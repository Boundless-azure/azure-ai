import { promises as fs } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { RunnerDbService } from '../../runner-db/services/runner-db.service';
import {
  APP_TAG_FILE,
  KEYWORD_DIMENSION_OTHER,
  canonicalDimension,
  type AppKeywordStore,
  type EnsureAppTagPayload,
  type EnsureManyPayload,
  type SearchAppTagsPayload,
} from '../types/app-tag.types';

/**
 * 归一化关键词做去重比较键 (裁剪 + 小写 + 折叠空白); 存储仍保留原词。
 * @keyword-cn 关键词归一, 去重键
 * @keyword-en normalize-keyword, dedupe-key
 */
function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * @title Runner App 关键词服务
 * @description 读写每个 app 目录顶层的 tags.json —— 一份**维度化关键词词表** (`{维度: [纯词]}`, 维度受限于
 *   工程向 4 维 + 其他)。按 appId 定位 app.location。ensure/ensureMany 走每 appId 串行化 read-modify-write,
 *   抗全并发写竞态; 维度经 canonicalDimension 归一、按 (维度, 归一化词) 去重。
 * @keyword-cn 关键词服务, 维度化, 并发原子
 * @keyword-en app-keyword-service, dimensioned, concurrent-atomic
 */
export class RunnerAppTagService {
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly runnerDb: RunnerDbService,
    private readonly workspacePath: string,
  ) {}

  /**
   * 读取某 app 的维度化关键词词表 (只读, 可并发)。
   * @keyword-cn 词表列出, 只读
   * @keyword-en list-keywords, read-only
   */
  async getList(appId: string): Promise<AppKeywordStore> {
    return this.readStore(await this.resolveTagsFile(appId));
  }

  /**
   * 幂等新增一个维度化关键词; 命中 (维度, 归一化词) 则不加。串行化抗并发。
   * @keyword-cn 确保关键词, 幂等去重
   * @keyword-en ensure-keyword, idempotent-dedupe
   */
  async ensure(
    payload: EnsureAppTagPayload,
  ): Promise<{ dimension: string; keyword: string; created: boolean }> {
    const dimension = canonicalDimension(payload.dimension);
    const keyword = payload.keyword.replace(/^@+/, '').trim();
    const { added } = await this.ensureMany({
      appId: payload.appId,
      entries: [{ dimension: payload.dimension, keyword: payload.keyword }],
    });
    return { dimension, keyword, created: added > 0 };
  }

  /**
   * 批量把维度化关键词同步进 tags.json: 逐条归一维度、按 (维度, 归一化词) 去重, 只加缺的。一次落盘。
   * @keyword-cn 批量确保, 关键词同步
   * @keyword-en ensure-many, keyword-sync
   */
  async ensureMany(
    payload: EnsureManyPayload,
  ): Promise<{ added: number; total: number }> {
    return this.withLock(payload.appId, async () => {
      const file = await this.resolveTagsFile(payload.appId);
      const store = await this.readStore(file);
      const seen: Record<string, Set<string>> = {};
      for (const [dim, list] of Object.entries(store)) {
        seen[dim] = new Set(list.map(normalizeKeyword));
      }
      let added = 0;
      for (const entry of payload.entries) {
        const keyword = entry.keyword.replace(/^@+/, '').trim();
        if (!keyword) continue;
        const dim = canonicalDimension(entry.dimension);
        const list = store[dim] ?? (store[dim] = []);
        const bucket = seen[dim] ?? (seen[dim] = new Set());
        const normalized = normalizeKeyword(keyword);
        if (bucket.has(normalized)) continue;
        bucket.add(normalized);
        list.push(keyword);
        added += 1;
      }
      if (added > 0) await this.writeStore(file, store);
      const total = Object.values(store).reduce((n, l) => n + l.length, 0);
      return { added, total };
    });
  }

  /**
   * 在某 app 词表内按 query 跨维度子串搜索, 回命中维度分组。
   * @keyword-cn 关键词搜索, 跨维度
   * @keyword-en search-keywords, cross-dimension
   */
  async search(payload: SearchAppTagsPayload): Promise<AppKeywordStore> {
    const store = await this.readStore(await this.resolveTagsFile(payload.appId));
    const query = (payload.query ?? '').trim().toLowerCase();
    if (!query) return store;
    const out: AppKeywordStore = {};
    for (const [dim, list] of Object.entries(store)) {
      const matched = list.filter((k) => k.toLowerCase().includes(query));
      if (matched.length > 0) out[dim] = matched;
    }
    return out;
  }

  /**
   * 由 appId 解析出该 app 目录顶层的 tags.json 绝对路径。
   * @keyword-cn 路径解析, app定位
   * @keyword-en resolve-path, app-locate
   */
  private async resolveTagsFile(appId: string): Promise<string> {
    const app = await this.runnerDb.findAppById(appId);
    if (!app) throw new Error(`app not found: ${appId}`);
    const location = app.location?.trim();
    if (!location) throw new Error(`app has no on-disk location: ${appId}`);
    const dir = isAbsolute(location)
      ? location
      : join(this.workspacePath, location);
    return join(dir, APP_TAG_FILE);
  }

  /**
   * 读 tags.json → 维度化词表; 缺文件回空; 兼容旧的扁平 string[] (归到 `其他`)。
   * @keyword-cn 读词表, 兼容旧格式
   * @keyword-en read-store, legacy-tolerant
   */
  private async readStore(file: string): Promise<AppKeywordStore> {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const terms = parsed.filter(
          (x): x is string => typeof x === 'string' && x.trim() !== '',
        );
        return terms.length > 0 ? { [KEYWORD_DIMENSION_OTHER]: terms } : {};
      }
      if (parsed && typeof parsed === 'object') {
        const store: AppKeywordStore = {};
        for (const [dim, list] of Object.entries(parsed)) {
          if (Array.isArray(list)) {
            store[dim] = list.filter(
              (x): x is string => typeof x === 'string' && x.trim() !== '',
            );
          }
        }
        return store;
      }
      return {};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw error;
    }
  }

  /**
   * 把维度化词表写回 tags.json (目录不存在则建)。
   * @keyword-cn 写词表, 落盘
   * @keyword-en write-store, persist
   */
  private async writeStore(file: string, store: AppKeywordStore): Promise<void> {
    await fs.mkdir(dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(store, null, 2), 'utf8');
  }

  /**
   * 每 appId 串行化: 后到的操作接在前一个之后, 保证 read-modify-write 原子。
   * @keyword-cn 并发锁, 串行化
   * @keyword-en concurrency-lock, serialize
   */
  private withLock<T>(appId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(appId) ?? Promise.resolve();
    const run = prev.then(
      () => fn(),
      () => fn(),
    );
    this.locks.set(
      appId,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }
}

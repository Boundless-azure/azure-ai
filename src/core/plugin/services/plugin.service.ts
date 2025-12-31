import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as os from 'os';
import { createHash } from 'crypto';
import { pathToFileURL } from 'url';
import { PluginEntity } from '../entities/plugin.entity';
import { PluginKeywordsService } from './plugin.keywords.service';
import type { Db, Collection } from 'mongodb';
import type { PluginDoc } from '../../../mongo/types/mongo.types';
import { PluginConfig, validatePluginConfig } from '../types';

@Injectable()
/**
 * 插件服务
 * - 提供插件的增删改查与注册（通过目录加载配置）
 * - 在注册过程中调用 AI 生成关键词并入库
 */
export class PluginService {
  private readonly logger = new Logger(PluginService.name);

  constructor(
    @InjectRepository(PluginEntity)
    private readonly repo: Repository<PluginEntity>,
    private readonly keywords: PluginKeywordsService,
    @Optional() @Inject('MONGO_DB') private readonly mongoDb?: Db,
  ) {}

  /**
   * 获取所有插件列表
   * @returns 插件实体数组（按 updatedAt 倒序）
   */
  async list(): Promise<PluginEntity[]> {
    if (this.useMongo()) {
      const col = this.pluginCollection();
      if (!col) return [];
      const docs = await col
        .find({ isDelete: { $ne: true } })
        .sort({ updatedAt: -1 })
        .limit(500)
        .toArray();
      return docs.map((d) => this.toEntity(d));
    }
    return this.repo.find({ order: { updatedAt: 'DESC' } });
  }

  /**
   * 根据 ID 获取插件
   * @param id 插件主键
   * @returns 找到则返回实体，否则返回 null
   */
  async get(id: string): Promise<PluginEntity | null> {
    if (this.useMongo()) {
      const col = this.pluginCollection();
      if (!col) return null;
      const doc = await col.findOne({ _id: id } as unknown as Record<
        string,
        unknown
      >);
      return doc ? this.toEntity(doc) : null;
    }
    return this.repo.findOne({ where: { id } });
  }

  /**
   * 删除插件
   * @param id 插件主键
   */
  async delete(id: string): Promise<void> {
    if (this.useMongo()) {
      const col = this.pluginCollection();
      if (!col) return;
      await col.updateOne({ _id: id } as unknown as Record<string, unknown>, {
        $set: { isDelete: true, updatedAt: new Date() },
      });
      return;
    }
    await this.repo.delete({ id });
  }

  /**
   * 录入插件：通过目录读取 plugin.conf.ts，生成关键词并入库（upsert by name+version）
   */
  async registerByDir(pluginDir: string): Promise<PluginEntity> {
    const conf = await this.loadConfig(pluginDir);
    validatePluginConfig(conf);
    const kw = await this.keywords.generateKeywords(conf);

    if (this.useMongo()) {
      const col = this.pluginCollection();
      if (!col) throw new Error('MongoDB not available');
      const now = new Date();
      const doc: PluginDoc = {
        name: conf.name,
        version: conf.version,
        description: conf.description,
        hooks: conf.hooks,
        keywordsZh: kw.zh.join(', '),
        keywordsEn: kw.en.join(', '),
        pluginDir,
        registered: true,
        updatedAt: now,
        createdAt: now,
        isDelete: false,
      };
      await col.updateOne(
        { name: doc.name, version: doc.version },
        { $set: doc },
        { upsert: true },
      );
      const saved = await col.findOne({ name: doc.name, version: doc.version });
      if (!saved) throw new Error('Plugin upsert failed');
      this.logger.log(`Registered plugin: ${conf.name}@${conf.version}`);
      return this.toEntity(saved);
    }

    const existing = await this.repo.findOne({
      where: { name: conf.name, version: conf.version },
    });

    const entityData: Partial<PluginEntity> = {
      name: conf.name,
      version: conf.version,
      description: conf.description,
      hooks: JSON.stringify(conf.hooks),
      keywordsZh: kw.zh.join(', '),
      keywordsEn: kw.en.join(', '),
      pluginDir,
      registered: true,
      updatedAt: new Date(),
    };

    if (existing) {
      const saved = await this.repo.save({ ...existing, ...entityData });
      this.logger.log(`Updated plugin: ${conf.name}@${conf.version}`);
      return saved;
    } else {
      const instance = Object.assign(new PluginEntity(), entityData);
      await this.repo.insert(instance);
      const created = await this.repo.findOne({
        where: { name: conf.name, version: conf.version },
      });
      if (!created) throw new Error('Plugin insert failed');
      this.logger.log(`Registered plugin: ${conf.name}@${conf.version}`);
      return created;
    }
  }

  /**
   * 更新插件的可变字段
   * @param id 插件主键
   * @param updates 需要更新的字段（局部）
   * @returns 更新后的实体
   */
  async update(
    id: string,
    updates: Partial<PluginEntity>,
  ): Promise<PluginEntity> {
    if (this.useMongo()) {
      const col = this.pluginCollection();
      if (!col) throw new Error('MongoDB not available');
      const patch: Record<string, unknown> = {
        ...updates,
        updatedAt: new Date(),
      };
      await col.updateOne({ _id: id } as unknown as Record<string, unknown>, {
        $set: patch,
      });
      const saved = await col.findOne({ _id: id } as unknown as Record<
        string,
        unknown
      >);
      if (!saved) throw new Error('Plugin update failed');
      return this.toEntity(saved);
    }
    const existing = await this.get(id);
    if (!existing) throw new Error(`Plugin not found: ${id}`);
    const saved = await this.repo.save({
      ...existing,
      ...updates,
      updatedAt: new Date(),
    });
    return saved;
  }

  /**
   * 从目录加载 plugin.conf.ts（TS 文件），使用 TypeScript 在运行时转译并以 data:URL 的方式动态导入
   * @param dir 插件目录（相对或绝对路径）
   * @returns 解析后的 PluginConfig
   * @throws 当找不到配置或导出不符合约定时抛出错误
   */
  private async loadConfig(dir: string): Promise<PluginConfig> {
    const confPathTs = path.isAbsolute(dir)
      ? path.join(dir, 'plugin.conf.ts')
      : path.join(process.cwd(), dir, 'plugin.conf.ts');
    if (!fs.existsSync(confPathTs)) {
      throw new Error(`plugin.conf.ts not found in ${dir}`);
    }
    const source = fs.readFileSync(confPathTs, 'utf-8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2019,
        // Use CommonJS to allow loading via require() in Jest/Node
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        skipLibCheck: true,
        isolatedModules: true,
      },
      reportDiagnostics: false,
    });

    const code = transpiled.outputText;
    // Write transpiled code to a temporary .cjs file to avoid Jest resolver issues with data: URLs
    const hash = createHash('sha1')
      .update(confPathTs + source)
      .digest('hex')
      .slice(0, 8);
    const tempFile = path.join(
      os.tmpdir(),
      `azureai-plugin-conf-${hash}-${Date.now()}.cjs`,
    );
    fs.writeFileSync(tempFile, code, 'utf-8');

    // Use dynamic import for better ESM/CJS interop and to satisfy eslint no-require-imports
    const mod: unknown = await import(pathToFileURL(tempFile).href);
    // Clean up temp file best-effort
    try {
      fs.unlinkSync(tempFile);
    } catch (e: unknown) {
      const msgVal = isObject(e) ? e['message'] : undefined;
      const msg = typeof msgVal === 'string' ? msgVal : String(e);
      this.logger.warn(`Failed to delete temp file ${tempFile}: ${msg}`);
    }

    let confUnknown: unknown;
    if (isObject(mod)) {
      const rec = mod;
      // Support both CommonJS default export and named export
      confUnknown = rec['default'] ?? rec['pluginConfig'] ?? mod;
    }
    if (!isPartialPluginConfig(confUnknown)) {
      throw new Error('plugin.conf.ts must export default PluginConfig');
    }
    validatePluginConfig(confUnknown);
    return confUnknown;
  }

  private useMongo(): boolean {
    return (process.env.MONGO_ENABLED ?? 'false') === 'true' && !!this.mongoDb;
  }

  private pluginCollection(): Collection<PluginDoc> | undefined {
    if (!this.mongoDb) return undefined;
    return this.mongoDb.collection<PluginDoc>('plugins');
  }

  private toEntity(doc: PluginDoc): PluginEntity {
    const e = new PluginEntity();
    (e as unknown as { id?: string }).id =
      doc._id ?? `${doc.name}:${doc.version}`;
    e.name = doc.name;
    e.version = doc.version;
    e.description = doc.description;
    e.hooks = JSON.stringify(doc.hooks);
    e.keywordsZh = doc.keywordsZh ?? null;
    e.keywordsEn = doc.keywordsEn ?? null;
    e.pluginDir = doc.pluginDir;
    e.registered = doc.registered;
    (e as unknown as { createdAt?: Date }).createdAt =
      doc.createdAt ?? new Date();
    (e as unknown as { updatedAt?: Date }).updatedAt =
      doc.updatedAt ?? new Date();
    (e as unknown as { isDelete?: boolean }).isDelete = doc.isDelete ?? false;
    return e;
  }
}

// 简单对象判定（顶层辅助函数）
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// 将 unknown 收窄为 Partial<PluginConfig>，便于传入 validatePluginConfig
function isPartialPluginConfig(v: unknown): v is Partial<PluginConfig> {
  return typeof v === 'object' && v !== null;
}

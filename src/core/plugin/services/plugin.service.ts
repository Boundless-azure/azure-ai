import { Injectable, Logger } from '@nestjs/common';
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
  ) {}

  /**
   * 获取所有插件列表
   * @returns 插件实体数组（按 updatedAt 倒序）
   */
  async list(): Promise<PluginEntity[]> {
    return this.repo.find({ order: { updatedAt: 'DESC' } });
  }

  /**
   * 根据 ID 获取插件
   * @param id 插件主键
   * @returns 找到则返回实体，否则返回 null
   */
  async get(id: string): Promise<PluginEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * 删除插件
   * @param id 插件主键
   */
  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  /**
   * 录入插件：通过目录读取 plugin.conf.ts，生成关键词并入库（upsert by name+version）
   */
  async registerByDir(pluginDir: string): Promise<PluginEntity> {
    const conf = await this.loadConfig(pluginDir);
    validatePluginConfig(conf);
    const kw = await this.keywords.generateKeywords(conf);

    // Upsert by name+version
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
      // 新增插件：使用 insert 让数据库通过 DEFAULT(UUID()) 生成主键
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
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.warn(`Failed to delete temp file ${tempFile}: ${e.message}`);
    }

    let confUnknown: unknown;
    if (mod && typeof mod === 'object') {
      const rec = mod as Record<string, unknown>;
      // Support both CommonJS default export and named export
      confUnknown = rec.default ?? rec.pluginConfig ?? mod;
    }
    if (!confUnknown || typeof confUnknown !== 'object') {
      throw new Error('plugin.conf.ts must export default PluginConfig');
    }
    return confUnknown as PluginConfig;
  }
}

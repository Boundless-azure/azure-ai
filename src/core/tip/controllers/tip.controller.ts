/**
 * Tip 控制器：提供基于 Tip 的检索、AST 索引与自动生成接口。
 *
 * 端点说明：
 * - GET /tip/search           按关键词检索（支持从 module.tip 的映射与内容模糊匹配）
 * - GET /tip/ast-index        构建指定目录（默认 src/core）的 AST 索引（类/方法/函数）
 * - GET /tip/diagnostics      汇总模块 tip 文档的诊断信息
 * - POST /tip/generate        基于 AST+AI 组合生成指定目录的 module.tip
 * - POST /tip/generate-ai     快速为 AI 模块生成 tip 文件
 * - POST /tip/generate-with-ai 使用指定/自动选择的 AI 模型生成完整 Tip 内容
 * - POST /tip/generate-all    为 base 目录下的所有子模块分别生成各自的 module.tip
 *
 * 使用建议：
 * - 在 IDE 中查看返回类型（TipSearchResult、TipIndex、TipDiagnostics、TipGenerateResult），便于自动提示。
 * - 若返回错误场景（缺少 dir 等），统一以 TipGenerateResult 的 error 字段呈现。
 */
import { Controller, Get, Post, Query, Body, Logger } from '@nestjs/common';
import { TipService } from '../services/tip.service';
import { TipGeneratorService } from '../services/tip.generator';
import type {
  TipGenerateOptions,
  TipGenerateResult,
  TipSearchResult,
  TipIndex,
  TipDiagnostics,
} from '../types';

@Controller('tip')
export class TipController {
  private readonly logger = new Logger(TipController.name);
  constructor(
    private readonly tipService: TipService,
    private readonly tipGenerator: TipGeneratorService,
  ) {}

  // GET /tip/search?keywords=AIModelService,chat
  @Get('search')
  search(
    @Query('keywords') keywords?: string,
    @Query('max') max?: string,
  ): TipSearchResult[] {
    /**
     * 将逗号分隔的关键词转换为字符串数组，并进行基础清洗（trim/去空）。
     * maxResults 默认 20，可通过查询参数覆盖。
     */
    const list = (keywords || '')
      .split(',')
      .map((k: string) => k.trim())
      .filter(Boolean);
    const maxResults = max ? parseInt(max, 10) || 20 : 20;
    return this.tipService.searchKeywords(list, maxResults);
  }

  // GET /tip/ast-index?dir=src/core/ai
  @Get('ast-index')
  astIndex(@Query('dir') dir?: string): TipIndex {
    /**
     * 构建指定目录的 AST 索引：提取类、方法、函数等符号与位置信息，
     * 结果可用于 IDE 内的快速导航与文档生成。
     */
    return this.tipService.buildAstIndex(dir);
  }

  // GET /tip/diagnostics
  @Get('diagnostics')
  diagnostics(): TipDiagnostics {
    /**
     * 读取所有 tip 文件并解析诊断段落，同时做基本内容检查（缺失章节、跨模块引用等）。
     */
    return this.tipService.collectDiagnostics();
  }

  // POST /tip/generate { dir: 'src/core/ai', writeToFile: true }
  @Post('generate')
  async generate(@Body() body: TipGenerateOptions): Promise<TipGenerateResult> {
    this.logger.log(
      `[HTTP] /tip/generate called with dir=${body?.dir ?? ''}, writeToFile=${body?.writeToFile}, aiModelId=${body?.aiModelId ?? ''}`,
    );
    if (!body?.dir) {
      // 统一返回 TipGenerateResult 结构，便于 IDE 类型推断与前端消费
      const err: TipGenerateResult = {
        outputPath: '',
        content: '',
        warnings: ['Missing field: dir'],
        error: 'Missing field: dir',
      };
      return err;
    }
    // 统一走 AST+AI 组合生成（根据可用模型自动合并），无需区分不同接口
    return await this.tipGenerator.generateModuleTip(body);
  }

  // POST /tip/generate-ai 用于快速为 AI 目录生成 tip 文件
  @Post('generate-ai')
  async generateAi(): Promise<TipGenerateResult> {
    /**
     * 为 AI 模块生成 tip 文件的便捷端点。
     * 默认写入到 src/core/ai/module.tip。
     */
    return await this.tipGenerator.generateModuleTip({
      dir: 'src/core/ai',
      writeToFile: true,
      outputFileName: 'module.tip',
    });
  }

  // POST /tip/generate-with-ai { dir: 'src/core/ai', aiModelId?: string, writeToFile?: true }
  // 通过 AIModelService 生成完整 Tip（目录结构、函数清单、文件说明、函数说明、关键词索引）
  @Post('generate-with-ai')
  async generateWithAI(
    @Body()
    body: TipGenerateOptions & { aiModelId?: string; systemPrompt?: string },
  ): Promise<TipGenerateResult> {
    this.logger.log(
      `[HTTP] /tip/generate-with-ai called with dir=${body?.dir ?? ''}, aiModelId=${body?.aiModelId ?? ''}, writeToFile=${body?.writeToFile}`,
    );
    console.log('controller message');
    if (!body?.dir) {
      // 统一返回 TipGenerateResult 结构，便于 IDE 类型推断与前端消费
      const err: TipGenerateResult = {
        outputPath: '',
        content: '',
        warnings: ['Missing field: dir'],
        error: 'Missing field: dir',
      };
      return err;
    }
    return await this.tipGenerator.generateModuleTipAI(body);
  }

  // POST /tip/generate-all { base: 'src/core', writeToFile: true }
  // 为 base 目录下的每个子模块分别生成各自的 module.tip，避免混在一起
  @Post('generate-all')
  async generateAll(
    @Body() body: { base?: string; writeToFile?: boolean },
  ): Promise<TipGenerateResult[]> {
    /**
     * 为 base 目录（默认 src/core）下每个子目录生成独立的 module.tip，
     * 通过 TipGeneratorService 的目录扫描与 AI 模块整合实现。
     */
    const base = body?.base ?? 'src/core';
    const writeToFile = body?.writeToFile !== false;
    return await this.tipGenerator.generateTipsForModules(base, writeToFile);
  }
}

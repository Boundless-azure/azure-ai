import { Controller, Get, Post, Query, Body, Logger } from '@nestjs/common';
import { TipService } from './tip.service';
import { TipGeneratorService } from './tip.generator';
import type { TipGenerateOptions } from './tip.types';

@Controller('tip')
export class TipController {
  private readonly logger = new Logger(TipController.name);
  constructor(
    private readonly tipService: TipService,
    private readonly tipGenerator: TipGeneratorService,
  ) {}

  // GET /tip/search?keywords=AIModelService,chat
  @Get('search')
  search(@Query('keywords') keywords?: string, @Query('max') max?: string) {
    const list = (keywords || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    const maxResults = max ? parseInt(max, 10) || 20 : 20;
    return this.tipService.searchKeywords(list, maxResults);
  }

  // GET /tip/ast-index?dir=src/core/ai
  @Get('ast-index')
  astIndex(@Query('dir') dir?: string) {
    return this.tipService.buildAstIndex(dir);
  }

  // GET /tip/diagnostics
  @Get('diagnostics')
  diagnostics() {
    return this.tipService.collectDiagnostics();
  }

  // POST /tip/generate { dir: 'src/core/ai', writeToFile: true }
  @Post('generate')
  async generate(@Body() body: TipGenerateOptions) {
    this.logger.log(
      `[HTTP] /tip/generate called with dir=${body?.dir ?? ''}, writeToFile=${body?.writeToFile}, aiModelId=${body?.aiModelId ?? ''}`,
    );
    if (!body?.dir) {
      return { error: 'Missing field: dir' };
    }
    // 统一走 AST+AI 组合生成（根据可用模型自动合并），无需区分不同接口
    return await this.tipGenerator.generateModuleTip(body);
  }

  // POST /tip/generate-ai 用于快速为 AI 目录生成 tip 文件
  @Post('generate-ai')
  async generateAi() {
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
  ) {
    this.logger.log(
      `[HTTP] /tip/generate-with-ai called with dir=${body?.dir ?? ''}, aiModelId=${body?.aiModelId ?? ''}, writeToFile=${body?.writeToFile}`,
    );
    console.log('controller message');
    if (!body?.dir) {
      return { error: 'Missing field: dir' };
    }
    return await this.tipGenerator.generateModuleTipAI(body);
  }

  // POST /tip/generate-all { base: 'src/core', writeToFile: true }
  // 为 base 目录下的每个子模块分别生成各自的 module.tip，避免混在一起
  @Post('generate-all')
  async generateAll(@Body() body: { base?: string; writeToFile?: boolean }) {
    const base = body?.base ?? 'src/core';
    const writeToFile = body?.writeToFile !== false;
    return await this.tipGenerator.generateTipsForModules(base, writeToFile);
  }
}

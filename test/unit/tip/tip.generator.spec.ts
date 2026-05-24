import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TipGeneratorService } from '../../../src/core/tip';
import type { TipGenerateResult } from '../../../src/core/tip';
import { AIModelService } from '../../../src/core/ai/services/ai-model.service';
import { AppModule } from '../../../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

describe('TipGeneratorService (real AI, no mocks)', () => {
  let moduleRef: TestingModule;
  let service: TipGeneratorService;
  let aiService: AIModelService;
  let modelId: string | undefined;
  jest.setTimeout(60000);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    service = moduleRef.get(TipGeneratorService);
    aiService = moduleRef.get(AIModelService);
    const enabled = await aiService.getEnabledModels();
    modelId = enabled[0]?.id;
    if (!modelId) {
      // 保持测试健壮性：若无可用模型，直接跳过（由环境决定）
      console.warn('No enabled AI models found. Tests may be skipped.');
    }
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should generate module tip with AST+AI combined and diagnostics', async () => {
    const projectTmpRoot = path.resolve(__dirname, '../tmp-tip-write');
    fs.mkdirSync(projectTmpRoot, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(projectTmpRoot, 'tipgen-'));
    const filePath = path.join(tmpDir, 'index.ts');
    fs.writeFileSync(
      filePath,
      `/**\n * @tip 用于测试生成tip\n * @doc 示例文档说明\n */\nexport function foo() { return 1; }\n`,
      'utf-8',
    );

    // 增加更多符合统一规则的示例代码（文件级、函数级、方法级 JSDoc 标签）
    const utilPath = path.join(tmpDir, 'util.ts');
    fs.writeFileSync(
      utilPath,
      `/**
 * @title 工具库
 * @desc 提供常用计算与格式化函数
 * @keywords-cn 工具库,计算,格式化
 * @keywords-en utils,calculate,format
 */
export function add(a: number, b: number) { return a + b; }
/**
 * @function add
 * @desc 两数相加
 * @keywords-cn 相加,加法
 * @keywords-en add,plus
 */
export class Greeter {
  /**
   * @method greet
   * @desc 生成问候语
   * @keywords-cn 问候,欢迎
   * @keywords-en greet,welcome
   */
  greet(name: string) { return 'Hello, ' + name; }
}
`,
      'utf-8',
    );

    const res: TipGenerateResult = await service.generateModuleTip({
      dir: tmpDir,
      writeToFile: false,
      aiIncludeCode: true,
      aiIncludeCommentsOnly: true,
      aiCommentTags: ['@tip', '@doc', '@purpose'],
      aiMaxCodeChars: 2000,
      aiModelId: modelId,
    });

    expect(res).toBeTruthy();
    expect(res.content).toContain('文件列表（File List）');
    expect(res.content).toContain('函数索引（Function Index）');
    expect(res.content).toContain('#problems_and_diagnostics');
  });

  it('generateModuleTipAI should append diagnostics using real AI', async () => {
    const projectTmpRoot = path.resolve(__dirname, '../tmp-tip-write');
    fs.mkdirSync(projectTmpRoot, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(projectTmpRoot, 'tipgen-'));
    const filePath = path.join(tmpDir, 'a.ts');
    fs.writeFileSync(
      filePath,
      `// @tip 仅注释测试\nexport const a = 1;\n`,
      'utf-8',
    );

    // 增加更多符合统一规则的示例文件，包含关键词与描述
    const extraPath = path.join(tmpDir, 'extra.ts');
    fs.writeFileSync(
      extraPath,
      `/**
 * @title 额外示例
 * @desc 验证 AI 生成时上下文中能包含关键词与函数说明
 * @keywords-cn 示例,验证
 * @keywords-en example,verify
 */
/**
 * @function mul
 * @desc 两数相乘
 * @keywords-cn 乘法
 * @keywords-en multiply
 */
export function mul(x: number, y: number) { return x * y; }
`,
      'utf-8',
    );

    const ok = await service.generateModuleTipAI({
      dir: tmpDir,
      writeToFile: false,
      outputFileName: 'module.tip',
      aiModelId: modelId,
      aiIncludeCode: true,
      aiIncludeCommentsOnly: true,
    });
    expect(ok.content).toContain('#problems_and_diagnostics');
  });

  it('should write module.tip to disk when writeToFile=true', async () => {
    const projectTmpRoot = path.resolve(__dirname, '../tmp-tip-write');
    fs.mkdirSync(projectTmpRoot, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(projectTmpRoot, 'tipgen-write-'));
    const filePath = path.join(tmpDir, 'b.ts');
    fs.writeFileSync(
      filePath,
      `/** @tip 写入测试 */\nexport const b = 2;\n`,
      'utf-8',
    );

    // 增加符合规则的文件，覆盖 @keywords-cn/@keywords-en/@method 等标签
    const complexPath = path.join(tmpDir, 'complex.ts');
    fs.writeFileSync(
      complexPath,
      `/**
 * @title 复杂示例
 * @desc 覆盖多标签解析以便统一规则测试
 * @keywords-cn 复杂,解析,规则
 * @keywords-en complex,parse,rule
 */
export class Calc {
  /**
   * @method sub
   * @desc 两数相减
   * @keywords-cn 减法
   * @keywords-en subtract
   */
  sub(a: number, b: number) { return a - b; }
}
`,
      'utf-8',
    );

    const res: TipGenerateResult = await service.generateModuleTip({
      dir: tmpDir,
      writeToFile: true,
      outputFileName: 'module.tip',
      aiIncludeCode: true,
      aiIncludeCommentsOnly: true,
      aiCommentTags: ['@tip', '@doc', '@purpose'],
      aiMaxCodeChars: 2000,
      aiModelId: modelId,
    });

    expect(res).toBeTruthy();
    const tipPath = path.join(tmpDir, 'module.tip');
    expect(fs.existsSync(tipPath)).toBe(true);
    const tipContent = fs.readFileSync(tipPath, 'utf-8');
    expect(tipContent).toContain('#problems_and_diagnostics');
  });
});

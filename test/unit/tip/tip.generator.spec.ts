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

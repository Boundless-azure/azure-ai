import { Test, TestingModule } from '@nestjs/testing';
import { TipGeneratorService } from '../src/core/tip/tip.generator';
import { TIP_OPTIONS } from '../src/core/tip/tip.tokens';
import type {
  TipModuleOptions,
  TipGenerateResult,
} from '../src/core/tip/tip.types';
import { AIModelService } from '../src/core/ai/services/ai-model.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('TipGeneratorService (Gemini test cases)', () => {
  let moduleRef: TestingModule;
  let service: TipGeneratorService;
  const mockAI: Partial<AIModelService> = {
    chat: jest.fn().mockResolvedValue({
      content:
        '# 文件说明\n- 示例文件说明\n# 函数说明\n- 示例函数说明\n# 关键词索引\n- foo',
      model: 'gemini-1.5-flash',
      responseTime: 10,
      requestId: 'req1',
    }),
    getEnabledModels: jest.fn().mockResolvedValue([{ id: 'gemini-1.5-flash' }]),
  };

  const tipOptions: TipModuleOptions = {
    excludePatterns: ['**/node_modules/**', '**/dist/**'],
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        TipGeneratorService,
        { provide: TIP_OPTIONS, useValue: tipOptions },
        { provide: AIModelService, useValue: mockAI },
      ],
    }).compile();
    service = moduleRef.get(TipGeneratorService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should generate module tip with AST+AI combined and diagnostics using Gemini', async () => {
    // create a temporary module directory with a simple ts file and @tip annotation
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tipgen-'));
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
    });

    expect(res).toBeTruthy();
    expect(res.content).toContain('文件列表（File List）');
    expect(res.content).toContain('函数索引（Function Index）');
    expect(res.content).toContain('#problems_and_diagnostics');
    expect((mockAI.chat as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    const calledModelId = (mockAI.chat as jest.Mock).mock.calls[0][0]?.modelId;
    expect(calledModelId).toBe('gemini-1.5-flash');
  });

  it('generateModuleTipAI should append diagnostics and fallback on AI error (Gemini)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tipgen-'));
    const filePath = path.join(tmpDir, 'a.ts');
    fs.writeFileSync(
      filePath,
      `// @tip 仅注释测试\nexport const a = 1;\n`,
      'utf-8',
    );

    // success path
    const ok = await service.generateModuleTipAI({
      dir: tmpDir,
      writeToFile: false,
      outputFileName: 'module.tip',
      aiModelId: 'gemini-1.5-flash',
      aiIncludeCode: true,
      aiIncludeCommentsOnly: true,
    });
    expect(ok.content).toContain('#problems_and_diagnostics');

    // failure path
    (mockAI.chat as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const fail = await service.generateModuleTipAI({
      dir: tmpDir,
      writeToFile: false,
      outputFileName: 'module.tip',
      aiModelId: 'gemini-1.5-flash',
      aiIncludeCode: true,
      aiIncludeCommentsOnly: true,
    });
    expect(fail.content).toContain('#problems_and_diagnostics');
    expect(fail.content).toContain('[error] AI 生成失败');
    expect(fail.error).toBeUndefined();
  });

  it('should write module.tip to disk when writeToFile=true (Gemini)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tipgen-write-'));
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
    });

    expect(res).toBeTruthy();
    const tipPath = path.join(tmpDir, 'module.tip');
    expect(fs.existsSync(tipPath)).toBe(true);
    const tipContent = fs.readFileSync(tipPath, 'utf-8');
    expect(tipContent).toContain('#problems_and_diagnostics');

    // ensure AI was invoked in combined generation
    expect((mockAI.chat as jest.Mock).mock.calls.length).toBeGreaterThan(0);

    // cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

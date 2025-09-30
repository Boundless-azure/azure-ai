import { Test, TestingModule } from '@nestjs/testing';
import { TipController } from '../src/core/tip/tip.controller';
import { TipService } from '../src/core/tip/tip.service';
import { TipGeneratorService } from '../src/core/tip/tip.generator';
import { TIP_OPTIONS } from '../src/core/tip/tip.tokens';
import type {
  TipModuleOptions,
  TipGenerateOptions,
  TipGenerateResult,
} from '../src/core/tip/tip.types';
import { AIModelService } from '../src/core/ai/services/ai-model.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('TipController (Gemini test cases)', () => {
  let moduleRef: TestingModule;
  let controller: TipController;

  const mockTipService: Partial<TipService> = {
    searchKeywords: jest.fn().mockReturnValue([]),
    // TipIndex requires { files: TipFileInfo[]; createdAt: Date }
    buildAstIndex: jest
      .fn()
      .mockReturnValue({ files: [], createdAt: new Date() }),
    // TipDiagnostics requires { problems: TipProblem[]; createdAt: Date }
    collectDiagnostics: jest
      .fn()
      .mockReturnValue({ problems: [], createdAt: new Date() }),
  };

  const mockAI: Partial<AIModelService> = {
    chat: jest.fn().mockResolvedValue({
      content:
        '# 文件说明\n- 控制器测试\n# 函数说明\n- generate\n# 关键词索引\n- tip',
      model: 'gemini-1.5-flash',
      responseTime: 15,
      requestId: 'req-ctrl',
    }),
    getEnabledModels: jest.fn().mockResolvedValue([{ id: 'gemini-1.5-flash' }]),
  };

  const tipOptions: TipModuleOptions = {
    excludePatterns: ['**/node_modules/**', '**/dist/**'],
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [TipController],
      providers: [
        { provide: TipService, useValue: mockTipService },
        TipGeneratorService,
        { provide: TIP_OPTIONS, useValue: tipOptions },
        { provide: AIModelService, useValue: mockAI },
      ],
    }).compile();
    controller = moduleRef.get(TipController);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('POST /tip/generate should return tip content with diagnostics (Gemini)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tip-ctrl-'));
    fs.writeFileSync(
      path.join(tmpDir, 'c.ts'),
      `/** @tip 控制器用例 */\nexport const c = 3;\n`,
      'utf-8',
    );

    const res = await controller.generate({
      dir: tmpDir,
      writeToFile: false,
      aiIncludeCode: true,
      aiIncludeCommentsOnly: true,
      // 扩展注释标签以提高 #problems_and_diagnostics 的上下文质量
      aiCommentTags: ['@tip', '@doc', '@purpose'],
      aiMaxCodeChars: 4000,
    });

    expect(res).toBeTruthy();
    // 类型缩窄：确保不是错误对象
    expect('error' in res).toBe(false);
    const tipRes = res as TipGenerateResult;
    expect(tipRes.content).toContain('文件列表（File List）');
    expect(tipRes.content).toContain('函数索引（Function Index）');
    expect(tipRes.content).toContain('#problems_and_diagnostics');
  });

  it('POST /tip/generate should return error for missing dir', async () => {
    // 使用 unknown 进行安全断言，避免 no-unsafe-argument
    const res = await controller.generate({} as unknown as TipGenerateOptions);
    expect(res).toEqual({ error: 'Missing field: dir' });
  });
  it('POST /tip/generate should write module.tip when writeToFile=true (Gemini)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tip-ctrl-write-'));
    fs.writeFileSync(
      path.join(tmpDir, 'd.ts'),
      `/** @tip 控制器写入测试 */\nexport const d = 4;\n`,
      'utf-8',
    );

    const res = await controller.generate({
      dir: tmpDir,
      writeToFile: true,
      aiIncludeCode: true,
      aiIncludeCommentsOnly: true,
      aiCommentTags: ['@tip', '@doc', '@purpose'],
      aiMaxCodeChars: 2000,
      outputFileName: 'module.tip',
    });

    expect('error' in res).toBe(false);
    const tipPath = path.join(tmpDir, 'module.tip');
    expect(fs.existsSync(tipPath)).toBe(true);
    const tipContent = fs.readFileSync(tipPath, 'utf-8');
    expect(tipContent).toContain('#problems_and_diagnostics');

    // cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

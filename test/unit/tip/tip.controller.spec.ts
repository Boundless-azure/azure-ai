import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TipController } from '../../../src/core/tip';
import type {
  TipGenerateOptions,
  TipGenerateResult,
} from '../../../src/core/tip';
import { AIModelService } from '../../../src/core/ai/services/ai-model.service';
import { AppModule } from '../../../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

describe('TipController (real AI, no mocks)', () => {
  let moduleRef: TestingModule;
  let controller: TipController;
  let aiService: AIModelService;
  let modelId: string | undefined;
  jest.setTimeout(60000);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    controller = moduleRef.get(TipController);
    aiService = moduleRef.get(AIModelService);
    const enabled = await aiService.getEnabledModels();
    modelId = enabled[0]?.id;
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('POST /tip/generate should return tip content with diagnostics', async () => {
    const projectTmpRoot = path.resolve(__dirname, '../tmp-tip-write');
    fs.mkdirSync(projectTmpRoot, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(projectTmpRoot, 'tip-ctrl-'));
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
      aiCommentTags: ['@tip', '@doc', '@purpose'],
      aiMaxCodeChars: 4000,
      aiModelId: modelId,
    });

    expect(res).toBeTruthy();
    expect('error' in res).toBe(false);
    const tipRes: TipGenerateResult = res;
    expect(tipRes.content).toContain('文件列表（File List）');
    expect(tipRes.content).toContain('函数索引（Function Index）');
    expect(tipRes.content).toContain('#problems_and_diagnostics');
  });

  it('POST /tip/generate should return error for missing dir', async () => {
    const res = await controller.generate({} as unknown as TipGenerateOptions);
    // After controller refactor, errors conform to TipGenerateResult shape
    // (may include additional fields like outputPath/content). Use partial match.
    expect(res).toMatchObject({ error: 'Missing field: dir' });
  });

  it('POST /tip/generate should write module.tip when writeToFile=true', async () => {
    const projectTmpRoot = path.resolve(__dirname, '../tmp-tip-write');
    fs.mkdirSync(projectTmpRoot, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(projectTmpRoot, 'tip-ctrl-write-'));
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
      aiModelId: modelId,
    });

    expect('error' in res).toBe(false);
    const tipPath = path.join(tmpDir, 'module.tip');
    expect(fs.existsSync(tipPath)).toBe(true);
    const tipContent = fs.readFileSync(tipPath, 'utf-8');
    expect(tipContent).toContain('#problems_and_diagnostics');
  });
});

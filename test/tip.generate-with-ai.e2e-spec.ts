import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Server as NetServer } from 'net';
import { AppModule } from './../src/app.module';
import { AIModelService } from '../src/core/ai/services/ai-model.service';
import * as fs from 'fs';
import * as path from 'path';

type SupertestRequestTarget = string | NetServer;

function isSupertestTarget(server: unknown): server is SupertestRequestTarget {
  return typeof server === 'string' || server instanceof NetServer;
}

function toSupertestTarget(server: unknown): SupertestRequestTarget {
  if (isSupertestTarget(server)) {
    return server;
  }
  throw new Error('Invalid server type passed to supertest request(...)');
}

describe('POST /tip/generate-with-ai (e2e, real AI, no mocks)', () => {
  let app: INestApplication;
  let aiService: AIModelService;
  let modelId: string | undefined;
  jest.setTimeout(60000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    aiService = app.get(AIModelService);
    const enabled = await aiService.getEnabledModels();
    modelId = enabled[0]?.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate tip content using DB-backed AI model (test temp dir)', async () => {
    // 使用测试目录，方便在本地查看生成的 module.tip
    const projectTmpRoot = path.resolve(__dirname, '../tmp-tip-write');
    fs.mkdirSync(projectTmpRoot, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(projectTmpRoot, 'tip-e2e-'));
    const filePath = path.join(tmpDir, 'sample.ts');
    fs.writeFileSync(
      filePath,
      `/** @tip e2e测试样例 */\nexport const x = 1;\n`,
      'utf-8',
    );

    const body = {
      dir: tmpDir,
      aiModelId: modelId,
      writeToFile: true,
      outputFileName: 'module.tip',
      aiIncludeCode: true,
      aiIncludeCommentsOnly: true,
      aiCommentTags: ['@tip', '@doc', '@purpose'],
      aiMaxCodeChars: 4000,
    };

    const res = await request(toSupertestTarget(app.getHttpServer()))
      .post('/tip/generate-with-ai')
      .send(body)
      .expect(201);

    expect(res.body).toBeTruthy();
    // 允许不同模型输出差异，但应包含诊断段落
    expect(typeof res.body.content).toBe('string');
    expect(res.body.content).toContain('#problems_and_diagnostics');

    // 验证生成文件便于查看
    const tipPath = path.join(tmpDir, 'module.tip');
    expect(fs.existsSync(tipPath)).toBe(true);
    const tipContent = fs.readFileSync(tipPath, 'utf-8');
    expect(tipContent).toContain('#problems_and_diagnostics');
  });
});

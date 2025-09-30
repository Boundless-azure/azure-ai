import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Server as NetServer } from 'net';
import { AppModule } from './../src/app.module';

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

describe('Tip diagnostics (e2e, #problems_and_diagnostics)', () => {
  let app: INestApplication;
  jest.setTimeout(30000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.skip('POST /tip/generate should include #problems_and_diagnostics in content', async () => {
    // 此用例在CI环境可能因外部依赖（数据库/模型初始化）而超时，标记为跳过。
    // 如需本地验证，可取消跳过，并确保数据库与模型配置就绪。
  });

  it('GET /tip/diagnostics should return problems array (scanning default root)', async () => {
    const res = await request(toSupertestTarget(app.getHttpServer()))
      .get('/tip/diagnostics')
      .expect(200);

    expect(res.body).toBeTruthy();
    expect(Array.isArray(res.body.problems)).toBe(true);
    // 允许为空，但类型必须正确
    if (res.body.problems.length > 0) {
      const p = res.body.problems[0];
      expect(typeof p.severity).toBe('string');
      expect(typeof p.message).toBe('string');
      expect(typeof p.filePath).toBe('string');
    }
  });
});

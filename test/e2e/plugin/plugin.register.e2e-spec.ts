import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PluginKeywordsService } from '../../../src/core/plugin/services/plugin.keywords.service';
import type { Server } from 'http';

describe('Plugin register (e2e, real DB)', () => {
  let app: INestApplication;
  let httpServer: Server;
  jest.setTimeout(60000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Avoid real AI dependency: override keywords generator to deterministic output
      .overrideProvider(PluginKeywordsService)
      .useValue({
        pickDefaultModelId: () => Promise.resolve('mock-model-id'),
        generateKeywords: () =>
          Promise.resolve({
            zh: ['客户', '注册', '订单'],
            en: ['customer', 'signup', 'order'],
          }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    // Cast http server to typed Server to satisfy eslint no-unsafe-argument
    httpServer = app.getHttpServer() as unknown as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /plugin/register should write plugin into DB and return entity', async () => {
    const body = { pluginDir: 'plugins/customer-analytics' };
    const res = await request(httpServer)
      .post('/plugin/register')
      .send(body)
      .expect(201);

    // Verify response entity
    expect(res.body).toBeTruthy();
    // 主键改为 UUID 字符串
    expect(typeof res.body.id).toBe('string');
    expect(res.body.registered).toBe(true);
    expect(res.body.name).toBe('customer-analytics');
    expect(res.body.version).toBe('1.0.0');
    expect(typeof res.body.hooks).toBe('string');
    expect((res.body.keywordsZh || '').length).toBeGreaterThan(0);
    expect((res.body.keywordsEn || '').length).toBeGreaterThan(0);

    // Verify it exists in DB via list endpoint
    const list = await request(httpServer).get('/plugin').expect(200);
    const found = (list.body as Array<any>).find(
      (p) => p.name === 'customer-analytics' && p.version === '1.0.0',
    );
    expect(found).toBeTruthy();
    expect(found.registered).toBe(true);
  });
});

import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PluginKeywordsService } from '../../../src/core/plugin/services/plugin.keywords.service';
import type { PluginConfig } from '../../../src/core/plugin/types';
import { AppModule } from '../../../src/app.module';

// Gate real-AI tests behind an env flag to avoid failures when API key/network
// is unavailable in CI or local environments. Set RUN_AI_TESTS=true to enable.
const RUN_AI_TESTS = process.env.RUN_AI_TESTS === 'true';

describe('PluginKeywordsService (real AI, no mocks)', () => {
  let moduleRef: TestingModule;
  let service: PluginKeywordsService;
  jest.setTimeout(60000);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    service = moduleRef.get(PluginKeywordsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  const conf: PluginConfig = {
    name: 'customer-analytics',
    version: '1.0.0',
    description: '用户生命周期分析，包括注册、资料更新与订单支付等事件',
    hooks: [
      {
        name: 'customer.created',
        payloadDescription: '用户完成注册后触发，包含用户基础信息与渠道来源',
      },
      {
        name: 'order.paid',
        payloadDescription: '订单支付成功后触发，包含订单号、金额与支付方式',
      },
    ],
  };

  it('pickDefaultModelId returns first enabled model id (DB-backed)', async () => {
    const id = await service.pickDefaultModelId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generateKeywords returns normalized keyword arrays using real AI', async () => {
    if (!RUN_AI_TESTS) {
      console.warn(
        'Skipping real AI test: set RUN_AI_TESTS=true to enable PluginKeywordsService.generateKeywords.',
      );
      return;
    }
    const res = await service.generateKeywords(conf);
    expect(Array.isArray(res.zh)).toBe(true);
    expect(Array.isArray(res.en)).toBe(true);
    // 允许不同模型输出差异，但应至少返回若干关键词
    expect(res.zh.length).toBeGreaterThanOrEqual(1);
    expect(res.en.length).toBeGreaterThanOrEqual(1);
  });
});

import { PluginService } from '../../../src/core/plugin/services/plugin.service';
import type { PluginConfig } from '../../../src/core/plugin/types';
import { PluginEntity } from '../../../src/core/plugin/entities/plugin.entity';
import type { Repository } from 'typeorm';
import type { PluginKeywordsService } from '../../../src/core/plugin/services/plugin.keywords.service';

type FindOneMock = jest.Mock<
  Promise<PluginEntity | null>,
  [{ where: { name?: string; version?: string; id?: string } }]
>;
type InsertMock = jest.Mock<Promise<unknown>, [PluginEntity]>;
interface PluginRepo {
  findOne: FindOneMock;
  insert: InsertMock;
}

type GenerateKeywordsMock = jest.Mock<
  Promise<{ zh: string[]; en: string[] }>,
  [PluginConfig]
>;
interface KeywordsGen {
  generateKeywords: GenerateKeywordsMock;
}

describe('PluginService', () => {
  const repo: PluginRepo = {
    findOne: jest.fn<
      ReturnType<FindOneMock>,
      Parameters<FindOneMock>
    >() as FindOneMock,
    insert: jest.fn<
      ReturnType<InsertMock>,
      Parameters<InsertMock>
    >() as InsertMock,
  };
  const keywords: KeywordsGen = {
    generateKeywords: jest.fn<
      ReturnType<GenerateKeywordsMock>,
      Parameters<GenerateKeywordsMock>
    >() as GenerateKeywordsMock,
  };

  const service = new PluginService(
    repo as unknown as Repository<PluginEntity>,
    keywords as unknown as PluginKeywordsService,
  );

  const config: PluginConfig = {
    name: 'customer-analytics',
    version: '1.0.0',
    description: '客户分析插件',
    hooks: [
      { name: 'customer.created', payloadDescription: '新用户注册完成后触发' },
      { name: 'order.paid', payloadDescription: '订单支付成功后触发' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registerByDir saves plugin with AI-generated keywords', async () => {
    // Mock private loadConfig to avoid data: URL import in Jest
    const spyLoad = jest.spyOn(
      service as unknown as {
        loadConfig: (dir: string) => Promise<PluginConfig>;
      },
      'loadConfig',
    );
    spyLoad.mockResolvedValue(config);

    // First call: check existing -> null, Second call: fetch created -> returns entity
    repo.findOne.mockResolvedValueOnce(null);
    keywords.generateKeywords.mockResolvedValue({
      zh: ['客户', '注册'],
      en: ['customer', 'signup'],
    });
    repo.insert.mockResolvedValue(Promise.resolve({}));

    const createdEntity = Object.assign(new PluginEntity(), {
      id: 'mock-id-uuid',
      name: config.name,
      version: config.version,
      description: config.description,
      hooks: JSON.stringify(config.hooks),
      keywordsZh: '客户, 注册',
      keywordsEn: 'customer, signup',
      pluginDir: 'plugins/customer-analytics',
      registered: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDelete: false,
      deletedAt: null,
    } as Partial<PluginEntity>);
    repo.findOne.mockResolvedValueOnce(createdEntity);

    const pluginDir = 'plugins/customer-analytics';
    const saved = await service.registerByDir(pluginDir);

    expect(repo.findOne).toHaveBeenCalled();
    expect(keywords.generateKeywords).toHaveBeenCalled();
    expect(repo.insert).toHaveBeenCalled();

    // Verify critical fields
    expect(saved.pluginDir).toBe(pluginDir);
    expect(saved.registered).toBe(true);
    expect(saved.name).toBe(config.name);
    expect(saved.version).toBe(config.version);
    expect(saved.description).toBe(config.description);
    // hooks stored as JSON string
    expect(typeof saved.hooks).toBe('string');
    const hooksObj = JSON.parse(saved.hooks);
    expect(Array.isArray(hooksObj)).toBe(true);
    expect(hooksObj[0].name).toBe('customer.created');
    // keywords stored as comma-separated string
    expect((saved.keywordsZh ?? '').includes('客户')).toBe(true);
    expect((saved.keywordsEn ?? '').includes('customer')).toBe(true);
  });
});

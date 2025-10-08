import { PluginService } from '../src/core/plugin/plugin.service';
import type { PluginConfig } from '../src/core/plugin/types';
import type { PluginEntity } from '../src/core/plugin/plugin.entity';
import type { Repository } from 'typeorm';
import type { PluginKeywordsService } from '../src/core/plugin/plugin.keywords.service';

type FindOneMock = jest.Mock<
  Promise<PluginEntity | null>,
  [{ where: { name?: string; version?: string; id?: number } }]
>;
type SaveMock = jest.Mock<Promise<PluginEntity>, [Partial<PluginEntity>]>;
interface PluginRepo {
  findOne: FindOneMock;
  save: SaveMock;
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
    save: jest.fn<ReturnType<SaveMock>, Parameters<SaveMock>>() as SaveMock,
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

    repo.findOne.mockResolvedValue(null);
    keywords.generateKeywords.mockResolvedValue({
      zh: ['客户', '注册'],
      en: ['customer', 'signup'],
    });
    repo.save.mockImplementation((entity: Partial<PluginEntity>) =>
      Promise.resolve({
        ...(entity as PluginEntity),
        id: (entity as PluginEntity).id ?? 1,
      }),
    );

    const pluginDir = 'plugins/customer-analytics';
    const saved = await service.registerByDir(pluginDir);

    expect(repo.findOne).toHaveBeenCalled();
    expect(keywords.generateKeywords).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();

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

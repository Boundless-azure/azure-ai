import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { SolutionEntity } from '../entities/solution.entity';
import { SolutionPurchaseEntity } from '../entities/solution-purchase.entity';
import {
  CreateSolutionRequest,
  UpdateSolutionRequest,
  ListSolutionsQuery,
  SolutionResponse,
  PaginatedSolutionsResponse,
  TagResponse,
  SolutionPurchaseResponse,
} from '../types/solution.types';
import {
  PluginStatus,
  SolutionSource,
  SolutionInclude,
} from '../enums/solution.enums';

/**
 * @title Solution Service
 * @description Solution 管理服务，提供 Solution CRUD、市场和分页功能
 * @keywords-cn Solution服务, Solution管理, Solution市场, 分页
 * @keywords-en solution-service, solution-management, solution-marketplace, pagination
 */
@Injectable()
export class SolutionService {
  constructor(
    @InjectRepository(SolutionEntity)
    private readonly solutionRepo: Repository<SolutionEntity>,
    @InjectRepository(SolutionPurchaseEntity)
    private readonly purchaseRepo: Repository<SolutionPurchaseEntity>,
  ) {}

  // Mock data for development
  private readonly mockSolutions: SolutionResponse[] = [
    {
      id: 'mock-solution-1',
      runnerIds: ['runner-1', 'runner-2'],
      tenantId: 'tenant-1',
      name: '天气查询解决方案',
      version: '1.0.0',
      summary: '实时查询全球天气信息，支持温度、湿度、风速等',
      description: '一款强大的天气查询解决方案，可以实时获取全球各地的天气信息',
      iconUrl: 'https://api.iconify.design/mdi:weather-partly-cloudy.svg',
      tags: ['工具', '生活服务'],
      authorName: '系统内置',
      authorId: 'system',
      markdownContent: '# 天气查询解决方案\n\n支持全球天气查询...',
      pluginDir: null,
      installCount: 1250,
      rating: 4.8,
      status: PluginStatus.ACTIVE,
      isPublished: true,
      isInstalled: true,
      source: SolutionSource.SELF_DEVELOPED,
      location: '/runner/solutions/weather-query',
      images: ['https://example.com/weather-1.png'],
      includes: [SolutionInclude.APP, SolutionInclude.UNIT],
      createdAt: new Date('2025-01-15'),
      updatedAt: new Date('2025-03-10'),
    },
    {
      id: 'mock-solution-2',
      runnerIds: ['runner-1'],
      tenantId: 'tenant-1',
      name: 'PDF 转换解决方案',
      version: '1.2.0',
      summary: '支持 Word、Excel、图片转 PDF 格式',
      description: '强大的文档格式转换工具',
      iconUrl: 'https://api.iconify.design/mdi:file-pdf-box.svg',
      tags: ['工具', '文档处理'],
      authorName: '系统内置',
      authorId: 'system',
      markdownContent: '# PDF 转换解决方案\n\n支持多种格式转换...',
      pluginDir: null,
      installCount: 890,
      rating: 4.5,
      status: PluginStatus.ACTIVE,
      isPublished: true,
      isInstalled: true,
      source: SolutionSource.MARKETPLACE,
      location: '/runner/solutions/pdf-converter',
      images: ['https://example.com/pdf-1.png'],
      includes: [SolutionInclude.APP, SolutionInclude.WORKFLOW],
      createdAt: new Date('2025-02-01'),
      updatedAt: new Date('2025-03-05'),
    },
    {
      id: 'mock-solution-3',
      runnerIds: [],
      tenantId: null,
      name: '翻译助手解决方案',
      version: '2.1.0',
      summary: '支持 100+ 语言互译，精准快速',
      description: '基于 AI 的智能翻译工具',
      iconUrl: 'https://api.iconify.design/mdi:translate.svg',
      tags: ['工具', '语言处理'],
      authorName: '第三方开发者',
      authorId: 'dev-001',
      markdownContent: '# 翻译助手解决方案\n\n支持多语言翻译...',
      pluginDir: null,
      installCount: 2100,
      rating: 4.9,
      status: PluginStatus.ACTIVE,
      isPublished: true,
      isInstalled: false,
      source: SolutionSource.MARKETPLACE,
      location: null,
      images: null,
      includes: [
        SolutionInclude.APP,
        SolutionInclude.UNIT,
        SolutionInclude.AGENT,
      ],
      createdAt: new Date('2025-01-20'),
      updatedAt: new Date('2025-03-15'),
    },
    {
      id: 'mock-solution-4',
      runnerIds: [],
      tenantId: null,
      name: '数据分析解决方案',
      version: '1.0.0',
      summary: 'Excel/CSV 数据可视化与分析',
      description: '智能数据分析工具',
      iconUrl: 'https://api.iconify.design/mdi:chart-bar.svg',
      tags: ['数据处理', '可视化'],
      authorName: '系统内置',
      authorId: 'system',
      markdownContent: '# 数据分析解决方案\n\n支持多种数据格式...',
      pluginDir: null,
      installCount: 560,
      rating: 4.3,
      status: PluginStatus.ACTIVE,
      isPublished: true,
      isInstalled: false,
      source: SolutionSource.SELF_DEVELOPED,
      location: null,
      images: null,
      includes: [SolutionInclude.APP, SolutionInclude.AGENT],
      createdAt: new Date('2025-02-10'),
      updatedAt: new Date('2025-03-01'),
    },
  ];

  // Mock runners for development
  private readonly mockRunners = [
    { id: 'runner-1', alias: 'Runner 北京节点', status: 'online' },
    { id: 'runner-2', alias: 'Runner 上海节点', status: 'online' },
    { id: 'runner-3', alias: 'Runner 广州节点', status: 'online' },
    { id: 'runner-4', alias: 'Runner 深圳节点', status: 'offline' },
  ];

  private readonly mockTags: TagResponse[] = [
    { tag: '工具', count: 3 },
    { tag: '效率', count: 2 },
    { tag: '生活服务', count: 1 },
    { tag: '文档处理', count: 1 },
    { tag: '语言处理', count: 1 },
    { tag: '数据处理', count: 1 },
    { tag: '可视化', count: 1 },
  ];

  /**
   * @title 创建 Solution
   * @description 创建新 Solution
   * @param userId 用户 ID
   * @param data 创建数据
   */
  async create(
    userId: string,
    data: CreateSolutionRequest,
  ): Promise<SolutionEntity> {
    const solution = this.solutionRepo.create({
      id: uuidv7(),
      runnerIds: data.runnerIds ?? null,
      tenantId: null,
      name: data.name,
      version: data.version,
      summary: data.summary ?? null,
      description: data.description ?? null,
      iconUrl: data.iconUrl ?? null,
      tags: data.tags ?? null,
      authorName: data.authorName ?? null,
      authorId: userId,
      markdownContent: data.markdownContent ?? null,
      pluginDir: data.pluginDir ?? null,
      installCount: 0,
      rating: 0,
      status: PluginStatus.ACTIVE,
      isPublished: data.isPublished ?? false,
      isInstalled: false,
      source: data.source ?? SolutionSource.SELF_DEVELOPED,
      location: data.location ?? null,
      images: data.images ?? null,
      includes: data.includes ?? null,
      createdUser: userId,
      updateUser: userId,
      channelId: userId,
    });

    return await this.solutionRepo.save(solution);
  }

  /**
   * @title 获取 Solution 详情
   * @description 根据 ID 获取 Solution 详情
   * @param id Solution ID
   */
  async getById(id: string): Promise<SolutionEntity> {
    const solution = await this.solutionRepo.findOne({
      where: { id, isDelete: false },
    });
    if (!solution) {
      throw new NotFoundException('Solution not found');
    }
    return solution;
  }

  /**
   * @title 更新 Solution
   * @description 更新 Solution 信息
   * @param id Solution ID
   * @param userId 用户 ID
   * @param data 更新数据
   */
  async update(
    id: string,
    userId: string,
    data: UpdateSolutionRequest,
  ): Promise<SolutionEntity> {
    const solution = await this.getById(id);

    if (data.summary !== undefined) solution.summary = data.summary;
    if (data.description !== undefined) solution.description = data.description;
    if (data.iconUrl !== undefined) solution.iconUrl = data.iconUrl;
    if (data.tags !== undefined) solution.tags = data.tags;
    if (data.markdownContent !== undefined)
      solution.markdownContent = data.markdownContent;
    if (data.status !== undefined) solution.status = data.status;
    if (data.isPublished !== undefined) solution.isPublished = data.isPublished;
    if (data.source !== undefined) solution.source = data.source;
    if (data.location !== undefined) solution.location = data.location;
    if (data.images !== undefined) solution.images = data.images;
    if (data.includes !== undefined) solution.includes = data.includes;

    solution.updateUser = userId;
    return await this.solutionRepo.save(solution);
  }

  /**
   * @title 删除 Solution
   * @description 软删除 Solution
   * @param id Solution ID
   */
  async delete(id: string): Promise<void> {
    const solution = await this.getById(id);
    solution.isDelete = true;
    solution.deletedAt = new Date();
    await this.solutionRepo.save(solution);
  }

  /**
   * @title 列出 Solution
   * @description 分页查询 Solution 列表
   * @param query 查询参数
   */
  list(query: ListSolutionsQuery): PaginatedSolutionsResponse {
    const { page, pageSize, tag, q, isInstalled, source, runnerId } = query;
    const skip = (page - 1) * pageSize;

    let filteredSolutions = [...this.mockSolutions];

    // Filter by isInstalled
    if (isInstalled !== undefined) {
      filteredSolutions = filteredSolutions.filter(
        (s) => s.isInstalled === isInstalled,
      );
    }

    // Filter by source
    if (source !== undefined) {
      filteredSolutions = filteredSolutions.filter((s) => s.source === source);
    }

    // Filter by runnerId
    if (runnerId !== undefined) {
      filteredSolutions = filteredSolutions.filter((s) =>
        s.runnerIds.includes(runnerId),
      );
    }

    // Filter by tag
    if (tag) {
      filteredSolutions = filteredSolutions.filter((s) =>
        s.tags?.includes(tag),
      );
    }

    // Filter by search query
    if (q) {
      const lowerQ = q.toLowerCase();
      filteredSolutions = filteredSolutions.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQ) ||
          s.summary?.toLowerCase().includes(lowerQ) ||
          s.description?.toLowerCase().includes(lowerQ),
      );
    }

    const total = filteredSolutions.length;
    const paginatedSolutions = filteredSolutions.slice(skip, skip + pageSize);

    return {
      items: paginatedSolutions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * @title 列出市场 Solution
   * @description 分页查询已发布的 Solution 列表
   * @param query 查询参数
   */
  listMarketplace(query: ListSolutionsQuery): PaginatedSolutionsResponse {
    const { page, pageSize, tag, q, source } = query;
    const skip = (page - 1) * pageSize;

    let filteredSolutions = this.mockSolutions.filter((s) => s.isPublished);

    // Filter by source
    if (source !== undefined) {
      filteredSolutions = filteredSolutions.filter((s) => s.source === source);
    }

    // Filter by tag
    if (tag) {
      filteredSolutions = filteredSolutions.filter((s) =>
        s.tags?.includes(tag),
      );
    }

    // Filter by search query
    if (q) {
      const lowerQ = q.toLowerCase();
      filteredSolutions = filteredSolutions.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQ) ||
          s.summary?.toLowerCase().includes(lowerQ) ||
          s.description?.toLowerCase().includes(lowerQ),
      );
    }

    const total = filteredSolutions.length;
    const paginatedSolutions = filteredSolutions.slice(skip, skip + pageSize);

    return {
      items: paginatedSolutions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * @title 安装 Solution
   * @description 将市场 Solution 安装到指定 Runner 列表
   * @param id Solution ID
   * @param runnerIds Runner ID 列表
   * @param userId 用户 ID
   */
  install(id: string, runnerIds: string[], _userId: string): SolutionResponse {
    const solution = this.mockSolutions.find((s) => s.id === id);
    if (!solution) {
      throw new NotFoundException('Solution not found');
    }

    // Add new runnerIds that are not already installed
    const existingRunnerIds = new Set(solution.runnerIds);
    const newRunnerIds = runnerIds.filter((r) => !existingRunnerIds.has(r));
    solution.runnerIds = [...solution.runnerIds, ...newRunnerIds];
    solution.isInstalled = solution.runnerIds.length > 0;
    solution.installCount += newRunnerIds.length;

    return solution;
  }

  /**
   * @title 卸载 Solution
   * @description 从指定 Runner 列表卸载 Solution
   * @param id Solution ID
   * @param runnerIds Runner ID 列表
   * @param userId 用户 ID
   */
  uninstall(
    id: string,
    runnerIds: string[],
    _userId: string,
  ): SolutionResponse {
    const solution = this.mockSolutions.find((s) => s.id === id);
    if (!solution) {
      throw new NotFoundException('Solution not found');
    }

    // Remove specified runnerIds
    const removeSet = new Set(runnerIds);
    solution.runnerIds = solution.runnerIds.filter((r) => !removeSet.has(r));
    solution.isInstalled = solution.runnerIds.length > 0;

    return solution;
  }

  /**
   * @title 获取所有标签
   * @description 获取所有已发布 Solution 的标签及数量
   */
  getTags(): TagResponse[] {
    return this.mockTags;
  }

  /**
   * @title 获取所有 Runner
   * @description 获取所有可用的 Runner 列表
   */
  getRunners(): { id: string; alias: string; status: string }[] {
    return this.mockRunners;
  }

  /**
   * @title 获取购买记录
   * @description 获取当前用户的购买记录
   * @param userId 用户 ID
   */
  getPurchases(userId: string): SolutionPurchaseResponse[] {
    // Mock purchase data
    const mockPurchases: SolutionPurchaseResponse[] = [
      {
        id: 'purchase-1',
        userId,
        solutionId: 'mock-solution-1',
        solutionName: '天气查询解决方案',
        solutionVersion: '1.0.0',
        runnerId: 'runner-1',
        purchasedAt: new Date('2025-03-01'),
        createdAt: new Date('2025-03-01'),
      },
      {
        id: 'purchase-2',
        userId,
        solutionId: 'mock-solution-2',
        solutionName: 'PDF 转换解决方案',
        solutionVersion: '1.2.0',
        runnerId: null,
        purchasedAt: new Date('2025-03-05'),
        createdAt: new Date('2025-03-05'),
      },
    ];
    return mockPurchases;
  }

  /**
   * @title 购买 Solution
   * @description 记录用户购买 Solution
   * @param userId 用户 ID
   * @param solutionId Solution ID
   * @param solutionName Solution 名称
   * @param solutionVersion Solution 版本
   */
  async purchase(
    userId: string,
    solutionId: string,
    solutionName: string,
    solutionVersion: string,
  ): Promise<SolutionPurchaseEntity> {
    const purchase = this.purchaseRepo.create({
      id: uuidv7(),
      userId,
      solutionId,
      solutionName,
      solutionVersion,
      runnerId: null,
      source: SolutionSource.MARKETPLACE,
      purchasedAt: new Date(),
      createdUser: userId,
      updateUser: userId,
      channelId: userId,
    });

    return await this.purchaseRepo.save(purchase);
  }

  private toResponse(entity: SolutionEntity): SolutionResponse {
    return {
      id: entity.id,
      runnerIds: entity.runnerIds || [],
      tenantId: entity.tenantId,
      name: entity.name,
      version: entity.version,
      summary: entity.summary,
      description: entity.description,
      iconUrl: entity.iconUrl,
      tags: entity.tags,
      authorName: entity.authorName,
      authorId: entity.authorId,
      markdownContent: entity.markdownContent,
      pluginDir: entity.pluginDir,
      installCount: entity.installCount,
      rating: entity.rating,
      status: entity.status,
      isPublished: entity.isPublished,
      isInstalled: entity.isInstalled,
      source: entity.source,
      location: entity.location,
      images: entity.images,
      includes: entity.includes,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

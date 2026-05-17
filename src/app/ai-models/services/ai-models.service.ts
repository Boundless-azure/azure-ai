import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { AIModelEntity } from '../entities/ai-model.entity';
import { AIModelApiSpec, AIModelStatus } from '@core/ai/types';
import type {
  CreateAiModelDto,
  QueryAiModelDto,
  TestAiModelConnectionDto,
  UpdateAiModelDto,
} from '../types/ai-models.types';

/**
 * @title AI模型管理服务
 * @description 提供 AI 模型配置的增删改查能力。
 * @keywords-cn AI模型服务, 模型管理, 配置管理
 * @keywords-en ai-model-service, model-management, config
 */
@Injectable()
export class AiModelsService {
  constructor(
    @InjectRepository(AIModelEntity)
    private readonly repository: Repository<AIModelEntity>,
  ) {}

  /**
   * 查询 AI 模型配置列表。
   * @keyword-en ai-model-list
   */
  async list(query: QueryAiModelDto): Promise<AIModelEntity[]> {
    const base = {
      isDelete: false,
    } as const;

    const where = {
      ...base,
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.enabled !== undefined ? { enabled: query.enabled } : {}),
    };

    if (query.q && query.q.trim()) {
      const q = query.q.trim();
      return await this.repository.find({
        where: [
          { ...where, name: Like(`%${q}%`) },
          { ...where, displayName: Like(`%${q}%`) },
        ],
        order: { updatedAt: 'DESC' },
      });
    }

    return await this.repository.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * 获取单个 AI 模型配置。
   * @keyword-en ai-model-detail
   */
  async get(id: string): Promise<AIModelEntity> {
    const entity = await this.repository.findOne({
      where: { id, isDelete: false },
    });
    if (!entity) throw new NotFoundException('ai model not found');
    return entity;
  }

  /**
   * 创建 AI 模型配置。
   * @keyword-en ai-model-create
   */
  async create(dto: CreateAiModelDto): Promise<AIModelEntity> {
    const entity = this.repository.create({
      name: dto.name,
      displayName: dto.displayName,
      provider: dto.provider,
      apiProtocol: dto.apiProtocol ?? AIModelApiSpec.OPENAI,
      type: dto.type,
      status: dto.status ?? AIModelStatus.ACTIVE,
      apiKey: dto.apiKey,
      baseURL: dto.baseURL,
      azureConfig: dto.azureConfig,
      defaultParams: dto.defaultParams,
      description: dto.description,
      enabled: dto.enabled ?? true,
      thinkingEnabled: dto.thinkingEnabled ?? false,
    });
    return await this.repository.save(entity);
  }

  /**
   * 更新 AI 模型配置。
   * @keyword-en ai-model-update
   */
  async update(id: string, dto: UpdateAiModelDto): Promise<void> {
    const entity = await this.get(id);
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.displayName !== undefined) entity.displayName = dto.displayName;
    if (dto.provider !== undefined) entity.provider = dto.provider;
    if (dto.apiProtocol !== undefined) entity.apiProtocol = dto.apiProtocol;
    if (dto.type !== undefined) entity.type = dto.type;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.apiKey !== undefined && dto.apiKey.trim()) {
      entity.apiKey = dto.apiKey;
    }
    if (dto.baseURL !== undefined) entity.baseURL = dto.baseURL;
    if (dto.azureConfig !== undefined) entity.azureConfig = dto.azureConfig;
    if (dto.defaultParams !== undefined)
      entity.defaultParams = dto.defaultParams;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.enabled !== undefined) entity.enabled = dto.enabled;
    if (dto.thinkingEnabled !== undefined)
      entity.thinkingEnabled = dto.thinkingEnabled;
    await this.repository.save(entity);
  }

  /**
   * 软删除 AI 模型配置。
   * @keyword-en ai-model-remove
   */
  async remove(id: string): Promise<void> {
    const entity = await this.get(id);
    entity.isDelete = true;
    entity.deletedAt = new Date();
    await this.repository.save(entity);
  }

  /**
   * 测试模型 API 密钥、模型ID与 endpoint 是否可用。
   * @keyword-en ai-model-connection-test
   */
  async testConnection(dto: TestAiModelConnectionDto): Promise<{
    ok: boolean;
    message: string;
    provider: string;
    modelId: string;
  }> {
    try {
      const provider = dto.provider.trim().toLowerCase();
      const modelId = dto.modelId.trim();
      const apiProtocol = dto.apiProtocol ?? AIModelApiSpec.OPENAI;
      const apiKey = dto.apiKey.trim();
      const baseURL = dto.baseURL?.trim();

      if (!apiKey || !modelId) {
        return {
          ok: false,
          message: 'apiKey or modelId is empty',
          provider,
          modelId,
        };
      }

      if (apiProtocol === AIModelApiSpec.ANTHROPIC) {
        const ok = await this.testAnthropicConnection({
          apiKey,
          modelId,
          baseURL,
        });
        return {
          ok: ok.ok,
          message: ok.message,
          provider,
          modelId,
        };
      }

      const ok = await this.testOpenAIConnection({
        provider,
        apiKey,
        modelId,
        baseURL,
      });
      return {
        ok: ok.ok,
        message: ok.message,
        provider,
        modelId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'test failed';
      return {
        ok: false,
        message,
        provider: dto.provider,
        modelId: dto.modelId,
      };
    }
  }

  /**
   * 使用 OpenAI 兼容接口发送最小聊天请求。
   * @keyword-en openai-compatible-connection-test
   */
  private async testOpenAIConnection(params: {
    provider: string;
    apiKey: string;
    modelId: string;
    baseURL?: string;
  }): Promise<{ ok: boolean; message: string }> {
    const baseURL = this.resolveOpenAIBaseURL(params.provider, params.baseURL);
    const endpoint = baseURL.endsWith('/v1')
      ? `${baseURL}/chat/completions`
      : `${baseURL}/v1/chat/completions`;
    const body: Record<string, unknown> = {
      model: params.modelId,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    };
    if (params.provider !== 'kimi') {
      body.temperature = 0;
    } else {
      body.thinking = { type: 'disabled' };
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true, message: 'connection success' };
    const text = await res.text();
    return {
      ok: false,
      message: `connection failed(${res.status}): ${text || 'unknown error'}`,
    };
  }

  /**
   * 使用 Anthropic Messages 接口发送最小聊天请求。
   * @keyword-en anthropic-connection-test
   */
  private async testAnthropicConnection(params: {
    apiKey: string;
    modelId: string;
    baseURL?: string;
  }): Promise<{ ok: boolean; message: string }> {
    const baseURL = params.baseURL?.trim() || 'https://api.anthropic.com';
    const endpoint = baseURL.endsWith('/v1')
      ? `${baseURL}/messages`
      : `${baseURL}/v1/messages`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.modelId,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    if (res.ok) return { ok: true, message: 'connection success' };
    const text = await res.text();
    return {
      ok: false,
      message: `connection failed(${res.status}): ${text || 'unknown error'}`,
    };
  }

  /**
   * 解析 OpenAI 兼容 provider 的默认 baseURL。
   * @keyword-en openai-compatible-base-url
   */
  private resolveOpenAIBaseURL(provider: string, baseURL?: string): string {
    if (baseURL && baseURL.trim()) return baseURL.trim();
    if (provider === 'deepseek') return 'https://api.deepseek.com';
    if (provider === 'kimi') return 'https://api.moonshot.cn/v1';
    if (provider === 'nvidia') return 'https://integrate.api.nvidia.com/v1';
    if (provider === 'azure_openai') return 'https://api.openai.com';
    return 'https://api.openai.com';
  }
}

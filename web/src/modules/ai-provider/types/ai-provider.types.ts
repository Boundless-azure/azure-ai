import { z } from 'zod';

/**
 * @title AI模型类型
 * @description AI提供商管理页面使用的模型类型定义。
 * @keywords-cn AI模型类型, 提供商模型
 * @keywords-en ai-model-types, provider-model
 */
export interface AiModelItem {
  id: string;
  name: string;
  displayName?: string | null;
  provider: string;
  apiProtocol: string;
  type: string;
  status: string;
  apiKey: string;
  baseURL?: string | null;
  azureConfig?: Record<string, unknown> | null;
  defaultParams?: Record<string, unknown> | null;
  description?: string | null;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TestAiModelConnectionRequest {
  provider: string;
  apiProtocol?: 'openai' | 'anthropic';
  apiKey: string;
  baseURL?: string | null;
  modelId: string;
}

export interface TestAiModelConnectionResult {
  ok: boolean;
  message: string;
  provider: string;
  modelId: string;
}

export const QueryAiModelSchema = z.object({
  q: z.string().optional(),
  provider: z.string().min(1).optional(),
  type: z.enum(['chat', 'completion', 'embedding']).optional(),
  status: z
    .enum(['active', 'inactive', 'deprecated', 'maintenance'])
    .optional(),
  enabled: z.boolean().optional(),
});

export const CreateAiModelSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().optional().nullable(),
  provider: z.string().min(1),
  apiProtocol: z.enum(['openai', 'anthropic']).optional(),
  type: z.enum(['chat', 'completion', 'embedding']),
  status: z.enum(['active', 'inactive', 'deprecated', 'maintenance']).optional(),
  apiKey: z.string().min(1),
  baseURL: z.string().optional().nullable(),
  azureConfig: z.record(z.any()).optional().nullable(),
  defaultParams: z.record(z.any()).optional().nullable(),
  description: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

export const UpdateAiModelSchema = z.object({
  name: z.string().optional(),
  displayName: z.string().optional().nullable(),
  provider: z.string().min(1).optional(),
  apiProtocol: z.enum(['openai', 'anthropic']).optional(),
  type: z.enum(['chat', 'completion', 'embedding']).optional(),
  status: z.enum(['active', 'inactive', 'deprecated', 'maintenance']).optional(),
  apiKey: z.string().optional(),
  baseURL: z.string().optional().nullable(),
  azureConfig: z.record(z.any()).optional().nullable(),
  defaultParams: z.record(z.any()).optional().nullable(),
  description: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

export const TestAiModelConnectionSchema = z.object({
  provider: z.string().min(1),
  apiProtocol: z.enum(['openai', 'anthropic']).optional(),
  apiKey: z.string().min(1),
  baseURL: z.string().optional().nullable(),
  modelId: z.string().min(1),
});

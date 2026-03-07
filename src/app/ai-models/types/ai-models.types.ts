import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { AIModelApiSpec, AIModelStatus, AIModelType } from '@core/ai/types';
import type { AzureOpenAIConfig, ModelParameters } from '@core/ai/types';

/**
 * @title AI模型查询参数
 * @description AI模型列表筛选条件。
 * @keywords-cn AI模型查询, 筛选, 列表
 * @keywords-en ai-model-query, filter, list
 */
export class QueryAiModelDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsEnum(AIModelType)
  type?: AIModelType;

  @IsOptional()
  @IsEnum(AIModelStatus)
  status?: AIModelStatus;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/**
 * @title AI模型创建请求
 * @description 创建 AI 模型配置所需字段。
 * @keywords-cn AI模型创建, 模型配置, 提供商
 * @keywords-en ai-model-create, config, provider
 */
export class CreateAiModelDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsString()
  provider!: string;

  @IsOptional()
  @IsEnum(AIModelApiSpec)
  apiProtocol?: AIModelApiSpec;

  @IsEnum(AIModelType)
  type!: AIModelType;

  @IsOptional()
  @IsEnum(AIModelStatus)
  status?: AIModelStatus;

  @IsString()
  apiKey!: string;

  @IsOptional()
  @IsString()
  baseURL?: string;

  @IsOptional()
  @IsObject()
  azureConfig?: AzureOpenAIConfig;

  @IsOptional()
  @IsObject()
  defaultParams?: ModelParameters;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/**
 * @title AI模型更新请求
 * @description 更新 AI 模型配置字段。
 * @keywords-cn AI模型更新, 模型配置, 字段更新
 * @keywords-en ai-model-update, config-update, fields
 */
export class UpdateAiModelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsEnum(AIModelApiSpec)
  apiProtocol?: AIModelApiSpec;

  @IsOptional()
  @IsEnum(AIModelType)
  type?: AIModelType;

  @IsOptional()
  @IsEnum(AIModelStatus)
  status?: AIModelStatus;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseURL?: string;

  @IsOptional()
  @IsObject()
  azureConfig?: AzureOpenAIConfig;

  @IsOptional()
  @IsObject()
  defaultParams?: ModelParameters;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/**
 * @title AI模型连通测试请求
 * @description 测试指定提供商、密钥和模型ID是否可用。
 * @keywords-cn 连通测试, API密钥, 模型ID
 * @keywords-en connection-test, api-key, model-id
 */
export class TestAiModelConnectionDto {
  @IsString()
  provider!: string;

  @IsOptional()
  @IsEnum(AIModelApiSpec)
  apiProtocol?: AIModelApiSpec;

  @IsString()
  apiKey!: string;

  @IsOptional()
  @IsString()
  baseURL?: string;

  @IsString()
  modelId!: string;
}

import type { Type } from '@nestjs/common';

// Hook 描述：名称 + payload 的文本描述，用于 AI 生成关键词时参考
export interface HookDescriptor {
  name: string;
  // 对该 hook 的 payload 进行一个简要的业务语义描述，辅助 AI 生成关键词
  payloadDescription: string;
}

// 插件配置文件的结构定义（plugins/*/plugin.conf.ts）
export interface PluginConfig {
  name: string;
  version: string;
  description: string;
  hooks: HookDescriptor[];
}

// 供插件在各自的 plugin.d.ts 中使用的元祖类型约定
// 左侧为 hook 名称，右侧为该 hook 的 payload 类型
export type PluginHookTuple<Name extends string, Payload> = [Name, Payload];

// 简单校验工具：确保必要字段存在
export function validatePluginConfig(
  config: Partial<PluginConfig>,
): asserts config is PluginConfig {
  if (!config) throw new Error('PluginConfig is empty');
  if (!config.name) throw new Error('PluginConfig.name is required');
  if (!config.version) throw new Error('PluginConfig.version is required');
  if (!config.description)
    throw new Error('PluginConfig.description is required');
  if (!Array.isArray(config.hooks))
    throw new Error('PluginConfig.hooks must be an array');
  for (const h of config.hooks) {
    if (!h.name) throw new Error('HookDescriptor.name is required');
    if (typeof h.payloadDescription !== 'string') {
      throw new Error('HookDescriptor.payloadDescription must be a string');
    }
  }
}

// Nest 模块约定（每个插件都是一个 Nest Module）
export type NestPluginModuleType = Type<unknown>;

import type { Type } from '@nestjs/common';

/**
 * Hook 描述：名称 + payload 的文本描述
 * @remarks
 * - 该结构主要用于 AI 生成关键词时参考，以便模型理解业务语义
 */
export interface HookDescriptor {
  /** Hook 名称（唯一标识该 Hook） */
  name: string;
  /** 对该 Hook 的 payload 进行简要业务语义描述，辅助 AI 生成关键词 */
  payloadDescription: string;
}

/**
 * 插件配置文件的结构定义(plugins/any/plugin.conf.ts)
 * @example
 * const pluginConfig: PluginConfig = {
 *   name: 'customer-analytics',
 *   version: '1.0.0',
 *   description: '分析客户行为并输出统计报表',
 *   hooks: [
 *     { name: 'onPurchase', payloadDescription: '用户下单时的订单与用户信息' },
 *   ],
 * };
 */
export interface PluginConfig {
  /** 插件名称 */
  name: string;
  /** 插件版本（语义化版本号） */
  version: string;
  /** 插件描述 */
  description: string;
  /** 插件暴露的 hooks 列表 */
  hooks: HookDescriptor[];
}

/**
 * 供插件在各自的 plugin.d.ts 中使用的元祖类型约定
 * - 左侧为 hook 名称，右侧为该 hook 的 payload 类型
 * @example
 * type OnPurchaseHook = PluginHookTuple<'onPurchase', {
 *   orderId: string;
 *   amount: number;
 * }>;
 */
export type PluginHookTuple<Name extends string, Payload> = [Name, Payload];

/**
 * 简单校验工具：确保必要字段存在
 * @param config 可能不完整的插件配置
 * @throws 字段缺失或类型不符合约定时抛出错误
 */
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

/** Nest 模块约定（每个插件都是一个 Nest Module） */
export type NestPluginModuleType = Type<unknown>;

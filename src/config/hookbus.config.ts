import type { HookBusConfig } from './types';

/**
 * @title HookBus 配置加载
 * @description 从环境变量读取事件总线配置
 * @keywords-cn HookBus配置, 事件总线, 缓冲区
 * @keywords-en hookbus-config, event-bus, buffer
 */
export function loadHookBusConfigFromEnv(): HookBusConfig {
  const enabled = (process.env.HOOKBUS_ENABLED || 'false') === 'true';
  const debug = (process.env.HOOKBUS_DEBUG || 'false') === 'true';
  const bufferSize =
    parseInt(process.env.HOOKBUS_BUFFER_SIZE || '1000', 10) || 1000;
  return { enabled, debug, bufferSize };
}

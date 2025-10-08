import type { HookBusConfig } from './types';

export function loadHookBusConfigFromEnv(): HookBusConfig {
  const enabled = (process.env.HOOKBUS_ENABLED || 'false') === 'true';
  const debug = (process.env.HOOKBUS_DEBUG || 'false') === 'true';
  const bufferSize =
    parseInt(process.env.HOOKBUS_BUFFER_SIZE || '1000', 10) || 1000;
  return { enabled, debug, bufferSize };
}

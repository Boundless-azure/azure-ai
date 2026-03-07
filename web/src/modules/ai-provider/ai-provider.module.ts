/**
 * @title AI Provider Module (Web)
 * @description 前端AI提供商模块导出。
 * @keywords-cn AI提供商模块, 前端模块, 导出
 * @keywords-en ai-provider-module, web-module, exports
 */
import { moduleTip } from './module.tip';
import { useAiProviders } from './hooks/useAiProviders';

export const AiProviderModule = {
  name: 'AiProviderModule',
  tip: moduleTip,
  hooks: {
    useAiProviders,
  },
};

export * from './types/ai-provider.types';
export * from './hooks/useAiProviders';

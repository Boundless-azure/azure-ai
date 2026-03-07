/**
 * @title AI Provider Module Tip (Web)
 * @description 前端AI提供商模块的描述与关键词映射。
 * @keywords-cn 模块描述, 关键词映射, 哈希对照
 * @keywords-en module-description, keyword-mapping, hash-map
 */

export const moduleTip = {
  description:
    'AI Provider module provides UI and hooks for managing AI model configurations.',
  keywords: {
    cn: {
      AI提供商入口: 'src/modules/ai-provider/pages/AiProviderPage.vue',
      AI提供商组件: 'src/modules/ai-provider/components/AiProviderManagement.vue',
      AI提供商常量: 'src/modules/ai-provider/constants/ai-provider.constants.ts',
      AI提供商类型: 'src/modules/ai-provider/types/ai-provider.types.ts',
      AI提供商hook: 'src/modules/ai-provider/hooks/useAiProviders.ts',
      模型连通测试: 'src/modules/ai-provider/hooks/useAiProviders.ts',
      AI提供商模块: 'src/modules/ai-provider/ai-provider.module.ts',
    },
    en: {
      ai_provider_page: 'src/modules/ai-provider/pages/AiProviderPage.vue',
      ai_provider_component:
        'src/modules/ai-provider/components/AiProviderManagement.vue',
      ai_provider_constants:
        'src/modules/ai-provider/constants/ai-provider.constants.ts',
      ai_provider_types: 'src/modules/ai-provider/types/ai-provider.types.ts',
      ai_provider_hook: 'src/modules/ai-provider/hooks/useAiProviders.ts',
      model_connection_test: 'src/modules/ai-provider/hooks/useAiProviders.ts',
      ai_provider_module: 'src/modules/ai-provider/ai-provider.module.ts',
    },
  },
  hashes: {
    useAiProviders_list: 'web_ai_provider_hook_list_001',
    useAiProviders_create: 'web_ai_provider_hook_create_002',
    useAiProviders_update: 'web_ai_provider_hook_update_003',
    useAiProviders_remove: 'web_ai_provider_hook_remove_004',
    useAiProviders_testConnection: 'web_ai_provider_hook_test_005',
    AiProviderManagement_submit: 'web_ai_provider_ui_submit_006',
  },
};

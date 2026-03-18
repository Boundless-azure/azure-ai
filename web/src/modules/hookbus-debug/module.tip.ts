/**
 * @title HookBus Debug Module Tip (Web)
 * @description HookBus 调试前端模块的关键词路径映射与函数哈希对照。
 * @keywords-cn 模块描述, HookBus调试, 关键词映射
 * @keywords-en module-description, hookbus-debug, keyword-mapping
 */
export const moduleTip = {
  description: 'HookBus 调试前端模块提供连接、hook选择、payload调试与历史记录能力。',
  keywords: {
    cn: {
      调试页面: 'src/modules/hookbus-debug/pages/HookbusDebugPage.vue',
      调试组件: 'src/modules/hookbus-debug/components/HookbusDebugWorkbench.vue',
      调试常量: 'src/modules/hookbus-debug/constants/hookbus-debug.constants.ts',
      调试类型: 'src/modules/hookbus-debug/types/hookbus-debug.types.ts',
      调试Hook: 'src/modules/hookbus-debug/hooks/useHookbusDebug.ts',
      调试模块: 'src/modules/hookbus-debug/hookbus-debug.module.ts',
      调试接口: 'src/api/hookbus-debug.ts',
    },
    en: {
      debug_page: 'src/modules/hookbus-debug/pages/HookbusDebugPage.vue',
      debug_component:
        'src/modules/hookbus-debug/components/HookbusDebugWorkbench.vue',
      debug_constants:
        'src/modules/hookbus-debug/constants/hookbus-debug.constants.ts',
      debug_types: 'src/modules/hookbus-debug/types/hookbus-debug.types.ts',
      debug_hook: 'src/modules/hookbus-debug/hooks/useHookbusDebug.ts',
      debug_module: 'src/modules/hookbus-debug/hookbus-debug.module.ts',
      debug_api: 'src/api/hookbus-debug.ts',
    },
  },
  hashMap: {
    useHookbusDebug_connect: 'web_hookbus_debug_connect_001',
    useHookbusDebug_sendDebug: 'web_hookbus_debug_send_002',
    HookbusDebugWorkbench_modal: 'web_hookbus_debug_modal_003',
  },
};

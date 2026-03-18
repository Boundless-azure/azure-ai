/**
 * @title HookBus Debug Module (Web)
 * @description 导出 HookBus 调试页相关常量、hooks 与页面组件。
 * @keywords-cn HookBus调试模块, 调试页面, 导出
 * @keywords-en hookbus-debug-module, debug-page, exports
 */
import * as HookbusDebugConstants from './constants/hookbus-debug.constants';
import { useHookbusDebug } from './hooks/useHookbusDebug';
import HookbusDebugPage from './pages/HookbusDebugPage.vue';

export * from './types/hookbus-debug.types';

export const HookbusDebugModule = {
  name: 'HookbusDebugModule',
  constants: HookbusDebugConstants,
  hooks: { useHookbusDebug },
  pages: { HookbusDebugPage },
};

/**
 * @title Runner Module (Web)
 * @description 导出 Runner 管理相关常量、hooks 与页面组件。
 * @keywords-cn Runner模块, 导出, 管理页面
 * @keywords-en runner-module, exports, management-page
 */
import * as RunnerConstants from './constants/runner.constants';
import { useRunners } from './hooks/useRunners';
import RunnerPage from './pages/RunnerPage.vue';

export * from './types/runner.types';

export const RunnerModule = {
  name: 'RunnerModule',
  constants: RunnerConstants,
  hooks: { useRunners },
  pages: { RunnerPage },
};

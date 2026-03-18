/**
 * @title Runner Module Tip (Web)
 * @description Runner 前端模块的关键词路径映射与函数哈希对照。
 * @keywords-cn 模块描述, Runner, 关键词映射
 * @keywords-en module-description, runner, keyword-mapping
 */
export const moduleTip = {
  description: 'Runner 前端模块提供管理页、CRUD hook 与 API 对接能力。',
  keywords: {
    cn: {
      Runner页面: 'src/modules/runner/pages/RunnerPage.vue',
      Runner组件: 'src/modules/runner/components/RunnerManagement.vue',
      Runner常量: 'src/modules/runner/constants/runner.constants.ts',
      Runner类型: 'src/modules/runner/types/runner.types.ts',
      RunnerHook: 'src/modules/runner/hooks/useRunners.ts',
      Runner模块: 'src/modules/runner/runner.module.ts',
      Runner接口: 'src/api/runner.ts',
    },
    en: {
      runner_page: 'src/modules/runner/pages/RunnerPage.vue',
      runner_component: 'src/modules/runner/components/RunnerManagement.vue',
      runner_constants: 'src/modules/runner/constants/runner.constants.ts',
      runner_types: 'src/modules/runner/types/runner.types.ts',
      runner_hook: 'src/modules/runner/hooks/useRunners.ts',
      runner_module: 'src/modules/runner/runner.module.ts',
      runner_api: 'src/api/runner.ts',
    },
  },
  hashMap: {
    useRunners_list: 'web_runner_hook_list_001',
    useRunners_create: 'web_runner_hook_create_002',
    useRunners_update: 'web_runner_hook_update_003',
    useRunners_remove: 'web_runner_hook_remove_004',
    RunnerManagement_submit: 'web_runner_cmp_submit_005',
  },
};

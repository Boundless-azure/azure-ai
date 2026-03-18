/**
 * @title Runner 数据库枚举
 * @description 定义 runner 管理库内置集合名称常量。
 * @keywords-cn Runner库, 集合名称, 枚举
 * @keywords-en runner-db, collection-names, enums
 */
export enum RunnerDbCollection {
  ConnectionHistory = 'runner_connection_history',
  HookFailure = 'runner_hook_failures',
  AppManagement = 'runner_apps',
  CapabilityManagement = 'runner_capabilities',
  ResourceLibrary = 'runner_resources',
  WebMcp = 'runner_webmcp',
  Mcp = 'runner_mcp',
  Skill = 'runner_skills',
  Migration = 'runner_migrations',
}

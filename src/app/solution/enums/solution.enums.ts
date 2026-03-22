/**
 * @title 插件状态枚举
 * @description 插件启用/禁用状态
 * @keywords-cn 插件状态, 启用, 禁用
 * @keywords-en plugin-status, active, inactive
 */
export enum PluginStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/**
 * @title 插件安装类型枚举
 * @description 插件是官方发布还是市场安装
 * @keywords-cn 安装类型, 官方, 市场
 * @keywords-en install-type, official, marketplace
 */
export enum InstallType {
  OFFICIAL = 'official',
  MARKETPLACE = 'marketplace',
}

/**
 * @title Solution 来源枚举
 * @description Solution 的来源类型
 * @keywords-cn solution来源, 自产开发, 市场插件
 * @keywords-en solution-source, self-developed, marketplace
 */
export enum SolutionSource {
  SELF_DEVELOPED = 'self_developed',
  MARKETPLACE = 'marketplace',
}

/**
 * @title Solution 包含类型枚举
 * @description Solution 包含内容的类型
 * @keywords-cn solution类型, 包含类型, app, unit, workflow, agent
 * @keywords-en solution-include, solution-type, app, unit, workflow, agent
 */
export enum SolutionInclude {
  APP = 'app',
  UNIT = 'unit',
  WORKFLOW = 'workflow',
  AGENT = 'agent',
}

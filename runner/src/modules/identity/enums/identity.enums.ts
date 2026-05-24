/**
 * @title Runner Identity 枚举
 * @description Principal 类型 / Role 内置常量 / 权限类型, 与 SaaS 端 identity 对齐但语义更窄。
 * @keywords-cn Runner身份枚举, 主体类型, 内置角色
 * @keywords-en runner-identity-enums, principal-type, builtin-role
 */

/**
 * Runner 内的主体类型. 跟 SaaS 不同, runner 没有 end-user 概念,
 * 主体多是 service principal (solution / agent / system / debug-user).
 * @keyword-en runner-principal-type
 */
export enum RunnerPrincipalType {
  /** runner 内置系统主体, 全权; 无需 grant role */
  System = 'system',
  /** Solution 注册时自动建; id 格式 solution:<name> */
  Solution = 'solution',
  /** AI agent (本地 agent runtime) 触发的 hook; id 格式 agent:<agentId> */
  Agent = 'agent',
  /** HTTP/WS 调试入口的主体; id 格式 debug:<userId> */
  Debug = 'debug',
  /** SaaS 派发来的 LLM 调用, runner 端默认映射到匿名主体 (能力受限); id 'anonymous-llm' */
  AnonymousLlm = 'anonymous-llm',
}

/**
 * 内置 Role 代码, seed 时创建.
 * @keyword-en runner-builtin-role
 */
export enum RunnerBuiltinRole {
  /** subject:* action:* 全权 */
  SystemRoot = 'system-root',
  /** mongo find / file read 等只读基座, solution 默认拿 */
  SolutionDefault = 'solution-default',
  /** 最小集合, 仅供 SaaS push 的匿名 LLM 兜底用 (find / read), 写权限均无 */
  LlmAnonymous = 'llm-anonymous',
}

/**
 * 权限类型 (跟 SaaS PermissionDefinitionType 对齐, 但目前 runner 只用 Management + Data).
 * @keyword-en runner-permission-type
 */
export enum RunnerPermissionType {
  /** 管理类权限, 即 can/cannot 用于路由级判定 */
  Management = 'management',
  /** 数据类权限, 走 DataPermissionContext + bound dto node */
  Data = 'data',
}

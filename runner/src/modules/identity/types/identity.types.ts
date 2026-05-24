/**
 * @title Runner Identity Types
 * @description Runner 端身份/权限的运行时数据形状; 与 SaaS 端 identity 模块同语义,
 *   但所有数据由 SaaS 在调 runner hook 时 push 到 event.context.extras, runner 端不查 DB.
 * @keywords-cn Runner身份, 能力规则, 数据权限, 推送上下文
 * @keywords-en runner-identity, ability-rules, data-permissions, push-context
 */

/**
 * 单条 ability 规则 (CASL 风格); 与 SaaS AbilityService.rules 同形。
 * - action: 动作动词 (read/create/update/delete/manage/'*')
 * - subject: 主体名 (storage/resource/todo/'*')
 * - 'manage' 和 '*' 是通配, 命中任意 action/subject
 * @keyword-en ability-rule
 */
export interface RunnerAbilityRule {
  action: string;
  subject: string;
}

/**
 * 单条数据权限规则; 与 SaaS DataPermissionContextService 输出同形。
 * 由 SaaS 在 push 时序列化, runner 端业务代码 (AI 产代码 / unit-core / runner.app.*) 自取用于过滤数据。
 * - table: 涉及的资源/集合名 (与 SaaS dataPermissions 的 subject 对齐)
 * - nodeKey: 数据权限节点键 (如 "todo:read-only-myself")
 * - where: 已经求值后的 SQL where 片段, 直接用于 SQL/Mongo 过滤
 *   · runner 不重新求值, SaaS 已经基于 principal/role/membership 算好
 * @keyword-en data-permission-rule
 */
export interface RunnerDataPermissionRule {
  table: string;
  nodeKey: string;
  where?: Record<string, unknown>;
  /** 原始 action 对 (如 read/update), 多 action 时可能存在多条 */
  action?: string;
}

/**
 * SaaS push 给 runner 的运行时身份上下文; 通过 context.extras.identity 透传。
 * - source !== 'llm' 时该字段可能缺省 (内部调用), middleware 按"无限制"放行 (denyLlm 仍生效)
 * - principalId / tenantId 跟 context.principalId 一致, 这里冗余便于业务代码直接用
 * @keyword-en runner-identity-context
 */
export interface RunnerIdentityContext {
  principalId?: string;
  tenantId?: string;
  /** 主体扁平角色列表 (调试/排查用, 鉴权决策只看 abilityRules) */
  roles?: string[];
  /** CASL ability rules; 经 SaaS AbilityService.buildForPrincipal 求值后 push */
  abilityRules?: RunnerAbilityRule[];
  /** 数据权限规则; 经 SaaS DataPermissionContextService 求值后 push */
  dataPermissions?: RunnerDataPermissionRule[];
}

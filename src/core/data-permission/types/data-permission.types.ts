import type { Type } from '@nestjs/common';

/**
 * @title 数据权限节点处理器返回值
 * @description handler 纯验证, 无副作用; 不再修改 payload。
 *              - true                 :: 通过
 *              - false                :: 失败 (用装饰器声明的 errorMsg)
 *              - string               :: 失败 (动态 errorMsg, 覆盖装饰器声明值)
 * @keywords-cn 节点结果, 验证, 错误消息
 * @keywords-en node-result, validation, error-msg
 */
export type DataPermissionNodeResult = boolean | string;

/**
 * @title 数据权限节点元数据
 * @description 装饰器 @DataPermissionNode 声明数据权限节点时携带的元信息。
 *              - subject :: 节点关联的资源/表 (跟 PermissionDefinition root 关联)
 *              - action  :: 节点 nodeKey, 同 subject 下唯一
 *              - weight  :: 权重 (用于配置时越权防护)
 *              - global  :: 全局强制节点, applyTo 时无视 ctx 是否拥有, 全员必跑
 *              - errorMsg :: 失败时默认 errorMsg, handler 返 false 时使用
 * @keywords-cn 节点元数据, 装饰器, 权重, 全局强制
 * @keywords-en node-meta, decorator, weight, global-mandatory
 */
export interface DataPermissionNodeMeta {
  subject: string;
  action: string;
  weight?: number;
  global?: boolean;
  errorMsg?: string;
}

/**
 * @title 数据权限上下文
 * @description applyTo 时传入的运行时上下文。
 *              rolePermissions 按 permissionType 分组, 'data' 决定哪些节点对当前 ctx 生效。
 * @keywords-cn 数据权限上下文, 角色权限, 类型分组
 * @keywords-en data-permission-context, role-perms, type-grouped
 */
export interface DataPermissionContext {
  principalId?: string;
  tenantId?: string;
  /** ctx 拥有的所有数据权限节点 (subject, action) :: 决定 applyTo 时哪些节点生效 */
  dataPermissions: Array<{ subject: string; action: string }>;
  /** ctx 拥有的所有管理权限 (subject, action) :: 用于 maxWeight 计算 / 通配判定 */
  managementPermissions: Array<{ subject: string; action: string }>;
  attributes: Record<string, unknown>;
}

/**
 * @title 数据权限上下文输入
 * @description 用于构建 DataPermissionContext 的原始输入。dataPermissions / managementPermissions
 *              通常由 ContextService 从 db 查询填充, 调用方仅需提供 principalId。
 * @keywords-cn 上下文输入, 权限构建
 * @keywords-en context-input, permission-build
 */
export interface DataPermissionContextInput {
  principalId?: string;
  tenantId?: string;
  attributes?: Record<string, unknown>;
}

/**
 * @title DTO 构造类型
 * @description 数据权限系统接收的 DTO 类构造器类型定义。
 * @keywords-cn DTO构造器, 类型定义
 * @keywords-en dto-constructor, type-definition
 */
export type DataPermissionDtoClass = Type<object>;

/**
 * @title 数据权限节点执行参数
 * @description handler 接收的统一参数: ctx + payload。
 * @keywords-cn 节点参数, 上下文, payload
 * @keywords-en node-params, context, payload
 */
export interface DataPermissionNodeArgs<TPayload = unknown> {
  ctx: DataPermissionContext;
  payload: TPayload;
}

/**
 * @title 数据权限节点处理器
 * @description 纯验证函数 :: 接收 (ctx, payload), 返回 boolean | string。无副作用。
 * @keywords-cn 节点处理器, 纯验证
 * @keywords-en node-handler, pure-validator
 */
export type DataPermissionNodeHandler<TPayload = unknown> = (
  args: DataPermissionNodeArgs<TPayload>,
) => DataPermissionNodeResult | Promise<DataPermissionNodeResult>;

/**
 * @title 数据权限节点注册项
 * @description 装饰器扫描后写入 Registry 的内部结构, 关联元数据 + handler 引用。
 * @keywords-cn 节点注册项, 装饰器扫描
 * @keywords-en node-registration, decorator-scan
 */
export interface DataPermissionNodeRegistration {
  meta: DataPermissionNodeMeta;
  handler: DataPermissionNodeHandler;
  /** 仅用于诊断, 记录是哪个 DTO 类的哪个静态方法 */
  source: { dtoClassName: string; methodName: string };
}

/**
 * @title 数据权限模块配置
 * @description forRoot 配置, 当前阶段保留兼容旧 API 但实际不再使用 nodes/tableDtoMap。
 *              新范式靠 @DataPermissionNode 装饰器扫描完成 SSOT。
 * @keywords-cn 模块配置, forRoot, 兼容
 * @keywords-en module-options, for-root, compat
 */
export interface DataPermissionModuleOptions {
  isGlobal?: boolean;
}

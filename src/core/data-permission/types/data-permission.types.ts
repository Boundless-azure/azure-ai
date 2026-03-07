import type { Type } from '@nestjs/common';

/**
 * @title 数据权限上下文
 * @description 执行数据权限节点时使用的上下文信息，包含主体身份与权限数据。
 * @keywords-cn 数据权限上下文, 主体信息, 权限信息
 * @keywords-en data-permission-context, principal-context, permission-context
 */
export interface DataPermissionContext {
  principalId?: string;
  tenantId?: string;
  roles: string[];
  permissions: string[];
  attributes: Record<string, unknown>;
}

/**
 * @title 数据权限上下文输入
 * @description 用于构建数据权限上下文的原始输入，字段可选。
 * @keywords-cn 上下文输入, 权限构建, 用户上下文
 * @keywords-en context-input, permission-build, user-context
 */
export interface DataPermissionContextInput {
  principalId?: string;
  tenantId?: string;
  roles?: string[];
  permissions?: string[];
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
 * @description 节点执行时输入的表名、DTO、上下文与可选请求数据。
 * @keywords-cn 节点参数, 表名, DTO, 上下文
 * @keywords-en node-params, table-name, dto, context
 */
export interface DataPermissionNodeParams {
  table: string;
  dtoClass: DataPermissionDtoClass;
  context: DataPermissionContext;
  payload?: Record<string, unknown>;
}

/**
 * @title 数据权限节点执行结果
 * @description 节点返回 allow 与 where 限制条件，用于服务层合并查询条件。
 * @keywords-cn 节点结果, 允许标识, 查询条件
 * @keywords-en node-result, allow-flag, where-condition
 */
export interface DataPermissionNodeResult {
  allow: boolean;
  where?: Record<string, unknown>;
}

/**
 * @title 数据权限节点处理器
 * @description 业务方注入的节点函数签名，按节点键执行权限裁决。
 * @keywords-cn 节点处理器, 业务函数, 权限裁决
 * @keywords-en node-handler, business-function, permission-decision
 */
export type DataPermissionNodeHandler = (
  params: DataPermissionNodeParams,
) => DataPermissionNodeResult | Promise<DataPermissionNodeResult>;

/**
 * @title 数据权限模块配置
 * @description forRoot 注入配置，包含表与 DTO 映射及节点处理器映射。
 * @keywords-cn 模块配置, forRoot, 表DTO映射, 节点映射
 * @keywords-en module-options, for-root, table-dto-map, node-map
 */
export interface DataPermissionModuleOptions {
  isGlobal?: boolean;
  tableDtoMap: Record<string, DataPermissionDtoClass[]>;
  nodes: Record<string, DataPermissionNodeHandler>;
}

/**
 * @title 数据权限解析结果
 * @description 根据 DTO 与上下文执行后得到的汇总结果。
 * @keywords-cn 解析结果, 命中节点, 拒绝节点, 查询条件
 * @keywords-en resolve-result, matched-nodes, denied-nodes, query-condition
 */
export interface DataPermissionResolveResult {
  table: string;
  dtoName: string;
  allow: boolean;
  where: Record<string, unknown>;
  matchedNodes: string[];
  deniedNodes: string[];
}

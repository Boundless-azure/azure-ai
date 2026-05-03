import { Injectable } from '@nestjs/common';
import type {
  DataPermissionContext,
  DataPermissionContextInput,
} from '../types/data-permission.types';

/**
 * @title 角色权限项 (按 permission_type 分组传入)
 * @description ContextService 不直接依赖 RolePermissionEntity (避免 core 反向依赖 app/identity),
 *              调用方按 permission_type 分组后扁平传入。
 * @keywords-cn 角色权限项, permission_type 分组, 反向依赖隔离
 * @keywords-en role-permission-item, permission-type-grouped, reverse-dep-isolation
 */
export interface RolePermissionItem {
  subject: string;
  action: string;
}

/**
 * @title 数据权限上下文构建服务
 * @description 给 service 层调用 :: 把 principalId / permissions 收成 DataPermissionContext。
 *              app/identity 端 (e.g. AbilityService 或 PrincipalService) 应提供一个查询入口
 *              (按 principalId + permission_type 拿对应权限项), business service 调 build 时传入。
 *
 *              本 service 不查询 db, 因为 core/data-permission 不能反向依赖 app/identity,
 *              查询责任在调用方 (通常是 app/identity 提供的 helper)。
 * @keywords-cn 上下文构建, 权限注入, 反向依赖隔离
 * @keywords-en context-builder, permission-injection, dependency-isolation
 */
@Injectable()
export class DataPermissionContextService {
  /**
   * 构建运行时上下文 :: 调用方提供按 type 分组的角色权限项
   * @keyword-en build-context
   */
  build(
    input: DataPermissionContextInput & {
      dataPermissions?: RolePermissionItem[];
      managementPermissions?: RolePermissionItem[];
    },
  ): DataPermissionContext {
    return {
      principalId: input.principalId,
      tenantId: input.tenantId,
      dataPermissions: input.dataPermissions ?? [],
      managementPermissions: input.managementPermissions ?? [],
      attributes: input.attributes ?? {},
    };
  }
}

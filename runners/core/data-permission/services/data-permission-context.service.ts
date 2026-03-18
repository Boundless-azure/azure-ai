import { Injectable } from '@nestjs/common';
import type {
  DataPermissionContext,
  DataPermissionContextInput,
} from '../types/data-permission.types';

/**
 * @title 数据权限上下文构建服务
 * @description 统一构建数据权限上下文，供业务服务传入数据权限执行器。
 * @keywords-cn 上下文构建, 权限上下文, 服务
 * @keywords-en context-builder, permission-context, service
 */
@Injectable()
export class DataPermissionContextService {
  build(input: DataPermissionContextInput): DataPermissionContext {
    return {
      principalId: input.principalId,
      tenantId: input.tenantId,
      roles: input.roles ?? [],
      permissions: input.permissions ?? [],
      attributes: input.attributes ?? {},
    };
  }
}

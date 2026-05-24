import type {
  DataAuthContext,
  DataAuthContextInput,
} from '../types/data-auth.types';

/**
 * @title Data Auth 上下文服务
 * @description 规范化权限上下文输入，输出统一结构。
 * @keywords-cn 上下文构建, 权限上下文, 规范化
 * @keywords-en context-build, permission-context, normalize
 */
export class DataAuthContextService {
  build(input: DataAuthContextInput): DataAuthContext {
    return {
      principalId: input.principalId,
      tenantId: input.tenantId,
      roles: input.roles ?? [],
      permissions: input.permissions ?? [],
      attributes: input.attributes ?? {},
    };
  }
}

import type { RunnerAbilityService } from '../../identity/services/ability.service';
import type { DataPermissionContext } from '../types/data-permission.types';

/**
 * @title 构造 DataPermissionContext 的快捷工厂
 * @description 给业务 service / hook handler 用; 输入 principalId 直接拿能跑 resolve 的 ctx.
 * @keywords-cn 数据权限上下文工厂, principal求 dataPermissions
 * @keywords-en data-permission-context-factory, principal-data-perms
 */
export async function buildDataPermissionContext(
  ability: RunnerAbilityService,
  args: {
    principalId: string;
    tenantId?: string;
    attributes?: Record<string, unknown>;
  },
): Promise<DataPermissionContext> {
  const built = await ability.buildForPrincipal(args.principalId);
  return {
    principalId: args.principalId,
    ...(args.tenantId ? { tenantId: args.tenantId } : {}),
    dataPermissions: built.dataPermissions,
    ...(args.attributes ? { attributes: args.attributes } : {}),
  };
}

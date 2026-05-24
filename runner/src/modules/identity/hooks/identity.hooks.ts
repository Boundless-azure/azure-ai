import { z } from 'zod';
import type { RunnerHookBusService } from '../../hookbus/services/hookbus.service';
import type { RunnerIdentityRepository } from '../repositories/identity.repository';
import type { RunnerAbilityService } from '../services/ability.service';
import {
  RunnerPermissionType,
  RunnerPrincipalType,
} from '../enums/identity.enums';

/**
 * @title Runner Identity Admin Hooks
 * @description 仅 debug / system / runner 入口可见的 RBAC 管理 hook; 全部 denyLlm=true 防 AI 自我提权。
 *              提供 list / grant / addMembership / invalidateCache 等运维能力。
 * @keywords-cn Runner身份Hook, RBAC管理, denyLlm, 调试入口
 * @keywords-en runner-identity-hooks, rbac-admin, deny-llm, debug-only
 */

const ListPrincipalsSchema = z.object({}).optional();

const UpsertPrincipalSchema = z.object({
  id: z.string().min(1).describe('主体 ID (solution:<name> / agent:<id> / debug:<userId> 等)'),
  type: z.nativeEnum(RunnerPrincipalType),
  displayName: z.string().optional(),
});

const UpsertRoleSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

const GrantPermissionSchema = z.object({
  roleId: z.string().min(1),
  subject: z.string().min(1),
  action: z.string().min(1),
  permissionType: z.nativeEnum(RunnerPermissionType).default(
    RunnerPermissionType.Management,
  ),
  nodeKey: z.string().optional(),
});

const AddMembershipSchema = z.object({
  principalId: z.string().min(1),
  roleId: z.string().min(1),
});

const InvalidateCacheSchema = z.object({
  principalId: z.string().optional(),
});

/**
 * 注册 runner.system.identity.* admin hooks. 全部 denyLlm=true.
 * @keyword-en register-identity-admin-hooks
 */
export function registerIdentityAdminHooks(
  hookBus: RunnerHookBusService,
  repo: RunnerIdentityRepository,
  ability: RunnerAbilityService,
): void {
  const existing = new Set(hookBus.listRegistrations().map((i) => i.name));
  const TAG = ['identity', 'admin', 'system'];

  if (!existing.has('runner.system.identity.upsertPrincipal')) {
    hookBus.register(
      'runner.system.identity.upsertPrincipal',
      async (event) => {
        const p = event.payload as z.infer<typeof UpsertPrincipalSchema>;
        await repo.upsertPrincipal({ ...p, builtin: false });
        return { status: 'success', data: { id: p.id } };
      },
      {
        description: 'Runner 内部: 新建/更新一个 principal (solution/agent/debug 等). denyLlm.',
        tags: TAG,
        pluginName: 'runner-identity',
        payloadSchema: UpsertPrincipalSchema,
        denyLlm: true,
      },
    );
  }

  if (!existing.has('runner.system.identity.upsertRole')) {
    hookBus.register(
      'runner.system.identity.upsertRole',
      async (event) => {
        const r = event.payload as z.infer<typeof UpsertRoleSchema>;
        await repo.upsertRole({ ...r, builtin: false });
        return { status: 'success', data: { id: r.id } };
      },
      {
        description: 'Runner 内部: 新建/更新一个 role. denyLlm.',
        tags: TAG,
        pluginName: 'runner-identity',
        payloadSchema: UpsertRoleSchema,
        denyLlm: true,
      },
    );
  }

  if (!existing.has('runner.system.identity.grantPermission')) {
    hookBus.register(
      'runner.system.identity.grantPermission',
      async (event) => {
        const g = event.payload as z.infer<typeof GrantPermissionSchema>;
        await repo.grantPermission(g);
        ability.invalidate(); // 全清 (粗粒度, role 改了影响多个 principal)
        return { status: 'success', data: { granted: true } };
      },
      {
        description:
          'Runner 内部: 给 role 添加一条 (subject, action) 权限; 同条幂等. denyLlm.',
        tags: TAG,
        pluginName: 'runner-identity',
        payloadSchema: GrantPermissionSchema,
        denyLlm: true,
      },
    );
  }

  if (!existing.has('runner.system.identity.addMembership')) {
    hookBus.register(
      'runner.system.identity.addMembership',
      async (event) => {
        const m = event.payload as z.infer<typeof AddMembershipSchema>;
        await repo.addMembership(m);
        ability.invalidate(m.principalId);
        return { status: 'success', data: { added: true } };
      },
      {
        description: 'Runner 内部: 给 principal 添加 role membership; 幂等. denyLlm.',
        tags: TAG,
        pluginName: 'runner-identity',
        payloadSchema: AddMembershipSchema,
        denyLlm: true,
      },
    );
  }

  if (!existing.has('runner.system.identity.invalidateCache')) {
    hookBus.register(
      'runner.system.identity.invalidateCache',
      async (event) => {
        const p = event.payload as z.infer<typeof InvalidateCacheSchema>;
        ability.invalidate(p.principalId);
        return {
          status: 'success',
          data: { invalidated: p.principalId ?? '<all>' },
        };
      },
      {
        description:
          'Runner 内部: 清掉 RunnerAbilityService 的本地缓存 (principalId 留空清全部). 改完权限立刻生效用. denyLlm.',
        tags: TAG,
        pluginName: 'runner-identity',
        payloadSchema: InvalidateCacheSchema,
        denyLlm: true,
      },
    );
  }

  if (!existing.has('runner.system.identity.listPrincipals')) {
    hookBus.register(
      'runner.system.identity.listPrincipals',
      async () => {
        const items = await repo.listPrincipals();
        return { status: 'success', data: { items, total: items.length } };
      },
      {
        description: 'Runner 内部: 列出所有 principal (debug 排查用). denyLlm.',
        tags: TAG,
        pluginName: 'runner-identity',
        payloadSchema: ListPrincipalsSchema,
        denyLlm: true,
      },
    );
  }

  if (!existing.has('runner.system.identity.listRoles')) {
    hookBus.register(
      'runner.system.identity.listRoles',
      async () => {
        const items = await repo.listRoles();
        return { status: 'success', data: { items, total: items.length } };
      },
      {
        description: 'Runner 内部: 列出所有 role (debug 排查用). denyLlm.',
        tags: TAG,
        pluginName: 'runner-identity',
        payloadSchema: ListPrincipalsSchema,
        denyLlm: true,
      },
    );
  }
}

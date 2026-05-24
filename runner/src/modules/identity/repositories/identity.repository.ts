import type { Collection, Db } from 'mongodb';
import { RunnerIdentityCollection } from '../enums/collection.enums';
import type {
  RunnerMembershipDoc,
  RunnerPrincipalDoc,
  RunnerRoleDoc,
  RunnerRolePermissionDoc,
} from '../types/entity.types';
import {
  RunnerBuiltinRole,
  RunnerPermissionType,
  RunnerPrincipalType,
} from '../enums/identity.enums';

/**
 * @title Runner Identity Repository
 * @description 4 张 RBAC 集合的统一访问层; identity 模块自治, 不通过 RunnerDbService。
 *   提供原子 CRUD + 启动 seed (内置 principal/role/grant).
 * @keywords-cn Runner身份仓库, RBAC访问, seed
 * @keywords-en runner-identity-repo, rbac-access, seed
 */
export class RunnerIdentityRepository {
  constructor(private readonly db: Db) {}

  private get principals(): Collection<RunnerPrincipalDoc> {
    return this.db.collection<RunnerPrincipalDoc>(
      RunnerIdentityCollection.Principal,
    );
  }
  private get roles(): Collection<RunnerRoleDoc> {
    return this.db.collection<RunnerRoleDoc>(RunnerIdentityCollection.Role);
  }
  private get rolePerms(): Collection<RunnerRolePermissionDoc> {
    return this.db.collection<RunnerRolePermissionDoc>(
      RunnerIdentityCollection.RolePermission,
    );
  }
  private get memberships(): Collection<RunnerMembershipDoc> {
    return this.db.collection<RunnerMembershipDoc>(
      RunnerIdentityCollection.Membership,
    );
  }

  // ============= Principal =============

  /**
   * 按 id upsert principal; 已存在不改 builtin/type, 仅刷 displayName.
   * @keyword-en upsert-principal
   */
  async upsertPrincipal(input: {
    id: string;
    type: RunnerPrincipalType;
    displayName?: string;
    builtin?: boolean;
  }): Promise<void> {
    await this.principals.updateOne(
      { id: input.id },
      {
        $set: {
          id: input.id,
          type: input.type,
          ...(input.displayName ? { displayName: input.displayName } : {}),
          builtin: input.builtin ?? false,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  async getPrincipal(id: string): Promise<RunnerPrincipalDoc | null> {
    return await this.principals.findOne({ id });
  }

  /** debug/admin 入口列出所有 principal (无分页 — runner 单租户规模小). */
  async listPrincipals(): Promise<RunnerPrincipalDoc[]> {
    return await this.principals.find({}).toArray();
  }

  /** debug/admin 入口列出所有 role. */
  async listRoles(): Promise<RunnerRoleDoc[]> {
    return await this.roles.find({}).toArray();
  }

  /** debug/admin 入口列出所有 membership. */
  async listMemberships(): Promise<RunnerMembershipDoc[]> {
    return await this.memberships.find({}).toArray();
  }

  // ============= Role =============

  async upsertRole(input: {
    id: string;
    code: string;
    name: string;
    description?: string;
    builtin?: boolean;
  }): Promise<void> {
    await this.roles.updateOne(
      { id: input.id },
      {
        $set: {
          id: input.id,
          code: input.code,
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
          builtin: input.builtin ?? false,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  async findRoleByCode(code: string): Promise<RunnerRoleDoc | null> {
    return await this.roles.findOne({ code });
  }

  // ============= Role Permission =============

  /**
   * 给 role 添加一条权限; 同 (role,subject,action,type,nodeKey) 视为同条幂等.
   * @keyword-en grant-permission
   */
  async grantPermission(input: {
    roleId: string;
    subject: string;
    action: string;
    permissionType: RunnerPermissionType;
    nodeKey?: string;
  }): Promise<void> {
    const id = `${input.roleId}::${input.permissionType}::${input.subject}::${input.action}::${input.nodeKey ?? ''}`;
    await this.rolePerms.updateOne(
      { id },
      {
        $set: {
          id,
          roleId: input.roleId,
          subject: input.subject,
          action: input.action,
          permissionType: input.permissionType,
          ...(input.nodeKey ? { nodeKey: input.nodeKey } : {}),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  async listPermissionsByRoles(
    roleIds: string[],
    permissionType?: RunnerPermissionType,
  ): Promise<RunnerRolePermissionDoc[]> {
    if (roleIds.length === 0) return [];
    const filter: Record<string, unknown> = { roleId: { $in: roleIds } };
    if (permissionType) filter.permissionType = permissionType;
    return await this.rolePerms.find(filter).toArray();
  }

  // ============= Membership =============

  async addMembership(input: {
    principalId: string;
    roleId: string;
  }): Promise<void> {
    const id = `${input.principalId}::${input.roleId}`;
    await this.memberships.updateOne(
      { id },
      {
        $set: { id, principalId: input.principalId, roleId: input.roleId },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  async listRoleIdsByPrincipal(principalId: string): Promise<string[]> {
    const docs = await this.memberships
      .find({ principalId })
      .project({ roleId: 1, _id: 0 })
      .toArray();
    return Array.from(new Set(docs.map((d) => d.roleId).filter(Boolean)));
  }

  // ============= 启动期 seed =============

  /**
   * Seed 内置 principal + 角色 + grant 关系. 幂等, 重复调安全.
   * 内置:
   *   - principal: system (builtin), anonymous-llm (builtin)
   *   - role: system-root (subject:* action:* manage), solution-default (mongo find / file read), llm-anonymous (find only)
   *   - grant: system → system-root, anonymous-llm → llm-anonymous
   * @keyword-en seed-builtin-identity
   */
  async seedBuiltin(): Promise<void> {
    // 1. 内置 principal
    await this.upsertPrincipal({
      id: 'system',
      type: RunnerPrincipalType.System,
      displayName: 'Runner System',
      builtin: true,
    });
    await this.upsertPrincipal({
      id: 'anonymous-llm',
      type: RunnerPrincipalType.AnonymousLlm,
      displayName: 'Anonymous LLM (SaaS push fallback)',
      builtin: true,
    });

    // 2. 内置 role
    await this.upsertRole({
      id: RunnerBuiltinRole.SystemRoot,
      code: RunnerBuiltinRole.SystemRoot,
      name: 'System Root (all subjects, all actions)',
      builtin: true,
    });
    await this.upsertRole({
      id: RunnerBuiltinRole.SolutionDefault,
      code: RunnerBuiltinRole.SolutionDefault,
      name: 'Solution default (mongo read, file read, solution read)',
      builtin: true,
    });
    await this.upsertRole({
      id: RunnerBuiltinRole.LlmAnonymous,
      code: RunnerBuiltinRole.LlmAnonymous,
      name: 'Anonymous LLM (read-only, no write)',
      builtin: true,
    });

    // 3. 权限
    // system-root: 全权
    await this.grantPermission({
      roleId: RunnerBuiltinRole.SystemRoot,
      subject: '*',
      action: '*',
      permissionType: RunnerPermissionType.Management,
    });

    // solution-default: 只读基座 (mongo.find, file.read/list, solution.read)
    const solutionDefaultGrants: Array<{ subject: string; action: string }> = [
      { subject: 'mongo', action: 'read' },
      { subject: 'file', action: 'read' },
      { subject: 'file', action: 'list' },
      { subject: 'solution', action: 'read' },
    ];
    for (const g of solutionDefaultGrants) {
      await this.grantPermission({
        roleId: RunnerBuiltinRole.SolutionDefault,
        ...g,
        permissionType: RunnerPermissionType.Management,
      });
    }

    // llm-anonymous: 仅 mongo.find / file.read
    await this.grantPermission({
      roleId: RunnerBuiltinRole.LlmAnonymous,
      subject: 'mongo',
      action: 'read',
      permissionType: RunnerPermissionType.Management,
    });
    await this.grantPermission({
      roleId: RunnerBuiltinRole.LlmAnonymous,
      subject: 'file',
      action: 'read',
      permissionType: RunnerPermissionType.Management,
    });

    // 4. membership: system → system-root, anonymous-llm → llm-anonymous
    await this.addMembership({
      principalId: 'system',
      roleId: RunnerBuiltinRole.SystemRoot,
    });
    await this.addMembership({
      principalId: 'anonymous-llm',
      roleId: RunnerBuiltinRole.LlmAnonymous,
    });
  }
}

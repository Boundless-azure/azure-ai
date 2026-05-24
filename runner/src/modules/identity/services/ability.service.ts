import type {
  RunnerAbilityRule,
  RunnerDataPermissionRule,
  RunnerIdentityContext,
} from '../types/identity.types';
import { RunnerPermissionType } from '../enums/identity.enums';
import type { RunnerIdentityRepository } from '../repositories/identity.repository';

/**
 * @title Runner Ability Service (本地优先 + push hint fallback)
 * @description 与 SaaS AbilityService can/cannot API 同形:
 *              - buildForPrincipal(principalId) :: 查 runner 本地 mongo, 返回 rules + can/cannot, 带 30s TTL cache
 *              - fromContext(identityHint) :: 静态版, 接 SaaS push hint 直接组装 can/cannot (用于本地查不到时的 fallback)
 *              - extractIdentityHint(extras) :: 从 ctx.extras.identitySaasHint 容错读取 SaaS push 来的 hint
 *
 *              caller principal 的 ability 计算优先级:
 *                1. 本地存在 principal + 至少一条 membership → 用本地 rules
 *                2. 本地不存在 + 有 SaaS push hint → 用 hint rules (fallback)
 *                3. 都没有 → 空 rules (按"拒绝"策略, middleware 兜底返回 permission-denied)
 * @keywords-cn Runner能力服务, 本地优先, hint回退, CASL, can-cannot
 * @keywords-en runner-ability-service, local-first, hint-fallback, casl
 */
export class RunnerAbilityService {
  private readonly cache = new Map<
    string,
    { value: { rules: RunnerAbilityRule[]; dataPermissions: RunnerDataPermissionRule[] }; expiresAt: number }
  >();
  private readonly TTL_MS = 30_000;

  constructor(private readonly repo: RunnerIdentityRepository) {}

  /**
   * 给 principalId 求 ability rules + data permissions, 带本地 30s cache.
   * 失败返回空数组 (不抛, 让 middleware 决定怎么处理).
   * @keyword-en build-for-principal
   */
  async buildForPrincipal(principalId: string): Promise<{
    rules: RunnerAbilityRule[];
    dataPermissions: RunnerDataPermissionRule[];
    can: (action: string, subject: string) => boolean;
    cannot: (action: string, subject: string) => boolean;
    /** 是否本地真实匹配 (false 表示空, 中间件可能 fallback 到 hint) */
    matched: boolean;
  }> {
    const cached = this.cache.get(principalId);
    if (cached && cached.expiresAt > Date.now()) {
      return this.assemble(cached.value.rules, cached.value.dataPermissions, true);
    }
    const roleIds = await this.repo.listRoleIdsByPrincipal(principalId);
    if (roleIds.length === 0) {
      // 本地无 membership; 不写 cache (避免锁住"空"状态), 让 middleware fallback 到 hint
      return this.assemble([], [], false);
    }
    const mgmtPerms = await this.repo.listPermissionsByRoles(
      roleIds,
      RunnerPermissionType.Management,
    );
    const dataPerms = await this.repo.listPermissionsByRoles(
      roleIds,
      RunnerPermissionType.Data,
    );
    const rules: RunnerAbilityRule[] = this.dedupe(
      mgmtPerms.map((p) => ({ action: p.action, subject: p.subject })),
    );
    const dataRules: RunnerDataPermissionRule[] = dataPerms.map((p) => ({
      table: p.subject,
      nodeKey: p.nodeKey ?? `${p.subject}:${p.action}`,
      action: p.action,
    }));
    this.cache.set(principalId, {
      value: { rules, dataPermissions: dataRules },
      expiresAt: Date.now() + this.TTL_MS,
    });
    return this.assemble(rules, dataRules, true);
  }

  /**
   * 清掉指定 principalId 的 cache (admin hooks 改完权限后用).
   * @keyword-en invalidate-cache
   */
  invalidate(principalId?: string): void {
    if (principalId) this.cache.delete(principalId);
    else this.cache.clear();
  }

  /**
   * 静态版: 用 SaaS push 的 hint 直接组装 can/cannot, 无副作用.
   * @keyword-en from-context, hint-static
   */
  static fromContext(identityHint: RunnerIdentityContext | undefined): {
    rules: RunnerAbilityRule[];
    dataPermissions: RunnerDataPermissionRule[];
    can: (action: string, subject: string) => boolean;
    cannot: (action: string, subject: string) => boolean;
  } {
    const rules = identityHint?.abilityRules ?? [];
    const dataPermissions = identityHint?.dataPermissions ?? [];
    const can = (action: string, subject: string): boolean =>
      RunnerAbilityService.canMatch(rules, action, subject);
    const cannot = (action: string, subject: string): boolean =>
      !can(action, subject);
    return { rules, dataPermissions, can, cannot };
  }

  /**
   * 从 extras 提取 SaaS push 的 identity hint (旧字段 `identity` 兼容; 新字段 `identitySaasHint`).
   * @keyword-en extract-identity-hint
   */
  static extractIdentityHint(
    extras: Record<string, unknown> | undefined,
  ): RunnerIdentityContext | undefined {
    if (!extras || typeof extras !== 'object') return undefined;
    const obj = extras as Record<string, unknown>;
    const hint = obj.identitySaasHint ?? obj.identity;
    if (!hint || typeof hint !== 'object') return undefined;
    return hint as RunnerIdentityContext;
  }

  // ============= internals =============

  private assemble(
    rules: RunnerAbilityRule[],
    dataPermissions: RunnerDataPermissionRule[],
    matched: boolean,
  ): {
    rules: RunnerAbilityRule[];
    dataPermissions: RunnerDataPermissionRule[];
    can: (action: string, subject: string) => boolean;
    cannot: (action: string, subject: string) => boolean;
    matched: boolean;
  } {
    const can = (action: string, subject: string): boolean =>
      RunnerAbilityService.canMatch(rules, action, subject);
    const cannot = (action: string, subject: string): boolean =>
      !can(action, subject);
    return { rules, dataPermissions, can, cannot, matched };
  }

  private dedupe(rules: RunnerAbilityRule[]): RunnerAbilityRule[] {
    const seen = new Set<string>();
    const out: RunnerAbilityRule[] = [];
    for (const r of rules) {
      const k = `${r.action}::${r.subject}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out;
  }

  static canMatch(
    rules: RunnerAbilityRule[],
    action: string,
    subject: string,
  ): boolean {
    return rules.some((r) => {
      const actionMatch =
        r.action === action || r.action === 'manage' || r.action === '*';
      const subjectMatch = r.subject === subject || r.subject === '*';
      return actionMatch && subjectMatch;
    });
  }
}

import { z, type ZodTypeAny } from 'zod';
import type { RunnerHookBusService } from '../services/hookbus.service';
import type {
  HookFilter,
  HookInvocationContext,
  HookRequiredAbility,
  HookResult,
} from '../types/hook.types';

/**
 * @title Lifecycle 上报 envelope 形状
 * @description 与 SaaS 端 @HookLifecycle 一致: { input, meta?, ok?, result?, error? }。
 *              声明阶段仅写 input 形状, runtime 自动包装成 envelope schema 落到 hookBus metadata。
 * @keywords-cn 生命周期信封, 上报体, 输入输出
 * @keywords-en lifecycle-envelope, report-body, input-output
 */
export interface HookLifecycleEnvelope<TInput = unknown, TResult = unknown> {
  input: TInput;
  meta?: Record<string, unknown>;
  ok?: boolean;
  result?: TResult;
  error?: { message: string; name?: string } | unknown;
}

/**
 * @title Lifecycle 声明
 * @description 应用通过 declare 上报: 哪个 hook + 描述 + input zod schema(可选) + 标签等。
 *              runtime 把声明转成 hookBus.register, 同名再 declare 触发热替换。
 * @keywords-cn 生命周期声明, 应用上报, 热更新
 * @keywords-en lifecycle-declaration, app-report, hot-update
 */
export interface HookLifecycleDeclaration {
  hook: string;
  description: string;
  /** input 形状; 框架自动包成 envelope, 不要自己包 input 字段 */
  payloadSchema?: ZodTypeAny;
  middlewares?: string[];
  errorMode?: 'capture' | 'throw';
  filter?: HookFilter;
  tags?: string[];
  pluginName?: string;
  methodRef?: string;
  /**
   * 调用方所需能力 (action/subject); 与 SaaS @CheckAbility 对齐。
   * Runner 不校验, 仅透传到 hookBus.metadata 让 SaaS 派发前过 HookAbilityMiddleware,
   * 同时 runner.system.hookbus.getInfo 会带出该字段给 LLM 自查。
   * @keyword-en required-ability
   */
  requiredAbility?: HookRequiredAbility | HookRequiredAbility[];
}

/** lifecycle 注册的统一 tag, 热替换时按此 tag 识别同来源旧项 */
const LIFECYCLE_TAG = 'lifecycle';

/**
 * 把 input schema 包成 lifecycle envelope schema
 * envelope shape :: { input, meta?, ok?, result?, error? }
 * @keyword-en wrap-lifecycle-envelope-schema
 */
function wrapLifecycleEnvelope(input: ZodTypeAny): ZodTypeAny {
  return z
    .object({
      input,
      meta: z.unknown().optional(),
      ok: z.boolean().optional(),
      result: z.unknown().optional(),
      error: z.unknown().optional(),
    })
    .passthrough();
}

/**
 * @title Hook Lifecycle Registry (Runner)
 * @description Runner 端应用 hook 声明式注册中心, 三个口子:
 *              - declare(decl)   :: 应用上报 hook, 同名幂等替换 (按 LIFECYCLE_TAG 清同源旧项)
 *              - undeclare(name) :: 应用主动撤销
 *              - report(name, envelope, ctx?) :: 业务方法完成时上报为 hook 事件, 走 hookBus.emit
 *              不依赖装饰器/反射, 完全声明式; 声明落 hookBus 后 runner.system.hookbus.search / runner.system.hookbus.getInfo 自动可见,
 *              SaaS 不维护 runner 镜像, LLM 调用前用元 hook 自查即可。
 * @keywords-cn 生命周期注册, 声明式, 热更新, 上报端点
 * @keywords-en lifecycle-registry, declarative, hot-reload, report-endpoint
 */
export class HookLifecycleRegistry {
  private readonly declarations = new Map<string, HookLifecycleDeclaration>();

  constructor(private readonly hookBus: RunnerHookBusService) {}

  /**
   * @title 上报 hook 声明
   * @description 幂等; 同名 hook 后到覆盖前到, 内部按 LIFECYCLE_TAG predicate 清同源旧 hookBus 注册,
   *              不影响其他来源 (如 unit-core / meta) 的同名注册。
   * @keyword-en declare-hook-lifecycle
   */
  declare(decl: HookLifecycleDeclaration): void {
    const hook = decl.hook?.trim();
    if (!hook) throw new Error('declare: hook name required');
    if (!decl.description?.trim()) {
      throw new Error('declare: description required');
    }
    const normalized: HookLifecycleDeclaration = { ...decl, hook };
    this.declarations.set(hook, normalized);
    this.hookBus.unregister(hook, (reg) =>
      (reg.metadata?.tags ?? []).includes(LIFECYCLE_TAG),
    );
    this.hookBus.register(
      hook,
      () => ({
        status: 'success',
        data: { lifecycle: true, hook },
      }),
      {
        pluginName: decl.pluginName ?? LIFECYCLE_TAG,
        tags: [LIFECYCLE_TAG, ...(decl.tags ?? [])],
        description: decl.description,
        middlewares: decl.middlewares,
        errorMode: decl.errorMode,
        methodRef: decl.methodRef,
        payloadSchema: decl.payloadSchema
          ? wrapLifecycleEnvelope(decl.payloadSchema)
          : undefined,
        requiredAbility: decl.requiredAbility,
      },
    );
  }

  /**
   * @title 撤销 hook 声明
   * @description 从 registry 删除并清除 hookBus 中同 LIFECYCLE_TAG 的注册项。
   * @keyword-en undeclare-hook-lifecycle
   */
  undeclare(hook: string): boolean {
    const key = hook?.trim();
    if (!key || !this.declarations.delete(key)) return false;
    this.hookBus.unregister(key, (reg) =>
      (reg.metadata?.tags ?? []).includes(LIFECYCLE_TAG),
    );
    return true;
  }

  /**
   * @title 上报 lifecycle 事件
   * @description 业务方法完成后调用, 把结果包成 envelope 走 hookBus.emit; 与 SaaS 拦截器对齐,
   *              失败不抛, 软返回 errorMsg, 由订阅链自行决定是否中断。
   * @keyword-en report-hook-lifecycle
   */
  async report<TInput = unknown, TResult = unknown>(
    hook: string,
    envelope: HookLifecycleEnvelope<TInput, TResult>,
    context?: HookInvocationContext,
  ): Promise<Array<HookResult<unknown>>> {
    const key = hook?.trim();
    if (!key || !this.declarations.has(key)) {
      return [{ status: 'error', error: `lifecycle-not-declared: ${hook}` }];
    }
    try {
      return await this.hookBus.emit({
        name: key,
        payload: envelope,
        context,
      });
    } catch (err) {
      return [
        {
          status: 'error',
          error: err instanceof Error ? err.message : 'lifecycle-report-failed',
        },
      ];
    }
  }

  /**
   * @title 列出当前声明
   * @description 调试/自查; 返回 registry 内存中所有 lifecycle 声明的快照副本。
   * @keyword-en list-lifecycle-declarations
   */
  list(): HookLifecycleDeclaration[] {
    return Array.from(this.declarations.values());
  }
}

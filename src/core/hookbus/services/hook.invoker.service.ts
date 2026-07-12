import { Injectable, Logger } from '@nestjs/common';
import { z, type ZodTypeAny } from 'zod';
import { HookResultStatus } from '../enums/hook.enums';
import type {
  HookEvent,
  HookRegistration,
  HookMiddleware,
  HookResult,
} from '../types/hook.types';
import { HookCacheService } from '../cache/hook.cache';
import { createHookLogSession } from '@core/observability/services/hook-log.factory';
import { runWithHookLog } from '@core/observability/services/hook-log.context';

/** 一个值是否是"空占位": null / undefined / 空串或纯空白串 */
function isEmptyPlaceholder(element: unknown): boolean {
  return (
    element === null ||
    element === undefined ||
    (typeof element === 'string' && element.trim() === '')
  );
}

/**
 * 统一归一 payload 里的空占位 —— 低能模型常用 `""` 当"空参"。payload 现为**单对象**约定。规则:
 * **整个 payload 为空占位 → 空对象 {}** (如 `""`→`{}`, 适配全可选对象的 hook);
 * **payload 是对象且某些字段为空占位 → 该字段值置 null** (如 `{id:"x",name:""}`→`{id:"x",name:null}`)。
 * 无空占位则原样返回, 不影响正常 payload。在 schema 校验前统一做。
 * @keyword-cn 空占位归一, payload序列化
 * @keyword-en normalize-empty-placeholder, payload-serialize
 */
function normalizePayloadEmpties(payload: unknown): unknown {
  // 整个 payload 是空占位 (含 "" / null / undefined) → 归一为空对象, 适配无参 / 全可选 hook
  if (isEmptyPlaceholder(payload)) return {};
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const entries = Object.entries(payload as Record<string, unknown>);
    if (entries.some(([, v]) => isEmptyPlaceholder(v))) {
      return Object.fromEntries(
        entries.map(([k, v]) => [k, isEmptyPlaceholder(v) ? null : v]),
      );
    }
  }
  return payload;
}

/**
 * @title Hook 调用器服务
 * @description 串接全局中间件 + 声明级中间件 + 命中的 handler。
 *              统一签名 (event, next) => HookResult, 无 ctx wrapper。
 * @keywords-cn Hook调用, 中间件链, 状态缓存
 * @keywords-en hook-invoker, middleware-chain, status-cache
 */
@Injectable()
export class HookInvokerService {
  private readonly logger = new Logger(HookInvokerService.name);
  private middlewares: HookMiddleware[] = [];
  private namedMiddlewares = new Map<string, HookMiddleware>();

  constructor(private readonly cache: HookCacheService) {}

  use(mw: HookMiddleware): void {
    this.middlewares.push(mw);
  }

  useNamed(name: string, mw: HookMiddleware): void {
    this.namedMiddlewares.set(name, mw);
  }

  /**
   * 调用一个 event 的所有命中 registration, 并发执行 + 状态缓存
   * @keyword-en invoke-hook
   */
  async invoke<T, R>(
    event: HookEvent<T>,
    regs: HookRegistration<T, R>[],
  ): Promise<HookResult<R>[]> {
    if (!regs.length) {
      await this.safeRecordStatus(event.name, HookResultStatus.Skipped);
      return [{ status: HookResultStatus.Skipped }];
    }

    // event.context.extras.debug=true 触发 OTel sandbox tracer (单次调用范围内, 多个命中 reg 各持独立会话)
    const debug = Boolean(event.context?.extras?.debug);
    const upstreamTraceId = event.context?.traceId;

    const tasks = regs.map(async (reg) => {
      const start = Date.now();
      const session = createHookLogSession({
        hookName: event.name,
        debug,
        upstreamTraceId,
      });
      const eventMws = (event.declaration?.middlewares ?? [])
        .map((name) => this.namedMiddlewares.get(name))
        .filter((item): item is HookMiddleware<T, R> => Boolean(item));
      const chain = this.compose<T, R>(
        [...eventMws, ...this.middlewares] as HookMiddleware<T, R>[],
        async (ev) => this.runHandlerWithSchema(reg, ev),
      );
      // metadata.requiredAbility 镜像到 event.declaration 给中间件读 (不污染原 event)
      const decorated: HookEvent<T> = {
        ...event,
        log: session.log,
        ...(reg.metadata?.requiredAbility
          ? {
              declaration: {
                ...event.declaration,
                requiredAbility: reg.metadata.requiredAbility,
              },
            }
          : {}),
      };
      try {
        // ALS 包 chain 调用, 让 controller / service 内通过 getCurrentHookLog() 拿到 session.log
        const res = await runWithHookLog(session.log, () => chain(decorated));
        const duration = Date.now() - start;
        await this.safeRecordStatus(event.name, res.status);
        const debugLog = session.finalize({
          ok: res.status !== HookResultStatus.Error,
          ...(res.error ? { error: res.error } : {}),
        });
        return {
          ...res,
          durationMs: duration,
          ...(debugLog.length > 0 ? { debugLog } : {}),
        } as HookResult<R>;
      } catch (e) {
        const duration = Date.now() - start;
        const msg = (e as Error)?.message ?? 'Hook execution error';
        await this.safeRecordStatus(event.name, HookResultStatus.Error);
        const debugLog = session.finalize({ error: msg });
        return {
          status: HookResultStatus.Error,
          error: msg,
          durationMs: duration,
          ...(debugLog.length > 0 ? { debugLog } : {}),
        } as HookResult<R>;
      }
    });
    const settled = await Promise.allSettled(tasks);
    return settled.map((s) =>
      s.status === 'fulfilled'
        ? s.value
        : { status: HookResultStatus.Error, error: 'handler crashed' },
    );
  }

  /**
   * 紧贴 handler 的 zod payload 校验; metadata.payloadSchema 缺省时跳过 (兼容存量 hook)
   * @keyword-en run-handler-with-schema
   */
  private async runHandlerWithSchema<T, R>(
    reg: HookRegistration<T, R>,
    event: HookEvent<T>,
  ): Promise<HookResult<R>> {
    const schema = reg.metadata?.payloadSchema;
    if (!schema) return await reg.handler(event);
    // 统一序列化: 归一空占位 (单值且空→{}, 多值里的空→null); 校验/报错/handler 都用归一后的 payload。
    const payload = normalizePayloadEmpties(event.payload);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      // 转一次 JSON Schema, 既用于逐字段取 fieldSchema, 又用于末尾全量兜底展示
      const jsonSchema = this.toJsonSchemaSafe(schema);
      const detail = parsed.error.issues
        .map((i) =>
          this.formatPayloadSchemaIssue(i.path, i.message, payload, jsonSchema),
        )
        .join('; ');
      // payload 仍含空占位 = 你送了空占位, 不是传输层改的; 命中就加一句硬指认, 掐断"平台序列化 bug"的误判
      const hasEmptyPlaceholder = parsed.error.issues.some((i) => {
        const actual = this.readPayloadPath(payload, i.path);
        return actual === '' || actual === null;
      });
      return {
        status: HookResultStatus.Error,
        // 每个报错字段自带 fieldSchema, 指名让 LLM 照该字段 schema 只重生成该字段的值; 全量 schema 仅兜底放末尾
        error:
          `payload-schema-invalid: ${detail}. ` +
          `→ You built this payload and its shape is wrong. The transport never rewrites, drops, or empties payload — ` +
          `${hasEmptyPlaceholder ? 'an empty string "" means you literally sent an empty string, ' : ''}` +
          `this is NOT a platform or serialization bug. ` +
          `For EACH failing field above, read that field's own \`fieldSchema\` and regenerate ONLY that field's value to satisfy it — ` +
          `do not blank the whole object or re-send a placeholder. ` +
          `payload is a SINGLE object — send the object directly (e.g. {"id":"..."}), ` +
          `pass {} (or omit) for a no-arg hook, never send ""/null/placeholder. ` +
          `Do NOT call init_tip / re-discover the hook. ` +
          `The complete authoritative format for this hook is exactly what \`get_hook_info\` returns as payloadSchema — ` +
          `it is ALREADY inlined below as expectedPayloadSchema (align every field to it; no need to re-call get_hook_info unless you want to re-confirm). ` +
          `Full structure for reference — expectedPayloadSchema=${this.previewSchemaValue(jsonSchema)}`,
      } as HookResult<R>;
    }
    return await reg.handler({ ...event, payload: parsed.data as T });
  }

  /**
   * 把当前 hook 的 zod payload schema 转成 JSON Schema 对象 (转换一次, 供逐字段 fieldSchema 提取 + 末尾全量展示复用)。
   * @keyword-cn schema转换, 逐字段schema
   * @keyword-en json-schema-convert, field-schema
   */
  private toJsonSchemaSafe(schema: ZodTypeAny): unknown {
    try {
      return z.toJSONSchema(schema);
    } catch {
      const schemaDef = (
        schema as { _def?: { type?: string; typeName?: string } }
      )._def;
      return { type: schemaDef?.type ?? schemaDef?.typeName ?? 'zod-schema' };
    }
  }

  /**
   * 沿 zod 错误 path 从 JSON Schema 里取出该报错字段自己的子 schema, 让 LLM 只按这个字段改值。
   * @description 支持 tuple 的 prefixItems[n] / array 的 items / object 的 properties[key]; 取不到返回 undefined。
   * @keyword-cn 逐字段schema, 子schema提取
   * @keyword-en field-schema, subschema-resolve
   */
  private resolveFieldSchema(
    jsonSchema: unknown,
    path: ReadonlyArray<PropertyKey>,
  ): unknown {
    let node: unknown = jsonSchema;
    for (const part of path) {
      if (!node || typeof node !== 'object') return undefined;
      const rec = node as Record<string, unknown>;
      if (typeof part === 'number') {
        const prefix = Array.isArray(rec.prefixItems)
          ? rec.prefixItems
          : undefined;
        node = prefix && part < prefix.length ? prefix[part] : rec.items;
        continue;
      }
      if (typeof part === 'symbol') return undefined;
      const props =
        rec.properties && typeof rec.properties === 'object'
          ? (rec.properties as Record<string, unknown>)
          : undefined;
      if (!props || !(part in props)) return undefined;
      node = props[part];
    }
    return node;
  }

  /**
   * 格式化 zod payload 错误 :: 输出字段路径、实际类型和值、**该字段自己的 fieldSchema**, 让 LLM 照字段 schema 改值。
   * @keyword-en format-payload-schema-issue
   */
  private formatPayloadSchemaIssue(
    path: ReadonlyArray<PropertyKey>,
    message: string,
    payload: unknown,
    jsonSchema: unknown,
  ): string {
    const field = this.formatPayloadPath(path);
    const actual = this.readPayloadPath(payload, path);
    const fieldSchema = this.resolveFieldSchema(jsonSchema, path);
    return [
      `field=${field}`,
      `actualType=${this.describeType(actual)}`,
      `actualValue=${this.previewValue(actual)}`,
      `fieldSchema=${
        fieldSchema === undefined ? 'n/a' : this.previewSchemaValue(fieldSchema)
      }`,
      `message=${JSON.stringify(message)}`,
    ].join(' ');
  }

  /**
   * 把 zod path 转成 LLM 更易懂的 payload 路径。
   * @keyword-en format-payload-path
   */
  private formatPayloadPath(path: ReadonlyArray<PropertyKey>): string {
    if (path.length === 0) return 'payload';
    return path.reduce<string>((acc, part) => {
      if (typeof part === 'number') return `${acc}[${part}]`;
      if (typeof part === 'symbol') return `${acc}.${String(part)}`;
      return `${acc}.${part}`;
    }, 'payload');
  }

  /**
   * 从实际 payload 中读取 zod path 对应的值。
   * @keyword-en read-payload-path
   */
  private readPayloadPath(
    payload: unknown,
    path: ReadonlyArray<PropertyKey>,
  ): unknown {
    let cur = payload;
    for (const part of path) {
      if (cur == null) return undefined;
      if (typeof part === 'number') {
        if (!Array.isArray(cur)) return undefined;
        cur = cur[part];
        continue;
      }
      if (typeof cur !== 'object') return undefined;
      if (typeof part === 'symbol') return undefined;
      cur = (cur as Record<string, unknown>)[part];
    }
    return cur;
  }

  /**
   * 返回适合错误消息展示的 JS 值类型。
   * @keyword-en describe-actual-type
   */
  private describeType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * 压缩展示实际字段值, 避免错误消息过长。
   * @keyword-en preview-schema-value
   */
  private previewValue(value: unknown): string {
    if (value === undefined) return 'undefined';
    const raw = JSON.stringify(value);
    // JSON.stringify 对 function / symbol / 含循环引用的对象返回 undefined; 用 typeof 兜底, 避免 [object Object]
    if (!raw) return `<${typeof value}>`;
    return raw.length > 160 ? `${raw.slice(0, 157)}...` : raw;
  }

  /**
   * 压缩展示 JSON Schema, 保留比实际字段值更长的上下文供 LLM 修正 payload。
   * @keyword-cn schema预览, payload校验
   * @keyword-en schema-preview, payload-validation
   */
  private previewSchemaValue(value: unknown): string {
    if (value === undefined) return 'undefined';
    const raw = JSON.stringify(value);
    if (!raw) return `<${typeof value}>`;
    // 返回完整 payloadSchema 供 LLM 逐字段对齐 payload; 仅极端超长 (>16000) 才截断防爆炸。
    return raw.length > 16000 ? `${raw.slice(0, 15997)}...` : raw;
  }

  private compose<T, R>(
    middlewares: HookMiddleware<T, R>[],
    last: (event: HookEvent<T>) => Promise<HookResult<R>>,
  ) {
    return async (event: HookEvent<T>): Promise<HookResult<R>> => {
      let idx = -1;
      const dispatch = async (i: number): Promise<HookResult<R>> => {
        if (i <= idx) throw new Error('next() called multiple times');
        idx = i;
        const fn = middlewares[i] ?? last;
        return await fn(event, () => dispatch(i + 1));
      };
      return await dispatch(0);
    };
  }

  private async safeRecordStatus(
    hook: string,
    status: HookResultStatus,
  ): Promise<void> {
    try {
      await this.cache.recordStatus(hook, status);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Failed to record hook status for "${hook}": ${msg}`);
    }
  }
}

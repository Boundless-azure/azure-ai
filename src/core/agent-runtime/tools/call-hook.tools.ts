import { tool } from 'langchain';
import z from 'zod';
import type { HookBusService } from '@/core/hookbus/services/hook.bus.service';

/**
 * @title call_hook / call_hook_async / call_hook_batch_sync / call_hook_batch LangChain 工具
 * @description 提供四个通用 hook 调用工具，供 Agent 对话层 LLM 使用：
 * - call_hook: 同步调用 HookBus，等待所有 handler 返回结果
 * - call_hook_async: 异步 fire-and-forget，立即返回，不等待结果
 * - call_hook_batch_sync: 批量同步调用，并发执行多个 hook，等待全部结果
 * - call_hook_batch: 批量 fire-and-forget，一次触发多个 hook，不等待结果
 * @keywords-cn call_hook, call_hook_async, call_hook_batch_sync, call_hook_batch, HookBus工具, Agent工具
 * @keywords-en call-hook-tool, call-hook-async-tool, call-hook-batch-sync-tool, call-hook-batch-tool, hookbus, agent-tool
 */

const hookCallSchema = z.object({
  hookName: z.string().describe('要调用的 HookBus hook 名称，例如 send_msg、web_control'),
  payload:  z.record(z.string(), z.unknown()).optional().describe('传递给 hook handler 的参数对象'),
});

const hookBatchSchema = z.object({
  calls: z.array(
    z.object({
      hookName: z.string().describe('hook 名称'),
      payload:  z.record(z.string(), z.unknown()).optional().describe('hook 参数对象'),
    }),
  ).min(1).describe('要批量调用的 hook 列表，每项包含 hookName 和可选 payload'),
});

/**
 * 构建 call_hook 同步工具（等待 handler 返回）
 * @keyword-en build-call-hook-tool
 */
export function buildCallHookTool(hookBus: HookBusService) {
  return tool(
    async (input: z.infer<typeof hookCallSchema>): Promise<string> => {
      try {
        const results = await hookBus.emit({
          name: input.hookName,
          payload: input.payload ?? {},
        });
        return JSON.stringify(results);
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
      }
    },
    {
      name: 'call_hook',
      description:
        '同步调用指定 HookBus hook 并等待执行结果。' +
        '适用于需要获取返回数据的场景（例如查询知识、发送消息并确认）。' +
        '参数 hookName 为 hook 名称，payload 为传入参数对象。',
      schema: hookCallSchema,
    },
  );
}

/**
 * 构建 call_hook_async 异步工具（fire-and-forget）
 * @keyword-en build-call-hook-async-tool
 */
export function buildCallHookAsyncTool(hookBus: HookBusService) {
  return tool(
    (input: z.infer<typeof hookCallSchema>): string => {
      // fire-and-forget: 不 await
      hookBus.emit({
        name: input.hookName,
        payload: input.payload ?? {},
      }).catch(() => { /* ignore */ });
      return JSON.stringify({ queued: true, hookName: input.hookName });
    },
    {
      name: 'call_hook_async',
      description:
        '异步触发指定 HookBus hook（fire-and-forget），立即返回，不等待执行结果。' +
        '适用于触发后台任务、不关心返回值的场景（例如启动工作流）。' +
        '参数 hookName 为 hook 名称，payload 为传入参数对象。',
      schema: hookCallSchema,
    },
  );
}

/**
 * 构建 call_hook_batch_sync 批量同步工具（并发调用，等待全部结果）
 * @keyword-en build-call-hook-batch-sync-tool
 */
export function buildCallHookBatchSyncTool(hookBus: HookBusService) {
  return tool(
    async (input: z.infer<typeof hookBatchSchema>): Promise<string> => {
      try {
        const results = await Promise.all(
          input.calls.map((c) =>
            hookBus.emit({ name: c.hookName, payload: c.payload ?? {} }).catch((e) => ({
              error: e instanceof Error ? e.message : String(e),
            })),
          ),
        );
        return JSON.stringify(results);
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
      }
    },
    {
      name: 'call_hook_batch_sync',
      description:
        '批量同步调用多个 HookBus hook，并发执行并等待全部结果后返回。' +
        '适用于需要同时查询多个数据源、同时读取多个知识章节等场景。' +
        '参数 calls 为 hook 调用列表，每项包含 hookName 和可选 payload。',
      schema: hookBatchSchema,
    },
  );
}

/**
 * 构建 call_hook_batch 批量异步工具（fire-and-forget 批量触发）
 * @keyword-en build-call-hook-batch-tool
 */
export function buildCallHookBatchTool(hookBus: HookBusService) {
  return tool(
    (input: z.infer<typeof hookBatchSchema>): string => {
      for (const c of input.calls) {
        hookBus.emit({ name: c.hookName, payload: c.payload ?? {} }).catch(() => { /* ignore */ });
      }
      return JSON.stringify({ queued: true, count: input.calls.length });
    },
    {
      name: 'call_hook_batch',
      description:
        '批量 fire-and-forget 触发多个 HookBus hook，立即返回，不等待任何结果。' +
        '适用于同时启动多个后台任务且不需要结果的场景。' +
        '参数 calls 为 hook 调用列表，每项包含 hookName 和可选 payload。',
      schema: hookBatchSchema,
    },
  );
}


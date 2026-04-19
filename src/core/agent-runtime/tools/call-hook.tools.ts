import { tool } from 'langchain';
import z from 'zod';
import type { HookBusService } from '@/core/hookbus/services/hook.bus.service';

/**
 * @title call_hook / call_hook_async LangChain 工具
 * @description 提供两个通用 hook 调用工具，供 Agent 对话层 LLM 使用：
 * - call_hook: 同步调用 HookBus，等待所有 handler 返回结果
 * - call_hook_async: 异步 fire-and-forget，立即返回，不等待结果
 * @keywords-cn call_hook, call_hook_async, HookBus工具, Agent工具, 通用hook
 * @keywords-en call-hook-tool, call-hook-async-tool, hookbus, agent-tool, generic-hook
 */

const hookCallSchema = z.object({
  hookName: z.string().describe('要调用的 HookBus hook 名称，例如 send_msg、web_control'),
  payload:  z.record(z.string(), z.unknown()).optional().describe('传递给 hook handler 的参数对象'),
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
        '适用于需要获取返回数据的场景（例如查询数据、发送消息并确认）。' +
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

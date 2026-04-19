import { z } from 'zod';

/**
 * @title HookBus Debug 类型
 * @description 定义调试页连接、请求历史与调试结果类型。
 * @keywords-cn hookbus调试类型, 请求历史, 调试结果
 * @keywords-en hookbus-debug-types, request-history, debug-result
 */
export const HookBusRegistrationSchema = z.object({
  name: z.string(),
  metadata: z
    .object({
      pluginId: z.string().optional(),
      pluginName: z.string().optional(),
      tags: z.array(z.string()).optional(),
      description: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export type HookBusRegistration = z.infer<typeof HookBusRegistrationSchema>;

export interface HookBusDebugRecord {
  id: string;
  hookName: string;
  endpoint: string;
  payloadText: string;
  createdAt: number;
  resultText: string;
  ok: boolean;
}

export interface HookBusConnectPayload {
  endpoint: string;
  key: string;
}

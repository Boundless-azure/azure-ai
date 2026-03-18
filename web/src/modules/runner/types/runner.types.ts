/**
 * @title Runner Types
 * @description Runner 模块前端类型与请求校验定义。
 * @keywords-cn Runner类型, 请求类型, 状态
 * @keywords-en runner-types, request-types, status
 */
import { z } from 'zod';

export const RunnerStatusSchema = z.union([z.literal('mounted'), z.literal('offline')]);
export type RunnerStatus = z.infer<typeof RunnerStatusSchema>;

export const RunnerItemSchema = z.object({
  id: z.string(),
  alias: z.string(),
  principalId: z.string(),
  description: z.string().nullable().optional(),
  status: RunnerStatusSchema,
  active: z.boolean(),
  runnerKey: z.string(),
  lastSeenAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type RunnerItem = z.infer<typeof RunnerItemSchema>;

export const CreateRunnerRequestSchema = z.object({
  alias: z.string().min(2).max(120),
  description: z.string().optional(),
  principalDisplayName: z.string().min(2).max(120).optional(),
});
export type CreateRunnerRequest = z.infer<typeof CreateRunnerRequestSchema>;

export const UpdateRunnerRequestSchema = z.object({
  alias: z.string().min(2).max(120).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});
export type UpdateRunnerRequest = z.infer<typeof UpdateRunnerRequestSchema>;

export const CreateRunnerResultSchema = z.object({
  id: z.string(),
  alias: z.string(),
  principalId: z.string(),
  description: z.string().nullable(),
  status: RunnerStatusSchema,
  active: z.boolean(),
  runnerKey: z.string(),
  lastSeenAt: z.string().nullable().optional(),
});
export type CreateRunnerResult = z.infer<typeof CreateRunnerResultSchema>;

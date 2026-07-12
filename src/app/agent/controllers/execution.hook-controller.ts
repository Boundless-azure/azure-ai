import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { AgentExecutionService } from '../services/execution.service';
import { AgentExecutionEntity } from '../entities/agent-execution.entity';
import type {
  QueryExecutionDto,
  UpdateExecutionDto,
} from '../types/agent.types';

/**
 * @title Agent Execution Hook payload schema (input 形状, SSOT)
 * @description 单对象 hook payload; scalar-id → { id }, id+body → { id, ...body }。
 * @keywords-cn AgentExecutionHook, payloadSchema, 单对象payload
 * @keywords-en agent-execution-hook, payload-schema, single-object-payload
 */
const idField = z.object({ id: z.string() });

const onAgentExecutionListInput = z.object({
  agentId: z.string().optional(),
  contextMessageId: z.string().optional(),
  runnerId: z.string().optional(),
});

const onAgentExecutionUpdateInput = z.object({
  nodeStatus: z.record(z.string(), z.unknown()).optional(),
  latestResponse: z.record(z.string(), z.unknown()).optional(),
  contextMessageId: z.string().min(1).max(36).optional(),
  runnerId: z.string().min(1).max(36).optional(),
});

const ExecutionUpdateHookSchema = idField.merge(onAgentExecutionUpdateInput);

/**
 * @title Agent Execution Hook Controller
 * @description agent 执行记录模块的 hook 声明层 (单对象 payload); 从 AgentExecutionController 迁出。
 *   每个 hook 直接调 AgentExecutionService。
 * @keywords-cn 执行AgentHook声明, 单对象payload
 * @keywords-en agent-execution-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'agent', tags: ['agent', 'execution'] })
export class AgentExecutionHookController {
  constructor(private readonly service: AgentExecutionService) {}

  /**
   * Agent 执行记录列表查询。
   * @keyword-cn 执行记录列表, 查询
   * @keyword-en execution-list, query
   */
  @HookRoute({
    hook: 'saas.app.agent.executionList',
    description: 'Agent执行记录列表查询',
    args: [onAgentExecutionListInput],
  })
  @CheckAbility('read', 'agent_execution')
  async list(
    payload: QueryExecutionDto,
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<AgentExecutionEntity[]> {
    return await this.service.list(payload);
  }

  /**
   * Agent 执行记录详情查询。
   * @keyword-cn 执行记录详情, 查询
   * @keyword-en execution-get, query
   */
  @HookRoute({
    hook: 'saas.app.agent.executionGet',
    description: 'Agent执行记录详情查询',
    args: [idField],
  })
  @CheckAbility('read', 'agent_execution')
  async get(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<AgentExecutionEntity | null> {
    return await this.service.get(payload.id);
  }

  /**
   * Agent 执行记录更新。
   * @keyword-cn 执行记录更新
   * @keyword-en execution-update
   */
  @HookRoute({
    hook: 'saas.app.agent.executionUpdate',
    description: 'Agent执行记录更新',
    args: [ExecutionUpdateHookSchema],
  })
  @CheckAbility('update', 'agent_execution')
  async update(
    payload: z.infer<typeof ExecutionUpdateHookSchema>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<AgentExecutionEntity> {
    const { id, ...body } = payload;
    return await this.service.update(id, body as UpdateExecutionDto);
  }

  /**
   * Agent 执行记录删除。
   * @keyword-cn 执行记录删除
   * @keyword-en execution-delete
   */
  @HookRoute({
    hook: 'saas.app.agent.executionDelete',
    description: 'Agent执行记录删除',
    args: [idField],
  })
  @CheckAbility('delete', 'agent_execution')
  async delete(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<{ ok: boolean }> {
    await this.service.delete(payload.id);
    return { ok: true };
  }
}

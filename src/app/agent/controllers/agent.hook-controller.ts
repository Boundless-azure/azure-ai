import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { AgentService } from '../services/agent.service';
import { AgentEntity } from '../entities/agent.entity';
import type {
  QueryAgentDto,
  UpdateAgentDto,
  AgentKnowledgeAssignmentState,
} from '../types/agent.types';

/**
 * @title Agent Hook payload schema (input 形状, SSOT)
 * @description 单对象 hook payload; scalar-id → { id }, id+body → { id, ...body }。
 * @keywords-cn AgentHook, payloadSchema, 单对象payload
 * @keywords-en agent-hook, payload-schema, single-object-payload
 */
const idField = z.object({ id: z.string() });

const onAgentListInput = z.object({
  q: z.string().optional(),
});

const onAgentUpdateInput = z.object({
  nickname: z.string().min(1).max(100).optional(),
  purpose: z.string().optional(),
  avatarUrl: z.string().min(1).max(255).optional(),
  aiModelIds: z.array(z.string()).optional(),
  proactiveChatEnabled: z.boolean().optional(),
});

const onAgentEmbeddingsUpdateInput = z.object({
  ids: z.array(z.string()).optional(),
});

const onAgentKnowledgeAssignmentsUpdateInput = z.object({
  bookIds: z.array(z.string()),
});

const AgentUpdateHookSchema = idField.merge(onAgentUpdateInput);
const AgentKnowledgeAssignmentsUpdateHookSchema = idField.merge(
  onAgentKnowledgeAssignmentsUpdateInput,
);

/**
 * @title Agent Hook Controller
 * @description agent 模块的 hook 声明层 (单对象 payload); 从 AgentController 迁出, HTTP 与 hook 解耦。
 *   每个 hook 直接调 AgentService。
 * @keywords-cn AgentHook声明, 单对象payload
 * @keywords-en agent-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'agent', tags: ['agent'] })
export class AgentHookController {
  constructor(private readonly service: AgentService) {}

  /**
   * Agent 列表查询。
   * @keyword-cn Agent列表, 查询
   * @keyword-en agent-list, query
   */
  @HookRoute({
    hook: 'saas.app.agent.list',
    description: 'Agent列表查询',
    args: [onAgentListInput],
  })
  @CheckAbility('read', 'agent')
  async list(
    payload: QueryAgentDto,
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<AgentEntity[]> {
    return await this.service.list(payload);
  }

  /**
   * Agent 详情查询。
   * @keyword-cn Agent详情, 查询
   * @keyword-en agent-get, query
   */
  @HookRoute({
    hook: 'saas.app.agent.get',
    description: 'Agent详情查询',
    args: [idField],
  })
  @CheckAbility('read', 'agent')
  async get(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<AgentEntity | null> {
    return await this.service.get(payload.id);
  }

  /**
   * Agent 知识分配查询。
   * @keyword-cn Agent知识分配, 查询
   * @keyword-en agent-knowledge-assignments, query
   */
  @HookRoute({
    hook: 'saas.app.agent.knowledgeAssignmentList',
    description: 'Agent知识分配查询',
    args: [idField],
  })
  @CheckAbility('read', 'agent')
  async getKnowledgeAssignments(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<AgentKnowledgeAssignmentState> {
    return await this.service.getKnowledgeAssignments(payload.id);
  }

  /**
   * Agent 更新。
   * @keyword-cn Agent更新
   * @keyword-en agent-update
   */
  @HookRoute({
    hook: 'saas.app.agent.update',
    description: 'Agent更新',
    args: [AgentUpdateHookSchema],
  })
  @CheckAbility('update', 'agent')
  async update(
    payload: z.infer<typeof AgentUpdateHookSchema>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<AgentEntity> {
    const { id, ...body } = payload;
    return await this.service.update(id, body as UpdateAgentDto);
  }

  /**
   * Agent 知识分配更新。
   * @keyword-cn Agent知识分配更新
   * @keyword-en agent-knowledge-assignments-update
   */
  @HookRoute({
    hook: 'saas.app.agent.knowledgeAssignmentUpdate',
    description: 'Agent知识分配更新',
    args: [AgentKnowledgeAssignmentsUpdateHookSchema],
  })
  @CheckAbility('update', 'agent')
  async updateKnowledgeAssignments(
    payload: z.infer<typeof AgentKnowledgeAssignmentsUpdateHookSchema>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<AgentKnowledgeAssignmentState> {
    const { id, bookIds } = payload;
    return await this.service.updateKnowledgeAssignments(id, bookIds);
  }

  /**
   * Agent 删除。
   * @keyword-cn Agent删除
   * @keyword-en agent-delete
   */
  @HookRoute({
    hook: 'saas.app.agent.delete',
    description: 'Agent删除',
    args: [idField],
  })
  @CheckAbility('delete', 'agent')
  async delete(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<{ ok: boolean }> {
    await this.service.delete(payload.id);
    return { ok: true };
  }

  /**
   * Agent 向量更新 (可选 ID 列表, 未提供时全量)。
   * @keyword-cn 向量更新, 全量, 选择
   * @keyword-en embeddings-update, all, selected
   */
  @HookRoute({
    hook: 'saas.app.agent.embeddingsUpdate',
    description: 'Agent向量更新',
    args: [onAgentEmbeddingsUpdateInput],
  })
  @CheckAbility('update', 'agent')
  async updateEmbeddings(
    payload: z.infer<typeof onAgentEmbeddingsUpdateInput>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ): Promise<{
    updated: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    return await this.service.updateEmbeddings(payload?.ids);
  }
}

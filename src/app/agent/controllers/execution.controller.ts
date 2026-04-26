import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { AgentExecutionService } from '../services/execution.service';
import { AgentExecutionEntity } from '../entities/agent-execution.entity';
import { QueryExecutionDto, UpdateExecutionDto } from '../types/agent.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';

/**
 * @title Agent Execution Hook payload schema (input 形状, SSOT)
 * @keywords-cn AgentExecutionHook, payloadSchema, input
 * @keywords-en agent-execution-hook, payload-schema, input
 */
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

const idParamInput = z.object({ id: z.string() });

/**
 * @title 执行Agent 控制器
 * @description 提供执行记录的查询、更新与删除接口（不提供新增）。
 * @keywords-cn 执行Agent控制器, 查询, 更新, 删除
 * @keywords-en agent-execution-controller, query, update, delete
 */
@Controller('agent-execution')
export class AgentExecutionController {
  constructor(private readonly service: AgentExecutionService) {}

  @Get()
  @CheckAbility('read', 'agent_execution')
  @HookLifecycle({
    hook: 'saas.app.agent.executionList',
    description: 'Agent执行记录列表查询',
    payloadSchema: onAgentExecutionListInput,
    payloadSource: 'query',
  })
  async list(
    @Query() query: QueryExecutionDto,
  ): Promise<AgentExecutionEntity[]> {
    return await this.service.list(query);
  }

  @Get(':id')
  @CheckAbility('read', 'agent_execution')
  @HookLifecycle({
    hook: 'saas.app.agent.executionGet',
    description: 'Agent执行记录详情查询',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async get(@Param('id') id: string): Promise<AgentExecutionEntity | null> {
    return await this.service.get(id);
  }

  @Put(':id')
  @CheckAbility('update', 'agent_execution')
  @HookLifecycle({
    hook: 'saas.app.agent.executionUpdate',
    description: 'Agent执行记录更新',
    payloadSchema: onAgentExecutionUpdateInput,
    payloadSource: 'body',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExecutionDto,
  ): Promise<AgentExecutionEntity> {
    return await this.service.update(id, dto);
  }

  @Delete(':id')
  @CheckAbility('delete', 'agent_execution')
  @HookLifecycle({
    hook: 'saas.app.agent.executionDelete',
    description: 'Agent执行记录删除',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.delete(id);
    return { ok: true };
  }
}

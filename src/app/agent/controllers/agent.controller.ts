import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { AgentService } from '../services/agent.service';
import { AgentEntity } from '../entities/agent.entity';
import {
  QueryAgentDto,
  UpdateAgentDto,
  UpdateEmbeddingsDto,
} from '../types/agent.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';

/**
 * @title Agent Hook payload schema (input 形状, SSOT)
 * @keywords-cn AgentHook, payloadSchema, input
 * @keywords-en agent-hook, payload-schema, input
 */
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

const idParamInput = z.object({ id: z.string() });

/**
 * @title Agent 控制器
 * @description 提供 Agent 的查询、更新与删除接口（不提供新增）。
 * @keywords-cn Agent控制器, 查询, 更新, 删除
 * @keywords-en agent-controller, query, update, delete
 */
@Controller('agent')
export class AgentController {
  constructor(private readonly service: AgentService) {}

  @Get()
  @CheckAbility('read', 'agent')
  @HookLifecycle({
    hook: 'saas.app.agent.list',
    description: 'Agent列表查询',
    payloadSchema: onAgentListInput,
    payloadSource: 'query',
  })
  async list(@Query() query: QueryAgentDto): Promise<AgentEntity[]> {
    return await this.service.list(query);
  }

  @Get(':id')
  @CheckAbility('read', 'agent')
  @HookLifecycle({
    hook: 'saas.app.agent.get',
    description: 'Agent详情查询',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async get(@Param('id') id: string): Promise<AgentEntity | null> {
    return await this.service.get(id);
  }

  @Put(':id')
  @CheckAbility('update', 'agent')
  @HookLifecycle({
    hook: 'saas.app.agent.update',
    description: 'Agent更新',
    payloadSchema: onAgentUpdateInput,
    payloadSource: 'body',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
  ): Promise<AgentEntity> {
    return await this.service.update(id, dto);
  }

  @Delete(':id')
  @CheckAbility('delete', 'agent')
  @HookLifecycle({
    hook: 'saas.app.agent.delete',
    description: 'Agent删除',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.delete(id);
    return { ok: true };
  }

  /**
   * @title 更新Agent向量
   * @description 根据传入的ID列表（可选）更新对应Agent的向量；未提供时全量更新。
   * @keywords-cn 向量更新, 全量, 选择
   * @keywords-en embeddings-update, all, selected
   */
  @Post('embeddings')
  @CheckAbility('update', 'agent')
  @HookLifecycle({
    hook: 'saas.app.agent.embeddingsUpdate',
    description: 'Agent向量更新',
    payloadSchema: onAgentEmbeddingsUpdateInput,
    payloadSource: 'body',
  })
  async updateEmbeddings(@Body() dto: UpdateEmbeddingsDto): Promise<{
    updated: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    return await this.service.updateEmbeddings(dto?.ids);
  }
}

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
import { AgentService } from '../services/agent.service';
import { AgentEntity } from '../entities/agent.entity';
import {
  QueryAgentDto,
  UpdateAgentDto,
  UpdateEmbeddingsDto,
} from '../types/agent.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';

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
  async list(@Query() query: QueryAgentDto): Promise<AgentEntity[]> {
    return await this.service.list(query);
  }

  @Get(':id')
  @CheckAbility('read', 'agent')
  async get(@Param('id') id: string): Promise<AgentEntity | null> {
    return await this.service.get(id);
  }

  @Put(':id')
  @CheckAbility('update', 'agent')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
  ): Promise<AgentEntity> {
    return await this.service.update(id, dto);
  }

  @Delete(':id')
  @CheckAbility('delete', 'agent')
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
  async updateEmbeddings(@Body() dto: UpdateEmbeddingsDto): Promise<{
    updated: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    return await this.service.updateEmbeddings(dto?.ids);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { AgentExecutionService } from '../services/execution.service';
import { AgentExecutionEntity } from '../entities/agent-execution.entity';
import { QueryExecutionDto, UpdateExecutionDto } from '../types/agent.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';

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
  async list(
    @Query() query: QueryExecutionDto,
  ): Promise<AgentExecutionEntity[]> {
    return await this.service.list(query);
  }

  @Get(':id')
  @CheckAbility('read', 'agent_execution')
  async get(@Param('id') id: string): Promise<AgentExecutionEntity | null> {
    return await this.service.get(id);
  }

  @Put(':id')
  @CheckAbility('update', 'agent_execution')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExecutionDto,
  ): Promise<AgentExecutionEntity> {
    return await this.service.update(id, dto);
  }

  @Delete(':id')
  @CheckAbility('delete', 'agent_execution')
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.delete(id);
    return { ok: true };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { AgentService } from '../services/agent.service';
import { AgentEntity } from '../entities/agent.entity';
import { QueryAgentDto, UpdateAgentDto } from '../types/agent.types';

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
  async list(@Query() query: QueryAgentDto): Promise<AgentEntity[]> {
    return await this.service.list(query);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<AgentEntity | null> {
    return await this.service.get(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
  ): Promise<AgentEntity> {
    return await this.service.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.delete(id);
    return { ok: true };
  }
}

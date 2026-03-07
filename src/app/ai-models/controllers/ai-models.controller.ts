import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { AiModelsService } from '../services/ai-models.service';
import {
  CreateAiModelDto,
  QueryAiModelDto,
  TestAiModelConnectionDto,
  UpdateAiModelDto,
} from '../types/ai-models.types';

/**
 * @title AI模型控制器
 * @description 管理 AI 模型配置的增删改查接口。
 * @keywords-cn AI模型接口, 模型管理, 提供商配置
 * @keywords-en ai-model-controller, management, provider-config
 */
@Controller('ai-models')
export class AiModelsController {
  constructor(private readonly service: AiModelsService) {}

  @Get()
  @CheckAbility('read', 'ai-model')
  async list(@Query() query: QueryAiModelDto) {
    return await this.service.list(query);
  }

  @Get(':id')
  @CheckAbility('read', 'ai-model')
  async get(@Param('id') id: string) {
    return await this.service.get(id);
  }

  @Post('test-connection')
  @CheckAbility('read', 'ai-model')
  async testConnection(@Body() body: TestAiModelConnectionDto) {
    return await this.service.testConnection(body);
  }

  @Post()
  @CheckAbility('create', 'ai-model')
  async create(@Body() dto: CreateAiModelDto) {
    return await this.service.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'ai-model')
  async update(@Param('id') id: string, @Body() dto: UpdateAiModelDto) {
    await this.service.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'ai-model')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true } as const;
  }
}

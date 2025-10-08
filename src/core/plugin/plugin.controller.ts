import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PluginService } from './plugin.service';
import { PluginEntity } from './plugin.entity';

@Controller('plugin')
export class PluginController {
  constructor(private readonly service: PluginService) {}

  @Get()
  async list(): Promise<PluginEntity[]> {
    return this.service.list();
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<PluginEntity | null> {
    return this.service.get(Number(id));
  }

  @Post('register')
  async register(@Body('pluginDir') pluginDir: string): Promise<PluginEntity> {
    if (!pluginDir) throw new Error('pluginDir is required');
    return this.service.registerByDir(pluginDir);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<PluginEntity>,
  ): Promise<PluginEntity> {
    return this.service.update(Number(id), body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(Number(id));
  }
}

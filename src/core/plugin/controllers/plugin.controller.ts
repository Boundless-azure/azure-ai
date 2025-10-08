import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PluginService } from '../services/plugin.service';
import { PluginEntity } from '../entities/plugin.entity';

/**
 * 插件控制器（REST API）
 * - 基础路径：/plugin
 * - 主要职责：对插件进行查询、注册、更新与删除
 *
 * 约定：
 * - 所有返回类型均为 Promise，以支持异步数据库/文件系统操作
 * - 路由参数与请求体均添加了类型提示，便于 IDE 智能提示与跳转
 */
@Controller('plugin')
export class PluginController {
  constructor(private readonly service: PluginService) {}

  @Get()
  /**
   * 获取插件列表（按更新时间倒序）
   * @returns 插件实体数组
   */
  async list(): Promise<PluginEntity[]> {
    return this.service.list();
  }

  @Get(':id')
  /**
   * 根据主键 ID 获取插件详情
   * @param id 路由参数中的插件 ID（字符串形式，会被转换为数字）
   * @returns 找到则返回 PluginEntity，否则返回 null
   */
  async get(@Param('id') id: string): Promise<PluginEntity | null> {
    return this.service.get(Number(id));
  }

  @Post('register')
  /**
   * 注册（录入）插件：通过插件目录读取配置并生成关键词入库
   * @param pluginDir 请求体中的插件目录（相对或绝对路径），例如：plugins/customer-analytics
   * @returns 保存后的插件实体
   * @throws 当 pluginDir 未提供或配置文件缺失时抛出错误
   */
  async register(@Body('pluginDir') pluginDir: string): Promise<PluginEntity> {
    if (!pluginDir) throw new Error('pluginDir is required');
    return this.service.registerByDir(pluginDir);
  }

  @Put(':id')
  /**
   * 更新插件的可变字段
   * @param id 插件 ID（字符串形式，会被转换为数字）
   * @param body 局部更新的字段（例如 description、keywords 等）
   * @returns 更新后的实体
   */
  async update(
    @Param('id') id: string,
    @Body() body: Partial<PluginEntity>,
  ): Promise<PluginEntity> {
    return this.service.update(Number(id), body);
  }

  @Delete(':id')
  /**
   * 删除插件
   * @param id 插件 ID（字符串形式，会被转换为数字）
   */
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(Number(id));
  }
}

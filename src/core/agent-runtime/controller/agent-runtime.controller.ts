import { Controller, Get, Query } from '@nestjs/common';
import { AgentRuntimeService } from '../services/agent-runtime.service';

/**
 * @title AgentRuntime 控制器（最小占位）
 * @description 暴露只读信息，避免不必要的接口膨胀；核心能力由 Service 提供给内部调用。
 * @keywords-cn 控制器, 只读, 信息查询
 * @keywords-en controller, readonly, info
 */
@Controller('agent-runtime')
export class AgentRuntimeController {
  constructor(private readonly runtime: AgentRuntimeService) {}

  /**
   * 获取指定目录的工具数量（用于验证加载）
   */
  @Get('tools-count')
  async toolsCount(@Query('dir') dir: string): Promise<{ count: number }> {
    const tools = await this.runtime.getTools(dir);
    return { count: Array.isArray(tools) ? tools.length : 0 };
  }
}

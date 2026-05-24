import { Controller, Get } from '@nestjs/common';
import { RunnerService } from '@/app/runner/services/runner.service';
import { RunnerStatus } from '@/app/runner/enums/runner.enums';

/**
 * @title MongoDB Explorer Controller
 * @description MongoDB 浏览器控制器，通过 Runner WebSocket 代理连接 MongoDB
 * @keywords-cn MongoDB浏览器, Runner代理, WebSocket通信
 * @keywords-en mongo-explorer, runner-proxy, websocket-communication
 */
@Controller('mongo-explorer')
export class MongoExplorerController {
  constructor(private readonly runnerService: RunnerService) {}

  /**
   * @title 获取可用的 Runner 列表（带 MongoDB 配置）
   * @description 返回所有在线 Runner 及其 MongoDB 连接信息
   * @note Runner 通过 WebSocket 直接提供 MongoDB 数据，无需 SaaS 存储连接信息
   */
  @Get('runners')
  async getRunnersWithMongo() {
    const runners = await this.runnerService.list({});
    const runnersWithMongo = runners
      .filter((r) => r.status === RunnerStatus.Mounted)
      .map((r) => ({
        id: r.id,
        alias: r.alias,
        status: r.status,
      }));
    return { success: true, data: runnersWithMongo };
  }
}

import { Injectable } from '@nestjs/common';

/**
 * @title MongoDB Explorer Service
 * @description MongoDB 浏览器服务，通过 Runner WebSocket 代理查询 MongoDB
 * @keywords-cn MongoDB浏览器, Runner代理, WebSocket通信
 * @keywords-en mongo-explorer, runner-proxy, websocket-communication
 * @note 此服务不直接连接 MongoDB，而是通过 Runner 的 WebSocket 连接进行查询
 */
@Injectable()
export class MongoExplorerService {
  /**
   * @title 通过 Runner 执行 MongoDB 查询
   * @description 将查询请求发送到指定 Runner 的 WebSocket 连接
   * @param runnerId Runner ID
   * @param query 查询参数
   * @returns 查询结果
   * @note 需要 Runner 在线并支持 MongoDB 代理功能
   */
  executeQueryViaRunner(): {
    documents: Record<string, unknown>[];
    total: number;
    executionTime: number;
  } {
    // TODO: 通过 WebSocket 向 Runner 发送查询请求
    // 目前 Runner Gateway 尚未实现 MongoDB 查询处理
    throw new Error(
      'MongoDB query via Runner WebSocket not yet implemented. Runner must support mongo query protocol.',
    );
  }

  /**
   * @title 获取 Runner MongoDB 状态
   * @description 检查 Runner 是否支持 MongoDB 代理
   * @param runnerId Runner ID
   */
  checkRunnerMongoCapability(): boolean {
    // TODO: 通过 WebSocket 检查 Runner 是否支持 MongoDB 查询
    return false;
  }
}

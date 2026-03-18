import { Module } from '@nestjs/common';
import { WebMcpGateway } from './controllers/webmcp.gateway';
import { WebMcpService } from './services/webmcp.service';

/**
 * @title WebMCP 模块
 * @description 提供 WebMCP 网关与服务，用于与前端页面进行声明与操作协议交互。
 * @keywords-cn WebMCP模块, 网关, 服务
 * @keywords-en webmcp-module, gateway, service
 */
@Module({
  providers: [WebMcpGateway, WebMcpService],
  exports: [WebMcpService],
})
export class WebMcpModule {}

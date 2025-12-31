import type { WebMcpPageDeclaration } from './types/webmcp.types';
import { createWebMcpController } from './controller/webmcp.controller';

/**
 * @title WebMCP Web SDK
 * @description 前端 SDK：统一对外暴露注册/连接/事件/主动注册接口。
 * @keywords-cn WebMCP前端SDK, 注册, 连接, 事件
 * @keywords-en webmcp-web-sdk, register, connect, events
 */
export function createWebMcpSDK() {
  const controller = createWebMcpController();
  return {
    registerPage(decl: WebMcpPageDeclaration) {
      controller.registerPage(decl);
    },
    connect(baseUrl: string) {
      controller.connect(baseUrl);
    },
    on: controller.on,
    registerCurrentPage: controller.registerCurrentPage,
  };
}

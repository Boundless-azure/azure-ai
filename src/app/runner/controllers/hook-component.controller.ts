import { Controller, Get, NotFoundException, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HookComponentRegistryService } from '@/core/hookbus/services/hook-component.registry.service';
import { RunnerProxyService } from '../services/runner-proxy.service';
import { RunnerGateway } from './runner.gateway';

/**
 * @title Hook Component Controller
 * @description 提供 GET /hook-component?hookName=xxx 接口，按优先级返回 Hook 组件 JS：
 *              1. SaaS 侧注册表（@HookComponent 声明的预定义组件，零延迟）
 *              2. 广播所有在线 Runner，返回首个持有该组件的 JS 文件内容
 *              前端无需感知来源，统一通过此接口拉取，结果缓存 300s。
 * @keywords-cn hook组件接口, SaaS优先, Runner广播, 动态组件
 * @keywords-en hook-component-controller, saas-first, runner-broadcast, dynamic-component
 */
@Controller('hook-component')
export class HookComponentController {
  constructor(
    private readonly registry: HookComponentRegistryService,
    private readonly proxy: RunnerProxyService,
    private readonly gateway: RunnerGateway,
  ) {}

  /**
   * 获取指定 hookName 的 Web Component JS。
   * 先查 SaaS 本地注册表，未命中再广播在线 Runner。
   * @param hookName hook 地址，如 saas.app.todo.card 或 runner.app.todo.card
   * @keyword-en get-hook-component serve-component-js
   */
  @Get()
  async get(
    @Query('hookName') hookName: string,
    @Res() res: Response,
  ) {
    if (!hookName) throw new NotFoundException('hookName is required');

    // 1. SaaS 本地注册表优先
    const saasJs = this.registry.get(hookName);
    if (saasJs) {
      return this.send(res, saasJs);
    }

    // 2. 广播所有在线 Runner
    const onlineIds = this.gateway.getOnlineRunnerIds();
    const runnerJs = await this.proxy.getHookComponentFromAnyRunner(
      this.gateway.ioServer,
      onlineIds,
      hookName,
    );
    if (runnerJs) {
      return this.send(res, runnerJs);
    }

    throw new NotFoundException(`hook component not found: ${hookName}`);
  }

  private send(res: Response, js: string) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(js);
  }
}

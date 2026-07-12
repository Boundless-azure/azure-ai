import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { RunnerService } from '../services/runner.service';
import { RunnerGateway } from './runner.gateway';
import type { QueryRunnerDto, RunnerView } from '../types/runner.types';
import { RunnerStatus } from '../enums/runner.enums';

/** 单对象 hook payload schema (zod, SSOT) */
const runnerListInputSchema = z.object({
  status: z
    .nativeEnum(RunnerStatus)
    .optional()
    .describe('按状态过滤; 想列"当前可用的"传 "mounted" (在线注册的)'),
  q: z.string().optional().describe('按 alias/description 模糊搜'),
  principalId: z
    .string()
    .optional()
    .describe('按持有 runner 的 principal 过滤'),
});
const runnerGetInputSchema = z.object({
  id: z.string().min(1).describe('runner id'),
});

/**
 * @title Runner Hook Controller
 * @description runner 模块的 hook 声明层 (单对象 payload); 从 RunnerController 迁出, HTTP 与 hook 解耦。
 *   list/get 给 LLM 在调 target=runner 前拿真实 runnerId + 在线状态。
 * @keywords-cn RunnerHook声明, 单对象payload
 * @keywords-en runner-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'runner', tags: ['runner', 'infrastructure'] })
export class RunnerHookController {
  constructor(
    private readonly service: RunnerService,
    private readonly gateway: RunnerGateway,
  ) {}

  /**
   * 列出 SaaS 已知的全部 runner; mounted 状态经 gateway 二次确认离线则回写。
   * @keyword-cn 列runner, LLM发现
   * @keyword-en list-runners, runner-discovery-for-llm
   */
  @HookRoute({
    hook: 'saas.app.runner.list',
    description:
      '列出 SaaS 已知的所有 runner (id/alias/status/lastSeenAt). ' +
      '⚠ LLM 在调 target=runner 的 search_hook/get_hook_tag/get_hook_info/call_hook **之前必须**先调本 hook 拿真实 runnerId. ' +
      'status="mounted" 表示当前在线可派发; 可按 status / q (alias 模糊) / principalId 过滤.',
    args: [runnerListInputSchema],
  })
  @CheckAbility('read', 'runner')
  async list(payload: QueryRunnerDto): Promise<RunnerView[]> {
    const runners = await this.service.list(payload);
    for (const runner of runners) {
      if (
        runner.status === RunnerStatus.Mounted &&
        !this.gateway.isRunnerOnline(runner.id)
      ) {
        await this.service.markStatus(runner.id, RunnerStatus.Offline);
        runner.status = RunnerStatus.Offline;
      }
    }
    return runners;
  }

  /**
   * 取单个 runner 详情; 核对 runnerId 是否合法且在线。
   * @keyword-cn 取runner, 在线核对
   * @keyword-en get-runner, online-check
   */
  @HookRoute({
    hook: 'saas.app.runner.get',
    description:
      '按 id 取 runner 详情. 想知道某个 runnerId 当前是否在线 (可派发 hook) 用本接口看 status==="mounted".',
    args: [runnerGetInputSchema],
  })
  @CheckAbility('read', 'runner')
  async get(payload: z.infer<typeof runnerGetInputSchema>): Promise<RunnerView | null> {
    const runner = await this.service.get(payload.id);
    if (!runner) return null;
    if (
      runner.status === RunnerStatus.Mounted &&
      !this.gateway.isRunnerOnline(payload.id)
    ) {
      await this.service.markStatus(payload.id, RunnerStatus.Offline);
      runner.status = RunnerStatus.Offline;
    }
    return runner;
  }
}

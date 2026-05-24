import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { RunnerEntity } from '../entities/runner.entity';
import { FrpRecordEntity } from '../entities/frp-record.entity';
import { Public } from '@/core/auth/decorators/public.decorator';

/** frps HTTP 插件请求体 — NewProxy op */
interface FrpPluginNewProxyContent {
  proxy_name: string;
  proxy_type: string;
  remote_port?: number;
  user: {
    user: string;
    metas?: Record<string, string>;
    run_id?: string;
  };
}

/** frps HTTP 插件请求体 — Login op */
interface FrpPluginLoginContent {
  version: string;
  hostname: string;
  metas?: Record<string, string>;
  user?: string;
}

interface FrpPluginRequest {
  version: string;
  op: 'NewProxy' | 'Login';
  content: FrpPluginNewProxyContent | FrpPluginLoginContent;
}

interface FrpPluginResponse {
  reject: boolean;
  reject_reason?: string;
  unchange?: boolean;
}

/**
 * @title FRP Server Plugin 控制器
 * @description 处理 frps 的 HTTP 插件回调，对 Login 和 NewProxy 操作进行二次鉴权：
 *              Login：校验 metadata 中的 runner_key 是否合法；
 *              NewProxy：额外校验请求的 remote_port 是否与分配的端口一致。
 *
 * @keywords-cn frps插件, 鉴权, NewProxy, Login, runner-key校验, 端口校验
 * @keywords-en frps-plugin, auth, new-proxy, login, runner-key-verify, port-verify
 */
@Controller('runner/frp')
export class FrpPluginController {
  private readonly logger = new Logger(FrpPluginController.name);

  constructor(
    @InjectRepository(RunnerEntity)
    private readonly runnerRepo: Repository<RunnerEntity>,
    @InjectRepository(FrpRecordEntity)
    private readonly frpRecordRepo: Repository<FrpRecordEntity>,
  ) {}

  /**
   * frps HTTP 插件回调入口
   * @keyword-en frp-plugin-handler, auth-callback
   */
  @Public()
  @Post('plugin')
  @HttpCode(200)
  async handle(@Body() body: FrpPluginRequest): Promise<FrpPluginResponse> {
    const { op, content } = body;
    this.logger.log(`[FrpPlugin] ▶ op=${op} body=${JSON.stringify(body)}`);

    let result: FrpPluginResponse;

    if (op === 'Login') {
      result = await this.handleLogin(content as FrpPluginLoginContent);
    } else if (op === 'NewProxy') {
      result = await this.handleNewProxy(content as FrpPluginNewProxyContent);
    } else {
      result = { reject: false, unchange: true };
    }

    this.logger.log(`[FrpPlugin] ◀ op=${op} result=${JSON.stringify(result)}`);
    return result;
  }

  /**
   * 校验 Login：metadata.runner_key 必须是合法的 runner key
   * @keyword-en handle-login, runner-key-verify
   */
  private async handleLogin(
    content: FrpPluginLoginContent,
  ): Promise<FrpPluginResponse> {
    const runnerKey = content.metas?.runner_key;
    if (!runnerKey) {
      this.logger.warn('[FrpPlugin] Login rejected: missing runner_key meta');
      return { reject: true, reject_reason: 'missing runner_key metadata' };
    }

    const runner = await this.findRunnerByKey(runnerKey);
    if (!runner) {
      this.logger.warn(`[FrpPlugin] Login rejected: invalid runner_key`);
      return { reject: true, reject_reason: 'invalid runner_key' };
    }

    this.logger.log(`[FrpPlugin] Login accepted for runner=${runner.id}`);
    return { reject: false, unchange: true };
  }

  /**
   * 校验 NewProxy：runner_key 合法 + remote_port 与分配记录一致
   * @keyword-en handle-new-proxy, port-verify, runner-auth
   */
  private async handleNewProxy(
    content: FrpPluginNewProxyContent,
  ): Promise<FrpPluginResponse> {
    const runnerKey = content.user?.metas?.runner_key;
    if (!runnerKey) {
      this.logger.warn(
        '[FrpPlugin] NewProxy rejected: missing runner_key meta',
      );
      return { reject: true, reject_reason: 'missing runner_key metadata' };
    }

    const runner = await this.findRunnerByKey(runnerKey);
    if (!runner) {
      this.logger.warn(`[FrpPlugin] NewProxy rejected: invalid runner_key`);
      return { reject: true, reject_reason: 'invalid runner_key' };
    }

    const remotePort = content.remote_port;
    if (!remotePort) {
      // 非 TCP 代理或无 remote_port，放行
      return { reject: false, unchange: true };
    }

    // 校验端口是否为该 runner 的分配端口
    const record = await this.frpRecordRepo.findOne({
      where: { runnerId: runner.id, port: remotePort, active: true },
    });

    if (!record) {
      this.logger.warn(
        `[FrpPlugin] NewProxy rejected: port=${remotePort} not allocated for runner=${runner.id}`,
      );
      return {
        reject: true,
        reject_reason: `port ${remotePort} not allocated for this runner`,
      };
    }

    this.logger.log(
      `[FrpPlugin] NewProxy accepted: runner=${runner.id} port=${remotePort}`,
    );
    return { reject: false, unchange: true };
  }

  /**
   * 根据明文 key 查找 runner（哈希比对）
   * @keyword-en find-runner-by-key, hash-compare
   */
  private async findRunnerByKey(key: string): Promise<RunnerEntity | null> {
    const keyHash = createHash('sha256').update(key).digest('hex');
    return this.runnerRepo.findOne({
      where: { runnerKeyHash: keyHash, active: true, isDelete: false },
    });
  }
}

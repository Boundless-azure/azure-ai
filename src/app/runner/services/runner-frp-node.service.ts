import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FrpNodeEntity } from '../entities/frp-node.entity';
import { FrpRecordEntity } from '../entities/frp-record.entity';
import { RunnerEntity } from '../entities/runner.entity';
import { CommonRedisService } from '../../../redis/services/common.service';

const REDIS_RUNNER_PREFIX = 'forwarding:runner:';

/**
 * @title Runner FRP 节点服务
 * @description 负责 FRP 节点查询、端口分配、frp_record 创建及 runners 表 host/port 更新。
 * @keywords-cn FRP节点服务, 端口分配, runner配置
 * @keywords-en frp-node-service, port-allocation, runner-config
 */
@Injectable()
export class RunnerFrpNodeService {
  private readonly frpPortRange = { start: 20000, end: 30000 };
  private usedPortsLoaded = false;
  private _usedPorts = new Set<number>();

  constructor(
    @InjectRepository(FrpNodeEntity)
    private readonly frpNodeRepo: Repository<FrpNodeEntity>,
    @InjectRepository(FrpRecordEntity)
    private readonly frpRecordRepo: Repository<FrpRecordEntity>,
    @InjectRepository(RunnerEntity)
    private readonly runnerRepo: Repository<RunnerEntity>,
    private readonly redis: CommonRedisService,
  ) {}

  private async ensureUsedPortsLoaded(): Promise<void> {
    if (this.usedPortsLoaded) return;
    // 清理遗留的 inactive 行（历史软删数据），避免 UNIQUE 冲突
    await this.frpRecordRepo.delete({ active: false });
    const records = await this.frpRecordRepo.find({ where: { active: true } });
    for (const r of records) {
      this._usedPorts.add(r.port);
    }
    this.usedPortsLoaded = true;
  }

  private findAvailablePort(): number {
    for (
      let port = this.frpPortRange.start;
      port <= this.frpPortRange.end;
      port++
    ) {
      if (!this._usedPorts.has(port)) {
        return port;
      }
    }
    throw new Error('No available FRP ports');
  }

  /**
   * @title 分配 FRP 记录并更新 Runner
   * @description 查找可用 FRP 节点 → 分配端口 → 创建 frp_record → 更新 runners 表的 frp_host/frp_port。
   * @param runnerId Runner ID
   * @param domain 域名
   * @returns 分配的端口号、节点 IP 与 frps token
   * @keywords-cn 分配FRP, 端口分配, 更新Runner, frps-token
   * @keywords-en allocate-frp, port-allocation, update-runner, frps-token
   */
  async allocateFrpRecord(
    runnerId: string,
    domain: string,
  ): Promise<{
    port: number;
    nodeIp: string;
    nodePort: number;
    token: string;
  }> {
    // 0. 先释放该 runner 的旧 frp_record，防止端口池泄漏与 Redis 脏缓存
    await this.releaseFrpRecord(runnerId);

    // 1. 查找可用 FRP 节点
    const node = await this.frpNodeRepo.findOne({
      where: { status: 'active' },
    });
    if (!node) {
      console.error(
        `[RunnerFrpNode] No active FRP node available for runner=${runnerId}`,
      );
      throw new Error('No active FRP node available');
    }

    // 2. 分配端口
    await this.ensureUsedPortsLoaded();
    const port = this.findAvailablePort();
    this._usedPorts.add(port);

    // 3. 创建 frp_record
    const record = this.frpRecordRepo.create({
      runnerId,
      domain,
      port,
      frpNodeAddr: node.nodeIp,
      frpsPort: node.nodePort,
      active: true,
    });
    await this.frpRecordRepo.save(record);

    // 4. 更新 runners 表
    await this.runnerRepo.update(runnerId, {
      frpHost: node.nodeIp,
      frpPort: port,
    });

    console.log(
      `[RunnerFrpNode] Allocated FRP for runner=${runnerId} port=${port} node=${node.nodeIp}:${node.nodePort}`,
    );
    console.log(
      `[RunnerFrpNode][TRACE] DB saved: runnerId=${runnerId} frpRecord.port=${port} runner.frpHost=${node.nodeIp} runner.frpPort=${port}`,
    );
    return {
      port,
      nodeIp: node.nodeIp,
      nodePort: node.nodePort,
      token: node.token,
    };
  }

  /**
   * @title 释放 FRP 记录并清空 Runner
   * @description 物理删除 frp_record（含历史 inactive 行）→ 清空 runners 表的 frp_host/frp_port。
   *              物理删除而非软删，确保 port UNIQUE 约束不阻塞下次分配。
   * @param runnerId Runner ID
   * @keywords-cn 释放FRP, 清空Runner配置, 物理删除
   * @keywords-en release-frp, clear-runner, physical-delete
   */
  async releaseFrpRecord(runnerId: string): Promise<void> {
    // 查全部记录（含历史 inactive），只对 active 的做内存清理
    const records = await this.frpRecordRepo.find({ where: { runnerId } });
    const activePorts = records.filter((r) => r.active).map((r) => r.port);
    // 物理删除：释放 UNIQUE 约束，避免下次重新分配时冲突
    await this.frpRecordRepo.delete({ runnerId });
    for (const p of activePorts) {
      this._usedPorts.delete(p);
    }
    await this.runnerRepo.update(runnerId, {
      frpHost: null,
      frpPort: null,
    });
    // 清除 forwarding 中间件的 Redis runner 缓存，避免旧端口被继续使用
    if (this.redis.isAvailable()) {
      await this.redis
        .delKeys([`${REDIS_RUNNER_PREFIX}${runnerId}`])
        .catch(() => null);
    }
    if (records.length) {
      console.log(
        `[RunnerFrpNode] Released FRP for runner=${runnerId} ports=${activePorts.join(',') || '(none active)'}`,
      );
    }
  }

  /**
   * @title 获取 FRP 节点列表
   * @description 查询所有 FRP 节点。
   * @returns FRP 节点列表
   * @keywords-cn FRP节点列表
   * @keywords-en frp-node-list
   */
  async listNodes(): Promise<FrpNodeEntity[]> {
    return this.frpNodeRepo.find();
  }
}

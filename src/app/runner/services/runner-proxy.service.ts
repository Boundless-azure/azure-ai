import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RunnerEntity } from '../entities/runner.entity';
import { FrpRecordEntity } from '../entities/frp-record.entity';
import { DomainBindingEntity } from '../entities/domain-binding.entity';
import { RewardRecordEntity } from '../entities/reward-record.entity';
import { RewardType } from '../enums/reward.enums';

/**
 * @title Runner 代理服务
 * @description 提供 Runner 面板所需的域名、应用、Solution、统计等数据能力。
 * @keywords-cn Runner代理服务, 域名管理, 应用管理, 统计
 * @keywords-en runner-proxy-service, domain-management, app-management, stats
 */
@Injectable()
export class RunnerProxyService {
  constructor(
    @InjectRepository(RunnerEntity)
    private readonly runnerRepo: Repository<RunnerEntity>,
    @InjectRepository(FrpRecordEntity)
    private readonly frpRepo: Repository<FrpRecordEntity>,
    @InjectRepository(DomainBindingEntity)
    private readonly domainRepo: Repository<DomainBindingEntity>,
    @InjectRepository(RewardRecordEntity)
    private readonly rewardRepo: Repository<RewardRecordEntity>,
  ) {}

  /**
   * @title 获取 Runner 基础信息
   * @description 校验 Runner 存在且在线。
   * @param runnerId Runner ID
   * @returns Runner 信息
   * @keywords-cn Runner信息, 在线状态
   * @keywords-en runner-info, online-status
   */
  async getRunner(runnerId: string): Promise<RunnerEntity> {
    const runner = await this.runnerRepo.findOne({
      where: { id: runnerId, isDelete: false },
    });
    if (!runner) throw new NotFoundException('Runner not found');
    return runner;
  }

  /**
   * @title 获取 Runner 性能统计
   * @description 返回 Runner 的 CPU、内存、FRP 状态与核心数量统计。
   * @param runnerId Runner ID
   * @returns 性能统计数据
   * @keywords-cn 性能统计, CPU, 内存, FRP状态
   * @keywords-en performance-stats, cpu, memory, frp-status
   */
  async getStats(runnerId: string): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    frpcRunning: boolean;
    solutions: number;
    domainBindings: number;
    apps: number;
    runners: number;
  }> {
    await this.getRunner(runnerId);

    const domainBindings = await this.domainRepo.count({
      where: { runnerId, active: true },
    });
    const frpcRunning = true; // TODO: 实际查询 Runner 的 FRP 进程状态

    return {
      cpuUsage: 0,
      memoryUsage: 0,
      frpcRunning,
      solutions: 0,
      domainBindings,
      apps: 0,
      runners: 1,
    };
  }

  /**
   * @title 获取 Runner 域名列表
   * @description 返回指定 Runner 的所有域名绑定记录。
   * @param runnerId Runner ID
   * @returns 域名列表
   * @keywords-cn 域名列表, 域名绑定
   * @keywords-en domain-list, domain-binding
   */
  async listDomains(runnerId: string): Promise<DomainBindingEntity[]> {
    await this.getRunner(runnerId);
    return this.domainRepo.find({ where: { runnerId, active: true } });
  }

  /**
   * @title 创建域名绑定
   * @description 为 Runner 创建新的域名绑定记录。
   * @param runnerId Runner ID
   * @param domain 域名
   * @param pathPattern 路径规则
   * @returns 创建的绑定记录
   * @keywords-cn 创建域名, 域名绑定
   * @keywords-en create-domain, domain-binding
   */
  async createDomain(
    runnerId: string,
    domain: string,
    pathPattern = '.*',
  ): Promise<DomainBindingEntity> {
    await this.getRunner(runnerId);

    const existing = await this.domainRepo.findOne({
      where: { domain, active: true },
    });
    if (existing) throw new NotFoundException('Domain already exists');

    const record = this.domainRepo.create({
      runnerId,
      domain,
      tenantId: 'default',
      pathPattern,
      active: true,
    });
    return this.domainRepo.save(record);
  }

  /**
   * @title 删除域名绑定
   * @description 软删除指定的域名绑定记录。
   * @param runnerId Runner ID
   * @param domainId 域名绑定 ID
   * @keywords-cn 删除域名, 域名解绑
   * @keywords-en delete-domain, domain-unbind
   */
  async deleteDomain(runnerId: string, domainId: string): Promise<void> {
    await this.getRunner(runnerId);
    const record = await this.domainRepo.findOne({
      where: { id: domainId, runnerId, active: true },
    });
    if (!record) throw new NotFoundException('Domain binding not found');
    record.active = false;
    await this.domainRepo.save(record);
  }

  /**
   * @title 获取 Runner FRP 记录
   * @description 查询指定 Runner 的所有 FRP 端口记录。
   * @param runnerId Runner ID
   * @returns FRP 记录列表
   * @keywords-cn FRP记录, 端口记录
   * @keywords-en frp-records, port-records
   */
  async listFrpRecords(runnerId: string): Promise<FrpRecordEntity[]> {
    await this.getRunner(runnerId);
    return this.frpRepo.find({ where: { runnerId, active: true } });
  }

  /**
   * @title 获取 Runner Solution 列表
   * @description 返回 Runner 上安装的 Solution 列表（当前为模拟数据）。
   * @param runnerId Runner ID
   * @returns Solution 列表
   * @keywords-cn Solution列表, Runner方案
   * @keywords-en solution-list, runner-solutions
   */
  async listSolutions(runnerId: string): Promise<
    Array<{
      id: string;
      name: string;
      version: string;
      appCount: number;
      installed: boolean;
    }>
  > {
    await this.getRunner(runnerId);
    // TODO: 实际从 Runner 实例查询 Solution 列表
    return [
      {
        id: '1',
        name: 'AI Chat Solution',
        version: '1.0.0',
        appCount: 3,
        installed: true,
      },
      {
        id: '2',
        name: 'Data Processing',
        version: '2.1.0',
        appCount: 1,
        installed: true,
      },
    ];
  }

  /**
   * @title 获取 Runner 应用列表
   * @description 返回 Runner 上部署的应用列表（当前为模拟数据）。
   * @param runnerId Runner ID
   * @returns 应用列表
   * @keywords-cn 应用列表, Runner应用
   * @keywords-en app-list, runner-apps
   */
  async listApps(runnerId: string): Promise<
    Array<{
      appId: string;
      name: string;
      appPort: number;
      description?: string;
      status: string;
    }>
  > {
    await this.getRunner(runnerId);
    // TODO: 实际从 Runner 实例查询应用列表
    return [];
  }

  /**
   * @title 获取 FRP 状态
   * @description 返回当前 FRP 进程运行状态。
   * @returns FRP 状态
   * @keywords-cn FRP状态, 进程状态
   * @keywords-en frp-status, process-status
   */
  getFrpStatus(): { running: boolean } {
    // TODO: 实际查询 FRP 进程状态
    return { running: false };
  }

  /**
   * @title 启动 FRP
   * @description 在 Runner 端启动 FRP 进程。
   * @param runnerId Runner ID
   * @keywords-cn 启动FRP, FRP进程
   * @keywords-en start-frp, frp-process
   */
  async startFrp(runnerId: string): Promise<{ ok: boolean; message: string }> {
    await this.getRunner(runnerId);
    // TODO: 通过 WS 向 Runner 发送启动指令
    return { ok: true, message: 'FRP start command sent' };
  }

  /**
   * @title 停止 FRP
   * @description 在 Runner 端停止 FRP 进程。
   * @param runnerId Runner ID
   * @keywords-cn 停止FRP, FRP进程
   * @keywords-en stop-frp, frp-process
   */
  async stopFrp(runnerId: string): Promise<{ ok: boolean; message: string }> {
    await this.getRunner(runnerId);
    // TODO: 通过 WS 向 Runner 发送停止指令
    return { ok: true, message: 'FRP stop command sent' };
  }

  /**
   * @title 重载 FRP
   * @description 在 Runner 端重载 FRP 配置。
   * @param runnerId Runner ID
   * @keywords-cn 重载FRP, FRP配置
   * @keywords-en reload-frp, frp-config
   */
  async reloadFrp(runnerId: string): Promise<{ ok: boolean; message: string }> {
    await this.getRunner(runnerId);
    // TODO: 通过 WS 向 Runner 发送重载指令
    return { ok: true, message: 'FRP reload command sent' };
  }

  /**
   * @title 领取免费域名
   * @description 为 Runner 发放免费域名（127.0.0.1:3000 + runnerId 作为 pathPattern）。
   *        若已发放过则抛出冲突异常。
   * @param runnerId Runner ID
   * @returns 域名绑定记录
   * @keywords-cn 免费域名, 领取域名, 奖励发放
   * @keywords-en free-domain, claim-domain, reward-grant
   */
  async claimFreeDomain(runnerId: string): Promise<DomainBindingEntity> {
    await this.getRunner(runnerId);

    // 检查是否已领取过
    const alreadyClaimed = await this.rewardRepo.findOne({
      where: {
        rewardType: RewardType.Domain,
        relatedId: runnerId,
        isDelete: false,
      },
    });
    if (alreadyClaimed) {
      throw new ConflictException('已领取过免费域名');
    }

    // 创建域名绑定
    const domain = '127.0.0.1:3000';
    const pathPattern = runnerId;
    const existingDomain = await this.domainRepo.findOne({
      where: { domain, pathPattern, active: true },
    });
    if (existingDomain) {
      throw new ConflictException('免费域名已存在');
    }

    const domainBinding = this.domainRepo.create({
      runnerId,
      tenantId: 'default',
      domain,
      pathPattern,
      active: true,
    });
    const savedDomain = await this.domainRepo.save(domainBinding);

    // 创建奖励记录
    const rewardRecord = this.rewardRepo.create({
      rewardType: RewardType.Domain,
      relatedId: runnerId,
      description: `免费域名: ${domain}/${pathPattern}`,
    });
    await this.rewardRepo.save(rewardRecord);

    return savedDomain;
  }
}

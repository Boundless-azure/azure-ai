import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FrpRecordEntity } from '../entities/frp-record.entity';

/**
 * @title Runner FRP 服务
 * @description 提供 FRP 端口分配和记录管理能力。
 * @keywords-cn FRP服务, 端口分配, 隧道记录
 * @keywords-en frp-service, port-allocation, tunnel-record
 */
@Injectable()
export class RunnerFrpService {
  private readonly frpPortRange = { start: 20000, end: 30000 };
  private usedPortsLoaded = false;
  private _usedPorts = new Set<number>();

  constructor(
    @InjectRepository(FrpRecordEntity)
    private readonly frpRepo: Repository<FrpRecordEntity>,
  ) {}

  private async ensureUsedPortsLoaded(): Promise<void> {
    if (this.usedPortsLoaded) return;
    const records = await this.frpRepo.find({ where: { active: true } });
    for (const r of records) {
      this._usedPorts.add(r.port);
    }
    this.usedPortsLoaded = true;
  }

  /**
   * @title 分配 FRP 端口
   * @description 为 Runner 分配一个可用的 FRP 端口。
   * @param runnerId Runner ID
   * @param domain 域名
   * @returns 分配的端口号
   * @keywords-cn 分配端口, FRP端口, Runner
   * @keywords-en allocate-port, frp-port, runner
   */
  async allocatePort(runnerId: string, domain: string): Promise<number> {
    await this.ensureUsedPortsLoaded();
    const port = this.findAvailablePort();
    this._usedPorts.add(port);

    const record = this.frpRepo.create({
      runnerId,
      domain,
      port,
      frpsPort: 7000,
      frpNodeAddr: 'default',
      active: true,
    });
    await this.frpRepo.save(record);
    return port;
  }

  /**
   * @title 获取 Runner 的 FRP 记录
   * @description 查询指定 Runner 的所有 FRP 端口记录。
   * @param runnerId Runner ID
   * @returns FRP 记录列表
   * @keywords-cn FRP记录, 查询, Runner
   * @keywords-en frp-records, find, runner
   */
  async findByRunnerId(runnerId: string): Promise<FrpRecordEntity[]> {
    return this.frpRepo.find({ where: { runnerId, active: true } });
  }

  /**
   * @title 根据域名查询 FRP 记录
   * @description 通过域名查找对应的 FRP 隧道记录。
   * @param domain 域名
   * @returns FRP 记录
   * @keywords-cn FRP记录, 域名查询
   * @keywords-en frp-record, domain-lookup
   */
  async findByDomain(domain: string): Promise<FrpRecordEntity | null> {
    return this.frpRepo.findOne({ where: { domain, active: true } });
  }

  /**
   * @title 释放 FRP 端口
   * @description 标记 FRP 记录为非活跃状态。
   * @param runnerId Runner ID
   * @keywords-cn 释放端口, FRP端口
   * @keywords-en release-port, frp-port
   */
  async releasePort(runnerId: string): Promise<void> {
    const records = await this.frpRepo.find({
      where: { runnerId, active: true },
    });
    await this.frpRepo.update({ runnerId }, { active: false });
    for (const r of records) {
      this._usedPorts.delete(r.port);
    }
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
}

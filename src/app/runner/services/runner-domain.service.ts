import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainBindingEntity } from '../entities/domain-binding.entity';

/**
 * @title Runner 域名服务
 * @description 提供域名绑定的增删改查能力。
 * @keywords-cn 域名服务, 域名绑定, CRUD
 * @keywords-en domain-service, domain-binding, crud
 */
@Injectable()
export class RunnerDomainService {
  constructor(
    @InjectRepository(DomainBindingEntity)
    private readonly repo: Repository<DomainBindingEntity>,
  ) {}

  /**
   * @title 域名列表
   * @description 获取指定 Runner 的所有域名绑定记录。
   * @param runnerId Runner ID
   * @returns 域名绑定列表
   * @keywords-cn 域名列表, 查询, Runner
   * @keywords-en domain-list, find, runner
   */
  async list(runnerId: string): Promise<DomainBindingEntity[]> {
    return this.repo.find({ where: { runnerId, active: true } });
  }

  /**
   * @title 创建域名绑定
   * @description 为 Runner 创建新的域名绑定记录。
   * @param runnerId Runner ID
   * @param tenantId 租户 ID
   * @param domain 域名
   * @param appId 应用 ID（可选）
   * @param pathPattern 路径匹配模式
   * @returns 创建的域名绑定记录
   * @keywords-cn 创建域名, 绑定, Runner
   * @keywords-en create-domain, binding, runner
   */
  async create(
    runnerId: string,
    tenantId: string,
    domain: string,
    appId?: string,
    pathPattern = '.*',
  ): Promise<DomainBindingEntity> {
    const existing = await this.repo.findOne({ where: { domain, active: true } });
    if (existing) {
      throw new ConflictException('Domain already exists');
    }

    const record = this.repo.create({
      runnerId,
      tenantId,
      domain,
      appId: appId ?? null,
      pathPattern,
      active: true,
    });
    return this.repo.save(record);
  }

  /**
   * @title 删除域名绑定
   * @description 软删除指定的域名绑定记录。
   * @param id 域名绑定 ID
   * @keywords-cn 删除域名, 域名绑定
   * @keywords-en delete-domain, binding
   */
  async delete(id: string): Promise<void> {
    const record = await this.repo.findOne({ where: { id, active: true } });
    if (!record) {
      throw new NotFoundException('Domain binding not found');
    }
    record.active = false;
    await this.repo.save(record);
  }

  /**
   * @title 根据域名查询绑定
   * @description 通过域名查找对应的绑定记录。
   * @param domain 域名
   * @returns 域名绑定记录
   * @keywords-cn 域名查询, 绑定查找
   * @keywords-en domain-lookup, binding-find
   */
  async findByDomain(domain: string): Promise<DomainBindingEntity | null> {
    return this.repo.findOne({ where: { domain, active: true } });
  }

  /**
   * @title 统计 Runner 的域名解析数量
   * @description 统计指定 Runner 下有多少应用绑定。
   * @param runnerId Runner ID
   * @returns 解析数量
   * @keywords-cn 解析数量, 统计, Runner
   * @keywords-en resolve-count, stat, runner
   */
  async countByRunnerId(runnerId: string): Promise<number> {
    return this.repo.count({ where: { runnerId, active: true } });
  }
}

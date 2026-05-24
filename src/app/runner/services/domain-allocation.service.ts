import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainBindingEntity } from '../entities/domain-binding.entity';

/**
 * @title 域名分配服务
 * @description 提供 Runner 域名分配能力，支持默认域名和自定义域名。
 *
 * @keywords-cn 域名分配, 默认域名, 自定义域名, runner域名
 * @keywords-en domain-allocation, default-domain, custom-domain, runner-domain
 */
@Injectable()
export class DomainAllocationService {
  /** 免费域名默认地址（可配置） */
  private readonly freeDomainHost =
    process.env.FREE_DOMAIN_HOST || '127.0.0.1:3000';

  constructor(
    @InjectRepository(DomainBindingEntity)
    private readonly domainRepo: Repository<DomainBindingEntity>,
  ) {}

  /**
   * @title 分配默认域名
   * @description 为 Runner 分配一个默认域名（127.0.0.1:3000 + runnerId 作为 pathPattern）。
   * @param runnerId Runner ID
   * @param tenantId 租户 ID
   * @returns 创建的域名绑定记录
   * @keywords-cn 分配默认域名, runner域名
   * @keywords-en allocate-default-domain, runner-domain
   */
  async allocateDefaultDomain(
    runnerId: string,
    tenantId: string,
  ): Promise<DomainBindingEntity> {
    const domain = this.freeDomainHost;
    const pathPattern = runnerId;

    const record = this.domainRepo.create({
      runnerId,
      tenantId,
      domain,
      pathPattern,
      active: true,
    });
    return this.domainRepo.save(record);
  }

  /**
   * @title 分配自定义域名
   * @description 为 Runner 分配自定义域名。
   * @param runnerId Runner ID
   * @param tenantId 租户 ID
   * @param domain 自定义域名（不含协议）
   * @param pathPattern 路径规则（默认 runnerId）
   * @returns 创建的域名绑定记录
   * @keywords-cn 自定义域名, runner域名
   * @keywords-en allocate-custom-domain, runner-domain
   */
  async allocateCustomDomain(
    runnerId: string,
    tenantId: string,
    domain: string,
    pathPattern?: string,
  ): Promise<DomainBindingEntity> {
    const record = this.domainRepo.create({
      runnerId,
      tenantId,
      domain: domain.replace(/^https?:\/\//, ''), // 去除协议
      pathPattern: pathPattern ?? runnerId,
      active: true,
    });
    return this.domainRepo.save(record);
  }
}

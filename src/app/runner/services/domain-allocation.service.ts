import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainBindingEntity } from '../entities/domain-binding.entity';

/**
 * @title 域名分配服务
 * @description 提供 Runner 默认域名分配能力。
 *
 * TODO: 当前仅支持单一域名模式（127.0.0.1:3000 + runnerId 作为 pathPattern）。
 *       后续扩展方向：
 *       - 支持自定义域名（用户携带自己的域名）
 *       - 支持多域名匹配规则（不同 pathPattern 对应不同后端服务）
 *       - pathPattern 规则引擎化（支持正则、精确匹配、前缀匹配等）
 *       - 域名配额管理（每个 runner 可分配的域名数量限制）
 *       - 域名 SSL 证书自动绑定
 *
 * @keywords-cn 域名分配, 默认域名, runner域名
 * @keywords-en domain-allocation, default-domain, runner-domain
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
}

import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title 域名绑定实体
 * @description 存储域名与 Runner、应用的绑定关系。
 * @keywords-cn 域名绑定, 路由映射, 应用域名
 * @keywords-en domain-binding, route-mapping, app-domain
 */
@Entity('domain_bindings')
@Unique(['domain'])
@Index(['runnerId'])
@Index(['appId'])
export class DomainBindingEntity extends BaseAuditedEntity {
  @Column({ name: 'domain', type: 'varchar', length: 255 })
  domain!: string;

  @Column({ name: 'runner_id', type: 'char', length: 36 })
  runnerId!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'app_id', type: 'varchar', length: 128, nullable: true })
  appId!: string | null;

  @Column({ name: 'path_pattern', type: 'varchar', length: 500, default: '.*' })
  pathPattern!: string;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}

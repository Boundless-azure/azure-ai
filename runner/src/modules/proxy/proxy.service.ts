import type { Db } from 'mongodb';
import type { RunnerDbService } from '../runner-db/services/runner-db.service';
import type { RunnerAppDomain } from '../runner-db/types/runner-db.types';
import type { ProxyTarget } from './types/proxy.types';

/**
 * @title 代理服务
 * @description 提供域名解析和应用转发能力。
 * @keywords-cn 代理服务, 域名解析, 转发
 * @keywords-en proxy-service, domain-resolve, forward
 */
export class ProxyService {
  constructor(
    private readonly runnerDb: RunnerDbService,
  ) {}

  /**
   * @title 解析目标服务
   * @description 根据域名查询对应的目标服务地址。
   * @param domain 域名
   * @returns 目标服务信息
   * @keywords-cn 解析目标, 域名查询, 应用
   * @keywords-en resolve-target, domain-lookup, app
   */
  async resolveTarget(domain: string): Promise<ProxyTarget | null> {
    const binding = await this.runnerDb.findAppDomainByDomain(domain);
    if (!binding || binding.status !== 'active') {
      return null;
    }
    return {
      host: binding.targetHost,
      port: binding.targetPort,
      appId: binding.appId,
    };
  }

  /**
   * @title 获取应用域名绑定
   * @description 获取指定应用的所有域名绑定。
   * @param appId 应用 ID
   * @returns 域名绑定列表
   * @keywords-cn 应用域名, 绑定列表
   * @keywords-en app-domains, binding-list
   */
  async getAppDomains(appId: string): Promise<RunnerAppDomain[]> {
    const all = await this.runnerDb.findAppDomains();
    return all.filter((d) => d.appId === appId);
  }

  /**
   * @title 获取所有域名绑定
   * @description 获取所有应用域名绑定记录。
   * @returns 域名绑定列表
   * @keywords-cn 域名绑定, 全部列表
   * @keywords-en all-domains, binding-list
   */
  async getAllDomains(): Promise<RunnerAppDomain[]> {
    return this.runnerDb.findAppDomains();
  }

  /**
   * @title 创建应用域名绑定
   * @description 创建或更新应用域名绑定记录。
   * @param binding 域名绑定信息
   * @keywords-cn 创建域名, 绑定
   * @keywords-en create-domain, binding
   */
  async upsertAppDomain(binding: Omit<RunnerAppDomain, '_id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.runnerDb.upsertAppDomain({
      ...binding,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * @title 删除应用域名绑定
   * @description 删除指定应用的所有域名绑定。
   * @param appId 应用 ID
   * @keywords-cn 删除域名, 应用域名
   * @keywords-en delete-domain, app-domain
   */
  async deleteAppDomains(appId: string): Promise<void> {
    await this.runnerDb.deleteAppDomainsByAppId(appId);
  }
}

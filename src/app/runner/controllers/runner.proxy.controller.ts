import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { RunnerProxyService } from '../services/runner-proxy.service';

/**
 * @title Runner 代理控制器
 * @description 提供 Runner 控制面板所需的所有代理接口：域名、应用、Solution、统计、FRP 管理。
 * @keywords-cn Runner代理控制器, 域名管理, 应用管理, FRP管理
 * @keywords-en runner-proxy-controller, domain-management, app-management, frp-management
 */
@Controller('runner/:runnerId')
export class RunnerProxyController {
  constructor(private readonly service: RunnerProxyService) {}

  /**
   * @title 获取性能统计
   * @description 返回 Runner 的 CPU、内存、FRP 状态与核心数量统计。
   * @param runnerId Runner ID
   * @returns 性能统计数据
   * @keywords-cn 性能统计, CPU, 内存, 统计
   * @keywords-en performance-stats, cpu, memory, stats
   */
  @Get('stats')
  async getStats(@Param('runnerId') runnerId: string) {
    return this.service.getStats(runnerId);
  }

  /**
   * @title 获取域名列表
   * @description 返回指定 Runner 的所有域名绑定记录。
   * @param runnerId Runner ID
   * @returns 域名绑定列表
   * @keywords-cn 域名列表, 域名绑定
   * @keywords-en domain-list, domain-binding
   */
  @Get('domains')
  async listDomains(@Param('runnerId') runnerId: string) {
    return this.service.listDomains(runnerId);
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
  @Post('domains')
  async createDomain(
    @Param('runnerId') runnerId: string,
    @Body() body: { domain: string; pathPattern?: string },
  ) {
    return this.service.createDomain(runnerId, body.domain, body.pathPattern);
  }

  /**
   * @title 删除域名绑定
   * @description 软删除指定的域名绑定记录。
   * @param runnerId Runner ID
   * @param domainId 域名绑定 ID
   * @keywords-cn 删除域名, 域名解绑
   * @keywords-en delete-domain, domain-unbind
   */
  @Delete('domains/:domainId')
  async deleteDomain(
    @Param('runnerId') runnerId: string,
    @Param('domainId') domainId: string,
  ) {
    await this.service.deleteDomain(runnerId, domainId);
    return { ok: true };
  }

  /**
   * @title 获取应用列表
   * @description 返回 Runner 上部署的应用列表。
   * @param runnerId Runner ID
   * @returns 应用列表
   * @keywords-cn 应用列表, Runner应用
   * @keywords-en app-list, runner-apps
   */
  @Get('apps')
  async listApps(@Param('runnerId') runnerId: string) {
    return this.service.listApps(runnerId);
  }

  /**
   * @title 获取 Solution 列表
   * @description 返回 Runner 上安装的 Solution 列表。
   * @param runnerId Runner ID
   * @returns Solution 列表
   * @keywords-cn Solution列表, Runner方案
   * @keywords-en solution-list, runner-solutions
   */
  @Get('solutions')
  async listSolutions(@Param('runnerId') runnerId: string) {
    return this.service.listSolutions(runnerId);
  }

  /**
   * @title 获取 FRP 状态
   * @description 返回当前 Runner 上 FRP 进程运行状态。
   * @param _runnerId Runner ID
   * @returns FRP 状态
   * @keywords-cn FRP状态, 进程状态
   * @keywords-en frp-status, process-status
   */
  @Get('frp/status')
  getFrpStatus(@Param('runnerId') _runnerId: string) {
    return this.service.getFrpStatus();
  }

  /**
   * @title 启动 FRP
   * @description 在 Runner 端启动 FRP 进程。
   * @param runnerId Runner ID
   * @keywords-cn 启动FRP, FRP进程
   * @keywords-en start-frp, frp-process
   */
  @Post('frp/start')
  async startFrp(@Param('runnerId') runnerId: string) {
    return this.service.startFrp(runnerId);
  }

  /**
   * @title 停止 FRP
   * @description 在 Runner 端停止 FRP 进程。
   * @param runnerId Runner ID
   * @keywords-cn 停止FRP, FRP进程
   * @keywords-en stop-frp, frp-process
   */
  @Post('frp/stop')
  async stopFrp(@Param('runnerId') runnerId: string) {
    return this.service.stopFrp(runnerId);
  }

  /**
   * @title 重载 FRP
   * @description 在 Runner 端重载 FRP 配置。
   * @param runnerId Runner ID
   * @keywords-cn 重载FRP, FRP配置
   * @keywords-en reload-frp, frp-config
   */
  @Post('frp/reload')
  async reloadFrp(@Param('runnerId') runnerId: string) {
    return this.service.reloadFrp(runnerId);
  }

  /**
   * @title 领取免费域名
   * @description 为 Runner 发放免费域名奖励，若已领取则返回冲突错误。
   * @param runnerId Runner ID
   * @returns 域名绑定记录
   * @keywords-cn 免费域名, 领取域名, 奖励
   * @keywords-en free-domain, claim-domain, reward
   */
  @Post('claim-free-domain')
  async claimFreeDomain(@Param('runnerId') runnerId: string) {
    return this.service.claimFreeDomain(runnerId);
  }
}

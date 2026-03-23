import { Controller, Post, Req, Res, HttpCode } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RunnerDomainService } from '../services/runner-domain.service';

/**
 * @title Runner 代理控制器
 * @description 提供统一的 HTTP 转发能力，将请求转发到对应 Runner。
 * @keywords-cn 代理控制器, HTTP转发, 统一转发
 * @keywords-en proxy-controller, http-forward, unified-forward
 */
@Controller()
export class RunnerProxyController {
  constructor(private readonly domainService: RunnerDomainService) {}

  /**
   * @title 统一转发接口
   * @description 接收来自 Caddy 的请求，根据域名查询 Runner 地址并通过 HTTP 代理转发。
   * @param req 原始请求对象
   * @param res 响应对象
   * @keywords-cn 转发, 统一转发, 域名路由
   * @keywords-en forward, unified-forward, domain-route
   */
  @Post('proxy/forward')
  @HttpCode(200)
  async forward(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const domain = (req.headers['x-forwarded-domain'] as string) || (req.headers['host'] as string);

    if (!domain) {
      res.status(400).json({ code: 400, message: 'Missing domain' });
      return;
    }

    const binding = await this.domainService.findByDomain(domain);
    if (!binding) {
      res.status(404).json({ code: 404, message: 'Domain not found' });
      return;
    }

    // TODO: 实现真正的 HTTP 代理转发
    // 当前只是记录日志，后续通过 FRP 隧道转发
    console.log(`[proxy] Forward request for domain: ${domain}, runnerId: ${binding.runnerId}`);

    res.status(501).json({ code: 501, message: 'Proxy not implemented yet' });
  }
}

import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * @title 资源签名服务
 * @description 为 GET /resources/:id 生成与校验访问签名，配合 @Public 接口实现租户隔离。
 *   - <img>/<video> 等浏览器原生标签无法附带 Authorization Bearer header，必须通过 URL query 携带凭证。
 *   - 签名公式: HMAC-SHA256(secret, `${id}:${tenantId}`).base64url.slice(0,32)。
 *   - 签名嵌入 tenantId 而非完整 JWT, 单纯防越权枚举; 链接泄露视为用户主动行为, 不在系统职责。
 *   - 历史资源 (channelId == null) 兼容期内允许无签名访问, 后续可移除该兜底。
 * @keywords-cn 资源签名, 租户隔离, HMAC, 越权防护
 * @keywords-en resource-sign, tenant-isolation, hmac, anti-enum
 */
@Injectable()
export class ResourceSignService {
  private readonly secret: string;

  constructor() {
    this.secret =
      process.env.RESOURCE_SIGN_SECRET ||
      process.env.JWT_SECRET ||
      'dev_secret_change_me';
  }

  /**
   * 计算资源访问签名。
   * @keyword-en compute-resource-sig, hmac
   */
  private compute(id: string, tenantId: string | null | undefined): string {
    const tid = tenantId ?? '';
    return createHmac('sha256', this.secret)
      .update(`${id}:${tid}`)
      .digest('base64url')
      .slice(0, 32);
  }

  /**
   * 构造资源访问 path: /resources/:id?sig=...&tid=...
   * @keyword-en build-signed-resource-path, signed-url
   */
  buildAccessPath(id: string, tenantId: string | null | undefined): string {
    const tid = tenantId ?? '';
    const sig = this.compute(id, tid);
    return `/resources/${id}?sig=${sig}&tid=${encodeURIComponent(tid)}`;
  }

  /**
   * 时间安全比较, 校验 sig 是否合法。
   * @keyword-en verify-resource-sig, timing-safe
   */
  verify(id: string, tenantId: string, sig: string): boolean {
    if (!id || !sig) return false;
    const expected = this.compute(id, tenantId);
    if (expected.length !== sig.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
      return false;
    }
  }
}

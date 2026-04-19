import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { DomainBindingEntity } from '../../app/runner/entities/domain-binding.entity';
import { RunnerEntity } from '../../app/runner/entities/runner.entity';
import { CommonRedisService } from '../../redis/services/common.service';

/** Redis 中缓存的域名绑定结构 */
interface CachedBinding {
  runnerId: string;
  pathPattern: string;
}

/** matchBinding 返回结果 */
interface MatchResult {
  binding: CachedBinding;
  /** 实际命中的路径前缀（要剥离的部分） */
  stripPrefix: string;
}

const REDIS_BINDINGS_PREFIX = 'forwarding:bindings:';
const REDIS_RUNNER_PREFIX = 'forwarding:runner:';
const REDIS_TTL = 300;

/**
 * @title 404 域名转发异常过滤器
 * @description 仅在 NestJS 路由无匹配（NotFoundException）时触发。
 *              根据 Host 头查询绑定列表，按 pathPattern（起始锚定正则）匹配路径，
 *              命中后通过 http-proxy-middleware 转发至对应 Runner。
 *              未命中则返回标准 404 JSON。
 *
 * @keywords-cn 404转发, 异常过滤器, 域名匹配, 路径锚定正则, Redis缓存, http-proxy
 * @keywords-en 404-forward, exception-filter, domain-match, anchored-path-regex, redis-cache, http-proxy
 */
@Catch(NotFoundException)
@Injectable()
export class ForwardingMiddleware implements ExceptionFilter {
  private readonly proxyCache = new Map<string, RequestHandler>();

  constructor(
    @InjectRepository(DomainBindingEntity)
    private readonly domainBindingRepo: Repository<DomainBindingEntity>,
    @InjectRepository(RunnerEntity)
    private readonly runnerRepo: Repository<RunnerEntity>,
    private readonly redis: CommonRedisService,
  ) {}
  /**
   * 核心过滤方法：仅处理 HTTP 请求的 NotFoundException，执行域名/路径匹配并代理转发
   * @keyword-en exception-catch, request-forward, proxy
   */
  async catch(
    exception: NotFoundException,
    host: ArgumentsHost,
  ): Promise<void> {
    if (host.getType() !== 'http') {
      throw exception;
    }
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const hostname = (req.headers['host'] as string) || '';
    const path = req.path;

    console.log(
      `[Forwarding] ${req.method} ${hostname}${path} — forwarding check`,
    );

    // Step 1: 取绑定列表（Redis 优先）
    const bindings = await this.getBindings(hostname);
    if (!bindings.length) {
      console.warn(`[Forwarding] No bindings found for host=${hostname}`);
      res.status(404).json({ statusCode: 404, message: 'Not Found' });
      return;
    }

    // Step 2: 按 pathPattern 起始锚定正则匹配（^pattern）
    const matched = this.matchBinding(bindings, path);
    if (!matched) {
      console.warn(
        `[Forwarding] No path match for path=${path} on host=${hostname}`,
      );
      res.status(404).json({ statusCode: 404, message: 'Not Found' });
      return;
    }

    console.log(
      `[Forwarding] Path matched: pathPattern=${matched.binding.pathPattern} stripPrefix=${matched.stripPrefix} runnerId=${matched.binding.runnerId}`,
    );

    // Step 3: 取 FRP 目标地址（Redis 优先）
    const targetUrl = await this.getTarget(matched.binding.runnerId);
    if (!targetUrl) {
      console.warn(
        `[Forwarding] No FRP target for runnerId=${matched.binding.runnerId}`,
      );
      res.status(404).json({ statusCode: 404, message: 'Not Found' });
      return;
    }

    console.log(
      `[Forwarding] Proxying to target=${targetUrl} stripPrefix=${matched.stripPrefix}`,
    );

    // Step 4: 代理转发（剥离前缀后转发，runner 返回任意状态码直接透传）
    const proxy = this.getProxy(targetUrl, matched.stripPrefix);
    void proxy(req, res, () => {
      if (!res.headersSent) {
        res.status(502).json({ statusCode: 502, message: 'Bad Gateway' });
      }
    });
  }

  /**
   * 查询域名绑定列表，优先读 Redis，回退到 DB 并写缓存
   * @keyword-en get-bindings, redis-cache, domain-lookup
   */
  private async getBindings(hostname: string): Promise<CachedBinding[]> {
    const key = `${REDIS_BINDINGS_PREFIX}${hostname}`;
    if (this.redis.isAvailable()) {
      const raw = await this.redis.getString(key).catch(() => null);
      if (raw) return JSON.parse(raw) as CachedBinding[];
    }

    const rows = await this.domainBindingRepo.find({
      where: { domain: hostname, active: true },
      select: ['runnerId', 'pathPattern'],
    });
    const bindings: CachedBinding[] = rows.map((r) => ({
      runnerId: r.runnerId,
      pathPattern: r.pathPattern,
    }));

    if (this.redis.isAvailable() && bindings.length) {
      await this.redis
        .setString(key, JSON.stringify(bindings), REDIS_TTL)
        .catch(() => null);
    }
    return bindings;
  }

  /**
   * 按 pathPattern 起始锄定正则匹配，返回匹配绑定及实际命中的前缀字符串
   * 例如 pathPattern="/abc" 匹配 path="/abc/foo" 时，stripPrefix="/abc"
   * @keyword-en match-binding, anchored-regex, strip-prefix
   */
  private matchBinding(
    bindings: CachedBinding[],
    path: string,
  ): MatchResult | null {
    for (const b of bindings) {
      try {
        // 归一化：pathPattern 不以 / 开头时自动补上，与 req.path 格式对齐
        const pattern = b.pathPattern.startsWith('/')
          ? b.pathPattern
          : `/${b.pathPattern}`;
        const m = new RegExp(`^(${pattern})`).exec(path);
        if (m) return { binding: b, stripPrefix: m[1] };
      } catch {
        // 跳过非法正则
      }
    }
    return null;
  }

  /**
   * 查询 Runner 的 FRP 目标 URL，优先读 Redis，回退到 DB 并写缓存
   * @keyword-en get-target, frp-lookup, runner-target
   */
  private async getTarget(runnerId: string): Promise<string | null> {
    const key = `${REDIS_RUNNER_PREFIX}${runnerId}`;
    if (this.redis.isAvailable()) {
      const cached = await this.redis.getString(key).catch(() => null);
      if (cached) return cached;
    }

    const runner = await this.runnerRepo.findOne({
      where: { id: runnerId, active: true },
      select: ['frpHost', 'frpPort'],
    });
    if (!runner?.frpHost || !runner?.frpPort) return null;

    const target = `http://${runner.frpHost}:${runner.frpPort}`;
    if (this.redis.isAvailable()) {
      await this.redis.setString(key, target, REDIS_TTL).catch(() => null);
    }
    return target;
  }

  /**
   * 按 targetUrl + stripPrefix 获取或创建代理实例
   * pathRewrite 将刻名前缀剥离，确保 runner 收到的是干净短路径；
   * runner 返回的任意状态码（包括 404）直接透传，不会再触发 ExceptionFilter
   * @keyword-en get-proxy, proxy-cache, path-rewrite
   */
  private getProxy(target: string, stripPrefix: string): RequestHandler {
    const cacheKey = `${target}::${stripPrefix}`;
    if (!this.proxyCache.has(cacheKey)) {
      const prefix = stripPrefix;
      const proxy = createProxyMiddleware<Request, Response>({
        target,
        changeOrigin: true,
        pathRewrite: (reqPath: string) => {
          // 将前缀剥离，空串补 /
          const rewritten = reqPath.startsWith(prefix)
            ? reqPath.slice(prefix.length) || '/'
            : reqPath;
          return rewritten;
        },
        on: {
          error: (err, _req, res) => {
            console.error(
              `[Forwarding] Proxy error on target=${target}: ${err.message}`,
            );
            const r = res as Response;
            if (!r.headersSent) r.status(502).send('Bad Gateway');
          },
        },
      });
      this.proxyCache.set(cacheKey, proxy);
    }
    return this.proxyCache.get(cacheKey)!;
  }
}

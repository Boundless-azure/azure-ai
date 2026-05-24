import { Global, Module } from '@nestjs/common';
import { CommonRedisService } from './services/common.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { RedisConfig } from '../config/types';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const conf = configService.get<RedisConfig>('appRedis');
        // Attempt dynamic import of ioredis if available
        try {
          // 动态导入 ioredis；未安装则返回 undefined
          const mod = await import('ioredis').catch(() => undefined as unknown);
          if (!mod) {
            return undefined;
          }
          // 从已知类型的模块中解构默认导出，避免 any 与不安全成员访问
          const { default: IORedisCtor } = mod as typeof import('ioredis');
          const client = conf?.url
            ? new IORedisCtor(conf.url)
            : new IORedisCtor({
                host: conf?.host ?? 'localhost',
                port: conf?.port ?? 6379,
                password: conf?.password,
                db: conf?.db ?? 0,
                tls: conf?.tls ? {} : undefined,
              });
          return client as unknown; // cast to RedisClientLike at injection site
        } catch {
          // ioredis not installed; return undefined to allow app to start without Redis
          return undefined;
        }
      },
    },
    CommonRedisService,
  ],
  exports: [CommonRedisService, 'REDIS_CLIENT'],
})
export class RedisModule {}

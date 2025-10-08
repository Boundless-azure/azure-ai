import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AICoreModule } from './core/ai/ai-core.module';
import { TipModule } from './core/tip/tip.module';
import { RedisModule } from './redis/redis.module';
import { PluginModule } from './core/plugin/plugin.module';
// 直接从具体配置文件导入，避免 Barrel 导出解析异常
import {
  loadDatabaseConfigFromEnv,
  createTypeOrmOptions,
} from './config/database.config';
import { loadAIConfigFromEnv } from './config/ai.config';
import { loadLoggingConfigFromEnv } from './config/logging.config';
import { loadHookBusConfigFromEnv } from './config/hookbus.config';
import { loadRedisConfigFromEnv } from './config/redis.config';
import type { DatabaseConfig } from './config/types';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [
        () => ({ appDatabase: loadDatabaseConfigFromEnv() }),
        () => ({ appAI: loadAIConfigFromEnv() }),
        () => ({ appLogging: loadLoggingConfigFromEnv() }),
        () => ({ appHookBus: loadHookBusConfigFromEnv() }),
        () => ({ appRedis: loadRedisConfigFromEnv() }),
      ],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (): TypeOrmModuleOptions => {
        const db: DatabaseConfig = loadDatabaseConfigFromEnv();
        return createTypeOrmOptions(db);
      },
    }),
    AICoreModule.forRoot({
      isGlobal: true,
      database: {
        // 仅一次读取并使用强类型，避免 ESLint 对不安全成员访问的误报
        ...(() => {
          const cfg: DatabaseConfig = loadDatabaseConfigFromEnv();
          return {
            type: cfg.type,
            host: cfg.host,
            port: cfg.port,
            username: cfg.username,
            password: cfg.password,
            database: cfg.database,
            synchronize: cfg.synchronize,
          };
        })(),
      },
      context: {
        maxMessages: 100,
        maxContextAge: 3600000, // 1小时
        cleanupInterval: 300000, // 5分钟
      },
    }),
    TipModule.forRoot({
      // 可选配置：rootDir 默认指向 src/core；includePatterns 默认 ['**/*.tip']
      // rootDir: join(process.cwd(), 'src', 'core'),
    }),
    RedisModule,
    PluginModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

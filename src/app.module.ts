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
import { PromptModule } from './core/prompt/prompt.module';
import { HookBusModule } from './core/hookbus/hookbus.module';
import { ConversationModule } from '@/app/conversation/conversation.module';
import { AgentModule } from '@/app/agent/agent.module';
import { TodoModule } from '@/app/todo/todo.module';
import { WebMcpModule } from '@/app/webmcp/webmcp.module';
import { IdentityModule } from '@/app/identity/identity.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { AbilityGuard } from '@/app/identity/guards/ability.guard';
import { AuthModule } from '@/core/auth/auth.module';
// 直接从具体配置文件导入，避免 Barrel 导出解析异常
import {
  loadDatabaseConfigFromEnv,
  createTypeOrmOptions,
} from './config/database.config';
import { loadMongoConfigFromEnv } from './config/mongo.config';
import { MongoModule } from './mongo/mongo.module';
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
        () => ({ appMongo: loadMongoConfigFromEnv() }),
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
        // 限制分析窗口大小，避免长上下文：仅取最近N条消息
        analysisWindowSize: 5,
      },
    }),
    TipModule.forRoot({
      // 可选配置：rootDir 默认指向 src/core；includePatterns 默认 ['**/*.tip']
      // rootDir: join(process.cwd(), 'src', 'core'),
    }),
    PromptModule.forRoot({ isGlobal: true }),
    HookBusModule.forRoot({
      bufferSize: loadHookBusConfigFromEnv().bufferSize,
      debug: loadHookBusConfigFromEnv().debug,
    }),
    RedisModule,
    MongoModule.forRoot({}),
    PluginModule,
    WebMcpModule,
    AuthModule,
    IdentityModule,
    ConversationModule,
    AgentModule,
    TodoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AbilityGuard },
  ],
})
export class AppModule {}

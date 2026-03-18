import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '@/app/identity/identity.module';
import { RunnerEntity } from './entities/runner.entity';
import { RunnerController } from './controllers/runner.controller';
import { RunnerGateway } from './controllers/runner.gateway';
import { RunnerService } from './services/runner.service';
import { RunnerHookRegisterService } from './services/runner-hook-register.service';

/**
 * @title Runner 模块
 * @description 提供 Runner 增删改查、注册网关与基础 Hook 注册能力。
 * @keywords-cn Runner模块, CRUD, 注册网关, Hook注册
 * @keywords-en runner-module, crud, register-gateway, hook-registration
 */
@Module({
  imports: [TypeOrmModule.forFeature([RunnerEntity]), IdentityModule],
  controllers: [RunnerController],
  providers: [RunnerService, RunnerGateway, RunnerHookRegisterService],
  exports: [RunnerService],
})
export class RunnerModule {}

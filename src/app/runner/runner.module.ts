import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '@/app/identity/identity.module';
import { RunnerEntity } from './entities/runner.entity';
import { FrpRecordEntity } from './entities/frp-record.entity';
import { DomainBindingEntity } from './entities/domain-binding.entity';
import { RewardRecordEntity } from './entities/reward-record.entity';
import { FrpNodeEntity } from './entities/frp-node.entity';
import { RunnerController } from './controllers/runner.controller';
import { RunnerProxyController } from './controllers/runner.proxy.controller';
import { RewardRecordController } from './controllers/reward-record.controller';
import { FrpPluginController } from './controllers/frp-plugin.controller';
import { RunnerGateway } from './controllers/runner.gateway';
import { RunnerService } from './services/runner.service';
import { RunnerFrpService } from './services/runner-frp.service';
import { RunnerDomainService } from './services/runner-domain.service';
import { DomainAllocationService } from './services/domain-allocation.service';
import { RewardRecordService } from './services/reward-record.service';
import { RunnerHookRegisterService } from './services/runner-hook-register.service';
import { RunnerProxyService } from './services/runner-proxy.service';
import { RunnerFrpNodeService } from './services/runner-frp-node.service';

/**
 * @title Runner 模块
 * @description 提供 Runner 增删改查、注册网关、域名分配与奖励记录能力。
 * @keywords-cn Runner模块, CRUD, 注册网关, 域名分配, 奖励记录
 * @keywords-en runner-module, crud, register-gateway, domain-allocation, reward-record
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RunnerEntity,
      FrpRecordEntity,
      DomainBindingEntity,
      RewardRecordEntity,
      FrpNodeEntity,
    ]),
    IdentityModule,
  ],
  controllers: [
    RunnerController,
    RunnerProxyController,
    RewardRecordController,
    FrpPluginController,
  ],
  providers: [
    RunnerService,
    RunnerFrpService,
    RunnerDomainService,
    DomainAllocationService,
    RewardRecordService,
    RunnerGateway,
    RunnerHookRegisterService,
    RunnerProxyService,
    RunnerFrpNodeService,
  ],
  exports: [
    RunnerService,
    RunnerFrpService,
    RunnerDomainService,
    DomainAllocationService,
    RewardRecordService,
    RunnerProxyService,
    RunnerFrpNodeService,
  ],
})
export class RunnerModule {}

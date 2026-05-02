import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolutionController } from './controllers/solution.controller';
import { SolutionService } from './services/solution.service';
import { SolutionEntity } from './entities/solution.entity';
import { SolutionPurchaseEntity } from './entities/solution-purchase.entity';
import { RunnerModule } from '@/app/runner/runner.module';

/**
 * @title Solution 模块
 * @description Solution 管理模块, 列表/详情走 Runner 真实数据 (HookRpc 跨进程聚合);
 *              市场与购买暂用占位, 后续接入。
 * @keywords-cn Solution模块, Solution管理, 真实数据, 跨runner聚合
 * @keywords-en solution-module, solution-management, real-data, cross-runner-aggregate
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SolutionEntity, SolutionPurchaseEntity]),
    RunnerModule,
  ],
  controllers: [SolutionController],
  providers: [SolutionService],
  exports: [SolutionService],
})
export class SolutionModule {}

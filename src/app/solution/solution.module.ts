import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolutionController } from './controllers/solution.controller';
import { SolutionService } from './services/solution.service';
import { SolutionEntity } from './entities/solution.entity';
import { SolutionPurchaseEntity } from './entities/solution-purchase.entity';

/**
 * @title Solution 模块
 * @description Solution 管理模块，提供解决方案的 CRUD、市场和购买功能
 * @keywords-cn Solution模块, Solution管理, 解决方案市场
 * @keywords-en solution-module, solution-management, solution-marketplace
 */
@Module({
  imports: [TypeOrmModule.forFeature([SolutionEntity, SolutionPurchaseEntity])],
  controllers: [SolutionController],
  providers: [SolutionService],
  exports: [SolutionService],
})
export class SolutionModule {}

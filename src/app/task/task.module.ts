import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskController } from './controllers/task.controller';
import { TaskEntity } from './entities/task.entity';
import { TaskService } from './services/task.service';

/**
 * @title 任务模块
 * @description 提供任务实体、服务与控制器。
 * @keywords-cn 任务模块, TypeORM, CRUD
 * @keywords-en task-module, typeorm, crud
 */
@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity])],
  providers: [TaskService],
  controllers: [TaskController],
  exports: [TaskService],
})
export class TaskModule {}

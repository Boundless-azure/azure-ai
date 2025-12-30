import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoEntity } from './entities/todo.entity';
import { TodoService } from './services/todo.service';
import { TodoController } from './controllers/todo.controller';

/**
 * @title 待办事项模块
 * @description 集成 TypeORM，提供待办的基础 CRUD 接口。
 * @keywords-cn 待办模块, TypeORM, CRUD
 * @keywords-en todo-module, typeorm, crud
 */
@Module({
  imports: [TypeOrmModule.forFeature([TodoEntity])],
  providers: [TodoService],
  controllers: [TodoController],
  exports: [TodoService],
})
export class TodoModule {}

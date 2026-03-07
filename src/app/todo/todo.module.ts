import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoEntity } from './entities/todo.entity';
import { TodoService } from './services/todo.service';
import { TodoController } from './controllers/todo.controller';
import { DataPermissionModule } from '@/core/data-permission';
import { CreateTodoDto, QueryTodoDto, UpdateTodoDto } from './types/todo.types';

/**
 * @title 待办事项模块
 * @description 集成 TypeORM，提供待办的基础 CRUD 接口。
 * @keywords-cn 待办模块, TypeORM, CRUD
 * @keywords-en todo-module, typeorm, crud
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TodoEntity]),
    DataPermissionModule.forRoot({
      tableDtoMap: {
        todos: [QueryTodoDto, CreateTodoDto, UpdateTodoDto],
      },
      nodes: {
        'todo:read-only-myself': ({ context }) => ({
          allow: Boolean(context.principalId),
          where: context.principalId
            ? { recipientId: context.principalId }
            : undefined,
        }),
        'todo:create-only-myself': ({ context, payload }) => ({
          allow:
            Boolean(context.principalId) &&
            payload?.recipientId === context.principalId,
        }),
        'todo:update-only-myself': ({ context }) => ({
          allow: Boolean(context.principalId),
          where: context.principalId
            ? { recipientId: context.principalId }
            : undefined,
        }),
      },
    }),
  ],
  providers: [TodoService],
  controllers: [TodoController],
  exports: [TodoService],
})
export class TodoModule {}

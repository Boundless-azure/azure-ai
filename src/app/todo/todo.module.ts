import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoEntity } from './entities/todo.entity';
import { TodoFollowupEntity } from './entities/todo-followup.entity';
import { TodoFollowupCommentEntity } from './entities/todo-followup-comment.entity';
import { TodoService } from './services/todo.service';
import { TodoController } from './controllers/todo.controller';
import { DataPermissionModule } from '@/core/data-permission';
import { CreateTodoDto, QueryTodoDto, UpdateTodoDto } from './types/todo.types';

/**
 * @title 待办事项模块
 * @description 集成 TypeORM，提供待办的基础 CRUD 接口及跟进记录、评论管理功能。
 * @keywords-cn 待办模块, TypeORM, CRUD, 跟进, 评论
 * @keywords-en todo-module, typeorm, crud, followup, comment
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TodoEntity,
      TodoFollowupEntity,
      TodoFollowupCommentEntity,
    ]),
    DataPermissionModule.forRoot({
      tableDtoMap: {
        todos: [QueryTodoDto, CreateTodoDto, UpdateTodoDto],
      },
      nodes: {
        'todo:read-only-myself': ({ context }) => ({
          allow: Boolean(context.principalId),
          where: context.principalId
            ? { initiatorId: context.principalId }
            : undefined,
        }),
        'todo:create-only-myself': ({ context, payload }) => ({
          allow:
            Boolean(context.principalId) &&
            payload?.initiatorId === context.principalId,
        }),
        'todo:update-only-myself': ({ context }) => ({
          allow: Boolean(context.principalId),
          where: context.principalId
            ? { initiatorId: context.principalId }
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

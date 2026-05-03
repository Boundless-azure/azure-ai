import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoEntity } from './entities/todo.entity';
import { TodoFollowupEntity } from './entities/todo-followup.entity';
import { TodoFollowupCommentEntity } from './entities/todo-followup-comment.entity';
import { TodoService } from './services/todo.service';
import { TodoController } from './controllers/todo.controller';
import { IdentityModule } from '@/app/identity/identity.module';

/**
 * @title 待办事项模块
 * @description 集成 TypeORM, 提供待办的基础 CRUD 接口及跟进记录、评论管理功能。
 *              数据权限走新范式 :: DTO 上 @DataPermissionNode 静态方法装饰器自身完成节点声明,
 *              service 注入 DataPermissionService (从 IdentityModule 透传) 调 applyTo 校验。
 *              不再需要 DataPermissionModule.forRoot 注册节点。
 * @keywords-cn 待办模块, TypeORM, CRUD, 跟进, 评论, 数据权限新范式
 * @keywords-en todo-module, typeorm, crud, followup, comment, data-permission-new
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TodoEntity,
      TodoFollowupEntity,
      TodoFollowupCommentEntity,
    ]),
    IdentityModule, // 提供 AbilityService + DataPermissionService (后者由 IdentityModule 通过 forRoot global 引入)
  ],
  providers: [TodoService],
  controllers: [TodoController],
  exports: [TodoService],
})
export class TodoModule {}

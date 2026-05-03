import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataPermissionModule } from '@/core/data-permission';
import { PrincipalEntity } from './entities/principal.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { MembershipEntity } from './entities/membership.entity';
import { RoleEntity } from './entities/role.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { UserEntity } from './entities/user.entity';
import { PrincipalService } from './services/principal.service';
import { OrganizationService } from './services/organization.service';
import { RoleService } from './services/role.service';
import { AbilityService } from './services/ability.service';
import { HookAbilityMiddlewareService } from './services/hook.ability-middleware.service';
import { PermissionDefinitionEntity } from './entities/permission-definition.entity';
import { PermissionDefinitionService } from './services/permission-definition.service';
import { PermissionDefinitionController } from './controllers/permission-definition.controller';
import { PrincipalController } from './controllers/principal.controller';
import { OrganizationController } from './controllers/organization.controller';
import { RoleController } from './controllers/role.controller';
import { MembershipController } from './controllers/membership.controller';
import { UsersController } from './controllers/users.controller';

/**
 * @title Identity 模块
 * @description 提供主体/组织/成员/角色/权限能力服务。
 *              依赖 DataPermissionModule (forRoot global) 使 PermissionDefinitionService 启动期能从装饰器同步数据节点。
 * @keywords-cn 身份模块, 组织, 角色, 权限, 数据权限同步
 * @keywords-en identity-module, organization, role, permissions, data-permission-sync
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PrincipalEntity,
      OrganizationEntity,
      MembershipEntity,
      RoleEntity,
      RolePermissionEntity,
      PermissionDefinitionEntity,
      UserEntity,
    ]),
    DataPermissionModule.forRoot({ isGlobal: true }),
  ],
  providers: [
    PrincipalService,
    OrganizationService,
    RoleService,
    AbilityService,
    PermissionDefinitionService,
    HookAbilityMiddlewareService,
  ],
  controllers: [
    PrincipalController,
    OrganizationController,
    RoleController,
    MembershipController,
    UsersController,
    PermissionDefinitionController,
  ],
  exports: [
    PrincipalService,
    OrganizationService,
    RoleService,
    AbilityService,
    PermissionDefinitionService,
  ],
})
export class IdentityModule {}

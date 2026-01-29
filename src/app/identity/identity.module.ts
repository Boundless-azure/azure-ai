import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
 * @keywords-cn 身份模块, 组织, 角色, 权限
 * @keywords-en identity-module, organization, role, permissions
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
  ],
  providers: [
    PrincipalService,
    OrganizationService,
    RoleService,
    AbilityService,
    PermissionDefinitionService,
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

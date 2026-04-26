import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
} from '@nestjs/common';
import { z } from 'zod';
import { PermissionDefinitionService } from '../services/permission-definition.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';
import { PermissionDefinitionType } from '../enums/permission.enums';
import type {
  CreatePermissionDefinitionDto,
  UpdatePermissionDefinitionDto,
} from '../types/identity.types';

/**
 * @title PermissionDefinition Hook payload schema (input 形状, SSOT)
 * @keywords-cn PermissionDefinitionHook, payloadSchema, input
 * @keywords-en permission-definition-hook, payload-schema, input
 */
const permissionTypeSchema = z.enum([
  PermissionDefinitionType.Management,
  PermissionDefinitionType.Data,
  PermissionDefinitionType.Menu,
]);

const onRbacPermissionDefinitionListInput = z.object({});

const onRbacPermissionDefinitionCreateInput = z.object({
  fid: z.string().nullable().optional(),
  nodeKey: z.string(),
  extraData: z.record(z.string(), z.unknown()).nullable().optional(),
  description: z.string().optional(),
  permissionType: permissionTypeSchema.optional(),
});

const onRbacPermissionDefinitionUpdateInput = z.object({
  fid: z.string().nullable().optional(),
  nodeKey: z.string().optional(),
  extraData: z.record(z.string(), z.unknown()).nullable().optional(),
  description: z.string().optional(),
  permissionType: permissionTypeSchema.optional(),
});

const idParamInput = z.object({ id: z.string() });

/**
 * @title PermissionDefinition 控制器
 * @description 权限定义的查询与维护接口。
 * @keywords-cn 权限定义控制器, 权限枚举
 * @keywords-en permission-definition-controller, permissions-enum
 */
@Controller('identity/permissions/definitions')
export class PermissionDefinitionController {
  constructor(private readonly service: PermissionDefinitionService) {}

  @Get()
  @CheckAbility('read', 'permission_definition')
  @HookLifecycle({
    hook: 'saas.app.identity.permissionDefinitionList',
    description: 'RBAC权限定义列表查询',
    payloadSchema: onRbacPermissionDefinitionListInput,
    payloadSource: 'query',
  })
  async list() {
    return await this.service.list();
  }

  @Post()
  @CheckAbility('create', 'permission_definition')
  @HookLifecycle({
    hook: 'saas.app.identity.permissionDefinitionCreate',
    description: 'RBAC权限定义创建',
    payloadSchema: onRbacPermissionDefinitionCreateInput,
    payloadSource: 'body',
  })
  async create(@Body() dto: CreatePermissionDefinitionDto) {
    return await this.service.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'permission_definition')
  @HookLifecycle({
    hook: 'saas.app.identity.permissionDefinitionUpdate',
    description: 'RBAC权限定义更新',
    payloadSchema: onRbacPermissionDefinitionUpdateInput,
    payloadSource: 'body',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDefinitionDto,
  ) {
    await this.service.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'permission_definition')
  @HookLifecycle({
    hook: 'saas.app.identity.permissionDefinitionDelete',
    description: 'RBAC权限定义删除',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true } as const;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../entities/role.entity';
import { RolePermissionEntity } from '../entities/role-permission.entity';
import type {
  CreateRoleDto,
  UpdateRoleDto,
  UpsertRolePermissionsDto,
} from '../types/identity.types';

/**
 * @title Role 服务
 * @description 提供角色与角色权限的管理。
 * @keywords-cn 角色服务, 权限, 管理
 * @keywords-en role-service, permissions, management
 */
@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly permRepo: Repository<RolePermissionEntity>,
  ) {}

  async list(): Promise<RoleEntity[]> {
    return await this.roleRepo.find({
      where: { isDelete: false },
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateRoleDto): Promise<RoleEntity> {
    const entity = this.roleRepo.create({
      name: dto.name,
      code: dto.code,
      description: dto.description ?? null,
      organizationId: dto.organizationId ?? null,
      builtin: false,
      isDelete: false,
    });
    return await this.roleRepo.save(entity);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<void> {
    const patch: Partial<RoleEntity> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    await this.roleRepo.update({ id }, patch);
  }

  async delete(id: string): Promise<void> {
    await this.roleRepo.update({ id }, { isDelete: true });
  }

  async listPermissions(roleId: string): Promise<RolePermissionEntity[]> {
    return await this.permRepo.find({
      where: { roleId, isDelete: false },
      order: { createdAt: 'DESC' },
    });
  }

  async upsertPermissions(
    roleId: string,
    dto: UpsertRolePermissionsDto,
  ): Promise<{ count: number }> {
    // 简化为替换式更新：先清空旧权限（软删），再批量插入
    await this.permRepo.update({ roleId }, { isDelete: true });
    const entities = dto.items.map((it) =>
      this.permRepo.create({
        roleId,
        subject: it.subject,
        action: it.action,
        conditions: it.conditions ?? null,
      }),
    );
    const saved = await this.permRepo.save(entities);
    return { count: saved.length };
  }
}

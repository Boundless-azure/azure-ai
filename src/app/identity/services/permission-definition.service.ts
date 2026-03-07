import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PermissionDefinitionEntity } from '../entities/permission-definition.entity';
import { PermissionDefinitionType } from '../enums/permission.enums';
import type {
  CreatePermissionDefinitionDto,
  UpdatePermissionDefinitionDto,
} from '../types/identity.types';

/**
 * @title PermissionDefinition 服务
 * @description 权限定义的读取与维护。
 * @keywords-cn 权限定义服务, 枚举
 * @keywords-en permission-definition-service, enum
 */
@Injectable()
export class PermissionDefinitionService {
  constructor(
    @InjectRepository(PermissionDefinitionEntity)
    private readonly repo: Repository<PermissionDefinitionEntity>,
  ) {}

  async list(): Promise<PermissionDefinitionEntity[]> {
    return await this.repo.find({
      where: { isDelete: false },
      order: { permissionType: 'ASC', fid: 'ASC', nodeKey: 'ASC' },
    });
  }

  async create(
    data: CreatePermissionDefinitionDto,
  ): Promise<PermissionDefinitionEntity> {
    const entity = this.repo.create({
      fid: data.fid ?? null,
      nodeKey: data.nodeKey,
      permissionType:
        data.permissionType ?? PermissionDefinitionType.Management,
      description: data.description ?? null,
      extraData: data.extraData ?? null,
      isDelete: false,
    });
    return await this.repo.save(entity);
  }

  async update(id: string, dto: UpdatePermissionDefinitionDto): Promise<void> {
    const entity = await this.repo.findOneBy({ id, isDelete: false });
    if (!entity) return;

    if (dto.fid !== undefined) entity.fid = dto.fid;
    if (dto.nodeKey !== undefined) entity.nodeKey = dto.nodeKey;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.extraData !== undefined) entity.extraData = dto.extraData;
    if (dto.permissionType !== undefined) {
      entity.permissionType = dto.permissionType;
    }

    await this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const idsToDelete: string[] = [id];
    let cursor = 0;

    while (cursor < idsToDelete.length) {
      const batch = idsToDelete.slice(cursor, cursor + 100);
      cursor += batch.length;
      const children = await this.repo.find({
        select: ['id'],
        where: { fid: In(batch), isDelete: false },
      });
      for (const child of children) {
        if (!idsToDelete.includes(child.id)) idsToDelete.push(child.id);
      }
    }

    await this.repo.update({ id: In(idsToDelete) }, { isDelete: true });
  }
}

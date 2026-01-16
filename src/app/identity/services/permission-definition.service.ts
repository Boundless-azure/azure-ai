import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionDefinitionEntity } from '../entities/permission-definition.entity';

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
      order: { subject: 'ASC', action: 'ASC' },
    });
  }

  async create(data: {
    subject: string;
    action: string;
    description?: string;
  }): Promise<PermissionDefinitionEntity> {
    const entity = this.repo.create({
      subject: data.subject,
      action: data.action,
      description: data.description ?? null,
      isDelete: false,
    });
    return await this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.repo.update({ id }, { isDelete: true });
  }
}

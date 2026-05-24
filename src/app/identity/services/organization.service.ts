import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { OrganizationEntity } from '../entities/organization.entity';
import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  QueryOrganizationDto,
} from '../types/identity.types';

/**
 * @title Organization 服务
 * @description 提供组织/租户的增删改查。
 * @keywords-cn 组织服务, 租户, 增删改查
 * @keywords-en organization-service, tenant, crud
 */
@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly repo: Repository<OrganizationEntity>,
  ) {}

  async list(query: QueryOrganizationDto): Promise<OrganizationEntity[]> {
    if (query.q && query.q.trim()) {
      const q = `%${query.q.trim()}%`;
      return await this.repo.find({
        where: [
          { name: Like(q), isDelete: false },
          { code: Like(q), isDelete: false },
        ],
        order: { createdAt: 'DESC' },
      });
    }
    return await this.repo.find({
      where: { isDelete: false },
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateOrganizationDto): Promise<OrganizationEntity> {
    const entity = this.repo.create({
      name: dto.name,
      code: dto.code ?? null,
      active: true,
      isDelete: false,
    });
    return await this.repo.save(entity);
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<void> {
    const patch: Partial<OrganizationEntity> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.code !== undefined) patch.code = dto.code;
    if (dto.active !== undefined) patch.active = !!dto.active;
    await this.repo.update({ id }, patch);
  }

  async delete(id: string): Promise<void> {
    await this.repo.update({ id }, { isDelete: true, active: false });
  }
}

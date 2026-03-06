import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ImContactGroupEntity } from '../entities/im-contact-group.entity';
import { ImContactGroupMemberEntity } from '../entities/im-contact-group-member.entity';
import type {
  CreateImContactGroupDto,
  UpdateImContactGroupDto,
  AddImContactGroupMembersDto,
  ImContactGroupInfo,
} from '../types/im.types';

/**
 * @title IM Contact Group Service
 * @description 提供通讯录分组的增删改查与成员维护能力（按 ownerPrincipalId 隔离）。
 * @keywords-cn 通讯录分组服务, 创建分组, 分组成员, 移动到分组
 * @keywords-en contact-group-service, create-group, group-members, move-to-group
 */
@Injectable()
export class ImContactGroupService {
  constructor(
    @InjectRepository(ImContactGroupEntity)
    private readonly groupRepo: Repository<ImContactGroupEntity>,
    @InjectRepository(ImContactGroupMemberEntity)
    private readonly memberRepo: Repository<ImContactGroupMemberEntity>,
  ) {}

  async listGroups(ownerPrincipalId: string): Promise<ImContactGroupInfo[]> {
    const groups = await this.groupRepo.find({
      where: { ownerPrincipalId, isDelete: false },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });

    const groupIds = groups.map((g) => g.id);
    const counts = new Map<string, number>();
    if (groupIds.length) {
      const rows = await this.memberRepo
        .createQueryBuilder('m')
        .select('m.groupId', 'groupId')
        .addSelect('COUNT(1)', 'cnt')
        .where('m.isDelete = FALSE')
        .andWhere('m.groupId IN (:...groupIds)', { groupIds })
        .groupBy('m.groupId')
        .getRawMany<{ groupId: string; cnt: string }>();

      for (const r of rows) counts.set(r.groupId, parseInt(r.cnt, 10) || 0);
    }

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder,
      active: g.active,
      memberCount: counts.get(g.id) ?? 0,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));
  }

  async getGroupInfo(
    ownerPrincipalId: string,
    groupId: string,
  ): Promise<ImContactGroupInfo> {
    const g = await this.groupRepo.findOneOrFail({
      where: { id: groupId, ownerPrincipalId, isDelete: false },
    });
    const memberCount = await this.memberRepo.count({
      where: { ownerPrincipalId, groupId, isDelete: false },
    });
    return {
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder,
      active: g.active,
      memberCount,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }

  async createGroup(
    ownerPrincipalId: string,
    dto: CreateImContactGroupDto,
  ): Promise<ImContactGroupEntity> {
    const name = dto.name.trim();
    if (!name) throw new Error('name is required');

    const existed = await this.groupRepo.findOne({
      where: { ownerPrincipalId, name, isDelete: false },
    });
    if (existed) throw new Error('group name already exists');

    const entity = this.groupRepo.create({
      ownerPrincipalId,
      name,
      sortOrder: 0,
      active: true,
    });
    return await this.groupRepo.save(entity);
  }

  async updateGroup(
    ownerPrincipalId: string,
    groupId: string,
    dto: UpdateImContactGroupDto,
  ): Promise<ImContactGroupEntity> {
    const entity = await this.groupRepo.findOneOrFail({
      where: { id: groupId, ownerPrincipalId, isDelete: false },
    });

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new Error('name is required');
      const existed = await this.groupRepo.findOne({
        where: { ownerPrincipalId, name, isDelete: false },
      });
      if (existed && existed.id !== entity.id)
        throw new Error('group name already exists');
      entity.name = name;
    }

    if (dto.sortOrder !== undefined) entity.sortOrder = dto.sortOrder;
    if (dto.active !== undefined) entity.active = dto.active;

    return await this.groupRepo.save(entity);
  }

  async deleteGroup(ownerPrincipalId: string, groupId: string): Promise<void> {
    const entity = await this.groupRepo.findOneOrFail({
      where: { id: groupId, ownerPrincipalId, isDelete: false },
    });
    entity.isDelete = true;
    await this.groupRepo.save(entity);

    await this.memberRepo
      .createQueryBuilder()
      .update(ImContactGroupMemberEntity)
      .set({ isDelete: true })
      .where('group_id = :groupId', { groupId })
      .andWhere('owner_principal_id = :ownerPrincipalId', { ownerPrincipalId })
      .execute();
  }

  async listMemberIds(ownerPrincipalId: string, groupId: string) {
    const group = await this.groupRepo.findOneOrFail({
      where: { id: groupId, ownerPrincipalId, isDelete: false },
    });
    if (!group.active) return [] as string[];

    const members = await this.memberRepo.find({
      where: { ownerPrincipalId, groupId, isDelete: false },
      order: { createdAt: 'DESC' },
    });
    return members.map((m) => m.memberPrincipalId);
  }

  async addMembers(
    ownerPrincipalId: string,
    groupId: string,
    dto: AddImContactGroupMembersDto,
  ): Promise<{ addedCount: number }> {
    const group = await this.groupRepo.findOneOrFail({
      where: { id: groupId, ownerPrincipalId, isDelete: false },
    });
    if (!group.active) throw new Error('group is inactive');

    const principalIds = Array.from(
      new Set(dto.principalIds.map((x) => x.trim()).filter((x) => x.length)),
    );
    if (!principalIds.length) return { addedCount: 0 };

    const existed = await this.memberRepo.find({
      where: {
        ownerPrincipalId,
        groupId,
        memberPrincipalId: In(principalIds),
        isDelete: false,
      },
    });
    const existedSet = new Set(existed.map((m) => m.memberPrincipalId));
    const toCreate = principalIds
      .filter((id) => !existedSet.has(id))
      .map((id) =>
        this.memberRepo.create({
          ownerPrincipalId,
          groupId,
          memberPrincipalId: id,
        }),
      );

    if (!toCreate.length) return { addedCount: 0 };
    await this.memberRepo.save(toCreate);
    return { addedCount: toCreate.length };
  }

  async removeMember(
    ownerPrincipalId: string,
    groupId: string,
    memberPrincipalId: string,
  ): Promise<void> {
    await this.groupRepo.findOneOrFail({
      where: { id: groupId, ownerPrincipalId, isDelete: false },
    });

    const entity = await this.memberRepo.findOne({
      where: {
        ownerPrincipalId,
        groupId,
        memberPrincipalId,
        isDelete: false,
      },
    });
    if (!entity) return;
    entity.isDelete = true;
    await this.memberRepo.save(entity);
  }
}

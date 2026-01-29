import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipEntity } from '../entities/membership.entity';
import { RoleEntity } from '../entities/role.entity';
import { CheckAbility } from '../decorators/check-ability.decorator';

/**
 * @title Membership 控制器
 * @description 组织成员关系管理接口。
 * @keywords-cn 成员控制器, 组织成员
 * @keywords-en membership-controller, organization-members
 */
@Controller('identity/memberships')
export class MembershipController {
  constructor(
    @InjectRepository(MembershipEntity)
    private readonly repo: Repository<MembershipEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  @Get()
  @CheckAbility('read', 'membership')
  async list(
    @Query('organizationId') organizationId?: string,
    @Query('principalId') principalId?: string,
  ) {
    const where: Record<string, unknown> = { isDelete: false };
    if (organizationId) where['organizationId'] = organizationId;
    if (principalId) where['principalId'] = principalId;
    const items = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    const ids = Array.from(
      new Set(
        items
          .map((m) => m.roleId)
          .filter((id): id is string => typeof id === 'string' && !!id),
      ),
    );
    const roles = ids.length
      ? await this.roleRepo.find({ where: { id: ids as any } })
      : [];
    const map = new Map<string, string>();
    for (const r of roles) map.set(r.id, r.code);
    return items.map((m) => ({
      ...m,
      role: map.get(m.roleId || '') || 'guest',
    }));
  }

  @Post()
  @CheckAbility('create', 'membership')
  async add(
    @Body()
    dto: {
      organizationId: string;
      principalId: string;
      roleId?: string;
      role?: string;
    },
  ) {
    let roleId: string | null = dto.roleId ?? null;
    if (!roleId && dto.role) {
      const code = dto.role === 'owner' ? 'admin' : dto.role;
      const role = await this.roleRepo.findOne({
        where: { code, isDelete: false },
      });
      roleId = role ? role.id : null;
    }
    const entity = this.repo.create({
      organizationId: dto.organizationId,
      principalId: dto.principalId,
      roleId,
      active: true,
      isDelete: false,
    });
    const saved = await this.repo.save(entity);
    return saved;
  }

  @Delete(':id')
  @CheckAbility('delete', 'membership')
  async remove(@Param('id') id: string) {
    await this.repo.update({ id }, { isDelete: true, active: false });
    return { success: true } as const;
  }
}

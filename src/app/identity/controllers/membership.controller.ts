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
    return await this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  @Post()
  @CheckAbility('create', 'membership')
  async add(
    @Body() dto: { organizationId: string; principalId: string; role: string },
  ) {
    const entity = this.repo.create({
      organizationId: dto.organizationId,
      principalId: dto.principalId,
      role: dto.role as any,
      active: true,
      isDelete: false,
    });
    return await this.repo.save(entity);
  }

  @Delete(':id')
  @CheckAbility('delete', 'membership')
  async remove(@Param('id') id: string) {
    await this.repo.update({ id }, { isDelete: true, active: false });
    return { success: true } as const;
  }
}

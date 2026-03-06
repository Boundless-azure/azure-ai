import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { ImContactGroupService } from '../services/im-contact-group.service';
import type {
  AddImContactGroupMembersDto,
  CreateImContactGroupDto,
  ImContactGroupInfo,
  UpdateImContactGroupDto,
} from '../types/im.types';

/**
 * @title IM Contact Group Controller
 * @description 通讯录分组 REST API：用于创建分组、分组列表、维护分组成员。
 * @keywords-cn 通讯录分组接口, 创建分组, 分组列表, 分组成员, 移动到分组
 * @keywords-en contact-group-api, create-group, group-list, group-members, move-to-group
 */
@Controller('im/contact-groups')
export class ImContactGroupController {
  constructor(private readonly svc: ImContactGroupService) {}

  @Get()
  @CheckAbility('read', 'session')
  async list(
    @Req() req: { user?: { id?: string } },
  ): Promise<ImContactGroupInfo[]> {
    const principalId = req.user?.id ?? 'anonymous';
    return await this.svc.listGroups(principalId);
  }

  @Post()
  @CheckAbility('create', 'session')
  async create(
    @Body() dto: CreateImContactGroupDto,
    @Req() req: { user?: { id?: string } },
  ) {
    const principalId = req.user?.id ?? 'anonymous';
    const entity = await this.svc.createGroup(principalId, dto);
    return await this.svc.getGroupInfo(principalId, entity.id);
  }

  @Patch(':id')
  @CheckAbility('update', 'session')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateImContactGroupDto,
    @Req() req: { user?: { id?: string } },
  ) {
    const principalId = req.user?.id ?? 'anonymous';
    const entity = await this.svc.updateGroup(principalId, id, dto);
    return await this.svc.getGroupInfo(principalId, entity.id);
  }

  @Delete(':id')
  @CheckAbility('delete', 'session')
  async delete(
    @Param('id') id: string,
    @Req() req: { user?: { id?: string } },
  ) {
    const principalId = req.user?.id ?? 'anonymous';
    await this.svc.deleteGroup(principalId, id);
    return { success: true } as const;
  }

  @Get(':id/members')
  @CheckAbility('read', 'session')
  async listMembers(
    @Param('id') id: string,
    @Req() req: { user?: { id?: string } },
  ) {
    const principalId = req.user?.id ?? 'anonymous';
    const ids = await this.svc.listMemberIds(principalId, id);
    return { items: ids } as const;
  }

  @Post(':id/members')
  @CheckAbility('update', 'session')
  async addMembers(
    @Param('id') id: string,
    @Body() dto: AddImContactGroupMembersDto,
    @Req() req: { user?: { id?: string } },
  ) {
    const principalId = req.user?.id ?? 'anonymous';
    return await this.svc.addMembers(principalId, id, dto);
  }

  @Delete(':id/members/:principalId')
  @CheckAbility('update', 'session')
  async removeMember(
    @Param('id') id: string,
    @Param('principalId') memberPrincipalId: string,
    @Req() req: { user?: { id?: string } },
  ) {
    const principalId = req.user?.id ?? 'anonymous';
    await this.svc.removeMember(principalId, id, memberPrincipalId);
    return { success: true } as const;
  }
}

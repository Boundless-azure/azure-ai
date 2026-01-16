import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityService } from '../services/ability.service';
import {
  CHECK_ABILITY_KEY,
  type RequiredAbility,
} from '../decorators/check-ability.decorator';
import type { Request } from 'express';
import type { JwtPayload } from '@/core/auth/types/auth.types';

/**
 * @title Ability 守卫
 * @description 基于 AbilityService 的 can/cannot 校验路由权限。
 * @keywords-cn 能力守卫, 权限校验, CASL
 * @keywords-en ability-guard, permission-check, casl
 */
@Injectable()
export class AbilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ability: AbilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<RequiredAbility | undefined>(
      CHECK_ABILITY_KEY,
      context.getHandler(),
    );
    if (!required) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload & { principalId?: string } }>();
    const principalId: string | undefined =
      req.user?.id ?? req.user?.principalId;
    if (!principalId) throw new UnauthorizedException('missing principal');

    const ability = await this.ability.buildForPrincipal(principalId);
    const ok = ability.can(required.action, required.subject, { principalId });
    if (!ok) throw new ForbiddenException('permission denied');
    return true;
  }
}

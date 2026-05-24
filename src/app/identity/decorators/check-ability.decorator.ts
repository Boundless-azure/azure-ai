import { SetMetadata } from '@nestjs/common';

/**
 * @title 能力检查装饰器
 * @description 为路由处理器标注所需的权限 action/subject，供 AbilityGuard 校验。
 * @keywords-cn 能力检查, 装饰器, 权限元数据
 * @keywords-en ability-check, decorator, permission-metadata
 */
export const CHECK_ABILITY_KEY = 'check_ability_metadata';

export interface RequiredAbility {
  action: string;
  subject: string;
}

export function CheckAbility(action: string, subject: string) {
  const meta: RequiredAbility = { action, subject };
  return SetMetadata(CHECK_ABILITY_KEY, meta);
}

/**
 * @title Identity Module (Web)
 * @description 前端身份与权限模块定义与导出。
 * @keywords-cn 模块定义, 身份模块, 权限模块
 * @keywords-en module-definition, identity-module, permissions-module
 */

import { identityService } from './services/identity.service';
import { identityController } from './controller/identity.controller';
import { moduleTip } from './description/module.tip';

export const IdentityModule = {
  name: 'IdentityModule',
  service: identityService,
  controller: identityController,
  tip: moduleTip,
};

export * from './types/identity.types';
export * from './services/identity.service';
export * from './controller/identity.controller';
export * from './enums/identity.enums';

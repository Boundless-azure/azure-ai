/**
 * @title Identity Module (Web)
 * @description 前端身份与权限模块定义与导出。
 * @keywords-cn 模块定义, 身份模块, 权限模块
 * @keywords-en module-definition, identity-module, permissions-module
 */

import { moduleTip } from './description/module.tip';
import * as IdentityConstants from './constants/identity.constants';
import { agentApi } from '../../api/agent';
import { usePrincipals } from './hooks/usePrincipals';
import { useOrganizations } from './hooks/useOrganizations';
import { useRoles } from './hooks/useRoles';
import { useMemberships } from './hooks/useMemberships';
import { usePermissionDefinitions } from './hooks/usePermissionDefinitions';

export const IdentityModule = {
  name: 'IdentityModule',
  tip: moduleTip,
  constants: IdentityConstants,
  api: agentApi,
  hooks: {
    usePrincipals,
    useOrganizations,
    useRoles,
    useMemberships,
    usePermissionDefinitions,
  },
};

export * from './types/identity.types';
export * from './constants/identity.constants';
export * from './hooks/usePrincipals';
export * from './hooks/useOrganizations';
export * from './hooks/useRoles';
export * from './hooks/useMemberships';
export * from './hooks/usePermissionDefinitions';

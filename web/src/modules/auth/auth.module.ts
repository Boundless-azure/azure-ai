/**
 * @title Auth 模块入口
 * @description 导出认证 hooks、常量与服务，供外部统一引用。
 * @keywords-cn 模块入口, 认证, 导出
 * @keywords-en module-entry, auth, exports
 */
import * as AuthConstants from './constants/auth.constants';
import { useAuth } from './hooks/useAuth';
import { moduleTip } from './description/module.tip';
export * from './types/auth.types';
export * from './store/auth.store';
export * from './services/auth.service';

export const AuthModule = {
  name: 'AuthModule',
  constants: AuthConstants,
  hooks: { useAuth },
  tip: moduleTip,
};


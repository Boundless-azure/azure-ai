/**
 * @title Auth 模块说明
 * @description 前端认证模块的关键词映射与函数哈希对照。
 * @keywords-cn 模块描述, 关键词映射, 哈希对照
 * @keywords-en module-description, keyword-mapping, hash-map
 */

export const moduleTip = {
  description:
    'Auth module provides login/logout and principal session management.',
  keywords: {
    cn: {
      登录页面: 'src/modules/auth/components/Login.vue',
      认证服务: 'src/modules/auth/services/auth.service.ts',
      认证类型: 'src/modules/auth/types/auth.types.ts',
      认证存储: 'src/modules/auth/store/auth.store.ts',
      认证常量: 'src/modules/auth/constants/auth.constants.ts',
      认证hook: 'src/modules/auth/hooks/useAuth.ts',
      认证API: 'src/modules/auth/services/auth.service.ts',
      登录文案: 'src/modules/auth/i18n/login.ts',
    },
    en: {
      login_page: 'src/modules/auth/components/Login.vue',
      auth_service: 'src/modules/auth/services/auth.service.ts',
      auth_types: 'src/modules/auth/types/auth.types.ts',
      auth_store: 'src/modules/auth/store/auth.store.ts',
      auth_constants: 'src/modules/auth/constants/auth.constants.ts',
      auth_hook: 'src/modules/auth/hooks/useAuth.ts',
      auth_api: 'src/modules/auth/services/auth.service.ts',
      login_i18n: 'src/modules/auth/i18n/login.ts',
    },
  },
  hashMap: {
    useAuth_login: 'hash_auth_hook_login_001',
    useAuth_logout: 'hash_auth_hook_logout_002',
    store_login: 'hash_auth_store_login_003',
  },
};

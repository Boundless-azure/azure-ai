# Auth Module（认证模块）

## 功能描述

Auth module provides login/logout and principal session management.

## 目录结构

```
src/modules/auth/
├── components/
│   └── Login.vue                  # 登录组件
├── constants/
│   └── auth.constants.ts          # 认证常量
├── hooks/
│   └── useAuth.ts                 # 认证 Hook
├── i18n/
│   └── login.ts                   # 登录文案
├── services/
│   └── auth.service.ts            # 认证服务
├── store/
│   └── auth.store.ts              # 认证状态
├── types/
│   └── auth.types.ts              # 类型定义
└── auth.module.ts                 # 模块定义
```

## 核心文件与函数

### hooks/useAuth.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `login` | 用户登录 |
| `logout` | 用户登出 |

### services/auth.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `login` | 登录接口 |
| `changePassword` | 修改密码 |

### components/Login.vue

主要区域：
- `login-form` - 登录表单
- `password-input` - 密码输入

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `useAuth_login` | `hash_auth_hook_login_001` |
| `useAuth_logout` | `hash_auth_hook_logout_002` |
| `store_login` | `hash_auth_store_login_003` |
| `store_update_principal` | `hash_auth_store_update_principal_004` |
| `auth_change_password` | `hash_auth_change_password_001` |

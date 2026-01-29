/**
 * @title Right Panel Tab Registry
 * @description 定义右侧面板各个 Tab 的名称与组件文件映射，并提供按需加载的入口 loader。
 * @keywords-cn 右侧面板, Tab注册表, 组件映射, 动态加载
 * @keywords-en right-panel, tab-registry, component-mapping, lazy-load
 */

export interface TabRegistryEntry {
  name: string;
  file: string;
  loader: () => Promise<unknown>;
}

export const tabRegistry: Record<string, TabRegistryEntry> = {
  agents: {
    name: 'Agent 管理',
    file: 'src/modules/agent/components/AgentList.vue',
    loader: () => import('../components/AgentList.vue'),
  },
  todos: {
    name: '待办',
    file: 'src/modules/todo/components/TodoList.vue',
    loader: () => import('../../todo/components/TodoList.vue'),
  },
  users: {
    name: '用户管理',
    file: 'src/modules/identity/components/UserManagement.vue',
    loader: () => import('../../identity/components/UserManagement.vue'),
  },
  orgs: {
    name: '组织管理',
    file: 'src/modules/identity/components/OrganizationManagement.vue',
    loader: () =>
      import('../../identity/components/OrganizationManagement.vue'),
  },
  roles: {
    name: '角色管理',
    file: 'src/modules/identity/components/RoleManagement.vue',
    loader: () => import('../../identity/components/RoleManagement.vue'),
  },
  perms: {
    name: '权限管理',
    file: 'src/modules/identity/components/PermissionManagement.vue',
    loader: () => import('../../identity/components/PermissionManagement.vue'),
  },
  'chat-detail': {
    name: '聊天信息',
    file: 'src/modules/agent/components/ChatDetail.vue',
    loader: () => import('../components/ChatDetail.vue'),
  },
};

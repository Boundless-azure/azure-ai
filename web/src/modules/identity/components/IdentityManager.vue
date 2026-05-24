<template>
  <div
    :class="
      embedded
        ? 'w-full h-full flex overflow-hidden'
        : 'fixed inset-0 z-50 flex items-center justify-center'
    "
  >
    <!-- Modal Backdrop -->
    <div
      v-if="!embedded"
      class="absolute inset-0 bg-black/30 backdrop-blur-sm"
      @click="$emit('close')"
    ></div>

    <!-- Main Container -->
    <div
      class="relative bg-white flex flex-col md:flex-row overflow-hidden border-gray-200 transition-all"
      :class="
        embedded
          ? 'w-full h-full rounded-none border-0'
          : 'rounded-2xl shadow-xl w-full md:w-[1200px] max-w-[95vw] h-[90vh] md:h-[800px] max-h-[90vh] border'
      "
    >
      <!-- Mobile Header -->
      <div class="md:hidden flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <div class="font-bold text-gray-900 flex items-center gap-2">
          <i class="fa-solid fa-id-card-clip text-indigo-600"></i>
          <span>身份管理</span>
        </div>
        <div class="flex items-center gap-3">
          <button 
            class="text-gray-600 hover:text-gray-900"
            @click="showMobileMenu = !showMobileMenu"
          >
            <i class="fa-solid fa-bars text-lg"></i>
          </button>
          <button 
            v-if="!embedded"
            class="text-gray-400 hover:text-gray-700"
            @click="$emit('close')"
          >
            <i class="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
      </div>

      <!-- Sidebar -->
      <div 
        class="bg-gray-50 border-r border-gray-100 flex flex-col transition-all duration-300 absolute md:relative z-20 h-full md:h-auto w-64 shadow-xl md:shadow-none"
        :class="[
          showMobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        ]"
      >
        <div class="hidden md:block p-6 border-b border-gray-100">
          <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
            <i class="fa-solid fa-id-card-clip text-indigo-600"></i>
            <span>身份管理</span>
          </h2>
          <p class="text-xs text-gray-500 mt-1">Identity & Access Management</p>
        </div>

        <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
          <button
            v-for="item in navItems"
            :key="item.id"
            class="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-3"
            :class="
              activeTab === item.id
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-100'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            "
            @click="selectTab(item.id)"
          >
            <i :class="item.icon" class="w-5 text-center"></i>
            {{ item.label }}
          </button>
        </nav>

        <div v-if="!embedded" class="p-4 border-t border-gray-100">
          <button
            class="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm transition-all text-sm flex items-center justify-center gap-2"
            @click="$emit('close')"
          >
            <i class="fa-solid fa-arrow-right-from-bracket"></i>
            退出管理
          </button>
        </div>
      </div>

      <!-- Mobile Sidebar Backdrop -->
      <div 
        v-if="showMobileMenu"
        class="md:hidden absolute inset-0 bg-black/20 z-10 backdrop-blur-sm"
        @click="showMobileMenu = false"
      ></div>

      <!-- Content Area -->
      <div class="flex-1 flex flex-col min-w-0 bg-white h-full overflow-hidden">
        <!-- Header -->
        <div class="hidden md:block px-8 py-5 border-b border-gray-50">
          <h3 class="text-xl font-bold text-gray-900">
            {{ currentNav?.label }}
          </h3>
          <p class="text-sm text-gray-500 mt-1">{{ currentNav?.desc }}</p>
        </div>

        <!-- Main Content -->
        <div class="flex-1 overflow-y-auto p-3 md:p-8 bg-gray-50/50">
          <component :is="currentComponent" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Identity Manager Component (Web)
 * @description 前端身份与权限管理主入口，集成用户、组织、角色及权限管理模块。
 * @keywords-cn 身份管理, 统一身份认证, 权限中心
 * @keywords-en identity-management, iam, permission-center
 */

import { ref, computed, watch, onMounted } from 'vue';
import UserManagement from './UserManagement.vue';
import OrganizationManagement from './OrganizationManagement.vue';
import RoleManagement from './RoleManagement.vue';
import PermissionManagement from './PermissionManagement.vue';

const props = defineProps<{
  embedded?: boolean;
  initialTab?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const activeTab = ref('users');
const showMobileMenu = ref(false);

const navItems = [
  {
    id: 'users',
    label: '用户管理',
    desc: '管理系统用户、账号及基本信息',
    icon: 'fa-solid fa-users',
    component: UserManagement,
  },
  {
    id: 'orgs',
    label: '组织管理',
    desc: '管理组织架构、部门及成员关系',
    icon: 'fa-regular fa-building',
    component: OrganizationManagement,
  },
  {
    id: 'roles',
    label: '角色管理',
    desc: '定义角色及分配权限策略',
    icon: 'fa-solid fa-user-tag',
    component: RoleManagement,
  },
  {
    id: 'perms',
    label: '权限管理',
    desc: '浏览及配置系统权限规则',
    icon: 'fa-solid fa-shield-halved',
    component: PermissionManagement,
  },
];

const currentNav = computed(() =>
  navItems.find((i) => i.id === activeTab.value),
);
const currentComponent = computed(() => currentNav.value?.component);

function selectTab(id: string) {
  activeTab.value = id;
  showMobileMenu.value = false;
}

onMounted(() => {
  if (props.initialTab && navItems.some((i) => i.id === props.initialTab)) {
    activeTab.value = props.initialTab;
  }
});

watch(
  () => props.initialTab,
  (newTab) => {
    if (newTab && navItems.some((i) => i.id === newTab)) {
      activeTab.value = newTab;
    }
  },
);
</script>

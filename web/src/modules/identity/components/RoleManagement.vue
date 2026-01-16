<template>
  <div class="space-y-4">
    <!-- Filter Bar -->
    <div
      class="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
    >
      <div class="flex-1 min-w-[200px]">
        <div class="relative">
          <i
            class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          ></i>
          <input
            v-model="query.q"
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="搜索角色名称或代码"
            @keyup.enter="handleSearch"
          />
        </div>
      </div>

      <button
        class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
        @click="handleSearch"
      >
        <i class="fa-solid fa-filter"></i>
        <span>筛选</span>
      </button>

      <div class="h-6 w-px bg-gray-200 mx-1"></div>

      <button
        class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2"
        @click="openCreateModal"
      >
        <i class="fa-solid fa-plus"></i>
        <span>新增角色</span>
      </button>
    </div>

    <!-- Role List (Table) -->
    <div
      class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="px-6 py-3 font-semibold text-gray-700">角色名称</th>
              <th class="px-6 py-3 font-semibold text-gray-700">代码</th>
              <th class="px-6 py-3 font-semibold text-gray-700">类型</th>
              <th class="px-6 py-3 font-semibold text-gray-700">描述</th>
              <th class="px-6 py-3 font-semibold text-gray-700 text-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="role in filteredRoles"
              :key="role.id"
              class="hover:bg-gray-50/50 transition-colors"
            >
              <td class="px-6 py-3">
                <div class="font-medium text-gray-900">{{ role.name }}</div>
              </td>
              <td class="px-6 py-3">
                <div
                  class="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block"
                >
                  {{ role.code }}
                </div>
              </td>
              <td class="px-6 py-3">
                <span
                  v-if="role.builtin"
                  class="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded font-medium"
                  >系统内置</span
                >
                <span
                  v-else
                  class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-medium"
                  >自定义</span
                >
              </td>
              <td class="px-6 py-3 text-gray-500 max-w-md truncate">
                {{ role.description || '-' }}
              </td>
              <td class="px-6 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                    title="权限配置"
                    @click="openPermissions(role)"
                  >
                    <i class="fa-solid fa-shield-halved"></i>
                  </button>
                  <button
                    class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="编辑"
                    @click="openEditModal(role)"
                  >
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button
                    v-if="!role.builtin"
                    class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                    @click="handleDelete(role)"
                  >
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredRoles.length === 0">
              <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                暂无数据
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Simple Pagination (Client-side) -->
      <div
        class="px-6 py-4 border-t border-gray-100 flex items-center justify-between"
        v-if="roles.length > 0"
      >
        <span class="text-sm text-gray-500">共 {{ roles.length }} 条记录</span>
      </div>
    </div>

    <!-- Edit/Create Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/30 backdrop-blur-sm"
        @click="closeModal"
      ></div>
      <div
        class="relative bg-white rounded-2xl shadow-xl w-[500px] max-w-[95vw] border border-gray-200 p-6 space-y-4"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900">
            {{ isEdit ? '编辑角色' : '新增角色' }}
          </h3>
          <button class="text-gray-400 hover:text-gray-700" @click="closeModal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >角色名称</label
            >
            <input
              v-model="form.name"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="请输入角色名称"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >角色代码</label
            >
            <input
              v-model="form.code"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="ROLE_CODE"
              :disabled="isEdit"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >描述</label
            >
            <textarea
              v-model="form.description"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              rows="3"
              placeholder="角色描述..."
            ></textarea>
          </div>
        </div>

        <div class="pt-2 flex justify-end gap-2">
          <button
            class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            @click="closeModal"
          >
            取消
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            @click="handleSubmit"
          >
            保存
          </button>
        </div>
      </div>
    </div>

    <!-- Permissions Modal -->
    <div
      v-if="showPermModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/30 backdrop-blur-sm"
        @click="closePermModal"
      ></div>
      <div
        class="relative bg-white rounded-2xl shadow-xl w-[900px] max-w-[95vw] border border-gray-200 flex flex-col max-h-[85vh]"
      >
        <div
          class="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0"
        >
          <div>
            <h3 class="text-lg font-bold text-gray-900">权限配置</h3>
            <p class="text-sm text-gray-500">
              角色：{{ currentRole?.name }} ({{ currentRole?.code }})
            </p>
          </div>
          <button
            class="text-gray-400 hover:text-gray-700"
            @click="closePermModal"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="flex-1 overflow-hidden">
          <RolePermissionAssign v-if="currentRole" :roleId="currentRole.id" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Role Management Component
 * @description 角色管理页面，提供角色的增删改查入口。
 * @keywords-cn 角色管理, 权限组管理
 * @keywords-en role-management, permission-group-management
 */

import { ref, onMounted, reactive, computed } from 'vue';
import { identityService } from '../services/identity.service';
import type { RoleItem } from '../types/identity.types';
import PermissionManagement from './PermissionManagement.vue';

const roles = ref<RoleItem[]>([]);
const showModal = ref(false);
const isEdit = ref(false);

const query = reactive({
  q: '',
});

const filteredRoles = computed(() => {
  if (!query.q) return roles.value;
  const q = query.q.toLowerCase();
  return roles.value.filter(
    (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q),
  );
});

const form = reactive({
  id: '',
  name: '',
  code: '',
  description: '',
});

const showPermModal = ref(false);
const currentRole = ref<RoleItem | null>(null);

function handleSearch() {
  // Client side filtering is automatic
}

onMounted(() => {
  fetchData();
});

async function fetchData() {
  try {
    roles.value = await identityService.listRoles();
  } catch (e) {
    console.error(e);
  }
}

function openCreateModal() {
  isEdit.value = false;
  form.name = '';
  form.code = '';
  form.description = '';
  showModal.value = true;
}

function openEditModal(role: RoleItem) {
  isEdit.value = true;
  form.id = role.id;
  form.name = role.name;
  form.code = role.code;
  form.description = role.description || '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

async function handleSubmit() {
  try {
    if (isEdit.value) {
      await identityService.updateRole(form.id, {
        name: form.name,
        description: form.description || null,
      });
    } else {
      await identityService.createRole({
        name: form.name,
        code: form.code,
        description: form.description || null,
      });
    }
    closeModal();
    fetchData();
  } catch (e) {
    console.error(e);
  }
}

async function handleDelete(role: RoleItem) {
  if (role.builtin) return;
  if (!confirm(`确认删除角色 "${role.name}" 吗？`)) return;
  try {
    await identityService.deleteRole(role.id);
    fetchData();
  } catch (e) {
    console.error(e);
  }
}

function openPermissions(role: RoleItem) {
  currentRole.value = role;
  showPermModal.value = true;
}

function closePermModal() {
  showPermModal.value = false;
  currentRole.value = null;
}
</script>

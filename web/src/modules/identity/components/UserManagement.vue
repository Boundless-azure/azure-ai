<template>
  <div class="space-y-4">
    <!-- Filter Bar -->
    <div class="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <div class="flex-1 min-w-[200px]">
        <div class="relative">
          <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input 
            v-model="query.q" 
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10" 
            placeholder="搜索用户名、邮箱或手机号" 
            @keyup.enter="handleSearch"
          />
        </div>
      </div>
      
      <div class="min-w-[150px]">
        <select v-model="query.type" class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10">
          <option value="">所有类型</option>
          <option value="user_enterprise">企业用户</option>
          <option value="user_consumer">消费者</option>
          <option value="official_account">官方账号</option>
          <option value="agent">Agent</option>
          <option value="system">系统</option>
        </select>
      </div>

      <button class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center gap-2" @click="handleSearch">
        <i class="fa-solid fa-filter"></i>
        <span>筛选</span>
      </button>
      
      <div class="h-6 w-px bg-gray-200 mx-1"></div>

      <button class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2" @click="openCreateModal">
        <i class="fa-solid fa-plus"></i>
        <span>新增用户</span>
      </button>
    </div>

    <!-- User List -->
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="px-6 py-3 font-semibold text-gray-700">用户</th>
              <th class="px-6 py-3 font-semibold text-gray-700">类型</th>
              <th class="px-6 py-3 font-semibold text-gray-700">联系方式</th>
              <th class="px-6 py-3 font-semibold text-gray-700">状态</th>
              <th class="px-6 py-3 font-semibold text-gray-700">创建时间</th>
              <th class="px-6 py-3 font-semibold text-gray-700 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="px-6 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 overflow-hidden">
                    <img v-if="user.avatarUrl" :src="user.avatarUrl" class="w-full h-full object-cover" />
                    <i v-else class="fa-solid fa-user"></i>
                  </div>
                  <div class="font-medium text-gray-900">{{ user.displayName }}</div>
                </div>
              </td>
              <td class="px-6 py-3">
                <span class="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                  {{ formatType(user.principalType) }}
                </span>
              </td>
              <td class="px-6 py-3 text-gray-500">
                <div v-if="user.email" class="flex items-center gap-1">
                  <i class="fa-regular fa-envelope text-xs"></i> {{ user.email }}
                </div>
                <div v-if="user.phone" class="flex items-center gap-1 mt-0.5">
                  <i class="fa-solid fa-mobile-screen text-xs"></i> {{ user.phone }}
                </div>
              </td>
              <td class="px-6 py-3">
                <span 
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                >
                  {{ user.active ? '启用' : '禁用' }}
                </span>
              </td>
              <td class="px-6 py-3 text-gray-500">
                {{ formatDate(user.createdAt) }}
              </td>
              <td class="px-6 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="编辑" @click="openEditModal(user)">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="删除" @click="handleDelete(user)">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="users.length === 0">
              <td colspan="6" class="px-6 py-12 text-center text-gray-400">
                <div class="flex flex-col items-center gap-2">
                  <i class="fa-regular fa-folder-open text-2xl"></i>
                  <span>暂无数据</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
        <div class="text-sm text-gray-500">
          共 {{ total }} 条记录
        </div>
        <div class="flex items-center gap-2">
          <button 
            class="px-3 py-1 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="page <= 1"
            @click="page--"
          >
            上一页
          </button>
          <span class="text-sm text-gray-700 font-medium px-2">{{ page }}</span>
          <button 
            class="px-3 py-1 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="page * limit >= total"
            @click="page++"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <!-- Edit/Create Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeModal"></div>
      <div class="relative bg-white rounded-2xl shadow-xl w-[500px] max-w-[95vw] border border-gray-200 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900">{{ isEdit ? '编辑用户' : '新增用户' }}</h3>
          <button class="text-gray-400 hover:text-gray-700" @click="closeModal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
            <input v-model="form.displayName" class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10" placeholder="请输入名称" />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">用户类型</label>
            <select v-model="form.principalType" class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10" :disabled="isEdit">
              <option value="user_enterprise">企业用户</option>
              <option value="user_consumer">消费者</option>
              <option value="official_account">官方账号</option>
              <option value="agent">Agent</option>
              <option value="system">系统</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input v-model="form.email" class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10" placeholder="example@domain.com" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">手机号</label>
            <input v-model="form.phone" class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10" placeholder="13800000000" />
          </div>
        </div>

        <div class="pt-2 flex justify-end gap-2">
          <button class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors" @click="closeModal">取消</button>
          <button class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors" @click="handleSubmit">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title User Management Component
 * @description 用户管理页面，提供用户的增删改查及筛选功能。
 * @keywords-cn 用户管理, 账号管理, 主体管理
 * @keywords-en user-management, account-management, principal-management
 */

import { ref, onMounted, reactive } from 'vue';
import { identityService } from '../services/identity.service';
import type { IdentityPrincipalItem, PrincipalType } from '../types/identity.types';

const users = ref<IdentityPrincipalItem[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(10);
const query = reactive({
  q: '',
  type: '' as PrincipalType | '',
});

const showModal = ref(false);
const isEdit = ref(false);
const form = reactive({
  id: '',
  displayName: '',
  principalType: 'user_enterprise' as PrincipalType,
  email: '',
  phone: '',
});

onMounted(() => {
  fetchData();
});

async function fetchData() {
  try {
    // 模拟分页
    const all = await identityService.listPrincipals({
      q: query.q,
      type: query.type || undefined,
    });
    total.value = all.length;
    const start = (page.value - 1) * limit.value;
    users.value = all.slice(start, start + limit.value);
  } catch (e) {
    console.error(e);
  }
}

function handleSearch() {
  page.value = 1;
  fetchData();
}

function formatType(type: string) {
  const map: Record<string, string> = {
    user_enterprise: '企业用户',
    user_consumer: '消费者',
    official_account: '官方账号',
    agent: 'Agent',
    system: '系统',
  };
  return map[type] || type;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function openCreateModal() {
  isEdit.value = false;
  form.displayName = '';
  form.principalType = 'user_enterprise';
  form.email = '';
  form.phone = '';
  showModal.value = true;
}

function openEditModal(user: IdentityPrincipalItem) {
  isEdit.value = true;
  form.id = user.id;
  form.displayName = user.displayName;
  form.principalType = user.principalType;
  form.email = user.email || '';
  form.phone = user.phone || '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

async function handleSubmit() {
  try {
    if (isEdit.value) {
      await identityService.updatePrincipal(form.id, {
        displayName: form.displayName,
        email: form.email || null,
        phone: form.phone || null,
      });
    } else {
      await identityService.createPrincipal({
        displayName: form.displayName,
        principalType: form.principalType,
        email: form.email || null,
        phone: form.phone || null,
      });
    }
    closeModal();
    fetchData();
  } catch (e) {
    console.error(e);
  }
}

async function handleDelete(user: IdentityPrincipalItem) {
  if (!confirm(`确认删除用户 "${user.displayName}" 吗？`)) return;
  try {
    await identityService.deletePrincipal(user.id);
    fetchData();
  } catch (e) {
    console.error(e);
  }
}
</script>

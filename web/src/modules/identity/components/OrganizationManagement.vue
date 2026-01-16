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
            placeholder="搜索组织名称或代码" 
            @keyup.enter="handleSearch"
          />
        </div>
      </div>
      
      <button class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center gap-2" @click="handleSearch">
        <i class="fa-solid fa-filter"></i>
        <span>筛选</span>
      </button>
      
      <div class="h-6 w-px bg-gray-200 mx-1"></div>

      <button class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2" @click="openCreateModal">
        <i class="fa-solid fa-plus"></i>
        <span>新增组织</span>
      </button>
    </div>

    <!-- Organization List -->
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="px-6 py-3 font-semibold text-gray-700">组织名称</th>
              <th class="px-6 py-3 font-semibold text-gray-700">代码</th>
              <th class="px-6 py-3 font-semibold text-gray-700">状态</th>
              <th class="px-6 py-3 font-semibold text-gray-700">创建时间</th>
              <th class="px-6 py-3 font-semibold text-gray-700 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="org in organizations" :key="org.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="px-6 py-3">
                <div class="font-medium text-gray-900">{{ org.name }}</div>
              </td>
              <td class="px-6 py-3 text-gray-500">
                <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{{ org.code || '-' }}</span>
              </td>
              <td class="px-6 py-3">
                <span 
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="org.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                >
                  {{ org.active ? '启用' : '禁用' }}
                </span>
              </td>
              <td class="px-6 py-3 text-gray-500">
                {{ formatDate(org.createdAt) }}
              </td>
              <td class="px-6 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="成员管理" @click="openMembersModal(org)">
                    <i class="fa-solid fa-users"></i>
                  </button>
                  <button class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="编辑" @click="openEditModal(org)">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="删除" @click="handleDelete(org)">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="organizations.length === 0">
              <td colspan="5" class="px-6 py-12 text-center text-gray-400">
                <div class="flex flex-col items-center gap-2">
                  <i class="fa-regular fa-building text-2xl"></i>
                  <span>暂无组织数据</span>
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
          <h3 class="text-lg font-bold text-gray-900">{{ isEdit ? '编辑组织' : '新增组织' }}</h3>
          <button class="text-gray-400 hover:text-gray-700" @click="closeModal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">组织名称</label>
            <input v-model="form.name" class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10" placeholder="请输入组织名称" />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">组织代码</label>
            <input v-model="form.code" class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10" placeholder="ORG_CODE" />
          </div>
        </div>

        <div class="pt-2 flex justify-end gap-2">
          <button class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors" @click="closeModal">取消</button>
          <button class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors" @click="handleSubmit">保存</button>
        </div>
      </div>
    </div>

    <!-- Members Modal -->
    <div v-if="showMembersModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeMembersModal"></div>
      <div class="relative bg-white rounded-2xl shadow-xl w-[800px] max-w-[95vw] border border-gray-200 p-6 flex flex-col h-[600px]">
        <div class="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h3 class="text-lg font-bold text-gray-900">成员管理</h3>
            <p class="text-sm text-gray-500">组织：{{ currentOrg?.name }}</p>
          </div>
          <button class="text-gray-400 hover:text-gray-700" @click="closeMembersModal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="flex gap-2 mb-4 flex-shrink-0">
          <input v-model="newMemberId" class="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="输入用户 ID 添加" />
          <select v-model="newMemberRole" class="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            <option value="member">成员</option>
            <option value="admin">管理员</option>
            <option value="owner">所有者</option>
          </select>
          <button class="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm" @click="addMember">添加</button>
        </div>

        <div class="flex-1 overflow-y-auto min-h-0 border border-gray-100 rounded-xl">
          <table class="w-full text-left text-sm">
            <thead class="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th class="px-4 py-2 font-semibold text-gray-700">用户 ID</th>
                <th class="px-4 py-2 font-semibold text-gray-700">角色</th>
                <th class="px-4 py-2 font-semibold text-gray-700 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="m in members" :key="m.id">
                <td class="px-4 py-2">{{ m.principalId }}</td>
                <td class="px-4 py-2">
                  <span class="px-2 py-0.5 rounded text-xs bg-gray-100">{{ m.role }}</span>
                </td>
                <td class="px-4 py-2 text-right">
                  <button class="text-red-600 hover:text-red-800 text-xs" @click="removeMember(m.id)">移除</button>
                </td>
              </tr>
              <tr v-if="members.length === 0">
                <td colspan="3" class="px-4 py-8 text-center text-gray-400">暂无成员</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Organization Management Component
 * @description 组织管理页面，包含组织增删改查及成员管理。
 * @keywords-cn 组织管理, 部门管理, 团队管理
 * @keywords-en organization-management, department-management, team-management
 */

import { ref, onMounted, reactive } from 'vue';
import { identityService } from '../services/identity.service';
import type { OrganizationItem, MembershipItem } from '../types/identity.types';

const organizations = ref<OrganizationItem[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(10);
const query = reactive({
  q: '',
});

const showModal = ref(false);
const isEdit = ref(false);
const form = reactive({
  id: '',
  name: '',
  code: '',
});

const showMembersModal = ref(false);
const currentOrg = ref<OrganizationItem | null>(null);
const members = ref<MembershipItem[]>([]);
const newMemberId = ref('');
const newMemberRole = ref('member');

onMounted(() => {
  fetchData();
});

async function fetchData() {
  try {
    const all = await identityService.listOrganizations({
      q: query.q,
    });
    total.value = all.length;
    const start = (page.value - 1) * limit.value;
    organizations.value = all.slice(start, start + limit.value);
  } catch (e) {
    console.error(e);
  }
}

function handleSearch() {
  page.value = 1;
  fetchData();
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function openCreateModal() {
  isEdit.value = false;
  form.name = '';
  form.code = '';
  showModal.value = true;
}

function openEditModal(org: OrganizationItem) {
  isEdit.value = true;
  form.id = org.id;
  form.name = org.name;
  form.code = org.code || '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

async function handleSubmit() {
  try {
    if (isEdit.value) {
      await identityService.updateOrganization(form.id, {
        name: form.name,
        code: form.code || null,
      });
    } else {
      await identityService.createOrganization({
        name: form.name,
        code: form.code || null,
      });
    }
    closeModal();
    fetchData();
  } catch (e) {
    console.error(e);
  }
}

async function handleDelete(org: OrganizationItem) {
  if (!confirm(`确认删除组织 "${org.name}" 吗？`)) return;
  try {
    await identityService.deleteOrganization(org.id);
    fetchData();
  } catch (e) {
    console.error(e);
  }
}

async function openMembersModal(org: OrganizationItem) {
  currentOrg.value = org;
  showMembersModal.value = true;
  fetchMembers(org.id);
}

async function fetchMembers(orgId: string) {
  try {
    members.value = await identityService.listMemberships({ organizationId: orgId });
  } catch (e) {
    console.error(e);
  }
}

function closeMembersModal() {
  showMembersModal.value = false;
  currentOrg.value = null;
  members.value = [];
}

async function addMember() {
  if (!currentOrg.value || !newMemberId.value) return;
  try {
    await identityService.addMembership({
      organizationId: currentOrg.value.id,
      principalId: newMemberId.value,
      role: newMemberRole.value,
    });
    newMemberId.value = '';
    fetchMembers(currentOrg.value.id);
  } catch (e) {
    console.error(e);
  }
}

async function removeMember(id: string) {
  if (!confirm('确认移除该成员吗？')) return;
  try {
    await identityService.removeMembership(id);
    if (currentOrg.value) {
      fetchMembers(currentOrg.value.id);
    }
  } catch (e) {
    console.error(e);
  }
}
</script>

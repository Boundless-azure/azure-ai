<template>
  <div class="space-y-4">
    <IdentitySectionHeader
      title="用户管理"
      description="管理系统用户、账号及基本信息"
    />
    <!-- Filter Bar -->
    <div
      class="flex flex-col md:flex-row md:items-center gap-3 bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm"
    >
      <div class="flex-1 w-full md:w-auto md:min-w-[200px]">
        <div class="relative">
          <i
            class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          ></i>
          <input
            v-model="query.q"
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="搜索用户名、邮箱或手机号"
            @keyup.enter="handleSearch"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 md:flex md:gap-2 gap-3">
        <div class="col-span-2 md:col-span-1 md:min-w-[120px]">
          <select
            v-model="query.type"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="">所有类型</option>
            <option value="user">企业用户</option>
            <option value="user_consumer">消费者</option>
            <option value="system">系统</option>
          </select>
        </div>

        <button
          class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          @click="handleSearch"
        >
          <i class="fa-solid fa-filter"></i>
          <span>筛选</span>
        </button>

        <div class="hidden md:block h-6 w-px bg-gray-200 mx-1 self-center"></div>

        <button
          class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          @click="openCreateModal"
        >
          <i class="fa-solid fa-plus"></i>
          <span>新增</span>
        </button>
      </div>
    </div>

    <!-- User List (Desktop Table) -->
    <div
      class="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="px-6 py-3 font-semibold text-gray-700">用户</th>
              <th class="px-6 py-3 font-semibold text-gray-700">类型</th>
              <th class="px-6 py-3 font-semibold text-gray-700">联系方式</th>
              <th class="px-6 py-3 font-semibold text-gray-700">状态</th>
              <th class="px-6 py-3 font-semibold text-gray-700">创建时间</th>
              <th class="px-6 py-3 font-semibold text-gray-700 text-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="user in users"
              :key="user.id"
              class="hover:bg-gray-50/50 transition-colors"
            >
              <td class="px-6 py-3">
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 overflow-hidden"
                  >
                    <img
                      v-if="user.avatarUrl"
                      :src="resolveImageUrl(user.avatarUrl)"
                      class="w-full h-full object-cover"
                    />
                    <i v-else class="fa-solid fa-user"></i>
                  </div>
                  <div class="font-medium text-gray-900">
                    {{ user.displayName }}
                  </div>
                </div>
              </td>
              <td class="px-6 py-3">
                <span
                  class="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600"
                >
                  {{ formatType(user.principalType) }}
                </span>
              </td>
              <td class="px-6 py-3 text-gray-500">
                <div v-if="user.email" class="flex items-center gap-1">
                  <i class="fa-regular fa-envelope text-xs"></i>
                  {{ user.email }}
                </div>
                <div v-if="user.phone" class="flex items-center gap-1 mt-0.5">
                  <i class="fa-solid fa-mobile-screen text-xs"></i>
                  {{ user.phone }}
                </div>
              </td>
              <td class="px-6 py-3">
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="
                    user.active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  "
                >
                  {{ user.active ? '启用' : '禁用' }}
                </span>
              </td>
              <td class="px-6 py-3 text-gray-500">
                {{ formatDate(user.createdAt) }}
              </td>
              <td class="px-6 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="角色分配"
                    @click="openRoleModal(user)"
                  >
                    <i class="fa-solid fa-user-shield"></i>
                  </button>
                  <button
                    class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="编辑"
                    @click="openEditModal(user)"
                  >
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button
                    class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                    @click="handleDelete(user)"
                  >
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
      <div
        class="px-6 py-4 border-t border-gray-100 flex items-center justify-between"
      >
        <div class="text-sm text-gray-500">共 {{ total }} 条记录</div>
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

    <!-- User List (Mobile Cards) -->
    <div class="md:hidden space-y-3">
      <div
        v-for="user in users"
        :key="user.id"
        class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
      >
        <div class="flex justify-between items-start mb-3">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 overflow-hidden"
            >
              <img
                v-if="user.avatarUrl"
                :src="resolveImageUrl(user.avatarUrl)"
                class="w-full h-full object-cover"
              />
              <i v-else class="fa-solid fa-user"></i>
            </div>
            <div>
              <div class="font-medium text-gray-900">
                {{ user.displayName }}
              </div>
              <div class="text-xs text-gray-500 mt-0.5">
                {{ formatType(user.principalType) }}
              </div>
            </div>
          </div>
          <span
            class="px-2 py-1 rounded-full text-xs font-medium"
            :class="
              user.active
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            "
          >
            {{ user.active ? '启用' : '禁用' }}
          </span>
        </div>

        <div class="space-y-2 text-sm text-gray-600 mb-3">
          <div v-if="user.email" class="flex items-center gap-2">
            <i class="fa-regular fa-envelope text-gray-400 w-4"></i>
            {{ user.email }}
          </div>
          <div v-if="user.phone" class="flex items-center gap-2">
            <i class="fa-solid fa-mobile-screen text-gray-400 w-4"></i>
            {{ user.phone }}
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <i class="fa-regular fa-clock w-4"></i>
            {{ formatDate(user.createdAt) }}
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            class="px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg"
            @click="openRoleModal(user)"
          >
            分配角色
          </button>
          <button
            class="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg"
            @click="openEditModal(user)"
          >
            编辑
          </button>
          <button
            class="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg"
            @click="handleDelete(user)"
          >
            删除
          </button>
        </div>
      </div>

      <div
        v-if="users.length === 0"
        class="bg-white p-8 rounded-xl border border-gray-100 text-center text-gray-400"
      >
        <div class="flex flex-col items-center gap-2">
          <i class="fa-regular fa-folder-open text-2xl"></i>
          <span>暂无数据</span>
        </div>
      </div>

      <!-- Mobile Pagination -->
      <div v-if="total > 0" class="flex justify-between items-center pt-2 px-2">
        <span class="text-xs text-gray-500">共 {{ total }} 条</span>
        <div class="flex gap-2">
          <button
            class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white disabled:opacity-50"
            :disabled="page <= 1"
            @click="page--"
          >
            上一页
          </button>
          <span class="text-xs flex items-center bg-white px-2 rounded-lg border border-gray-200">{{ page }}</span>
          <button
            class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white disabled:opacity-50"
            :disabled="page * limit >= total"
            @click="page++"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <!-- Edit/Create Modal :: 用 BaseModal 统一外壳 -->
    <BaseModal
      :open="showModal"
      :title="isEdit ? '编辑用户' : '新增用户'"
      size="md"
      @close="closeModal"
    >
      <div class="space-y-3">
          <div v-if="isEdit">
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >头像</label
            >
            <div class="flex items-center gap-3">
              <div
                class="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 overflow-hidden border border-gray-200"
              >
                <img
                  v-if="form.avatarUrl"
                  :src="resolveImageUrl(form.avatarUrl)"
                  class="w-full h-full object-cover"
                />
                <i v-else class="fa-solid fa-user"></i>
              </div>
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                @click="showAvatarModal = true"
              >
                更换头像
              </button>
              <div v-if="uploading" class="text-xs text-gray-500">
                上传中 {{ progress.percent }}%
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >显示名称</label
            >
            <input
              v-model="form.displayName"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="请输入名称"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >用户类型</label
            >
            <select
              v-model="form.principalType"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              :disabled="isEdit"
            >
              <option value="user">企业用户</option>
              <option value="user_consumer">消费者</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >邮箱</label
            >
            <input
              v-model="form.email"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="example@domain.com"
            />
          </div>

          <!-- Password Field :: 新增时设置初始密码，编辑时可留空不修改 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >{{ isEdit ? '新密码' : '密码' }}</label
            >
            <div class="flex items-center gap-2">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                :placeholder="isEdit ? '留空则不修改密码' : '请输入密码'"
              />
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                @click="togglePassword"
              >
                {{ showPassword ? '隐藏' : '显示' }}
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                @click="generatePassword"
              >
                随机生成
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >手机号</label
            >
            <input
              v-model="form.phone"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="13800000000"
            />
          </div>
      </div>

      <template #footer>
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
      </template>
    </BaseModal>

    <SquareAvatarCropModal
      v-model:open="showAvatarModal"
      title="裁剪头像"
      :initial-url="resolveImageUrl(form.avatarUrl)"
      @confirm="onAvatarConfirm"
    />
  </div>

  <!-- 角色分配 Modal :: 用 BaseModal 统一外壳 -->
  <BaseModal
    :open="showRoleModal"
    title="角色分配"
    :subtitle="`用户：${currentUser?.displayName ?? ''}`"
    size="lg"
    @close="closeRoleModal"
  >
    <div class="flex gap-2 mb-4 flex-shrink-0">
        <select
          v-model="newMembershipOrgId"
          class="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
        >
          <option value="" disabled>请选择组织</option>
          <option v-for="org in organizations" :key="org.id" :value="org.id">
            {{ org.name }}
          </option>
        </select>
        <select
          v-model="newMembershipRole"
          class="px-3 py-2 rounded-lg border border-gray-200 text-sm"
        >
          <option value="member">成员</option>
          <option value="admin">管理员</option>
          <option value="owner">所有者</option>
        </select>
        <button
          class="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm"
          @click="addUserMembership"
        >
          添加
        </button>
      </div>

      <div
        class="flex-1 overflow-y-auto min-h-0 border border-gray-100 rounded-xl"
      >
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th class="px-4 py-2 font-semibold text-gray-700">组织</th>
              <th class="px-4 py-2 font-semibold text-gray-700">角色</th>
              <th class="px-4 py-2 font-semibold text-gray-700 text-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="m in memberships" :key="m.id">
              <td class="px-4 py-2">
                {{ getOrganizationName(m.organizationId) }}
              </td>
              <td class="px-4 py-2">
                <span class="px-2 py-0.5 rounded text-xs bg-gray-100">
                  {{ formatMembershipRole(m.role) }}
                </span>
              </td>
              <td class="px-4 py-2 text-right">
                <button
                  class="text-red-600 hover:text-red-800 text-xs"
                  @click="removeUserMembership(m.id)"
                >
                  移除
                </button>
              </td>
            </tr>
            <tr v-if="memberships.length === 0">
              <td colspan="3" class="px-4 py-8 text-center text-gray-400">
                暂无角色
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </BaseModal>
</template>

<script setup lang="ts">
/**
 * @title User Management Component
 * @description 用户管理页面，提供用户的增删改查及筛选功能。
 * @keywords-cn 用户管理, 账号管理, 主体管理
 * @keywords-en user-management, account-management, principal-management
 */

import { ref, onMounted, reactive } from 'vue';
import BaseModal from '../../../components/BaseModal.vue';
import IdentitySectionHeader from './IdentitySectionHeader.vue';
import { usePrincipals } from '../hooks/usePrincipals';
import { useOrganizations } from '../hooks/useOrganizations';
import { useMemberships } from '../hooks/useMemberships';
import {
  SquareAvatarCropModal,
  useResourceUpload,
} from '../../resource/resource.module';
import { resolveImageUrl } from '../../resource/services/resource-url.service';
import type {
  IdentityPrincipalItem,
  UserPrincipalType,
  OrganizationItem,
  MembershipItem,
} from '../types/identity.types';

defineOptions({
  inheritAttrs: false,
});

defineEmits<{
  (e: 'close'): void;
}>();

const users = ref<IdentityPrincipalItem[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(10);
const query = reactive({
  q: '',
  type: '' as UserPrincipalType | '',
});

const showModal = ref(false);
const isEdit = ref(false);
const showPassword = ref(true);
const showAvatarModal = ref(false);
const form = reactive({
  id: '',
  displayName: '',
  principalType: 'user' as UserPrincipalType,
  email: '',
  password: '',
  phone: '',
  avatarUrl: null as string | null,
});

const { listUsers, createUser, updateUser, removeUser } = usePrincipals();
const { uploading, progress, upload: uploadResource } = useResourceUpload();
const { list: listOrganizations } = useOrganizations();
const {
  list: listMemberships,
  add: addMembership,
  remove: removeMembership,
} = useMemberships();

const showRoleModal = ref(false);
const currentUser = ref<IdentityPrincipalItem | null>(null);
const memberships = ref<MembershipItem[]>([]);
const organizations = ref<OrganizationItem[]>([]);
const newMembershipOrgId = ref('');
const newMembershipRole = ref('member');

onMounted(() => {
  fetchData();
});

/**
 * @description 获取用户列表并按当前前端分页裁切展示。
 * @keyword-en fetch-user-data
 */
async function fetchData() {
  try {
    const all = await listUsers({
      q: query.q,
      type: (query.type || undefined) as UserPrincipalType | undefined,
    });
    total.value = all.length;
    const start = (page.value - 1) * limit.value;
    users.value = all.slice(start, start + limit.value);
  } catch (e) {
    console.error(e);
  }
}

/**
 * @description 重置页码并按当前筛选条件查询用户。
 * @keyword-en search-users
 */
function handleSearch() {
  page.value = 1;
  fetchData();
}

/**
 * @description 将用户主体类型转换为中文显示名。
 * @keyword-en format-user-type
 */
function formatType(type: string) {
  const map: Record<string, string> = {
    user: '企业用户',
    user_consumer: '消费者',
    official_account: '官方账号',
    agent: 'Agent',
    system: '系统',
  };
  return map[type] || type;
}

/**
 * @description 格式化列表创建时间。
 * @keyword-en format-user-date
 */
function formatDate(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

/**
 * @description 打开新增用户弹窗并重置表单。
 * @keyword-en open-create-user-modal
 */
function openCreateModal() {
  isEdit.value = false;
  form.displayName = '';
  form.principalType = 'user';
  form.email = '';
  form.password = '';
  form.phone = '';
  form.avatarUrl = null;
  showPassword.value = true;
  showModal.value = true;
}

/**
 * @description 打开编辑用户弹窗；密码默认留空，保存时不修改。
 * @keyword-en open-edit-user-modal
 */
function openEditModal(user: IdentityPrincipalItem) {
  isEdit.value = true;
  form.id = user.id;
  form.displayName = user.displayName;
  form.principalType = toUserPrincipalType(user.principalType);
  form.email = user.email || '';
  form.password = '';
  form.phone = user.phone || '';
  form.avatarUrl = user.avatarUrl || null;
  showPassword.value = true;
  showModal.value = true;
}

/**
 * @description 上传并写入用户头像资源路径。
 * @keyword-en confirm-user-avatar
 */
async function onAvatarConfirm(file: File) {
  const res = await uploadResource(file);
  form.avatarUrl = res.data.path;
}

/**
 * @description 归一化用户管理支持的主体类型。
 * @keyword-en to-user-principal-type
 */
function toUserPrincipalType(type: string): UserPrincipalType {
  if (
    type === 'user' ||
    type === 'user_consumer' ||
    type === 'system'
  ) {
    return type;
  }
  return 'user';
}

/**
 * @description 生成随机密码并切换为可见。
 * @keyword-en generate-user-password
 */
function generatePassword() {
  form.password = buildRandomPassword(12);
  showPassword.value = true;
}

/**
 * @description 切换密码输入可见状态。
 * @keyword-en toggle-user-password-visibility
 */
function togglePassword() {
  showPassword.value = !showPassword.value;
}

/**
 * @description 使用浏览器随机源生成指定长度密码。
 * @keyword-en build-random-password
 */
function buildRandomPassword(length: number): string {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const values = new Uint32Array(length);
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(values);
  } else {
    for (let i = 0; i < values.length; i += 1) {
      values[i] = Math.floor(Math.random() * chars.length);
    }
  }
  let out = '';
  for (let i = 0; i < values.length; i += 1) {
    out += chars[values[i] % chars.length];
  }
  return out;
}

/**
 * @description 关闭用户编辑弹窗并同步关闭头像裁剪弹窗。
 * @keyword-en close-user-modal
 */
function closeModal() {
  showModal.value = false;
  showAvatarModal.value = false;
}

function getOrganizationName(id: string) {
  const org = organizations.value.find((item) => item.id === id);
  if (!org) return id;
  return org.name;
}

function formatMembershipRole(role: string) {
  const map: Record<string, string> = {
    owner: '所有者',
    admin: '管理员',
    member: '成员',
  };
  return map[role] || role;
}

async function handleSubmit() {
  try {
    if (isEdit.value) {
      if (!form.email.trim()) {
        alert('请填写邮箱');
        return;
      }
      const password = form.password.trim();
      await updateUser(form.id, {
        displayName: form.displayName,
        email: form.email,
        password: password ? password : undefined,
        phone: form.phone || null,
        avatarUrl: form.avatarUrl,
      });
    } else {
      if (!form.email.trim()) {
        alert('请填写邮箱');
        return;
      }
      const password = form.password.trim();
      await createUser({
        displayName: form.displayName,
        principalType: form.principalType,
        email: form.email,
        password: password ? password : undefined,
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
    await removeUser(user.id);
    fetchData();
  } catch (e) {
    console.error(e);
  }
}

async function openRoleModal(user: IdentityPrincipalItem) {
  currentUser.value = user;
  showRoleModal.value = true;
  newMembershipOrgId.value = '';
  newMembershipRole.value = 'member';
  await fetchRoleData();
}

async function fetchRoleData() {
  if (!currentUser.value) return;
  try {
    const [orgs, list] = await Promise.all([
      listOrganizations({}),
      listMemberships({ principalId: currentUser.value.id }),
    ]);
    organizations.value = orgs;
    memberships.value = list;
    if (!newMembershipOrgId.value && organizations.value.length > 0) {
      newMembershipOrgId.value = organizations.value[0].id;
    }
  } catch (e) {
    console.error(e);
  }
}

function closeRoleModal() {
  showRoleModal.value = false;
  currentUser.value = null;
  memberships.value = [];
  organizations.value = [];
  newMembershipOrgId.value = '';
  newMembershipRole.value = 'member';
}

async function addUserMembership() {
  if (!currentUser.value || !newMembershipOrgId.value) return;
  try {
    await addMembership({
      organizationId: newMembershipOrgId.value,
      principalId: currentUser.value.id,
      role: newMembershipRole.value,
    });
    await fetchRoleData();
  } catch (e) {
    console.error(e);
  }
}

async function removeUserMembership(id: string) {
  if (!confirm('确认移除该角色吗？')) return;
  try {
    await removeMembership(id);
    await fetchRoleData();
  } catch (e) {
    console.error(e);
  }
}
</script>

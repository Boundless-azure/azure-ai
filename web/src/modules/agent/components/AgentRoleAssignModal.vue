<template>
  <!-- 角色分配 Modal :: 与 UserManagement 同构, 落点 principalId 由 props 传入 -->
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center"
  >
    <div
      class="absolute inset-0 bg-black/30 backdrop-blur-sm"
      @click="handleClose"
    ></div>
    <div
      class="relative bg-white rounded-2xl shadow-xl w-[820px] max-w-[95vw] border border-gray-200 p-6 flex flex-col h-[620px]"
    >
      <!-- 头部 :: 标题 + 关闭 -->
      <div class="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h3 class="text-lg font-bold text-gray-900">分配角色</h3>
          <p class="text-sm text-gray-500">
            Agent: {{ agentName || '-' }}
          </p>
          <p
            v-if="!principalId"
            class="text-xs text-amber-600 mt-1 flex items-center gap-1"
          >
            <i class="fa-solid fa-triangle-exclamation"></i>
            该 Agent 尚未关联 principal, 暂无法分配角色
          </p>
        </div>
        <button
          class="text-gray-400 hover:text-gray-700"
          @click="handleClose"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- 新增成员行 :: 选组织 + 选角色 + 添加 -->
      <div class="flex gap-2 mb-4 flex-shrink-0">
        <select
          v-model="newOrgId"
          class="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
          :disabled="!principalId"
        >
          <option value="" disabled>请选择组织</option>
          <option v-for="org in organizations" :key="org.id" :value="org.id">
            {{ org.name }}
          </option>
        </select>
        <select
          v-model="newRoleId"
          class="px-3 py-2 rounded-lg border border-gray-200 text-sm min-w-[180px]"
          :disabled="!principalId"
        >
          <option value="" disabled>请选择角色</option>
          <option v-for="role in roles" :key="role.id" :value="role.id">
            {{ role.name }} · {{ role.code }}
          </option>
        </select>
        <button
          class="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50"
          :disabled="!principalId || !newOrgId || !newRoleId || saving"
          @click="addRole"
        >
          <i v-if="saving" class="fa-solid fa-spinner fa-spin mr-1"></i>
          添加
        </button>
      </div>

      <!-- 当前角色列表 -->
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
              <td class="px-4 py-2">{{ getOrgName(m.organizationId) }}</td>
              <td class="px-4 py-2">
                <span class="px-2 py-0.5 rounded text-xs bg-gray-100">
                  {{ formatRoleLabel(m) }}
                </span>
              </td>
              <td class="px-4 py-2 text-right">
                <button
                  class="text-red-600 hover:text-red-800 text-xs"
                  @click="removeRole(m.id)"
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
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title AgentRoleAssignModal
 * @description Agent 角色分配弹窗。底层与 UserManagement 共用 membership 系统,
 *              区别仅是入口和展示对象 (Agent vs 用户)。落点为 agent 的 principalId。
 * @keywords-cn Agent角色分配, 主体角色, 成员关系
 * @keywords-en agent-role-assign, principal-role, membership
 */
import { ref, watch } from 'vue';
import { useOrganizations } from '../../identity/hooks/useOrganizations';
import { useRoles } from '../../identity/hooks/useRoles';
import { useMemberships } from '../../identity/hooks/useMemberships';
import type {
  MembershipItem,
  OrganizationItem,
  RoleItem,
} from '../../identity/types/identity.types';

const props = defineProps<{
  open: boolean;
  principalId: string | null | undefined;
  agentName?: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { list: listOrgs } = useOrganizations();
const { list: listRoles } = useRoles();
const {
  list: listMemberships,
  add: addMembership,
  remove: removeMembership,
} = useMemberships();

const organizations = ref<OrganizationItem[]>([]);
const roles = ref<RoleItem[]>([]);
const memberships = ref<MembershipItem[]>([]);
const newOrgId = ref('');
const newRoleId = ref('');
const saving = ref(false);

/**
 * 拉取当前 agent principal 名下所有成员关系
 * @keyword-en refresh-memberships
 */
async function refreshMemberships() {
  if (!props.principalId) {
    memberships.value = [];
    return;
  }
  try {
    const list = await listMemberships({ principalId: props.principalId });
    memberships.value = list;
  } catch (e) {
    console.error('Failed to load memberships:', e);
    memberships.value = [];
  }
}

/**
 * 打开后并行加载组织、角色、成员关系
 * @keyword-en bootstrap-modal-data
 */
async function bootstrap() {
  try {
    const [orgs, roleList] = await Promise.all([listOrgs(), listRoles()]);
    organizations.value = orgs;
    roles.value = roleList;
    await refreshMemberships();
  } catch (e) {
    console.error('Failed to bootstrap role-assign modal:', e);
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) bootstrap();
  },
);

watch(
  () => props.principalId,
  () => {
    if (props.open) refreshMemberships();
  },
);

function getOrgName(id: string): string {
  return organizations.value.find((o) => o.id === id)?.name || id;
}

/**
 * 角色展示文案 :: 后端 normalize 成 owner/admin/member 之一, 取本地中文映射;
 *                 同时若 roleId 命中 roles 列表, 拼上自定义角色名以便区分。
 * @keyword-en format-role-label
 */
function formatRoleLabel(m: MembershipItem): string {
  const map: Record<string, string> = {
    owner: '所有者',
    admin: '管理员',
    member: '成员',
  };
  return map[m.role] ?? m.role;
}

async function addRole() {
  if (!props.principalId || !newOrgId.value || !newRoleId.value) return;
  saving.value = true;
  try {
    await addMembership({
      organizationId: newOrgId.value,
      principalId: props.principalId,
      roleId: newRoleId.value,
    });
    newOrgId.value = '';
    newRoleId.value = '';
    await refreshMemberships();
  } catch (e) {
    console.error('Failed to add role:', e);
  } finally {
    saving.value = false;
  }
}

async function removeRole(id: string) {
  try {
    await removeMembership(id);
    await refreshMemberships();
  } catch (e) {
    console.error('Failed to remove role:', e);
  }
}

function handleClose() {
  emit('close');
}
</script>

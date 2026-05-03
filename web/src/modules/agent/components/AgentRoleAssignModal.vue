<template>
  <!-- 角色分配 Modal :: 用通用 BaseModal, backdrop / z-index / ESC / 关闭按钮 全部由 BaseModal 接管 -->
  <BaseModal
    :open="open"
    title="分配角色"
    :subtitle="`Agent: ${agentName || '-'}`"
    size="lg"
    @close="handleClose"
  >
    <!-- 警告条 :: principal 缺失 -->
    <div
      v-if="!principalId"
      class="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-1.5"
    >
      <i class="fa-solid fa-triangle-exclamation"></i>
      该 Agent 尚未关联 principal, 暂无法分配角色
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
          {{ role.name }}
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
    <div class="border border-gray-100 rounded-xl overflow-hidden">
      <table class="w-full text-left text-sm">
        <thead class="bg-gray-50">
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
  </BaseModal>
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
import BaseModal from '../../../components/BaseModal.vue';
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
 * 角色展示文案 :: 直接用后端返回的 roleName (来自 RoleEntity.name);
 *                 fallback 路径: roleName 为空 → 通过 code 反查 roles 列表 → 'guest' 历史数据提示
 * @keyword-en format-role-label
 */
function formatRoleLabel(m: MembershipItem): string {
  // 直接用后端 list 返回的 RoleEntity.name (用户在 RoleManagement 配的真实名字)
  if (m.roleName && m.roleName.trim()) return m.roleName;
  // 'guest' 是后端 fallback (找不到 roleId 对应 role) :: 历史数据明确提示
  if (m.role === 'guest') return '未关联角色 (历史数据, 请重新分配)';
  // 兜底 :: 通过 code 反查 roles 列表 (老接口可能没回 roleName)
  const matched = roles.value.find((r) => r.code === m.role);
  return matched?.name ?? m.role;
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

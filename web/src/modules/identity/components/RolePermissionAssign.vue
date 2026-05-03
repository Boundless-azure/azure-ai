<template>
  <div
    class="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
  >
    <div
      class="p-4 border-b border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-gray-50/50"
    >
      <div class="flex flex-col md:flex-row md:items-center gap-4">
        <div v-if="!roleId" class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-700 whitespace-nowrap">角色:</label>
          <select
            v-model="selectedRoleId"
            class="w-full md:w-auto px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            @change="loadPermissions"
          >
            <option value="" disabled>请选择...</option>
            <option v-for="r in roles" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
        </div>
        <div class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            v-for="tab in nodeTabs"
            :key="tab.id"
            class="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors border whitespace-nowrap"
            :class="
              activeType === tab.id
                ? 'bg-white text-gray-900 border-gray-200 shadow-sm'
                : 'text-gray-500 border-transparent hover:bg-white'
            "
            @click="activeType = tab.id"
          >
            <i class="fa-solid" :class="tab.icon"></i>
            {{ tab.label }}
          </button>
        </div>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 text-sm transition-colors flex items-center justify-center gap-2"
        @click="save"
        :disabled="saving || !selectedRoleId"
      >
        <i v-if="saving" class="fa-solid fa-circle-notch fa-spin"></i>
        <i v-else class="fa-solid fa-save"></i>
        <span>保存变更</span>
      </button>
    </div>

    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
      <div class="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 flex flex-col h-1/2 md:h-auto">
        <div class="p-3 border-b border-gray-200 bg-gray-100/50">
          <div class="text-xs font-bold text-gray-500 uppercase tracking-wider">
            权限节点
          </div>
          <div class="text-xs text-gray-400 mt-1">
            {{ subjects.length }} 个父级节点
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-2 space-y-2">
          <div
            v-for="subject in subjects"
            :key="subject.id"
            class="space-y-1"
          >
            <div
              class="px-3 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer transition-colors"
              :class="
                activeSelection?.kind === 'subject' &&
                activeSelection.subjectId === subject.id
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-600 hover:bg-gray-100'
              "
              @click="setActiveSubject(subject)"
            >
              <input
                :ref="(el) => setSubjectCheckboxRef(subject.id, el)"
                type="checkbox"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                :checked="isSubjectChecked(subject)"
                @change="toggleSubject(subject)"
                @click.stop
              />
              <span class="font-mono truncate flex-1">
                {{ subject.nodeKey }}
              </span>
            </div>
            <div class="pl-8 space-y-1">
              <div
                v-for="child in subject.children"
                :key="child.id"
                class="px-3 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer transition-colors"
                :class="
                  activeSelection?.kind === 'action' &&
                  activeSelection.actionId === child.id
                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-600 hover:bg-gray-100'
                "
                @click="setActiveAction(subject, child)"
              >
                <input
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  :checked="isChildSelected(subject, child)"
                  @change="toggleChild(subject, child)"
                  @click.stop
                />
                <span class="font-mono truncate flex-1">
                  {{ child.nodeKey }}
                </span>
              </div>
            </div>
          </div>
          <div
            v-if="subjects.length === 0"
            class="text-center py-8 text-gray-400 text-xs"
          >
            暂无权限节点
          </div>
        </div>
      </div>

      <div class="flex-1 bg-white flex flex-col min-w-0 h-1/2 md:h-auto border-t md:border-t-0">
        <div class="p-6 border-b border-gray-100">
          <div class="text-sm text-gray-500">描述详情</div>
          <div
            v-if="activeDetail"
            class="mt-2 text-lg font-semibold text-gray-900"
          >
            {{ activeDetail.title }}
          </div>
          <div v-else class="mt-2 text-gray-400 text-sm">
            请选择左侧节点查看描述
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="activeDetail" class="space-y-4">
            <div class="text-sm text-gray-700">
              {{ activeDetail.description || '暂无描述' }}
            </div>
            <div v-if="activeDetail.children.length > 0" class="space-y-3">
              <div class="text-xs font-semibold text-gray-500 uppercase">
                子级节点描述
              </div>
              <div class="space-y-2">
                <div
                  v-for="child in activeDetail.children"
                  :key="child.id"
                  class="p-3 rounded-lg border border-gray-100 bg-gray-50/60"
                >
                  <div class="text-sm font-mono text-gray-900">
                    {{ child.nodeKey }}
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                    {{ child.description || '暂无描述' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-gray-400 text-sm">
            点击左侧节点显示对应描述
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Role Permission Assignment Component
 * @description 角色权限分配组件，用于给特定角色分配资源操作权限。
 * @keywords-cn 角色权限, 权限分配, 策略配置
 * @keywords-en role-permission, permission-assignment, policy-config
 */

import { ref, watch, onMounted, computed } from 'vue';
import { useRoles } from '../hooks/useRoles';
import { usePermissionDefinitions } from '../hooks/usePermissionDefinitions';
import type {
  PermissionDefinitionItem,
  PermissionDefinitionType,
  RoleItem,
} from '../types/identity.types';
import { useUIStore } from '../../agent/store/ui.store';

const props = defineProps<{
  roleId?: string;
}>();

const loading = ref(false);
const saving = ref(false);
const roles = ref<RoleItem[]>([]);
const selectedRoleId = ref('');
const definitions = ref<PermissionDefinitionItem[]>([]);
const selectedKeys = ref<Set<string>>(new Set());
const activeType = ref<PermissionDefinitionType>('management');
const activeSelection = ref<
  | { kind: 'subject'; subjectId: string }
  | { kind: 'action'; subjectId: string; actionId: string }
  | null
>(null);
const subjectCheckboxRefs = new Map<string, HTMLInputElement>();

const nodeTabs: Array<{
  id: PermissionDefinitionType;
  label: string;
  icon: string;
}> = [
  { id: 'management', label: '管理权限节点', icon: 'fa-shield-halved' },
  { id: 'data', label: '数据权限节点', icon: 'fa-database' },
  { id: 'menu', label: '菜单节点', icon: 'fa-bars' },
];

const { list: listRoles, listPermissions, upsertPermissions } = useRoles();
const { list: listDefinitions } = usePermissionDefinitions();

const subjects = computed(() => {
  const items = definitions.value.filter(
    (d) => d.permissionType === activeType.value,
  );
  const parents = items.filter((d) => !d.fid);
  return parents
    .map((subject) => ({
      ...subject,
      children: items
        .filter((d) => d.fid === subject.id)
        .sort((a, b) => a.nodeKey.localeCompare(b.nodeKey)),
    }))
    .sort((a, b) => a.nodeKey.localeCompare(b.nodeKey));
});

const activeDetail = computed(() => {
  if (!activeSelection.value) return null;
  if (activeSelection.value.kind === 'subject') {
    const subject = subjects.value.find(
      (s) => s.id === activeSelection.value?.subjectId,
    );
    if (!subject) return null;
    return {
      title: subject.nodeKey,
      description: subject.description,
      children: subject.children,
    };
  }
  const subject = subjects.value.find(
    (s) => s.id === activeSelection.value?.subjectId,
  );
  const child = subject?.children.find(
    (c) => c.id === activeSelection.value?.actionId,
  );
  if (!subject || !child) return null;
  return {
    title: `${subject.nodeKey} · ${child.nodeKey}`,
    description: child.description,
    children: [],
  };
});

onMounted(async () => {
  await loadDefinitions();
  if (!props.roleId) {
    try {
      roles.value = await listRoles();
    } catch (e) {
      console.error(e);
    }
  } else {
    selectedRoleId.value = props.roleId;
    loadPermissions();
  }
});

watch(
  () => props.roleId,
  (newVal) => {
    if (newVal) {
      selectedRoleId.value = newVal;
      loadPermissions();
    }
  },
);

watch(
  () => [subjects.value, selectedKeys.value],
  () => {
    subjects.value.forEach((subject) => updateSubjectCheckbox(subject.id));
  },
);

watch(
  () => activeType.value,
  () => {
    const first = subjects.value[0];
    if (first) {
      activeSelection.value = { kind: 'subject', subjectId: first.id };
    } else {
      activeSelection.value = null;
    }
  },
);

async function loadDefinitions() {
  try {
    definitions.value = await listDefinitions();
  } catch (e) {
    console.error(e);
  }
}

async function loadPermissions() {
  if (!selectedRoleId.value) return;
  loading.value = true;

  try {
    const perms = await listPermissions(selectedRoleId.value);
    const next = new Set<string>();
    perms.forEach((p) => {
      // 三元组 key :: 同一 (subject, action) 在不同 permissionType 下是不同节点, 必须分开存
      const type = (p.permissionType ?? 'management') as PermissionDefinitionType;
      next.add(makeKey(p.subject, p.action, type));
    });
    selectedKeys.value = next;
    if (!activeSelection.value && subjects.value.length > 0) {
      activeSelection.value = {
        kind: 'subject',
        subjectId: subjects.value[0].id,
      };
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

/**
 * 三元组 key :: (subject, action, type), 让 selectedKeys 跨 tab 切换不丢失
 * @keyword-en make-permission-key
 */
function makeKey(
  subject: string,
  action: string,
  type: PermissionDefinitionType,
) {
  return `${subject}::${action}::${type}`;
}

function setSubjectCheckboxRef(subjectId: string, el: Element | null) {
  if (!el) {
    subjectCheckboxRefs.delete(subjectId);
    return;
  }
  if (el instanceof HTMLInputElement) {
    subjectCheckboxRefs.set(subjectId, el);
    updateSubjectCheckbox(subjectId);
  }
}

function updateSubjectCheckbox(subjectId: string) {
  const el = subjectCheckboxRefs.get(subjectId);
  if (!el) return;
  const subject = subjects.value.find((s) => s.id === subjectId);
  if (!subject) return;
  el.indeterminate = isSubjectIndeterminate(subject);
}

function isChildSelected(
  subject: PermissionDefinitionItem,
  child: PermissionDefinitionItem,
) {
  return selectedKeys.value.has(
    makeKey(subject.nodeKey, child.nodeKey, activeType.value),
  );
}

function isSubjectChecked(subject: {
  nodeKey: string;
  children: PermissionDefinitionItem[];
}) {
  if (subject.children.length === 0) return false;
  return subject.children.every((child) =>
    selectedKeys.value.has(
      makeKey(subject.nodeKey, child.nodeKey, activeType.value),
    ),
  );
}

function isSubjectIndeterminate(subject: {
  nodeKey: string;
  children: PermissionDefinitionItem[];
}) {
  const selectedCount = subject.children.filter((child) =>
    selectedKeys.value.has(
      makeKey(subject.nodeKey, child.nodeKey, activeType.value),
    ),
  ).length;
  return selectedCount > 0 && selectedCount < subject.children.length;
}

function toggleSubject(subject: {
  nodeKey: string;
  id: string;
  children: PermissionDefinitionItem[];
}) {
  const next = new Set(selectedKeys.value);
  const shouldSelect = !isSubjectChecked(subject);
  subject.children.forEach((child) => {
    const key = makeKey(subject.nodeKey, child.nodeKey, activeType.value);
    if (shouldSelect) next.add(key);
    else next.delete(key);
  });
  selectedKeys.value = next;
  setActiveSubject(subject);
}

function toggleChild(
  subject: PermissionDefinitionItem,
  child: PermissionDefinitionItem,
) {
  const next = new Set(selectedKeys.value);
  const key = makeKey(subject.nodeKey, child.nodeKey, activeType.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selectedKeys.value = next;
  setActiveAction(subject, child);
}

function setActiveSubject(subject: { id: string }) {
  activeSelection.value = { kind: 'subject', subjectId: subject.id };
}

function setActiveAction(
  subject: { id: string },
  child: { id: string },
) {
  activeSelection.value = {
    kind: 'action',
    subjectId: subject.id,
    actionId: child.id,
  };
}

async function save() {
  if (!selectedRoleId.value) return;
  const ui = useUIStore();
  try {
    saving.value = true;
    // 解三元组 key :: subject::action::permissionType
    const payloadItems = Array.from(selectedKeys.value).map((key) => {
      const [subject, action, permissionType] = key.split('::');
      return {
        subject,
        action,
        permissionType: (permissionType as PermissionDefinitionType) ?? 'management',
      };
    });
    await upsertPermissions(selectedRoleId.value, { items: payloadItems });
    ui.showToast('权限配置已保存', 'success');
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : '保存失败';
    // 后端权重越权防护时给的 ForbiddenException 信息要清晰反馈
    ui.showToast(
      msg.includes('权重越权') ? msg : '保存失败',
      'error',
    );
  } finally {
    saving.value = false;
  }
}
</script>

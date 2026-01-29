<template>
  <div
    class="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
  >
    <!-- Header/Toolbar -->
    <div
      class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50"
    >
      <div class="flex items-center gap-4">
        <div v-if="!roleId" class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-700">角色:</label>
          <select
            v-model="selectedRoleId"
            class="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            @change="loadPermissions"
          >
            <option value="" disabled>请选择...</option>
            <option v-for="r in roles" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
        </div>
        <div class="text-sm text-gray-500">
          <i class="fa-solid fa-layer-group mr-1"></i>
          {{ resources.length }} 个资源对象
        </div>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 text-sm transition-colors flex items-center gap-2"
        @click="save"
        :disabled="loading"
      >
        <i v-if="loading" class="fa-solid fa-circle-notch fa-spin"></i>
        <i v-else class="fa-solid fa-save"></i>
        <span>保存变更</span>
      </button>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Left Sidebar: Resources -->
      <div class="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div
          class="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-100/50"
        >
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider"
            >资源列表 (Subjects)</span
          >
          <button
            class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="添加资源"
            @click="addResource"
          >
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-2 space-y-1">
          <div
            v-for="(res, idx) in resources"
            :key="idx"
            class="px-3 py-2 rounded-lg text-sm cursor-pointer flex justify-between items-center group transition-all duration-200"
            :class="
              currentResourceIndex === idx
                ? 'bg-white text-blue-600 shadow-sm font-medium ring-1 ring-gray-200'
                : 'text-gray-600 hover:bg-gray-100'
            "
            @click="currentResourceIndex = idx"
          >
            <div class="truncate flex-1">
              <span v-if="res.subject" class="font-mono">{{
                res.subject
              }}</span>
              <span v-else class="text-gray-400 italic">未命名资源</span>
            </div>
            <button
              class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-1 transition-all"
              @click.stop="removeResource(idx)"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div
            v-if="resources.length === 0"
            class="text-center py-8 text-gray-400 text-xs"
          >
            暂无资源配置<br />点击上方 + 添加
          </div>
        </div>
      </div>

      <!-- Right Content: Actions -->
      <div class="flex-1 bg-white flex flex-col min-w-0">
        <div v-if="currentResource" class="h-full flex flex-col">
          <!-- Resource Header -->
          <div class="p-6 border-b border-gray-100 flex items-start gap-4">
            <div class="flex-1">
              <label
                class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                >资源名称 (Subject)</label
              >
              <input
                v-model="currentResource.subject"
                class="w-full text-lg font-bold text-gray-900 border-b border-gray-200 focus:border-blue-500 focus:outline-none bg-transparent px-1 py-1 font-mono placeholder-gray-300 transition-colors"
                placeholder="例如: article, user, order"
              />
              <p class="text-xs text-gray-400 mt-2">
                定义权限作用的目标资源标识符 (CASL Subject)。
              </p>
            </div>
            <button
              class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
              @click="addAction(currentResource)"
            >
              <i class="fa-solid fa-plus mr-1"></i> 添加操作
            </button>
          </div>

          <!-- Actions Table -->
          <div class="flex-1 overflow-y-auto p-6">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="text-xs text-gray-500 border-b border-gray-100">
                  <th class="pb-3 pl-2 w-1/4 font-semibold">操作 (Action)</th>
                  <th class="pb-3 w-1/2 font-semibold">
                    条件 (Conditions - JSON)
                  </th>
                  <th class="pb-3 pr-2 w-16 text-right font-semibold">移除</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr
                  v-for="(action, aIdx) in currentResource.actions"
                  :key="aIdx"
                  class="group hover:bg-gray-50/50 transition-colors"
                >
                  <td class="py-3 pl-2 align-top">
                    <input
                      v-model="action.action"
                      class="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-sm transition-all"
                      placeholder="e.g. create"
                    />
                  </td>
                  <td class="py-3 align-top px-2">
                    <textarea
                      v-model="action.conditionsText"
                      class="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-xs resize-none h-[38px] focus:h-24 transition-all"
                      placeholder="{}"
                    ></textarea>
                  </td>
                  <td class="py-3 pr-2 align-top text-right">
                    <button
                      class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      @click="removeAction(currentResource, aIdx)"
                    >
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-if="currentResource.actions.length === 0"
              class="text-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl mt-4"
            >
              <i class="fa-solid fa-shield-cat text-2xl mb-2"></i>
              <p class="mt-2 text-sm">暂无操作定义</p>
              <button
                class="mt-2 text-blue-600 hover:underline text-sm font-medium"
                @click="addAction(currentResource)"
              >
                添加一个操作
              </button>
            </div>
          </div>
        </div>

        <div
          v-else
          class="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30"
        >
          <div
            class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4"
          >
            <i class="fa-regular fa-folder-open text-2xl text-gray-400"></i>
          </div>
          <p class="font-medium text-gray-600">请选择左侧资源</p>
          <p class="text-sm mt-1">或点击 "+" 添加新资源</p>
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
import type { RoleItem } from '../types/identity.types';
import { useUIStore } from '../../agent/store/ui.store';

const props = defineProps<{
  roleId?: string;
}>();

interface ActionItem {
  action: string;
  conditionsText: string;
}

interface ResourceGroup {
  subject: string;
  actions: ActionItem[];
}

const loading = ref(false);
const roles = ref<RoleItem[]>([]);
const selectedRoleId = ref('');
const resources = ref<ResourceGroup[]>([]);
const currentResourceIndex = ref<number>(-1);

const currentResource = computed(() =>
  currentResourceIndex.value >= 0 &&
  currentResourceIndex.value < resources.value.length
    ? resources.value[currentResourceIndex.value]
    : null,
);

const { list, listPermissions, upsertPermissions } = useRoles();

onMounted(async () => {
  if (!props.roleId) {
    try {
      roles.value = await list();
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

async function loadPermissions() {
  if (!selectedRoleId.value) return;
  loading.value = true;
  resources.value = [];
  currentResourceIndex.value = -1;

  try {
    const perms = await listPermissions(selectedRoleId.value);

    // Group by Subject
    const grouped = new Map<string, ActionItem[]>();
    perms.forEach((p) => {
      const items = grouped.get(p.subject) || [];
      items.push({
        action: p.action,
        conditionsText: p.conditions ? JSON.stringify(p.conditions) : '',
      });
      grouped.set(p.subject, items);
    });

    resources.value = Array.from(grouped.entries()).map(
      ([subject, actions]) => ({
        subject,
        actions,
      }),
    );

    if (resources.value.length > 0) {
      currentResourceIndex.value = 0;
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function addResource() {
  resources.value.push({
    subject: '',
    actions: [{ action: 'create', conditionsText: '' }],
  });
  currentResourceIndex.value = resources.value.length - 1;
}

function removeResource(index: number) {
  if (confirm('确认移除该资源及其所有操作权限吗？')) {
    resources.value.splice(index, 1);
    if (currentResourceIndex.value >= resources.value.length) {
      currentResourceIndex.value = Math.max(0, resources.value.length - 1);
    }
  }
}

function addAction(resource: ResourceGroup) {
  resource.actions.push({ action: '', conditionsText: '' });
}

function removeAction(resource: ResourceGroup, index: number) {
  resource.actions.splice(index, 1);
}

async function save() {
  if (!selectedRoleId.value) return;

  const ui = useUIStore();

  // Validate and Flatten
  const payloadItems = [];

  for (const res of resources.value) {
    const subject = res.subject.trim();
    if (!subject) {
      ui.showToast('存在未命名的资源 (Subject)', 'error');
      return;
    }

    for (const act of res.actions) {
      const action = act.action.trim();
      if (!action) continue; // Skip empty actions

      let conditions = null;
      if (act.conditionsText && act.conditionsText.trim()) {
        try {
          conditions = JSON.parse(act.conditionsText);
        } catch (e) {
          ui.showToast(`JSON 格式错误: ${subject} - ${action}`, 'error');
          return;
        }
      }

      payloadItems.push({
        subject,
        action,
        conditions,
      });
    }
  }

  try {
    loading.value = true;
    await upsertPermissions(selectedRoleId.value, { items: payloadItems });
    ui.showToast('权限配置已保存', 'success');
  } catch (e) {
    console.error(e);
    ui.showToast('保存失败', 'error');
  } finally {
    loading.value = false;
  }
}
</script>

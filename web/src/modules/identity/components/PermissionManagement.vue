<template>
  <div
    class="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
  >
    <!-- Toolbar -->
    <div
      class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50"
    >
      <div class="relative w-72">
        <i
          class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
        ></i>
        <input
          v-model="searchSubject"
          class="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          placeholder="搜索资源..."
        />
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 text-sm transition-colors flex items-center gap-2"
        @click="openAddResourceModal"
      >
        <i class="fa-solid fa-plus"></i>
        <span>添加资源 (Subject)</span>
      </button>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Left Sidebar: Subjects -->
      <div class="w-72 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div class="flex-1 overflow-y-auto p-2 space-y-1">
          <div
            v-for="subject in filteredSubjects"
            :key="subject"
            class="px-3 py-2.5 rounded-lg text-sm cursor-pointer flex justify-between items-center group transition-all duration-200"
            :class="
              currentSubject === subject
                ? 'bg-white text-blue-600 shadow-sm font-medium ring-1 ring-gray-200'
                : 'text-gray-600 hover:bg-gray-100'
            "
            @click="currentSubject = subject"
          >
            <div class="flex items-center gap-2 truncate flex-1">
              <i class="fa-solid fa-cube text-xs opacity-50"></i>
              <span class="font-mono">{{ subject }}</span>
            </div>
            <div
              class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <span
                class="text-xs bg-gray-200 text-gray-600 px-1.5 rounded-full"
                title="操作数量"
                >{{ getActionCount(subject) }}</span
              >
              <button
                class="p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="删除该资源下的所有权限"
                @click.stop="handleDeleteSubject(subject)"
              >
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
          <div
            v-if="filteredSubjects.length === 0"
            class="text-center py-8 text-gray-400 text-xs"
          >
            {{ subjects.length === 0 ? '暂无资源定义' : '未找到匹配资源' }}
          </div>
        </div>
      </div>

      <!-- Right Content: Actions -->
      <div class="flex-1 bg-white flex flex-col min-w-0">
        <div v-if="currentSubject" class="h-full flex flex-col">
          <!-- Subject Header -->
          <div class="p-6 border-b border-gray-100 flex items-start gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span
                  class="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                  >Subject</span
                >
                <h3 class="text-2xl font-bold text-gray-900 font-mono">
                  {{ currentSubject }}
                </h3>
              </div>
              <p class="text-sm text-gray-500">
                定义针对
                <span class="font-medium text-gray-700">{{
                  currentSubject
                }}</span>
                资源的可执行操作。
              </p>
            </div>
            <button
              class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
              @click="openAddActionModal"
            >
              <i class="fa-solid fa-plus mr-1"></i> 添加操作 (Action)
            </button>
          </div>

          <!-- Actions List -->
          <div class="flex-1 overflow-y-auto p-6">
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div
                v-for="def in currentActions"
                :key="def.id"
                class="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow group relative"
              >
                <div class="flex justify-between items-start mb-2">
                  <div class="flex items-center gap-2">
                    <span
                      class="bg-green-50 text-green-700 text-xs font-bold px-2 py-0.5 rounded font-mono"
                      >{{ def.action }}</span
                    >
                  </div>
                  <button
                    class="text-gray-300 hover:text-red-600 transition-colors p-1"
                    @click="handleDeleteDefinition(def)"
                  >
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
                <p class="text-sm text-gray-600 line-clamp-2">
                  {{ def.description || '暂无描述' }}
                </p>
                <div class="mt-3 text-xs text-gray-400 font-mono">
                  ID: {{ def.id }}
                </div>
              </div>

              <!-- Add Card -->
              <button
                class="border-2 border-dashed border-gray-100 rounded-xl p-4 flex flex-col items-center justify-center text-gray-400 hover:border-blue-200 hover:text-blue-500 hover:bg-blue-50/10 transition-all min-h-[100px]"
                @click="openAddActionModal"
              >
                <i class="fa-solid fa-plus text-xl mb-2"></i>
                <span class="text-sm font-medium">添加操作</span>
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
            <i class="fa-solid fa-cube text-2xl text-gray-400"></i>
          </div>
          <p class="font-medium text-gray-600">请选择左侧资源</p>
          <p class="text-sm mt-1">管理该资源下的操作权限点</p>
        </div>
      </div>
    </div>

    <!-- Add Resource Modal -->
    <div
      v-if="showResourceModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/30 backdrop-blur-sm"
        @click="showResourceModal = false"
      ></div>
      <div
        class="relative bg-white rounded-2xl shadow-xl w-[400px] max-w-[95vw] border border-gray-200 p-6"
      >
        <h3 class="text-lg font-bold text-gray-900 mb-4">添加资源 (Subject)</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >资源标识 (Subject)</label
            >
            <input
              v-model="newResourceForm.subject"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
              placeholder="e.g. user, order, article"
            />
            <p class="text-xs text-gray-500 mt-1">通常使用英文名词单数或复数</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >初始操作 (Action)</label
            >
            <input
              v-model="newResourceForm.action"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
              placeholder="e.g. create"
            />
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            @click="showResourceModal = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            @click="submitNewResource"
          >
            添加
          </button>
        </div>
      </div>
    </div>

    <!-- Add Action Modal -->
    <div
      v-if="showActionModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/30 backdrop-blur-sm"
        @click="showActionModal = false"
      ></div>
      <div
        class="relative bg-white rounded-2xl shadow-xl w-[400px] max-w-[95vw] border border-gray-200 p-6"
      >
        <h3 class="text-lg font-bold text-gray-900 mb-4">
          添加操作 ({{ currentSubject }})
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >操作标识 (Action)</label
            >
            <input
              v-model="newActionForm.action"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
              placeholder="e.g. read, update, delete"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >描述</label
            >
            <textarea
              v-model="newActionForm.description"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              rows="3"
              placeholder="该权限点的作用描述..."
            ></textarea>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            @click="showActionModal = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            @click="submitNewAction"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Permission Definition Management
 * @description 权限定义管理页面，用于维护系统中的 Subject 和 Action 字典。
 * @keywords-cn 权限定义, 权限字典, 资源管理, 权限点
 * @keywords-en permission-definition, permission-dictionary, resource-management, permission-point
 */

import { ref, computed, onMounted, reactive } from 'vue';
import { identityService } from '../services/identity.service';
import { useUIStore } from '../../agent/store/ui.store';

interface PermissionDefinition {
  id: string;
  subject: string;
  action: string;
  description?: string;
}

const ui = useUIStore();
const definitions = ref<PermissionDefinition[]>([]);
const searchSubject = ref('');
const currentSubject = ref<string>('');

// Modals
const showResourceModal = ref(false);
const showActionModal = ref(false);
const newResourceForm = reactive({ subject: '', action: 'create' });
const newActionForm = reactive({ action: '', description: '' });

const subjects = computed(() => {
  const s = new Set<string>();
  definitions.value.forEach((d) => s.add(d.subject));
  return Array.from(s).sort();
});

const filteredSubjects = computed(() => {
  if (!searchSubject.value) return subjects.value;
  const q = searchSubject.value.toLowerCase();
  return subjects.value.filter((s) => s.toLowerCase().includes(q));
});

const currentActions = computed(() => {
  if (!currentSubject.value) return [];
  return definitions.value.filter((d) => d.subject === currentSubject.value);
});

onMounted(() => {
  loadData();
});

async function loadData() {
  try {
    definitions.value = await identityService.listPermissionDefinitions();
    // If currentSubject is invalid (deleted), reset it
    if (
      currentSubject.value &&
      !definitions.value.some((d) => d.subject === currentSubject.value)
    ) {
      currentSubject.value = '';
    }
    // Select first if none selected and data exists
    if (!currentSubject.value && subjects.value.length > 0) {
      currentSubject.value = subjects.value[0];
    }
  } catch (e) {
    console.error(e);
  }
}

function getActionCount(subject: string) {
  return definitions.value.filter((d) => d.subject === subject).length;
}

function openAddResourceModal() {
  newResourceForm.subject = '';
  newResourceForm.action = 'create';
  showResourceModal.value = true;
}

async function submitNewResource() {
  if (!newResourceForm.subject || !newResourceForm.action) {
    ui.showToast('请填写完整', 'warning');
    return;
  }
  try {
    await identityService.createPermissionDefinition({
      subject: newResourceForm.subject,
      action: newResourceForm.action,
      description: 'Initial action',
    });
    await loadData();
    currentSubject.value = newResourceForm.subject;
    showResourceModal.value = false;
    ui.showToast('资源添加成功', 'success');
  } catch (e) {
    console.error(e);
  }
}

function openAddActionModal() {
  if (!currentSubject.value) return;
  newActionForm.action = '';
  newActionForm.description = '';
  showActionModal.value = true;
}

async function submitNewAction() {
  if (!newActionForm.action) {
    ui.showToast('请填写操作标识', 'warning');
    return;
  }
  try {
    await identityService.createPermissionDefinition({
      subject: currentSubject.value,
      action: newActionForm.action,
      description: newActionForm.description,
    });
    await loadData();
    showActionModal.value = false;
    ui.showToast('操作添加成功', 'success');
  } catch (e) {
    console.error(e);
  }
}

async function handleDeleteDefinition(def: PermissionDefinition) {
  if (!confirm(`确认删除权限点 ${def.subject}:${def.action} 吗？`)) return;
  try {
    await identityService.deletePermissionDefinition(def.id);
    await loadData();
    ui.showToast('删除成功', 'success');
  } catch (e) {
    console.error(e);
  }
}

async function handleDeleteSubject(subject: string) {
  if (
    !confirm(`确认删除资源 "${subject}" 及其所有操作权限吗？此操作不可恢复。`)
  )
    return;

  const toDelete = definitions.value.filter((d) => d.subject === subject);
  try {
    // Delete one by one or batch if API supported. Here one by one.
    for (const def of toDelete) {
      await identityService.deletePermissionDefinition(def.id);
    }
    await loadData();
    if (currentSubject.value === subject) {
      currentSubject.value = '';
    }
    ui.showToast(`资源 ${subject} 已删除`, 'success');
  } catch (e) {
    console.error(e);
  }
}
</script>

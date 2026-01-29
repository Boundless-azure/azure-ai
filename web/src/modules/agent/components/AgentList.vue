<template>
  <div class="space-y-6 h-full flex flex-col relative">
    <!-- Header -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm"
    >
      <div>
        <h2 class="text-2xl font-bold text-gray-900">
          {{ t('agent.management') }}
        </h2>
        <p class="text-gray-500 text-sm mt-1">
          {{ t('dashboard.welcomeSub') }}
        </p>
      </div>
      <div class="flex items-center gap-3 w-full md:w-auto">
        <div class="relative w-full md:w-64">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('agent.search')"
            class="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
          />
          <i
            class="fa-solid fa-search absolute left-3 top-3.5 text-gray-400"
          ></i>
        </div>
        <button
          @click="updateAllEmbeddings"
          class="px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-bold transition-colors shadow-md flex items-center"
          :disabled="isUpdating"
        >
          <i v-if="isUpdating" class="fa-solid fa-spinner fa-spin mr-2"></i>
          {{ t('agent.updateAllEmbeddings') }}
        </button>
        <button
          @click="updateSelectedEmbeddings"
          class="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-bold transition-colors shadow-md flex items-center"
          :disabled="isUpdating || selectedIds.size === 0"
        >
          <i v-if="isUpdating" class="fa-solid fa-spinner fa-spin mr-2"></i>
          {{ t('agent.updateSelectedEmbeddings') }}
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto min-h-0">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <i class="fa-solid fa-spinner fa-spin text-3xl text-gray-400"></i>
      </div>

      <div
        v-else-if="filteredAgents.length === 0"
        class="flex flex-col items-center justify-center h-64 text-gray-400"
      >
        <div
          class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4"
        >
          <i class="fa-solid fa-robot text-2xl text-gray-300"></i>
        </div>
        <p>{{ t('agent.search') }} - No results</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div
          v-for="agent in filteredAgents"
          :key="agent.id"
          class="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:border-gray-300 transition-all group relative flex flex-col"
          :class="isUpdating ? 'animate-pulse' : ''"
        >
          <!-- Agent Card -->
          <div class="flex justify-between items-start mb-4">
            <div
              class="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center text-white shadow-lg shadow-gray-900/20"
            >
              <i class="fa-solid fa-robot text-2xl"></i>
            </div>
            <div class="flex space-x-2">
              <button
                @click="openEditModal(agent)"
                class="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 transition-colors opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
                :title="t('agent.edit')"
              >
                <i class="fa-solid fa-pen text-sm"></i>
              </button>
              <button
                @click="confirmDelete(agent)"
                class="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 flex items-center justify-center text-red-600 transition-colors opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
                :title="t('agent.delete')"
              >
                <i class="fa-solid fa-trash text-sm"></i>
              </button>
              <label
                class="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center cursor-pointer"
              >
                <input
                  type="checkbox"
                  class="hidden"
                  :checked="selectedIds.has(agent.id)"
                  @change="toggleSelected(agent.id)"
                />
                <i
                  class="fa-solid"
                  :class="
                    selectedIds.has(agent.id)
                      ? 'fa-check-square text-gray-900'
                      : 'fa-square text-gray-400'
                  "
                ></i>
              </label>
            </div>
          </div>

          <div class="mb-4 flex-1">
            <h3
              class="text-lg font-bold text-gray-900 mb-2 line-clamp-1"
              :title="agent.nickname"
            >
              {{ agent.nickname }}
            </h3>
            <p
              class="text-sm text-gray-500 line-clamp-3 leading-relaxed h-[4.5rem]"
            >
              {{ agent.purpose }}
            </p>
          </div>

          <div
            class="flex items-center justify-between pt-4 border-t border-gray-100 text-xs font-medium text-gray-400"
          >
            <span
              class="flex items-center px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100"
              :title="`${t('agent.isAi')}: ${agent.is_ai_generated ? t('agent.aiGenerated') : t('agent.manual')}`"
            >
              {{ t('agent.isAi') }}:
              <span class="ml-1 font-semibold">
                {{
                  agent.is_ai_generated
                    ? t('agent.aiGenerated')
                    : t('agent.manual')
                }}
              </span>
            </span>
            <span>{{ formatDate(agent.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <transition name="fade">
      <div
        v-if="isUpdating"
        class="absolute inset-0 z-50 bg-white/70 backdrop-blur-sm flex items-center justify-center"
      >
        <div class="flex items-center gap-3 text-gray-700">
          <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
          <span class="font-bold">{{ t('agent.updatingEmbeddings') }}</span>
        </div>
      </div>
    </transition>

    <!-- Edit Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity"
      @click.self="showModal = false"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 transform transition-all scale-100"
      >
        <div class="flex items-center justify-between mb-8">
          <h3 class="text-2xl font-bold text-gray-900">
            {{ t('agent.edit') }}
          </h3>
          <button
            @click="showModal = false"
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i class="fa-solid fa-times text-xl"></i>
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">{{
              t('agent.nickname')
            }}</label>
            <input
              v-model="editForm.nickname"
              type="text"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all font-medium"
            />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">{{
              t('agent.purpose')
            }}</label>
            <textarea
              v-model="editForm.purpose"
              rows="4"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all font-medium resize-none"
            ></textarea>
          </div>
        </div>

        <div class="flex justify-end space-x-3 mt-10">
          <button
            @click="showModal = false"
            class="px-6 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 font-bold transition-colors"
          >
            {{ t('agent.cancel') }}
          </button>
          <button
            @click="handleSave"
            class="px-8 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-bold transition-colors shadow-lg shadow-gray-900/20"
          >
            {{ t('agent.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Agent List Component
 * @description Grid view for managing agents with search, edit, and delete capabilities.
 * @keywords-cn 代理列表, 代理管理, 搜索, 编辑, 删除
 * @keywords-en agent-list, agent-management, search, edit, delete
 */
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import type { Agent, UpdateAgentRequest } from '../types/agent.types';
import { useAgents } from '../hooks/useAgents';
import { useUIStore } from '../store/ui.store';

const { t, currentLocale } = useI18n();
const ui = useUIStore();
const { agents, loading, list, update, remove, updateEmbeddings } = useAgents();
const searchQuery = ref('');
const showModal = ref(false);
const currentAgent = ref<Agent | null>(null);
const isUpdating = ref(false);
const editForm = ref<UpdateAgentRequest>({
  nickname: '',
  purpose: '',
});

const filteredAgents = computed(() => {
  if (!searchQuery.value) return agents.value;
  const q = searchQuery.value.toLowerCase();
  return agents.value.filter(
    (a) =>
      a.nickname.toLowerCase().includes(q) ||
      a.purpose.toLowerCase().includes(q),
  );
});

const selectedIds = ref<Set<string>>(new Set());
const toggleSelected = (id: string) => {
  const set = new Set(selectedIds.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  selectedIds.value = set;
};

const fetchAgents = async () => {
  try {
    await list();
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    const msg = error instanceof Error ? error.message : '';
    if (/HTTP Error: 403/.test(msg)) {
      ui.showToast(
        currentLocale.value === 'en' ? 'Permission denied' : '权限不足',
        'warning',
        4000,
      );
    } else {
      ui.showToast(
        currentLocale.value === 'en'
          ? 'Failed to load agents'
          : 'Agent列表加载失败',
        'error',
        4000,
      );
    }
  }
};

const openEditModal = (agent: Agent) => {
  currentAgent.value = agent;
  editForm.value = {
    nickname: agent.nickname,
    purpose: agent.purpose,
  };
  showModal.value = true;
};

const handleSave = async () => {
  if (!currentAgent.value) return;
  try {
    await update(currentAgent.value.id, editForm.value);
    await fetchAgents();
    showModal.value = false;
  } catch (error) {
    console.error('Failed to update agent:', error);
  }
};

const confirmDelete = async (agent: Agent) => {
  if (confirm(t('agent.deleteConfirm'))) {
    try {
      await remove(agent.id);
      await fetchAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  }
};

const formatDate = (val: string | number | Date | null | undefined) => {
  if (val === null || val === undefined) return '-';
  let d: Date | null = null;
  if (typeof val === 'number') {
    d = new Date(val);
  } else if (typeof val === 'string') {
    const direct = new Date(val);
    if (!isNaN(direct.getTime())) {
      d = direct;
    } else {
      const iso = val.replace(' ', 'T');
      const withZ = /T\d{2}:\d{2}:\d{2}$/.test(iso) ? `${iso}Z` : iso;
      const parsed = new Date(withZ);
      d = isNaN(parsed.getTime()) ? null : parsed;
    }
  } else if (val instanceof Date) {
    d = val;
  }
  if (!d) return '-';
  try {
    return d.toLocaleString();
  } catch {
    return '-';
  }
};

const updateAllEmbeddings = async () => {
  isUpdating.value = true;
  try {
    await updateEmbeddings();
    await fetchAgents();
    selectedIds.value = new Set();
  } catch (e) {
    console.error(e);
  } finally {
    isUpdating.value = false;
  }
};

const updateSelectedEmbeddings = async () => {
  isUpdating.value = true;
  try {
    const ids = Array.from(selectedIds.value);
    if (ids.length === 0) return;
    await updateEmbeddings(ids);
    await fetchAgents();
    selectedIds.value = new Set();
  } catch (e) {
    console.error(e);
  } finally {
    isUpdating.value = false;
  }
};

onMounted(() => {
  fetchAgents();
});
</script>

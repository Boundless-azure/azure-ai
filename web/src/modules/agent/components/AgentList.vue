<template>
  <div class="space-y-6 h-full flex flex-col">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">{{ t('agent.management') }}</h2>
        <p class="text-gray-500 text-sm mt-1">{{ t('dashboard.welcomeSub') }}</p>
      </div>
      <div class="relative w-full md:w-64">
        <input 
          v-model="searchQuery" 
          type="text" 
          :placeholder="t('agent.search')"
          class="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
        >
        <i class="fa-solid fa-search absolute left-3 top-3.5 text-gray-400"></i>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto min-h-0">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <i class="fa-solid fa-spinner fa-spin text-3xl text-gray-400"></i>
      </div>
      
      <div v-else-if="filteredAgents.length === 0" class="flex flex-col items-center justify-center h-64 text-gray-400">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <i class="fa-solid fa-robot text-2xl text-gray-300"></i>
        </div>
        <p>{{ t('agent.search') }} - No results</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div 
          v-for="agent in filteredAgents" 
          :key="agent.id"
          class="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:border-gray-300 transition-all group relative flex flex-col"
        >
          <!-- Agent Card -->
          <div class="flex justify-between items-start mb-4">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center text-white shadow-lg shadow-gray-900/20">
              <i class="fa-solid fa-robot text-2xl"></i>
            </div>
            <div class="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                @click="openEditModal(agent)"
                class="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 transition-colors"
                :title="t('agent.edit')"
              >
                <i class="fa-solid fa-pen text-sm"></i>
              </button>
              <button 
                @click="confirmDelete(agent)"
                class="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 flex items-center justify-center text-red-600 transition-colors"
                :title="t('agent.delete')"
              >
                <i class="fa-solid fa-trash text-sm"></i>
              </button>
            </div>
          </div>

          <div class="mb-4 flex-1">
            <h3 class="text-lg font-bold text-gray-900 mb-2 line-clamp-1" :title="agent.nickname">{{ agent.nickname }}</h3>
            <p class="text-sm text-gray-500 line-clamp-3 leading-relaxed h-[4.5rem]">{{ agent.purpose }}</p>
          </div>

          <div class="flex items-center justify-between pt-4 border-t border-gray-100 text-xs font-medium text-gray-400">
             <span class="flex items-center px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100">
                <i class="fa-solid fa-microchip mr-1.5" :class="agent.is_ai_generated ? 'text-purple-500' : 'text-gray-400'"></i>
                {{ agent.is_ai_generated ? t('agent.aiGenerated') : t('agent.manual') }}
             </span>
             <span>{{ formatDate(agent.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity" @click.self="showModal = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 transform transition-all scale-100">
        <div class="flex items-center justify-between mb-8">
          <h3 class="text-2xl font-bold text-gray-900">{{ t('agent.edit') }}</h3>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-600 transition-colors">
            <i class="fa-solid fa-times text-xl"></i>
          </button>
        </div>
        
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">{{ t('agent.nickname') }}</label>
            <input 
              v-model="editForm.nickname"
              type="text" 
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all font-medium"
            >
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">{{ t('agent.purpose') }}</label>
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
import { agentService } from '../services/agent.service';
import type { Agent, UpdateAgentRequest } from '../types/agent.types';

const { t } = useI18n();
const agents = ref<Agent[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const showModal = ref(false);
const currentAgent = ref<Agent | null>(null);
const editForm = ref<UpdateAgentRequest>({
  nickname: '',
  purpose: ''
});

const filteredAgents = computed(() => {
  if (!searchQuery.value) return agents.value;
  const q = searchQuery.value.toLowerCase();
  return agents.value.filter(a => 
    a.nickname.toLowerCase().includes(q) || 
    a.purpose.toLowerCase().includes(q)
  );
});

const fetchAgents = async () => {
  loading.value = true;
  try {
    agents.value = await agentService.getAgents();
  } catch (error) {
    console.error('Failed to fetch agents:', error);
  } finally {
    loading.value = false;
  }
};

const openEditModal = (agent: Agent) => {
  currentAgent.value = agent;
  editForm.value = {
    nickname: agent.nickname,
    purpose: agent.purpose
  };
  showModal.value = true;
};

const handleSave = async () => {
  if (!currentAgent.value) return;
  try {
    await agentService.updateAgent(currentAgent.value.id, editForm.value);
    await fetchAgents();
    showModal.value = false;
  } catch (error) {
    console.error('Failed to update agent:', error);
  }
};

const confirmDelete = async (agent: Agent) => {
  if (confirm(t('agent.deleteConfirm'))) {
    try {
      await agentService.deleteAgent(agent.id);
      await fetchAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString();
};

onMounted(() => {
  fetchAgents();
});
</script>

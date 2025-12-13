<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div
        class="bg-white shadow-2xl flex flex-col overflow-hidden w-full h-full rounded-none md:w-[90vw] md:h-[85vh] md:rounded-2xl"
      >
        <!-- Header -->
        <div
          class="h-14 md:h-16 border-b border-gray-200 flex items-center justify-between px-4 md:px-6 bg-gray-50 flex-shrink-0"
        >
          <div class="flex items-center space-x-3">
            <div
              class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600"
            >
              <i class="fa-solid fa-comments"></i>
            </div>
            <div>
              <h3 class="text-base md:text-lg font-bold text-gray-800">
                {{ t('session.switchGroup') }}
              </h3>
            </div>
          </div>
          <button
            @click="$emit('close')"
            class="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            <i class="fa-solid fa-times text-lg"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 flex overflow-hidden">
          <!-- Left: Group List -->
          <div
            class="w-full md:w-1/3 border-r border-gray-200 flex flex-col bg-white overflow-y-auto custom-scrollbar"
          >
            <div v-if="loadingGroups" class="flex justify-center py-8">
              <i
                class="fa-solid fa-circle-notch fa-spin text-blue-500 text-xl"
              ></i>
            </div>

            <div
              v-else-if="groups.length === 0"
              class="text-center py-8 text-gray-500"
            >
              {{ t('session.noGroups') }}
            </div>

            <div v-else class="flex flex-col">
              <button
                v-for="group in groups"
                :key="group.id"
                @click="selectGroup(group)"
                class="w-full text-left px-4 py-4 border-b border-gray-100 hover:bg-gray-50 transition-all group relative"
                :class="{
                  'bg-blue-50/50': selectedGroupId === group.id,
                }"
              >
                <div
                  v-if="selectedGroupId === group.id"
                  class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"
                ></div>
                <div class="flex justify-between items-start mb-1">
                  <span
                    class="font-bold text-gray-800 group-hover:text-blue-600 transition-colors truncate pr-2"
                  >
                    {{ group.title || 'Untitled Group' }}
                  </span>
                  <span class="text-xs text-gray-400 whitespace-nowrap">
                    {{ formatDate(group.createdAt) }}
                  </span>
                </div>
                <div class="flex justify-between items-center mt-1">
                  <div class="text-xs text-gray-500 truncate max-w-[70%]">
                    ID: {{ group.id.substring(0, 8) }}...
                  </div>
                  <div v-if="group.active" class="text-xs text-green-600">
                    <i class="fa-solid fa-circle text-[8px] mr-1"></i>Active
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Right: Summaries -->
          <div
            class="hidden md:flex flex-1 flex-col bg-gray-50 overflow-hidden"
          >
            <div
              v-if="!selectedGroupId"
              class="flex-1 flex flex-col items-center justify-center text-gray-400"
            >
              <i class="fa-regular fa-comments text-4xl mb-3"></i>
              <p>{{ t('session.selectGroupHint') }}</p>
            </div>

            <div v-else class="flex-1 flex flex-col overflow-hidden">
              <!-- Summary Header -->
              <div
                class="p-4 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm"
              >
                <h4 class="font-bold text-gray-800">{{ t('session.summary') }}</h4>
                <button
                  @click="confirmSwitch"
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center"
                >
                  <i class="fa-solid fa-arrow-right-to-bracket mr-2"></i>
                  {{ t('common.confirm') }}
                </button>
              </div>

              <!-- Summary Content -->
              <div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div v-if="loadingSummaries" class="flex justify-center py-12">
                  <i
                    class="fa-solid fa-circle-notch fa-spin text-blue-500 text-xl"
                  ></i>
                </div>
                <div
                  v-else-if="summaries.length === 0"
                  class="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100 p-8"
                >
                  <i class="fa-solid fa-align-left text-3xl mb-3 opacity-50"></i>
                  <p>{{ t('session.noSummaries') }}</p>
                </div>
                <div v-else class="space-y-4">
                  <div
                    v-for="(item, index) in summaries"
                    :key="index"
                    class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div
                      class="flex items-center text-xs text-gray-500 mb-2 pb-2 border-b border-gray-100"
                    >
                      <span class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded mr-2 font-medium">
                        Round {{ item.roundNumber }}
                      </span>
                      <span>{{ formatDate(item.createdAt) }}</span>
                    </div>
                    <div
                      class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap"
                    >
                      {{ item.summaryContent }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * @title Session Switch Modal
 * @description Modal for switching between conversation session groups with summary preview.
 * @keywords-cn 会话切换, 会话组, 历史摘要, 左右分栏
 * @keywords-en session-switch, session-group, history-summary, split-view
 */
import { ref, watch, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { agentService } from '../services/agent.service';
import type { GroupListItem, SummaryItem } from '../types/agent.types';

const props = defineProps<{
  visible: boolean;
  currentGroupId?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', group: { id: string; title: string; date: string }): void;
}>();

const { t } = useI18n();
const loadingGroups = ref(false);
const loadingSummaries = ref(false);
const groups = ref<GroupListItem[]>([]);
const summaries = ref<SummaryItem[]>([]);
const selectedGroupId = ref<string>('');

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const loadGroups = async () => {
  loadingGroups.value = true;
  try {
    groups.value = await agentService.getGroupList();
    // Select the first group or current group by default
    if (props.currentGroupId && groups.value.some(g => g.id === props.currentGroupId)) {
      selectGroup(groups.value.find(g => g.id === props.currentGroupId)!);
    }
  } catch (error) {
    console.error('Failed to load groups:', error);
  } finally {
    loadingGroups.value = false;
  }
};

const selectGroup = async (group: GroupListItem) => {
  if (selectedGroupId.value === group.id) return;
  
  selectedGroupId.value = group.id;
  loadingSummaries.value = true;
  summaries.value = []; // Clear previous summaries
  
  try {
    const response = await agentService.getGroupSummaries(group.id);
    summaries.value = response.items;
  } catch (error) {
    console.error('Failed to load summaries:', error);
  } finally {
    loadingSummaries.value = false;
  }
};

const confirmSwitch = () => {
  if (!selectedGroupId.value) return;
  const group = groups.value.find((g) => g.id === selectedGroupId.value);
  if (group) {
    // Extract YYYY-MM-DD from createdAt
    const dateObj = new Date(group.createdAt);
    const dateStr = dateObj.toISOString().split('T')[0];
    
    emit('select', {
      id: group.id,
      title: group.title || 'Untitled',
      date: dateStr,
    });
    emit('close');
  }
};

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      loadGroups();
      selectedGroupId.value = '';
      summaries.value = [];
    }
  },
);

onMounted(() => {
  if (props.visible) {
    loadGroups();
  }
});
</script>

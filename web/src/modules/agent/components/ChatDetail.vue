<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header (Desktop style: simple text) -->
    <div class="px-4 py-3 border-b border-gray-100 flex items-center">
      <button
        @click="$emit('close')"
        class="mr-3 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
      >
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <h3 class="font-bold text-gray-800 flex-1">
        {{ title }}
        <span
          v-if="memberCount > 0"
          class="text-gray-500 font-normal text-sm ml-1"
          >({{ memberCount }})</span
        >
      </h3>
      <!-- Close button handled by parent drawer usually, but we can keep a close emit if needed or just rely on parent -->
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
      <!-- Members Grid -->
      <section>
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider">
            成员
          </h4>
        </div>
        <div class="grid grid-cols-4 gap-3">
          <div
            v-for="member in displayMembers"
            :key="member.principalId"
            class="flex flex-col items-center group cursor-pointer"
          >
            <div
              class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden group-hover:bg-gray-200 transition-colors"
            >
              <img
                v-if="member.avatarUrl"
                :src="member.avatarUrl"
                class="w-full h-full object-cover"
              />
              <i v-else class="fa-solid fa-user text-sm"></i>
            </div>
            <span
              class="text-[10px] text-gray-500 mt-1 truncate w-full text-center group-hover:text-gray-700"
              >{{ member.displayName }}</span
            >
          </div>
          <!-- Add Button (Grid item) -->
          <div
            class="flex flex-col items-center cursor-pointer group"
            @click="
              $emit(
                'addMember',
                members.map((m) => m.principalId),
              )
            "
          >
            <div
              class="w-10 h-10 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 group-hover:border-gray-400 group-hover:bg-gray-50 transition-colors"
            >
              <i class="fa-solid fa-plus text-sm"></i>
            </div>
            <span class="text-[10px] text-gray-400 mt-1">邀请</span>
          </div>
        </div>
      </section>

      <div class="border-t border-gray-100"></div>

      <!-- Settings -->
      <section class="space-y-4">
        <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider">
          设置
        </h4>

        <!-- Group Name -->
        <div
          v-if="type === 'group'"
          class="flex items-center justify-between group"
        >
          <span class="text-sm text-gray-700">群聊名称</span>
          <div
            class="flex items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors"
            @click="editName"
          >
            <span class="text-sm text-gray-600 mr-2 max-w-[120px] truncate">{{
              currentTitle
            }}</span>
            <i
              class="fa-solid fa-pen text-xs text-gray-400 opacity-0 group-hover:opacity-100"
            ></i>
          </div>
        </div>

        <!-- Group Notice -->
        <div v-if="type === 'group'" class="flex items-center justify-between">
          <span class="text-sm text-gray-700">群公告</span>
          <span class="text-sm text-gray-400 cursor-pointer hover:text-gray-600"
            >未设置</span
          >
        </div>

        <!-- Pin Chat -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-700">置顶聊天</span>
          <button
            @click="togglePin"
            :disabled="['assistant', 'system'].includes(type)"
            class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
            :class="[
              isPinnedLocal || ['assistant', 'system'].includes(type)
                ? 'bg-green-500'
                : 'bg-gray-200',
              ['assistant', 'system'].includes(type)
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer',
            ]"
          >
            <span
              class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
              :class="
                isPinnedLocal || ['assistant', 'system'].includes(type)
                  ? 'translate-x-4'
                  : 'translate-x-1'
              "
            />
          </button>
        </div>

        <!-- Background (DM only) -->
        <div
          v-if="type === 'dm'"
          class="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
        >
          <span class="text-sm text-gray-700">设置聊天背景</span>
          <i class="fa-solid fa-chevron-right text-xs text-gray-300"></i>
        </div>
      </section>

      <div class="border-t border-gray-100"></div>

      <!-- Danger Zone -->
      <section class="space-y-2">
        <div
          class="flex items-center text-red-500 cursor-pointer hover:bg-red-50 px-2 py-2 rounded transition-colors"
          @click="clearHistory"
        >
          <i class="fa-regular fa-trash-can mr-2"></i>
          <span class="text-sm">清空聊天记录</span>
        </div>

        <div
          v-if="type === 'group'"
          class="flex items-center text-red-500 cursor-pointer hover:bg-red-50 px-2 py-2 rounded transition-colors"
          @click="deleteThread"
        >
          <i class="fa-solid fa-arrow-right-from-bracket mr-2"></i>
          <span class="text-sm">删除并退出</span>
        </div>
        <div
          v-else
          class="flex items-center text-gray-600 cursor-pointer hover:bg-gray-50 px-2 py-2 rounded transition-colors"
        >
          <i class="fa-solid fa-circle-exclamation mr-2 text-gray-400"></i>
          <span class="text-sm">投诉</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { imApi, type ImMemberInfo } from '../../../api/im';
import { usePanelStore } from '../store/panel.store';
import { useUIStore } from '../store/ui.store';

const props = defineProps<{
  sessionId: string;
  type: string; // 'dm', 'group', 'assistant', etc.
  title: string;
  isPinned: boolean;
  initialMembers?: string[]; // IDs
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'addMember', ids: string[]): void;
  // Search history removed
}>();

const panelStore = usePanelStore();
const uiStore = useUIStore();
const members = ref<ImMemberInfo[]>([]);
const isLoadingMembers = ref(false);
const currentTitle = ref(props.title);
const isPinnedLocal = ref(props.isPinned);

watch(
  () => props.isPinned,
  (val) => {
    isPinnedLocal.value = val;
  },
);

watch(
  () => props.title,
  (val) => {
    currentTitle.value = val;
  },
);

const memberCount = computed(() => members.value.length);
const displayMembers = computed(() => {
  return members.value.slice(0, 12); // Show fewer members on desktop panel
});

const loadMembers = async () => {
  if (!props.sessionId) return;
  isLoadingMembers.value = true;
  try {
    const res = await imApi.getSession(props.sessionId);
    if (res.data && res.data.members) {
      members.value = res.data.members;
    }
  } catch (err) {
    console.error('Failed to load members', err);
  } finally {
    isLoadingMembers.value = false;
  }
};

watch(
  () => panelStore.sessionRefreshTrigger,
  () => {
    loadMembers();
  },
);

const editName = async () => {
  const newName = prompt('请输入新的群聊名称', currentTitle.value);
  if (newName && newName !== currentTitle.value) {
    try {
      await imApi.updateSession(props.sessionId, { name: newName });
      currentTitle.value = newName;
      panelStore.triggerSessionRefresh();
      uiStore.showToast('群聊名称已更新', 'success');
    } catch (e) {
      console.error(e);
      uiStore.showToast('更新失败', 'error');
    }
  }
};

const togglePin = async () => {
  try {
    const newVal = !isPinnedLocal.value;
    await imApi.updateSession(props.sessionId, { isPinned: newVal } as any);
    isPinnedLocal.value = newVal;
    panelStore.triggerSessionRefresh();
  } catch (e) {
    uiStore.showToast('操作失败', 'error');
  }
};

const clearHistory = async () => {
  if (confirm('确定要清空聊天记录吗？')) {
    try {
      uiStore.showToast('聊天记录已清空(本地)', 'success');
      panelStore.triggerSessionRefresh();
    } catch (e) {
      uiStore.showToast('操作失败', 'error');
    }
  }
};

const deleteThread = async () => {
  if (confirm('确定要删除该对话吗？')) {
    try {
      await imApi.deleteSession(props.sessionId);
      panelStore.triggerSessionRefresh();
      emit('close');
      uiStore.showToast('会话已删除', 'success');
    } catch (e) {
      uiStore.showToast('删除失败', 'error');
    }
  }
};

onMounted(() => {
  loadMembers();
});

watch(
  () => props.sessionId,
  () => {
    loadMembers();
    currentTitle.value = props.title;
    isPinnedLocal.value = props.isPinned;
  },
);
</script>

<style scoped>
/* Custom scrollbar adjustments if needed */
</style>

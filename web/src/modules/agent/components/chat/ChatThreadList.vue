<template>
  <div class="h-full" ref="listContainer">
    <div
      v-if="displayThreads.length === 0"
      class="flex flex-col items-center justify-center py-10 space-y-4"
    >
      <div
        class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center"
      >
        <i class="fa-solid fa-comments text-2xl text-gray-300"></i>
      </div>
      <p class="text-sm text-gray-500">
        {{ emptyText }}
      </p>
    </div>
    <div
      v-for="thread in displayThreads"
      :key="thread.id"
      class="relative overflow-hidden border-b border-gray-100 cursor-pointer group select-none touch-pan-y"
      @mousedown="(e) => onDragStart(e, thread)"
      @touchstart="(e) => onDragStart(e, thread)"
      @click="onItemClick(thread)"
    >
      <div class="absolute inset-y-0 right-0 flex">
        <button
          @click.stop="
            $emit('toggle-pin', thread);
            activeId = null;
          "
          :disabled="
            thread.id.startsWith('fixed:') ||
            ['assistant', 'system'].includes(thread.threadType)
          "
          class="w-[70px] h-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex flex-col items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i
            :class="
              thread.isPinned
                ? 'fa-solid fa-thumbtack-slash'
                : 'fa-solid fa-thumbtack rotate-45'
            "
            class="mb-1"
          ></i>
          <span class="text-xs">{{
            thread.isPinned ? t('chat.unpin') : t('chat.pin')
          }}</span>
        </button>
        <button
          @click.stop="
            $emit('delete', thread);
            activeId = null;
          "
          class="w-[70px] h-full bg-red-500 hover:bg-red-600 text-white flex flex-col items-center justify-center transition-colors"
        >
          <i class="fa-solid fa-trash mb-1"></i>
          <span class="text-xs">{{ t('common.delete') }}</span>
        </button>
      </div>
      <div
        class="relative"
        :class="[
          thread.isPinned ? 'bg-gray-50' : 'bg-white',
          'group-hover:bg-gray-50',
        ]"
        :style="{
          transform: `translateX(${getTranslateX(thread)}px)`,
          transition:
            swipingId === thread.id ? 'none' : 'transform 0.3s ease-out',
        }"
      >
        <div class="px-4 py-3 flex items-center space-x-3">
          <div class="flex-shrink-0">
            <ChatContactAvatar :thread="thread" size="sm" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2 min-w-0">
                <span class="text-sm font-semibold text-gray-900 truncate">
                  {{ thread.title || '未命名会话' }}
                </span>
              </div>
              <div class="ml-2 flex items-center space-x-1 flex-shrink-0">
                <span class="text-[11px] text-gray-400">
                  {{ formatTime(thread.updatedAt) }}
                </span>
              </div>
            </div>
            <div class="mt-1 flex items-center min-h-[1.25rem] space-x-2">
              <p class="text-xs text-gray-500 truncate flex-1 min-w-0">
                {{ thread.lastMessage || '' }}
              </p>
              <span
                v-if="thread.unreadCount && thread.unreadCount > 0"
                class="bg-red-500 text-white text-[10px] px-1 rounded-full min-w-[16px] h-[16px] flex items-center justify-center leading-none flex-shrink-0"
              >
                {{ formatUnread(thread.unreadCount) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Session List
 * @description 会话列表滑动操作与最近消息展示组件。
 * @keywords-cn 会话列表, 滑动操作, 最近消息
 * @keywords-en session-list, swipe-actions, last-message
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { SessionListItem } from '../../types/agent.types';
import { useI18n } from '../../composables/useI18n';
import ChatContactAvatar from './ChatContactAvatar.vue';

interface Props {
  emptyText: string;
  threads: SessionListItem[];
  activeId?: string;
  searchQuery?: string;
  onlyAi?: boolean;
  isLoading?: boolean;
  workflowCount?: number;
}

const props = defineProps<Props>();

const activeId = ref<string | null>(null);
const swipingId = ref<string | null>(null);
const swipeOffset = ref(0);
const listContainer = ref<HTMLElement | null>(null);
const startX = ref(0);
const startY = ref(0);
const justSwiped = ref(false);
const movedHorizontally = ref(false);

const emit = defineEmits<{
  (e: 'select', thread: SessionListItem): void;
  (e: 'toggle-pin', thread: SessionListItem): void;
  (e: 'delete', thread: SessionListItem): void;
}>();

function onDragStart(event: MouseEvent | TouchEvent, thread: SessionListItem) {
  const isTouch = 'touches' in event;
  const clientX = isTouch
    ? (event as TouchEvent).touches[0].clientX
    : (event as MouseEvent).clientX;
  const clientY = isTouch
    ? (event as TouchEvent).touches[0].clientY
    : (event as MouseEvent).clientY;

  startX.value = clientX;
  startY.value = clientY;
  swipingId.value = thread.id;
  swipeOffset.value = activeId.value === thread.id ? -140 : 0;
  movedHorizontally.value = false;

  if (isTouch) {
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
    window.addEventListener('touchcancel', onDragEnd);
  } else {
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('mouseleave', onDragEnd);
  }
}

function onDragMove(event: Event) {
  if (!swipingId.value) return;

  const isTouch = 'touches' in event;
  const mouseEvent = event as MouseEvent;
  const touchEvent = event as TouchEvent;

  const clientX = isTouch ? touchEvent.touches[0].clientX : mouseEvent.clientX;
  const clientY = isTouch ? touchEvent.touches[0].clientY : mouseEvent.clientY;

  const deltaX = clientX - startX.value;
  const deltaY = clientY - startY.value;

  // For touch devices, handle scroll conflict
  if (isTouch) {
    // If vertical scrolling dominates, ignore horizontal swipe and let browser scroll
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }
    // If horizontal swipe dominates, prevent browser defaults (scrolling/navigation)
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  let newOffset = (activeId.value === swipingId.value ? -140 : 0) + deltaX;

  // Clamp offset between -140 and 0
  if (newOffset > 0) newOffset = 0;
  if (newOffset < -140) newOffset = -140;

  swipeOffset.value = newOffset;
  if (Math.abs(deltaX) > 5) movedHorizontally.value = true;
}

function onDragEnd(event: Event) {
  // Clean up listeners
  window.removeEventListener('touchmove', onDragMove);
  window.removeEventListener('touchend', onDragEnd);
  window.removeEventListener('touchcancel', onDragEnd);
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  window.removeEventListener('mouseleave', onDragEnd);

  if (!swipingId.value) return;

  const currentSwipingId = swipingId.value;
  const finalOffset = swipeOffset.value;
  swipingId.value = null; // Enable transition

  // Threshold to determine open/close state (e.g., -70px)
  if (finalOffset < -70) {
    activeId.value = currentSwipingId;
  } else {
    // If it was open and we swiped back enough (e.g. > -70), close it
    // Or if it was closed and didn't reach -70, keep it closed (set to null)
    if (activeId.value === currentSwipingId) {
      // It was open, now checking if we should close
      if (finalOffset > -70) {
        activeId.value = null;
      }
    } else {
      // It was closed, keep closed
    }
  }

  // Set justSwiped if there was significant movement to prevent click triggering
  // Compare final position with start position (which depends on initial state)
  const initialOffset = activeId.value === currentSwipingId ? -140 : 0; // Wait, this logic is tricky because activeId might have changed above
  // Better to use delta from start
  // Actually, we can just check if we moved significantly from the *gesture start*
  // But wait, onDragStart sets swipeOffset to initial state.
  // So we can check if finalOffset differs significantly from initial offset at start of drag.
  // We need to know initial state at drag start.
  // Let's just use a simple movement check: if abs(finalOffset - initial) > 5
  // But we didn't store initial offset explicitly other than in swipeOffset value at start.
  // Re-deriving:
  // If we started open, initial was -140. If closed, 0.
  // We can't use activeId here because we just updated it.
  // Let's assume if the offset is non-zero (meaning open) or we just closed it, it's a swipe.
  // Actually, simplest way: if we moved > 5px from startX, it's a swipe.
  // But we need the last known X to compare with startX?
  // We have finalOffset. We know initial offset was 0 or -140.
  // Let's use a flag `isMoved` set in onDragMove?
  // Or just check if finalOffset is significantly different from 0 or -140?

  // Let's implement a simple tracking:
  // We just check if we "snapped" to a state. If we did, we set justSwiped.

  if (movedHorizontally.value) {
    justSwiped.value = true;
    setTimeout(() => {
      justSwiped.value = false;
    }, 300);
  }
}

function getTranslateX(thread: SessionListItem) {
  if (swipingId.value === thread.id) {
    return swipeOffset.value;
  }
  return activeId.value === thread.id ? -140 : 0;
}

function handleClickOutside(event: MouseEvent) {
  if (
    activeId.value &&
    listContainer.value &&
    !listContainer.value.contains(event.target as Node)
  ) {
    activeId.value = null;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

function onItemClick(thread: SessionListItem) {
  if (justSwiped.value) {
    justSwiped.value = false;
    return;
  }

  if (activeId.value === thread.id) {
    activeId.value = null;
    return;
  }

  if (activeId.value !== null) {
    activeId.value = null;
    return;
  }

  emit('select', thread);
}

function formatTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

const { t } = useI18n();

function formatUnread(count?: number) {
  if (!count || count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

const displayThreads = computed<SessionListItem[]>(() => {
  let threads = props.threads;
  const q = (props.searchQuery || '').trim().toLowerCase();
  if (props.onlyAi) threads = threads.filter((t) => t.isAiInvolved);
  if (q) {
    threads = threads.filter((t) => (t.title || '').toLowerCase().includes(q));
  }

  const azureThread = threads.find((t) => t.id === 'azure-ai');
  const systemThread = threads.find((t) => t.id === 'ai-notify');

  const pinned = threads.filter(
    (t) =>
      t.isPinned &&
      t.threadType !== 'assistant' &&
      t.threadType !== 'system' &&
      t.id !== 'azure-ai' &&
      t.id !== 'ai-notify',
  );
  const others = threads.filter(
    (t) =>
      !t.isPinned &&
      t.threadType !== 'assistant' &&
      t.threadType !== 'system' &&
      t.id !== 'azure-ai' &&
      t.id !== 'ai-notify',
  );

  pinned.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  others.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const nowIso = new Date().toISOString();
  const azureTitle = azureThread?.title || t('chat.assistantTitle');
  const systemTitle = systemThread?.title || t('chat.systemNotification');
  const includeAzure = !q || azureTitle.toLowerCase().includes(q);
  const includeSystem =
    !props.onlyAi && (!q || systemTitle.toLowerCase().includes(q));

  const azureItem: SessionListItem = azureThread
    ? { ...azureThread, isPinned: true }
    : {
        id: 'azure-ai',
        title: t('chat.assistantTitle'),
        chatClientId: null,
        threadType: 'assistant',
        isPinned: true,
        isAiInvolved: true,
        lastMessage: t('chat.emptyState'),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

  const systemItem: SessionListItem = systemThread
    ? { ...systemThread, isPinned: true }
    : {
        id: 'ai-notify',
        title: t('chat.systemNotification'),
        chatClientId: null,
        threadType: 'system',
        isPinned: true,
        isAiInvolved: false,
        lastMessage: '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

  const workflowItem: SessionListItem = {
    id: 'fixed:workflow',
    title: t('chat.workflowAssistant'),
    threadType: 'system',
    isPinned: true,
    isAiInvolved: false,
    lastMessage:
      (props.workflowCount || 0) > 0
        ? t('chat.activeWorkflows', { count: props.workflowCount || 0 })
        : t('chat.noActiveWorkflows'),
    createdAt: nowIso,
    updatedAt: nowIso,
    chatClientId: null,
    workflowStatus: (props.workflowCount || 0) > 0 ? 'running' : 'idle',
  };

  const includeWorkflow =
    (props.workflowCount || 0) > 0 &&
    !props.onlyAi &&
    (!q || t('chat.workflowAssistant').toLowerCase().includes(q));

  const result: SessionListItem[] = [];
  if (includeAzure) result.push(azureItem);
  if (includeWorkflow) result.push(workflowItem);
  if (includeSystem) result.push(systemItem);
  result.push(...pinned, ...others);
  return result;
});
</script>

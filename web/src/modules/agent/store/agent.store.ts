import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useAgentStore = defineStore('agent', () => {
  // Helper to get local date string YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // State
  const selectedDate = ref<string>(getLocalDateString());
  const chatClientId = ref<string>('');
  const currentSessionId = ref<string | undefined>(undefined);
  const currentSessionTitle = ref<string>('');

  // Manual Persistence Implementation
  // Ensures state is restored correctly regardless of plugin initialization timing
  const STORAGE_KEY = 'agent';

  // 1. Initialize from localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as {
        selectedDate: string;
        chatClientId: string;
        currentSessionId?: string;
        currentSessionTitle?: string;
        lastVisitedDate?: string;
      };
      const today = getLocalDateString();
      if (parsed.lastVisitedDate && parsed.lastVisitedDate !== today) {
        selectedDate.value = today;
      } else if (parsed.selectedDate) {
        selectedDate.value = parsed.selectedDate;
      }
      if (parsed.chatClientId) {
        chatClientId.value = parsed.chatClientId;
      }
      if (parsed.currentSessionId) {
        currentSessionId.value = parsed.currentSessionId;
      }
      if (parsed.currentSessionTitle) {
        currentSessionTitle.value = parsed.currentSessionTitle;
      }
    }
  } catch (e) {
    console.warn('Failed to restore agent state', e);
  }

  // Ensure chatClientId exists
  if (!chatClientId.value) {
    chatClientId.value = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);
  }

  // 2. Watch for changes and save to localStorage
  watch(
    [selectedDate, chatClientId, currentSessionId, currentSessionTitle],
    () => {
      try {
        // Use simpler format or mimic plugin structure
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            selectedDate: selectedDate.value,
            chatClientId: chatClientId.value,
            currentSessionId: currentSessionId.value,
            currentSessionTitle: currentSessionTitle.value,
            lastVisitedDate: getLocalDateString(),
          }),
        );
      } catch (e) {
        console.warn('Failed to save agent state', e);
      }
    },
  );

  // Actions
  function setSelectedDate(date: string) {
    selectedDate.value = date;
  }

  function setCurrentSession(id: string | undefined, title: string) {
    currentSessionId.value = id;
    currentSessionTitle.value = title;
  }

  return {
    selectedDate,
    chatClientId,
    currentSessionId,
    currentSessionTitle,
    setSelectedDate,
    setCurrentSession,
  };
});

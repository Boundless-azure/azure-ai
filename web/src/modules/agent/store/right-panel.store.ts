import { defineStore } from 'pinia';
import { ref, watch, computed } from 'vue';

export interface RightPanelTab {
  id: string;
  label: string;
  props?: Record<string, any>;
}

export const useRightPanelStore = defineStore('agent_right_panel', () => {
  const STORAGE_KEY = 'agent_tabs_state';
  
  const currentTabId = ref('dashboard');
  const tabs = ref<RightPanelTab[]>([{ id: 'dashboard', label: 'Dashboard' }]);

  // Load from local storage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.tabs && Array.isArray(parsed.tabs)) {
        tabs.value = parsed.tabs;
      }
      if (parsed.currentTabId) {
        currentTabId.value = parsed.currentTabId;
      }
    }
  } catch {}

  // Watch and save
  watch([tabs, currentTabId], () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tabs: tabs.value,
        currentTabId: currentTabId.value
      }));
    } catch {}
  }, { deep: true });

  const currentTab = computed(() => {
    return tabs.value.find(t => t.id === currentTabId.value);
  });

  const currentTabProps = computed(() => {
    return currentTab.value?.props || {};
  });

  const openTab = (id: string, label: string, props?: Record<string, any>) => {
    const existing = tabs.value.find(t => t.id === id);
    if (existing) {
      // Update props if provided
      if (props) {
        existing.props = { ...existing.props, ...props };
      }
      currentTabId.value = id;
    } else {
      tabs.value.push({ id, label, props });
      currentTabId.value = id;
    }
  };

  const closeTab = (id: string) => {
    const index = tabs.value.findIndex(t => t.id === id);
    if (index !== -1) {
      tabs.value.splice(index, 1);
      if (currentTabId.value === id) {
        // Switch to previous or dashboard
        const newIndex = Math.max(0, index - 1);
        currentTabId.value = tabs.value[newIndex]?.id || 'dashboard';
      }
    }
  };

  const closeAllTabs = () => {
    tabs.value = [{ id: 'dashboard', label: 'Dashboard' }];
    currentTabId.value = 'dashboard';
  };

  const setTabProps = (id: string, props: Record<string, any>) => {
    const tab = tabs.value.find(t => t.id === id);
    if (tab) {
      tab.props = { ...tab.props, ...props };
    }
  };

  return {
    tabs,
    currentTabId,
    currentTab,
    currentTabProps,
    openTab,
    closeTab,
    closeAllTabs,
    setTabProps
  };
});

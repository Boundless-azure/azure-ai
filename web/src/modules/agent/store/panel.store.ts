/**
 * @title Agent Panel Store
 * @description 聊天/通讯录面板的UI状态管理与本地持久化。
 * @keywords-cn 面板状态, 本地存储, 选项卡
 * @keywords-en panel-state, local-storage, tabs
 */
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type PanelMode = 'home' | 'chat';
export type PanelTab = 'chat' | 'contacts' | 'daily';

export const usePanelStore = defineStore('agent_panel', () => {
  const STORAGE_KEY = 'agent_panel';

  const mode = ref<PanelMode>('home');
  const activeTab = ref<PanelTab>('chat');
  const onlyAi = ref<boolean>(false);
  const searchQuery = ref<string>('');
  const contactSearchQuery = ref<string>('');
  const expandedCategories = ref<string[]>(['contacts']);

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as {
        mode?: PanelMode;
        activeTab?: PanelTab;
        onlyAi?: boolean;
        searchQuery?: string;
        contactSearchQuery?: string;
        expandedCategories?: string[];
      };
      if (parsed.mode === 'home' || parsed.mode === 'chat') {
        mode.value = parsed.mode;
      }
      if (parsed.activeTab === 'chat' || parsed.activeTab === 'contacts' || parsed.activeTab === 'daily') {
        activeTab.value = parsed.activeTab;
      }
      if (typeof parsed.onlyAi === 'boolean') {
        onlyAi.value = parsed.onlyAi;
      }
      if (typeof parsed.searchQuery === 'string') {
        searchQuery.value = parsed.searchQuery;
      }
      if (typeof parsed.contactSearchQuery === 'string') {
        contactSearchQuery.value = parsed.contactSearchQuery;
      }
      if (Array.isArray(parsed.expandedCategories)) {
        expandedCategories.value = parsed.expandedCategories.filter((x) => typeof x === 'string');
      }
    }
  } catch {}

  watch([mode, activeTab, onlyAi, searchQuery, contactSearchQuery, expandedCategories], () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          mode: mode.value,
          activeTab: activeTab.value,
          onlyAi: onlyAi.value,
          searchQuery: searchQuery.value,
          contactSearchQuery: contactSearchQuery.value,
          expandedCategories: expandedCategories.value,
        }),
      );
    } catch {}
  }, { deep: true });

  const setMode = (m: PanelMode) => { mode.value = m; };
  const setActiveTab = (t: PanelTab) => { activeTab.value = t; };
  const setOnlyAi = (v: boolean) => { onlyAi.value = v; };
  const setSearchQuery = (q: string) => { searchQuery.value = q; };
  const setContactSearchQuery = (q: string) => { contactSearchQuery.value = q; };
  const toggleCategory = (id: string) => {
    if (expandedCategories.value.includes(id)) {
      expandedCategories.value = expandedCategories.value.filter((c) => c !== id);
    } else {
      expandedCategories.value.push(id);
    }
  };

  return {
    mode,
    activeTab,
    onlyAi,
    searchQuery,
    contactSearchQuery,
    expandedCategories,
    setMode,
    setActiveTab,
    setOnlyAi,
    setSearchQuery,
    setContactSearchQuery,
    toggleCategory,
  };
});


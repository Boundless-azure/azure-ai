/**
 * @title Agent Panel Store
 * @description 聊天/通讯录面板的UI状态管理与本地持久化。
 * @keywords-cn 面板状态, 本地存储, 选项卡
 * @keywords-en panel-state, local-storage, tabs
 */
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { imApi } from '../../../api/im';

export type PanelMode = 'home' | 'chat';
export type PanelTab = 'chat' | 'contacts' | 'daily';

export type ContactGroup = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type PanelDrawerType =
  | 'info'
  | 'todos'
  | 'tasks'
  | 'files'
  | 'members'
  | 'profile';

export const usePanelStore = defineStore('agent_panel', () => {
  const STORAGE_KEY = 'agent_panel';
  const CONTACT_GROUP_PREFIX = 'contact-group:';

  const normalizePrincipalId = (id: string): string => {
    const raw = (id || '').trim();
    if (!raw) return '';
    if (raw.startsWith('contact:'))
      return raw.substring('contact:'.length).trim();
    return raw;
  };

  const mode = ref<PanelMode>('home');
  const activeTab = ref<PanelTab>('chat');
  const onlyAi = ref<boolean>(false);
  const searchQuery = ref<string>('');
  const contactSearchQuery = ref<string>('');
  const expandedCategories = ref<string[]>(['contacts']);
  const sessionRefreshTrigger = ref<number>(0);

  const contactGroups = ref<ContactGroup[]>([]);
  const contactGroupMembers = ref<Record<string, string[]>>({});

  const hasSyncedLegacyContactGroups = ref(false);

  const toUiContactGroupId = (rawId: string): string => {
    const v = (rawId || '').trim();
    if (!v) return '';
    if (v.startsWith(CONTACT_GROUP_PREFIX)) return v;
    return `${CONTACT_GROUP_PREFIX}${v}`;
  };

  const toServerContactGroupId = (uiId: string): string => {
    const v = (uiId || '').trim();
    if (!v) return '';
    if (v.startsWith(CONTACT_GROUP_PREFIX))
      return v.substring(CONTACT_GROUP_PREFIX.length).trim();
    return v;
  };

  const drawerVisible = ref<boolean>(false);
  const drawerType = ref<PanelDrawerType>('info');
  const drawerProps = ref<Record<string, unknown>>({});

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
        contactGroups?: ContactGroup[];
        contactGroupMembers?: Record<string, string[]>;
      };
      if (parsed.mode === 'home' || parsed.mode === 'chat') {
        mode.value = parsed.mode;
      }
      if (
        parsed.activeTab === 'chat' ||
        parsed.activeTab === 'contacts' ||
        parsed.activeTab === 'daily'
      ) {
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
        expandedCategories.value = parsed.expandedCategories.filter(
          (x) => typeof x === 'string',
        );
      }

      if (Array.isArray(parsed.contactGroups)) {
        contactGroups.value = parsed.contactGroups
          .filter(
            (x) =>
              typeof x === 'object' &&
              x !== null &&
              typeof (x as { id?: unknown }).id === 'string' &&
              typeof (x as { name?: unknown }).name === 'string',
          )
          .map((x) => {
            const g = x as {
              id: string;
              name: string;
              createdAt?: unknown;
              updatedAt?: unknown;
            };
            return {
              id: g.id,
              name: g.name,
              createdAt:
                typeof g.createdAt === 'string'
                  ? g.createdAt
                  : new Date().toISOString(),
              updatedAt:
                typeof g.updatedAt === 'string'
                  ? g.updatedAt
                  : new Date().toISOString(),
            };
          });
      }
      if (
        parsed.contactGroupMembers &&
        typeof parsed.contactGroupMembers === 'object'
      ) {
        const raw = parsed.contactGroupMembers as Record<string, unknown>;
        const next: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(raw)) {
          if (typeof k !== 'string' || !k.trim()) continue;
          if (!Array.isArray(v)) continue;
          next[k] = v
            .filter((x) => typeof x === 'string')
            .map((x) => normalizePrincipalId(x))
            .filter(Boolean);
        }
        contactGroupMembers.value = next;
      }
    }
  } catch {
    // Ignore storage errors
  }

  watch(
    [
      mode,
      activeTab,
      onlyAi,
      searchQuery,
      contactSearchQuery,
      expandedCategories,
      contactGroups,
      contactGroupMembers,
    ],
    () => {
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
            contactGroups: contactGroups.value,
            contactGroupMembers: contactGroupMembers.value,
          }),
        );
      } catch {
        // Ignore storage errors
      }
    },
    { deep: true },
  );

  const normalizeContactGroupName = (name: string): string => {
    const trimmed = (name || '').trim();
    return trimmed.length > 100 ? trimmed.slice(0, 100) : trimmed;
  };

  const loadContactGroups = async (): Promise<void> => {
    if (!hasSyncedLegacyContactGroups.value) {
      hasSyncedLegacyContactGroups.value = true;
      try {
        const server = await imApi.listContactGroups();
        const serverGroups = Array.isArray(server.data) ? server.data : [];
        const serverByName = new Map(
          serverGroups.map((g) => [(g.name || '').trim().toLowerCase(), g]),
        );

        const legacyGroups = contactGroups.value
          .filter((g) => typeof g?.id === 'string')
          .filter((g) => (g.id || '').trim().startsWith(CONTACT_GROUP_PREFIX));

        for (const lg of legacyGroups) {
          const name = normalizeContactGroupName(lg.name);
          if (!name) continue;
          const key = name.toLowerCase();
          const existing = serverByName.get(key);
          const members = Array.isArray(contactGroupMembers.value[lg.id])
            ? contactGroupMembers.value[lg.id]
            : [];
          const principalIds = members
            .map((x) => (typeof x === 'string' ? normalizePrincipalId(x) : ''))
            .filter(Boolean);
          if (existing) {
            if (principalIds.length > 0) {
              await imApi.addContactGroupMembers(existing.id, { principalIds });
            }
            continue;
          }

          const created = await imApi.createContactGroup({ name });
          serverByName.set(key, created.data);
          if (principalIds.length > 0) {
            await imApi.addContactGroupMembers(created.data.id, {
              principalIds,
            });
          }
        }
      } catch {
        // Ignore legacy sync errors
      }
    }

    const resp = await imApi.listContactGroups();
    const groups = Array.isArray(resp.data) ? resp.data : [];
    const mapped: ContactGroup[] = groups.map((g) => ({
      id: toUiContactGroupId(g.id),
      name: g.name,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));

    contactGroups.value = mapped;

    const tasks = mapped.map(async (g) => {
      const serverId = toServerContactGroupId(g.id);
      if (!serverId) return;
      const m = await imApi.getContactGroupMembers(serverId);
      const ids = Array.isArray(m.data?.items) ? m.data.items : [];
      contactGroupMembers.value = {
        ...contactGroupMembers.value,
        [g.id]: ids.map((x) => normalizePrincipalId(x)).filter(Boolean),
      };
    });
    await Promise.allSettled(tasks);
  };

  const createContactGroup = async (
    name: string,
  ): Promise<ContactGroup | null> => {
    const normalized = normalizeContactGroupName(name);
    if (!normalized) return null;
    const created = await imApi.createContactGroup({ name: normalized });
    const data = created.data;
    const group: ContactGroup = {
      id: toUiContactGroupId(data.id),
      name: data.name,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    contactGroups.value = [...contactGroups.value, group];
    contactGroupMembers.value = {
      ...contactGroupMembers.value,
      [group.id]: contactGroupMembers.value[group.id] || [],
    };

    return group;
  };

  const addContactGroupMembers = async (
    groupId: string,
    principalIds: string[],
  ): Promise<number> => {
    const gid = (groupId || '').trim();
    if (!gid) return 0;
    const incoming = (principalIds || [])
      .map((x) => (typeof x === 'string' ? normalizePrincipalId(x) : ''))
      .filter(Boolean);
    if (incoming.length === 0) return 0;

    const serverGroupId = toServerContactGroupId(gid);
    if (!serverGroupId) return 0;

    const current = Array.isArray(contactGroupMembers.value[gid])
      ? contactGroupMembers.value[gid]
      : [];
    const set = new Set(
      current.map((x) => normalizePrincipalId(x)).filter(Boolean),
    );
    const toAdd: string[] = [];
    for (const id of incoming) {
      if (set.has(id)) continue;
      set.add(id);
      toAdd.push(id);
    }
    if (toAdd.length === 0) return 0;

    const resp = await imApi.addContactGroupMembers(serverGroupId, {
      principalIds: toAdd,
    });
    const addedCount = resp.data?.addedCount ?? toAdd.length;

    contactGroupMembers.value = {
      ...contactGroupMembers.value,
      [gid]: Array.from(set),
    };

    const nowIso = new Date().toISOString();
    contactGroups.value = contactGroups.value.map((g) =>
      g.id === gid ? { ...g, updatedAt: nowIso } : g,
    );

    return addedCount;
  };

  const setMode = (m: PanelMode) => {
    mode.value = m;
  };
  const setActiveTab = (t: PanelTab) => {
    activeTab.value = t;
  };
  const setOnlyAi = (v: boolean) => {
    onlyAi.value = v;
  };
  const setSearchQuery = (q: string) => {
    searchQuery.value = q;
  };
  const setContactSearchQuery = (q: string) => {
    contactSearchQuery.value = q;
  };
  const toggleCategory = (id: string) => {
    if (expandedCategories.value.includes(id)) {
      expandedCategories.value = expandedCategories.value.filter(
        (c) => c !== id,
      );
    } else {
      expandedCategories.value.push(id);
    }
  };

  const triggerSessionRefresh = () => {
    sessionRefreshTrigger.value = Date.now();
  };

  const openDrawer = (
    type: PanelDrawerType,
    props: Record<string, unknown> = {},
  ) => {
    drawerType.value = type;
    drawerProps.value = props;
    drawerVisible.value = true;
  };

  const closeDrawer = () => {
    drawerVisible.value = false;
    // Keep type/props for transition if needed, or clear them
  };

  return {
    mode,
    activeTab,
    onlyAi,
    searchQuery,
    contactSearchQuery,
    expandedCategories,
    sessionRefreshTrigger,
    contactGroups,
    contactGroupMembers,
    drawerVisible,
    drawerType,
    drawerProps,
    setMode,
    setActiveTab,
    setOnlyAi,
    setSearchQuery,
    setContactSearchQuery,
    toggleCategory,
    triggerSessionRefresh,
    loadContactGroups,
    createContactGroup,
    addContactGroupMembers,
    openDrawer,
    closeDrawer,
  };
});

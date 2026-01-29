<template>
  <div class="h-full bg-white border-l border-gray-200 flex flex-col">
    <!-- Tabs Header -->
    <div
      class="flex border-b border-gray-200 px-2 bg-gray-50 overflow-x-auto scrollbar-hide"
    >
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="group relative flex items-center min-w-[120px] max-w-[200px]"
        @contextmenu.prevent="handleContextMenu($event, tab.id)"
      >
        <button
          @click="currentTab = tab.id"
          class="w-full px-4 py-3 text-sm font-medium transition-all flex items-center justify-between border-r border-gray-200 last:border-r-0"
          :class="
            currentTab === tab.id
              ? 'text-gray-900 bg-white border-t-2 border-t-gray-900 font-bold shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-t-2 border-t-transparent'
          "
        >
          <span class="truncate mr-2">{{
            tab.id === 'dashboard'
              ? t('tabs.dashboard')
              : (tabRegistry[tab.id]?.name ?? tab.label)
          }}</span>

          <!-- Close Icon (Not for Dashboard) -->
          <div
            v-if="tab.id !== 'dashboard'"
            @click.stop="closeTab(tab.id)"
            class="w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-200 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
            :class="{ 'opacity-100': currentTab === tab.id }"
          >
            <i class="fa-solid fa-times text-xs"></i>
          </div>
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 overflow-y-auto p-8 bg-gray-50/50">
      <!-- Dashboard Tab -->
      <div
        v-if="currentTab === 'dashboard'"
        class="space-y-8 max-w-6xl mx-auto"
      >
        <!-- Quick Stats -->
        <div
          class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6"
        >
          <div
            v-for="stat in stats"
            :key="stat.labelKey"
            class="p-4 md:p-6 rounded-2xl border border-gray-200 bg-white hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer group"
          >
            <div class="flex justify-between items-start mb-3 md:mb-4">
              <div
                class="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-colors"
                :class="stat.bgClass"
              >
                <i
                  class="fa-solid text-base md:text-lg"
                  :class="`fa-${stat.icon} ${stat.textClass}`"
                ></i>
              </div>
              <span
                class="text-2xl md:text-3xl font-bold text-gray-900 group-hover:scale-110 transition-transform"
                >{{ stat.value }}</span
              >
            </div>
            <span
              class="text-xs text-gray-500 font-bold uppercase tracking-wider"
              >{{ t(stat.labelKey) }}</span
            >
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
          <!-- Left Column: Quick Access & Todos -->
          <div class="col-span-1 xl:col-span-2 space-y-6 md:space-y-8">
            <!-- Quick Access -->
            <section
              class="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm"
            >
              <h3
                class="text-sm font-bold text-gray-900 mb-6 flex items-center uppercase tracking-wide border-b border-gray-100 pb-4"
              >
                <i class="fa-solid fa-bolt text-yellow-500 mr-3"></i
                >{{ t('dashboard.quickAccess') }}
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div
                  v-for="item in resourceItems"
                  :key="item.id"
                  class="p-5 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-all group"
                >
                  <div class="flex flex-col items-center text-center space-y-3">
                    <div
                      class="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-black group-hover:text-white transition-all duration-300 shadow-sm"
                    >
                      <i
                        class="fa-solid text-xl"
                        :class="`fa-${item.icon}`"
                      ></i>
                    </div>
                    <span
                      class="text-sm font-medium text-gray-700 group-hover:text-gray-900"
                      >{{ item.title }}</span
                    >
                  </div>
                </div>
              </div>
            </section>

            <!-- Recent Activity/Todos -->
            <section
              class="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm"
            >
              <h3
                class="text-sm font-bold text-gray-900 mb-6 flex items-center uppercase tracking-wide border-b border-gray-100 pb-4"
              >
                <i class="fa-solid fa-list-check text-blue-500 mr-3"></i
                >{{ t('dashboard.tasksActivity') }}
              </h3>
              <div class="space-y-2">
                <div
                  v-for="(item, idx) in todoItems"
                  :key="item.id"
                  class="flex items-center p-3 md:p-4 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-200 group"
                >
                  <div
                    class="w-6 h-6 rounded-full border-2 border-gray-300 mr-4 cursor-pointer hover:border-black flex items-center justify-center transition-colors"
                  >
                    <div
                      class="w-3 h-3 bg-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    ></div>
                  </div>
                  <span
                    class="text-sm text-gray-700 font-medium flex-1 group-hover:text-gray-900"
                    >{{ item.title }}</span
                  >
                  <span
                    class="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full"
                    >{{ t('dashboard.today') }}</span
                  >
                </div>
              </div>
            </section>
          </div>

          <!-- Right Column: Notifications & Files -->
          <div class="col-span-1 space-y-6 md:space-y-8">
            <!-- Plugin Notifications -->
            <section
              class="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm"
            >
              <h3
                class="text-sm font-bold text-gray-900 mb-6 flex items-center uppercase tracking-wide border-b border-gray-100 pb-4"
              >
                <i class="fa-solid fa-plug text-purple-500 mr-3"></i
                >{{ t('dashboard.pluginNotifications') }}
              </h3>
              <div class="space-y-4">
                <div
                  v-for="item in pluginNotifications"
                  :key="item.id"
                  class="p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-white hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
                >
                  <div class="flex items-start">
                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0 transition-colors"
                      :class="item.iconBg"
                    >
                      <i
                        class="fa-solid text-lg"
                        :class="`fa-${item.icon} ${item.iconColor}`"
                      ></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex justify-between items-center mb-1">
                        <p
                          class="text-xs font-bold text-gray-500 uppercase tracking-wide"
                        >
                          {{ t(item.pluginNameKey) }}
                        </p>
                        <span class="text-[10px] text-gray-400">{{
                          t('dashboard.justNow')
                        }}</span>
                      </div>
                      <p class="text-sm font-bold text-gray-900 mb-1 truncate">
                        {{ t(item.titleKey) }}
                      </p>
                      <p
                        class="text-xs text-gray-500 line-clamp-2 leading-relaxed group-hover:text-gray-700"
                      >
                        {{ t(item.contentKey) }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- System Notifications -->
            <section
              class="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm"
            >
              <h3
                class="text-sm font-bold text-gray-900 mb-6 flex items-center uppercase tracking-wide border-b border-gray-100 pb-4"
              >
                <i class="fa-solid fa-bell text-red-500 mr-3"></i
                >{{ t('dashboard.systemNotifications') }}
              </h3>
              <div class="space-y-4">
                <div
                  v-for="item in notificationItems"
                  :key="item.id"
                  class="p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-white hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
                >
                  <div class="flex items-start">
                    <div
                      class="w-2 h-2 rounded-full bg-red-500 mt-1.5 mr-3 flex-shrink-0 animate-pulse"
                    ></div>
                    <div>
                      <p class="text-sm text-gray-800 font-bold mb-1">
                        {{ item.title }}
                      </p>
                      <p class="text-xs text-gray-400 font-medium">
                        {{ t('dashboard.justNow') }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Recent Files -->
            <section
              class="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm"
            >
              <h3
                class="text-sm font-bold text-gray-900 mb-6 flex items-center uppercase tracking-wide border-b border-gray-100 pb-4"
              >
                <i class="fa-solid fa-file text-gray-500 mr-3"></i
                >{{ t('dashboard.recentFiles') }}
              </h3>
              <div class="space-y-3">
                <div
                  class="flex items-center p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-all border border-transparent hover:border-gray-200 group"
                >
                  <div
                    class="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mr-3 group-hover:bg-red-100 transition-colors"
                  >
                    <i class="fa-solid fa-file-pdf text-red-500 text-lg"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-bold text-gray-700 truncate group-hover:text-gray-900"
                    >
                      Project_Specs.pdf
                    </p>
                    <p class="text-xs text-gray-400">2.4 MB</p>
                  </div>
                </div>
                <div
                  class="flex items-center p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-all border border-transparent hover:border-gray-200 group"
                >
                  <div
                    class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mr-3 group-hover:bg-blue-100 transition-colors"
                  >
                    <i class="fa-solid fa-file-code text-blue-500 text-lg"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-bold text-gray-700 truncate group-hover:text-gray-900"
                    >
                      main.py
                    </p>
                    <p class="text-xs text-gray-400">12 KB</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <!-- 非 Dashboard：动态组件加载 -->
      <div v-else class="h-full overflow-y-auto p-8 bg-gray-50/50">
        <div
          v-if="['users', 'orgs', 'roles', 'perms'].includes(currentTab)"
          class="mb-6"
        >
          <h2 class="text-2xl font-bold text-gray-900">
            {{
              currentTab === 'users'
                ? '用户管理'
                : currentTab === 'orgs'
                  ? '组织管理'
                  : currentTab === 'roles'
                    ? '角色管理'
                    : '权限管理'
            }}
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            {{
              currentTab === 'users'
                ? '管理系统用户、账号及基本信息'
                : currentTab === 'orgs'
                  ? '管理组织架构、部门及成员关系'
                  : currentTab === 'roles'
                    ? '定义角色及分配权限策略'
                    : '浏览及配置系统权限规则'
            }}
          </p>
        </div>

        <component
          :is="currentAsyncComponent"
          v-if="currentAsyncComponent"
          v-bind="currentTabProps"
          @close="closeTab(currentTab)"
          class="max-w-7xl mx-auto h-full"
        />

        <div
          v-else
          class="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl"
        >
          <div
            class="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm"
          >
            <i class="fa-solid fa-layer-group text-3xl text-gray-300"></i>
          </div>
          <h3 class="text-lg font-medium text-gray-500">
            No content for {{ currentTab }}
          </h3>
          <p class="text-sm text-gray-400 mt-2">
            Select an item from the left menu to view details.
          </p>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div
        v-if="showContextMenu"
        class="fixed z-[9999] bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-40 overflow-hidden"
        :style="{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }"
        @click.stop
      >
        <div
          class="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 flex items-center"
          @click="closeTabsLeft"
          :class="{ 'opacity-50 cursor-not-allowed': isLeftDisabled }"
        >
          <i class="fa-solid fa-arrow-left mr-2 text-gray-400"></i>
          {{ t('tabs.closeLeft') }}
        </div>
        <div
          class="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 flex items-center"
          @click="closeTabsRight"
          :class="{ 'opacity-50 cursor-not-allowed': isRightDisabled }"
        >
          <i class="fa-solid fa-arrow-right mr-2 text-gray-400"></i>
          {{ t('tabs.closeRight') }}
        </div>
        <div class="h-[1px] bg-gray-100 my-1"></div>
        <div
          class="px-4 py-2 hover:bg-red-50 cursor-pointer text-sm text-red-600 flex items-center"
          @click="closeAllTabs"
        >
          <i class="fa-solid fa-times-circle mr-2 text-red-500"></i>
          {{ t('tabs.closeAll') }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Right Panel Component
 * @description Professional dashboard with i18n and enhanced UI boundaries.
 * @keywords-cn 右侧面板, 仪表盘, 国际化, 专业界面
 * @keywords-en right-panel, dashboard, i18n, professional-ui
 */
import {
  ref,
  computed,
  onMounted,
  watch,
  defineAsyncComponent,
  onUnmounted,
} from 'vue';
import { storeToRefs } from 'pinia';
import { tabRegistry } from '../config/tab.registry';
import type { QuickItem } from '../types/agent.types';
import { useI18n } from '../composables/useI18n';
import { useAgentQuickItems } from '../hooks/useAgentQuickItems';
import { useRightPanelStore } from '../store/right-panel.store';

const props = defineProps<{
  activeView: string;
}>();

const { t } = useI18n();
const rightPanelStore = useRightPanelStore();
const {
  currentTabId: currentTab,
  tabs,
  currentTabProps,
} = storeToRefs(rightPanelStore);
const {
  openTab,
  closeTab: storeCloseTab,
  closeAllTabs: storeCloseAllTabs,
} = rightPanelStore;

// Tab 注册表：配置集中在 config/tab.registry.ts

const asyncComponents = new Map<
  string,
  ReturnType<typeof defineAsyncComponent>
>();
function ensureComponent(tabId: string) {
  if (tabId === 'dashboard') return;
  if (!asyncComponents.has(tabId)) {
    let reg = tabRegistry[tabId];
    if (!reg && tabId.startsWith('chat-detail-')) {
      reg = tabRegistry['chat-detail'];
    }
    if (reg) {
      asyncComponents.set(
        tabId,
        defineAsyncComponent({
          loader: reg.loader,
          delay: 200,
          timeout: 20000,
        }),
      );
    }
  }
}

const currentAsyncComponent = computed(() => {
  ensureComponent(currentTab.value);
  return asyncComponents.get(currentTab.value) ?? null;
});

// Watch for sidebar changes to update tabs
watch(
  () => props.activeView,
  (newView) => {
    if (newView !== 'chat' && newView !== 'more') {
      const label =
        tabRegistry[newView]?.name ??
        newView.charAt(0).toUpperCase() + newView.slice(1);
      openTab(newView, label);
    }
  },
);

const closeTab = (tabId: string) => {
  storeCloseTab(tabId);
};

const { items: quickItems } = useAgentQuickItems();

const stats = [
  {
    labelKey: 'dashboard.activeAgents',
    value: '3',
    icon: 'robot',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-600',
  },
  {
    labelKey: 'dashboard.tasksPending',
    value: '12',
    icon: 'list-check',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-600',
  },
  {
    labelKey: 'dashboard.workflows',
    value: '8',
    icon: 'diagram-project',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-600',
  },
  {
    labelKey: 'dashboard.errors',
    value: '0',
    icon: 'triangle-exclamation',
    bgClass: 'bg-green-50',
    textClass: 'text-green-600',
  },
];

onMounted(() => {
  // Store handles loading state
});

const resourceItems = computed(() =>
  quickItems.value.filter((i) => i.type === 'resource' || !i.type),
);
const todoItems = computed(() =>
  quickItems.value.filter((i) => i.type === 'todo'),
);
const notificationItems = computed(() =>
  quickItems.value.filter((i) => i.type === 'notification'),
);

const pluginNotifications = [
  {
    id: 'email-1',
    pluginNameKey: 'dashboard.emailPlugin',
    titleKey: 'dashboard.newEmail',
    contentKey: 'dashboard.emailContent',
    icon: 'envelope',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  {
    id: 'taxi-1',
    pluginNameKey: 'dashboard.taxiPlugin',
    titleKey: 'dashboard.taxiArriving',
    contentKey: 'dashboard.taxiContent',
    icon: 'taxi',
    iconBg: 'bg-yellow-50',
    iconColor: 'text-yellow-600',
  },
];

// Context Menu Logic
const showContextMenu = ref(false);
const contextMenuPos = ref({ x: 0, y: 0 });
const contextMenuTabId = ref('');

const isLeftDisabled = computed(() => {
  const index = tabs.value.findIndex((t) => t.id === contextMenuTabId.value);
  // Disabled if first tab or only dashboard is to the left
  return index <= 1 && tabs.value[0].id === 'dashboard';
});

const isRightDisabled = computed(() => {
  const index = tabs.value.findIndex((t) => t.id === contextMenuTabId.value);
  return index === tabs.value.length - 1;
});

const handleContextMenu = (e: MouseEvent, tabId: string) => {
  e.preventDefault();
  contextMenuTabId.value = tabId;
  contextMenuPos.value = { x: e.clientX, y: e.clientY };
  showContextMenu.value = true;
};

const closeContextMenu = () => {
  showContextMenu.value = false;
};

// Close all tabs to the left of target (excluding dashboard)
const closeTabsLeft = () => {
  if (isLeftDisabled.value) {
    closeContextMenu();
    return;
  }

  const targetIndex = tabs.value.findIndex(
    (t) => t.id === contextMenuTabId.value,
  );
  if (targetIndex === -1) return;

  // Filter: Keep dashboard + Keep tabs at or after targetIndex
  tabs.value = tabs.value.filter((t, index) => {
    return t.id === 'dashboard' || index >= targetIndex;
  });

  // If current tab was closed, switch to context menu target
  if (!tabs.value.find((t) => t.id === currentTab.value)) {
    currentTab.value = contextMenuTabId.value;
  }
  closeContextMenu();
};

// Close all tabs to the right of target
const closeTabsRight = () => {
  if (isRightDisabled.value) {
    closeContextMenu();
    return;
  }

  const targetIndex = tabs.value.findIndex(
    (t) => t.id === contextMenuTabId.value,
  );
  if (targetIndex === -1) return;

  // Filter: Keep tabs at or before targetIndex
  tabs.value = tabs.value.filter((t, index) => index <= targetIndex);

  // If current tab was closed (shouldn't happen logic-wise if we click on a tab to close right, but safe to check)
  if (!tabs.value.find((t) => t.id === currentTab.value)) {
    currentTab.value = contextMenuTabId.value;
  }
  closeContextMenu();
};

const closeAllTabs = () => {
  storeCloseAllTabs();
  closeContextMenu();
};

// Global click listener to close menu
onMounted(() => {
  document.addEventListener('click', closeContextMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu);
});
</script>

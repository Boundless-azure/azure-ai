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
          @click="handleTabClick(tab.id)"
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
              : t(`sidebar.${tab.id}`)
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
    <div class="flex-1 overflow-y-auto p-3 md:p-8 bg-gray-50/50">
      <!-- Dashboard Tab -->
      <div
        v-if="currentTab === 'dashboard'"
        class="space-y-4 md:space-y-8 max-w-6xl mx-auto"
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
          <!-- Left Column: Recent Resources & Pending Todos -->
          <div class="col-span-1 xl:col-span-2 space-y-6 md:space-y-8">
            <!-- Recent Resources -->
            <section
              class="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm"
            >
              <h3
                class="text-sm font-bold text-gray-900 mb-6 flex items-center uppercase tracking-wide border-b border-gray-100 pb-4"
              >
                <i class="fa-solid fa-folder-open text-blue-500 mr-3"></i
                >{{ t('dashboard.recentResources') }}
              </h3>
              <!-- 有数据 -->
              <div v-if="recentResources.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                  v-for="item in recentResources"
                  :key="item.id"
                  class="p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-all group"
                >
                  <div class="flex items-start space-x-3">
                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                      :class="item.iconBg"
                    >
                      <i
                        class="fa-solid text-lg"
                        :class="`fa-${item.icon} ${item.iconColor}`"
                      ></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">{{ item.name }}</p>
                      <p class="text-xs text-gray-400 mt-1">{{ item.time }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <!-- 空状态 -->
              <div v-else class="py-12 flex flex-col items-center justify-center text-gray-400">
                <i class="fa-solid fa-folder-open text-4xl mb-3"></i>
                <p class="text-sm">{{ t('dashboard.noRecentResources') }}</p>
              </div>
            </section>

            <!-- Pending Todos -->
            <section
              class="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm"
            >
              <h3
                class="text-sm font-bold text-gray-900 mb-6 flex items-center uppercase tracking-wide border-b border-gray-100 pb-4"
              >
                <i class="fa-solid fa-list-check text-orange-500 mr-3"></i
                >{{ t('dashboard.pendingTodos') }}
              </h3>
              <!-- 有数据 -->
              <div v-if="pendingTodos.length > 0" class="space-y-3">
                <div
                  v-for="item in pendingTodos"
                  :key="item.id"
                  class="flex items-start p-3 md:p-4 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-200 group cursor-pointer"
                  @click="openTodoDetail(item)"
                >
                  <!-- 状态 dot -->
                  <div
                    class="w-5 h-5 rounded-full mt-0.5 mr-3 flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                    :style="{ backgroundColor: item.statusColor || '#6B7280' }"
                  ></div>
                  <div class="flex-1 min-w-0">
                    <!-- 标题 -->
                    <span class="text-sm text-gray-700 font-medium flex-1 group-hover:text-gray-900 block truncate">{{ item.title }}</span>
                    <!-- 简述 -->
                    <span v-if="item.description" class="text-xs text-gray-400 mt-1 block truncate">{{ item.description }}</span>
                    <!-- 跟进人头像 -->
                    <div v-if="item.followerIds && item.followerIds.length > 0" class="flex items-center -space-x-2 mt-2">
                      <div
                        v-for="(followerId, idx) in item.followerIds.slice(0, 3)"
                        :key="followerId"
                        class="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600 overflow-hidden"
                        :title="getFollowerName(followerId)"
                      >
                        <img v-if="getFollowerAvatar(followerId)" :src="getFollowerAvatar(followerId)" class="w-full h-full object-cover" />
                        <span v-else>{{ getFollowerInitials(followerId) }}</span>
                      </div>
                      <span
                        v-if="item.followerIds.length > 3"
                        class="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-500"
                      >
                        +{{ item.followerIds.length - 3 }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <!-- 空状态 -->
              <div v-else class="py-12 flex flex-col items-center justify-center text-gray-400">
                <i class="fa-solid fa-check-circle text-4xl mb-3"></i>
                <p class="text-sm">{{ t('dashboard.noPendingTodos') }}</p>
              </div>
            </section>
          </div>

          <!-- Right Column: Notifications -->
          <div class="col-span-1 space-y-6 md:space-y-8">
            <!-- System Notifications -->
            <section
              class="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm"
            >
              <h3
                class="text-sm font-bold text-gray-900 mb-6 flex items-center uppercase tracking-wide border-b border-gray-100 pb-4"
              >
                <i class="fa-solid fa-bell text-red-500 mr-3"></i
                >{{ t('dashboard.notificationCenter') }}
              </h3>
              <!-- 通知列表 - 固定高度滚动区域 -->
              <div class="space-y-4 max-h-[400px] overflow-y-auto pr-1 scrollbar-hide">
                <template v-if="displayedNotifications.length > 0">
                  <div
                    v-for="item in displayedNotifications"
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
                            formatTimeAgo(item.createdAt)
                          }}</span>
                        </div>
                        <p class="text-sm font-bold text-gray-900 mb-1 truncate">
                          {{ item.titleKey }}
                        </p>
                        <p
                          class="text-xs text-gray-500 line-clamp-2 leading-relaxed group-hover:text-gray-700"
                        >
                          {{ item.contentKey }}
                        </p>
                      </div>
                    </div>
                  </div>
                </template>
                <!-- 空状态 -->
                <div v-else class="py-12 flex flex-col items-center justify-center text-gray-400">
                  <i class="fa-solid fa-bell-slash text-4xl mb-3"></i>
                  <p class="text-sm">{{ t('dashboard.noNotifications') }}</p>
                </div>
              </div>
              <!-- Show More Button -->
              <div v-if="hasMoreNotifications" class="mt-4 pt-4 border-t border-gray-100">
                <button
                  @click="showAllNotifications = !showAllNotifications"
                  class="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  {{ showAllNotifications ? t('dashboard.showLess') : t('dashboard.showMore') }}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      <!-- 非 Dashboard：动态组件加载 -->
      <div v-else class="h-full overflow-y-auto bg-gray-50/50 flex flex-col">
        <component
          :is="currentAsyncComponent"
          v-if="currentAsyncComponent"
          v-bind="currentTabProps"
          @close="closeTab(currentTab)"
          class="flex-1 w-full px-3 pb-3 md:px-8 md:pb-8"
        />

        <div
          v-else
          class="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl m-8"
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

    <!-- Todo Detail Modal -->
    <Teleport to="body">
      <div
        v-if="showTodoModal && selectedTodoDetail"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="closeTodoModal"
      >
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
          <!-- 头部 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span
                class="w-4 h-4 rounded-full flex-shrink-0"
                :style="{ backgroundColor: selectedTodoDetail.statusColor || '#6B7280' }"
              ></span>
              {{ selectedTodoDetail.title }}
            </h3>
            <button
              @click="closeTodoModal"
              class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- 内容 -->
          <div class="p-6 space-y-4">
            <!-- 简述 -->
            <div v-if="selectedTodoDetail.description">
              <label class="block text-sm font-medium text-gray-500 mb-1">描述</label>
              <p class="text-sm text-gray-700">{{ selectedTodoDetail.description }}</p>
            </div>

            <!-- 跟进人 -->
            <div v-if="selectedTodoDetail.followerIds && selectedTodoDetail.followerIds.length > 0">
              <label class="block text-sm font-medium text-gray-500 mb-2">跟进人</label>
              <div class="flex items-center gap-2 flex-wrap">
                <div
                  v-for="followerId in selectedTodoDetail.followerIds"
                  :key="followerId"
                  class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <div
                    class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 overflow-hidden flex-shrink-0"
                  >
                    <img v-if="getFollowerAvatar(followerId)" :src="getFollowerAvatar(followerId)" class="w-full h-full object-cover" />
                    <span v-else>{{ getFollowerInitials(followerId) }}</span>
                  </div>
                  <span class="text-sm text-gray-700">{{ getFollowerName(followerId) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部按钮 -->
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              @click="closeTodoModal"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              @click="goToTodoEdit"
              class="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <i class="fa-solid fa-pen"></i>
              {{ t('todo.edit') }}
            </button>
          </div>
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
import { useI18n } from '../composables/useI18n';
import { useRightPanelStore } from '../store/right-panel.store';
import { usePrincipals } from '../../identity/hooks/usePrincipals';
import { resolveResourceUrl } from '../../../utils/http';
import { agentApi } from '../../../api/agent';
import { runnerApi } from '../../../api/runner';
import { todoApi } from '../../../api/todo';
import { imApi } from '../../../api/im';
import type { ImMessageInfo } from '../../../api/im';

const props = defineProps<{
  activeView: string;
}>();

const emit = defineEmits<{
  (e: 'change', view: string): void;
}>();

const { t } = useI18n();
const rightPanelStore = useRightPanelStore();
const { list: listPrincipals } = usePrincipals();
const principalMap = ref<Record<string, any>>({});
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

/**
 * @description RightPanel tab 点击处理：更新 currentTabId 并向上 emit 同步 sidebar 高亮
 * chat 视图权重最高，处于 chat 时不同步 sidebar
 * @keyword-en tab-click, emit-change, sidebar-sync
 */
const handleTabClick = (tabId: string) => {
  currentTab.value = tabId;
  if (tabId !== props.activeView && props.activeView !== 'chat') {
    emit('change', tabId);
  }
};

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

// ========== Dashboard Real Data ==========

// Stats data
const statsData = ref({
  workflows: 0,
  activeAgents: 0,
  tasksPending: 0,
  runnerCount: 0,
});

const stats = computed(() => [
  {
    labelKey: 'dashboard.workflows',
    value: String(statsData.value.workflows),
    icon: 'diagram-project',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-600',
  },
  {
    labelKey: 'dashboard.activeAgents',
    value: String(statsData.value.activeAgents),
    icon: 'robot',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-600',
  },
  {
    labelKey: 'dashboard.tasksPending',
    value: String(statsData.value.tasksPending),
    icon: 'list-check',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-600',
  },
  {
    labelKey: 'dashboard.runnerCount',
    value: String(statsData.value.runnerCount),
    icon: 'server',
    bgClass: 'bg-green-50',
    textClass: 'text-green-600',
  },
]);

// Recent Resources data
interface RecentResource {
  id: string;
  name: string;
  time: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}

const recentResources = ref<RecentResource[]>([]);

// Pending Todos data
interface PendingTodo {
  id: string;
  title: string;
  description: string;
  followerIds: string[];
  statusColor: string;
}

const pendingTodos = ref<PendingTodo[]>([]);

// System Notifications from ai-notify session
interface SystemNotification {
  id: string;
  pluginNameKey: string;
  titleKey: string;
  contentKey: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  createdAt: string;
}

const systemNotifications = ref<SystemNotification[]>([]);

// Todo Detail Modal State
const showTodoModal = ref(false);
const selectedTodoDetail = ref<PendingTodo | null>(null);

// Fetch Dashboard Data
async function fetchDashboardData() {
  try {
    // Fetch agents count
    const agentsRes = await agentApi.getAgents();
    statsData.value.activeAgents = Array.isArray(agentsRes.data) ? agentsRes.data.length : 0;

    // Fetch runners count
    const runnersRes = await runnerApi.list();
    statsData.value.runnerCount = Array.isArray(runnersRes.data) ? runnersRes.data.length : 0;

    // Fetch principals for avatar resolution
    try {
      const principals = await listPrincipals();
      const pMap: Record<string, any> = {};
      (principals || []).forEach((p: any) => {
        pMap[p.id] = p;
      });
      principalMap.value = pMap;
    } catch (e) {
      console.error('Failed to load principals', e);
    }

    // Fetch pending todos (status not completed)
    const todosRes = await todoApi.list({ status: 'pending' });
    const todos = Array.isArray(todosRes.data) ? todosRes.data : [];
    statsData.value.tasksPending = todos.length;

    // Map todos to pendingTodos
    pendingTodos.value = todos.slice(0, 5).map((todo: any) => ({
      id: todo.id,
      title: todo.title || todo.content || '待办事项',
      description: todo.description || todo.content || '',
      followerIds: todo.followerIds || [],
      statusColor: todo.statusColor || '#6B7280',
    }));

    // Fetch recent resources from storage (latest 6)
    try {
      const storageRes = await fetch('/api/storage/nodes?limit=20', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      if (storageRes.ok) {
        const storageData = await storageRes.json();
        const items = storageData.data?.data || storageData.data?.items || storageData.data || [];
        // Sort by createdAt descending and take latest 6
        const sortedItems = [...items].sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        }).slice(0, 6);

        recentResources.value = sortedItems.map((item: any) => {
          const iconMap: Record<string, { icon: string; iconBg: string; iconColor: string }> = {
            'application/pdf': { icon: 'file-pdf', iconBg: 'bg-red-50', iconColor: 'text-red-500' },
            'application/zip': { icon: 'file-zip', iconBg: 'bg-yellow-50', iconColor: 'text-yellow-600' },
            'image/': { icon: 'image', iconBg: 'bg-purple-50', iconColor: 'text-purple-500' },
          };
          const mimeType = item.mimeType || '';
          let iconInfo = { icon: 'file', iconBg: 'bg-gray-50', iconColor: 'text-gray-500' };
          for (const [key, val] of Object.entries(iconMap)) {
            if (mimeType.includes(key)) {
              iconInfo = val;
              break;
            }
          }
          return {
            id: item.id,
            name: item.name || '未命名文件',
            time: formatTimeAgo(item.createdAt),
            ...iconInfo,
          };
        });
      }
    } catch {
      // Storage API might not exist or return error, use empty array
      recentResources.value = [];
    }
  } catch (err) {
    console.error('Failed to fetch dashboard data:', err);
  }
}

// Fetch System Notifications from ai-notify session
async function fetchSystemNotifications() {
  try {
    // First ensure the ai-notify session exists
    const sessionsRes = await imApi.getSessions({ limit: 100 });
    const sessions = sessionsRes.data?.items || [];
    const aiNotifySession = sessions.find((s: any) => s.sessionId === 'ai-notify' || s.name === '系统通知');

    if (!aiNotifySession) {
      systemNotifications.value = [];
      return;
    }

    // Get messages from the ai-notify session
    const messagesRes = await imApi.getMessages(aiNotifySession.sessionId, { limit: 20 });
    const messages: ImMessageInfo[] = messagesRes.data?.items || [];

    // Filter system messages and map to notifications
    systemNotifications.value = messages
      .filter((msg) => msg.messageType === 'system')
      .slice(0, 10)
      .map((msg) => ({
        id: msg.id,
        pluginNameKey: 'dashboard.systemNotification',
        titleKey: 'dashboard.systemMessage',
        contentKey: msg.content,
        icon: 'bell',
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-500',
        createdAt: msg.createdAt,
      }));
  } catch (err) {
    console.error('Failed to fetch system notifications:', err);
    systemNotifications.value = [];
  }
}

// Format time ago
function formatTimeAgo(isoDate: string | undefined): string {
  if (!isoDate) return '-';
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

// Follower avatar helpers
const getFollowerName = (id: string) => {
  if (!id) return '';
  const p = principalMap.value[id];
  return p ? (p.displayName || p.name || id) : id;
};

const getFollowerAvatar = (id: string) => {
  const p = principalMap.value[id];
  return p?.avatarUrl ? resolveResourceUrl(p.avatarUrl) : '';
};

const getFollowerInitials = (id: string) => {
  const name = getFollowerName(id);
  if (!name) return '?';
  if (name.startsWith('user-') || name.startsWith('agent-')) {
    return name.split('-').pop()?.slice(0, 2).toUpperCase() || '?';
  }
  return name.slice(0, 2).toUpperCase();
};

// Todo Detail Modal Functions
const openTodoDetail = (todo: PendingTodo) => {
  selectedTodoDetail.value = todo;
  showTodoModal.value = true;
};

const closeTodoModal = () => {
  showTodoModal.value = false;
  selectedTodoDetail.value = null;
};

const goToTodoEdit = () => {
  if (selectedTodoDetail.value) {
    const todoId = selectedTodoDetail.value.id;
    closeTodoModal();

    // If already on todos tab, just update the props
    if (currentTab.value === 'todos') {
      rightPanelStore.setTabProps('todos', { selectedTodoId: todoId });
    } else {
      // Otherwise emit to switch tabs
      emit('change', 'todos');
      // Also directly set the props on the tab after emit
      setTimeout(() => {
        rightPanelStore.setTabProps('todos', { selectedTodoId: todoId });
      }, 0);
    }
  }
};

// Notifications - Show More/Less Logic
const showAllNotifications = ref(false);
const MAX_VISIBLE_NOTIFICATIONS = 6;

const displayedNotifications = computed(() => {
  if (showAllNotifications.value) {
    return systemNotifications.value;
  }
  return systemNotifications.value.slice(0, MAX_VISIBLE_NOTIFICATIONS);
});

const hasMoreNotifications = computed(() => {
  return systemNotifications.value.length > MAX_VISIBLE_NOTIFICATIONS;
});

onMounted(async () => {
  await Promise.all([fetchDashboardData(), fetchSystemNotifications()]);
});

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

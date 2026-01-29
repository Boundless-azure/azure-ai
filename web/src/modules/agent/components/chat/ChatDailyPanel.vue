<template>
  <div class="flex-1 overflow-y-auto custom-scrollbar bg-white relative">
    <!-- Loading State -->
    <div
      v-if="loadingDaily"
      class="flex flex-col items-center justify-center py-10"
    >
      <div
        class="w-8 h-8 border-4 border-green-100 border-t-green-500 rounded-full animate-spin"
      ></div>
      <span class="text-xs text-gray-400 mt-2">加载中...</span>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="dailyReports.length === 0"
      class="flex flex-col items-center justify-center py-10 space-y-4"
    >
      <div
        class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center"
      >
        <i class="fa-solid fa-calendar-xmark text-2xl text-gray-300"></i>
      </div>
      <p class="text-sm text-gray-500">暂无日报记录</p>
    </div>

    <!-- Timeline List -->
    <div v-else class="px-4 py-4 space-y-8">
      <div
        v-for="report in dailyReports"
        :key="report.group.id"
        class="flex flex-col w-full"
      >
        <!-- Date Header (Above Card) -->
        <div class="flex items-center mb-3 px-1">
          <div class="w-2.5 h-2.5 rounded-full bg-green-500 mr-3"></div>
          <span class="text-lg font-bold text-gray-800 mr-2">
            {{ formatDateSimple(report.group.createdAt) }}
          </span>
          <span class="text-sm text-gray-400 font-medium">
            {{ getWeekDay(report.group.createdAt) }}
          </span>
        </div>

        <!-- Report Content Card -->
        <div
          class="space-y-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
        >
          <!-- Chat Summary -->
          <div class="space-y-2">
            <h4
              class="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center"
            >
              <i class="fa-solid fa-comment-dots mr-2"></i>
              {{ t('modal.chatSummary') || '对话摘要' }}
            </h4>
            <div
              class="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-600 leading-relaxed"
            >
              {{ report.report.summary || '暂无对话记录' }}
            </div>
          </div>

          <!-- Pending Tasks -->
          <div class="space-y-2">
            <h4
              class="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center"
            >
              <i class="fa-solid fa-list-check mr-2"></i>
              {{ t('modal.pendingTasks') || '待办事项' }}
            </h4>
            <div class="space-y-2">
              <div
                v-if="report.report.todos.length === 0"
                class="text-sm text-gray-400 italic pl-4"
              >
                暂无待办
              </div>
              <div
                v-for="todo in report.report.todos"
                :key="todo.id"
                class="flex items-center bg-white border border-gray-100 p-3 rounded-lg shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                @click="toggleTodoStatus(todo)"
              >
                <!-- Checkbox visualization matching DatePickerModal style -->
                <div
                  class="w-4 h-4 rounded border-2 mr-3 flex items-center justify-center transition-colors"
                  :class="
                    todo.completed
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300'
                  "
                >
                  <i
                    v-if="todo.completed"
                    class="fa-solid fa-check text-white text-[10px]"
                  ></i>
                </div>
                <span
                  class="text-sm text-gray-700"
                  :class="{
                    'line-through text-gray-400': todo.completed,
                  }"
                >
                  {{ todo.title }}
                </span>
              </div>
            </div>
          </div>

          <!-- Plugin Activity -->
          <div class="space-y-2">
            <h4
              class="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center"
            >
              <i class="fa-solid fa-plug mr-2"></i>
              {{ t('modal.pluginActivity') || '插件活动' }}
            </h4>
            <div class="space-y-2">
              <div
                v-if="report.report.plugins.length === 0"
                class="text-sm text-gray-400 italic pl-4"
              >
                暂无活动
              </div>
              <div
                v-for="plugin in report.report.plugins"
                :key="plugin.id"
                class="flex items-center justify-between bg-white border border-gray-100 p-3 rounded-lg hover:shadow-sm transition-shadow"
              >
                <div class="flex items-center">
                  <div
                    class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mr-3 text-blue-500"
                  >
                    <i class="fa-solid" :class="`fa-${plugin.icon}`"></i>
                  </div>
                  <span class="text-sm font-medium text-gray-700">
                    {{ plugin.name }}
                  </span>
                </div>
                <span
                  class="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-500"
                >
                  {{ plugin.count }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Daily Panel
 * @description 会话日报时间线视图，展示摘要、待办与插件活动。
 * @keywords-cn 日报面板, 会话摘要, 待办列表
 * @keywords-en daily-panel, chat-summary, todo-list
 */
import { computed, onMounted, reactive, watch } from 'vue';
import { useImStore } from '../../../im/im.module';
import type {
  GroupListItem,
  DailyTodo,
  DailyReportContent,
} from '../../types/agent.types';
import { useI18n } from '../../composables/useI18n';

interface Props {
  active: boolean;
}

interface DailyReportGroup {
  group: GroupListItem;
  report: DailyReportContent;
}

const props = defineProps<Props>();

const { t } = useI18n();
const imStore = useImStore();

const state = reactive({
  dailyReports: [] as DailyReportGroup[],
  loadingDaily: false,
});

const dailyReports = computed(() => state.dailyReports);
const loadingDaily = computed(() => state.loadingDaily);

const loadDailyReports = async () => {
  if (state.loadingDaily) return;
  state.loadingDaily = true;
  try {
    await imStore.loadSessionsInitial(100);
    const sessions = imStore.sessions || [];

    const reports: DailyReportGroup[] = sessions.map((s) => ({
      group: {
        id: s.sessionId,
        dayGroupId: s.sessionId,
        title: s.name || null,
        chatClientId: null,
        active: true,
        createdAt: s.createdAt,
        updatedAt: s.lastMessageAt || s.createdAt,
      },
      report: {
        summary: s.lastMessagePreview || '',
        todos: [],
        plugins: [],
      },
    }));

    reports.sort(
      (a, b) =>
        new Date(b.group.createdAt).getTime() -
        new Date(a.group.createdAt).getTime(),
    );
    state.dailyReports = reports;
  } catch (e) {
    console.error('Failed to load daily reports', e);
  } finally {
    state.loadingDaily = false;
  }
};

const toggleTodoStatus = (todo: DailyTodo) => {
  const current = Boolean(todo.completed);
  todo.completed = !current;
};

const formatDateSimple = (s: string) => {
  const d = new Date(s);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}月${day}日`;
};

const getWeekDay = (s: string) => {
  const d = new Date(s);
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[d.getDay()];
};

onMounted(() => {
  if (props.active) {
    void loadDailyReports();
  }
});

watch(
  () => props.active,
  (val) => {
    if (val && dailyReports.value.length === 0 && !loadingDaily.value) {
      void loadDailyReports();
    }
  },
);
</script>

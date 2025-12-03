<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" @click.self="$emit('close')">
      <div class="bg-white rounded-2xl border border-gray-200 shadow-2xl w-[800px] h-[500px] flex overflow-hidden animate-fade-in-up">
        
        <!-- Left: Calendar -->
        <div class="w-1/2 bg-gray-50 border-r border-gray-200 p-6 flex flex-col">
          <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <i class="fa-solid fa-calendar-days text-blue-500 mr-2"></i>
            {{ t('modal.selectDate') }}
          </h3>
          
          <div class="flex-1">
            <!-- Simple Custom Calendar Implementation -->
            <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div class="flex justify-between items-center mb-4">
                <button @click="changeMonth(-1)" class="p-1 hover:bg-gray-100 rounded-full"><i class="fa-solid fa-chevron-left text-xs"></i></button>
                <span class="font-bold text-gray-700">{{ currentYear }} / {{ currentMonth + 1 }}</span>
                <button @click="changeMonth(1)" class="p-1 hover:bg-gray-100 rounded-full"><i class="fa-solid fa-chevron-right text-xs"></i></button>
              </div>
              
              <div class="grid grid-cols-7 gap-1 text-center mb-2">
                <span v-for="day in weekDays" :key="day" class="text-xs font-medium text-gray-400">{{ day }}</span>
              </div>
              
              <div class="grid grid-cols-7 gap-1">
                <div 
                  v-for="(date, index) in calendarDays" 
                  :key="index"
                  class="aspect-square flex items-center justify-center rounded-lg text-sm cursor-pointer transition-all relative group"
                  :class="{
                    'text-gray-300': !date.isCurrentMonth,
                    'font-bold text-gray-900 hover:bg-gray-100': date.isCurrentMonth && !isSelected(date),
                    'bg-black text-white shadow-md': isSelected(date),
                    'ring-1 ring-blue-200 bg-blue-50': isToday(date) && !isSelected(date)
                  }"
                  @click="selectDate(date)"
                >
                  {{ date.day }}
                  <div v-if="hasData(date)" class="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Preview & Details -->
        <div class="w-1/2 bg-white p-6 flex flex-col overflow-y-auto relative">
          <div class="flex justify-between items-center mb-6">
             <h3 class="text-lg font-bold text-gray-900">{{ formatDate(selectedDate) }}</h3>
             <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-times"></i></button>
          </div>

          <!-- Future Date State -->
          <div v-if="isFutureDate" class="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-fade-in-up">
             <div class="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4 relative overflow-hidden">
               <div class="absolute inset-0 bg-blue-200/30 animate-ping rounded-full"></div>
               <i class="fa-solid fa-rocket text-4xl text-blue-500 relative z-10"></i>
             </div>
             <div class="space-y-2">
               <h3 class="text-2xl font-bold text-gray-900">{{ t('modal.futureIsComing') }}</h3>
               <p class="text-gray-500 max-w-xs mx-auto">{{ t('modal.exploreFuture') }}</p>
             </div>
          </div>

          <!-- Historical Data State -->
          <div v-else class="space-y-6 animate-fade-in-up">
            <!-- Chat Summary -->
            <div class="space-y-2">
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
                <i class="fa-solid fa-comment-dots mr-2"></i>{{ t('modal.chatSummary') }}
              </h4>
              <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-600 leading-relaxed">
                {{ mockData.summary || 'No conversation history for this date.' }}
              </div>
            </div>

            <!-- Pending Tasks -->
            <div class="space-y-2">
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
                <i class="fa-solid fa-list-check mr-2"></i>{{ t('modal.pendingTasks') }}
              </h4>
              <div class="space-y-2">
                <div v-if="mockData.todos.length === 0" class="text-sm text-gray-400 italic pl-4">No tasks</div>
                <div 
                  v-for="todo in mockData.todos" 
                  :key="todo.id"
                  class="flex items-center bg-white border border-gray-100 p-3 rounded-lg shadow-sm"
                >
                  <div class="w-4 h-4 rounded border-2 border-gray-300 mr-3"></div>
                  <span class="text-sm text-gray-700">{{ todo.title }}</span>
                </div>
              </div>
            </div>

            <!-- Plugin Activity -->
            <div class="space-y-2">
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
                <i class="fa-solid fa-plug mr-2"></i>{{ t('modal.pluginActivity') }}
              </h4>
              <div class="space-y-2">
                <div v-if="mockData.plugins.length === 0" class="text-sm text-gray-400 italic pl-4">No activity</div>
                <div 
                  v-for="plugin in mockData.plugins" 
                  :key="plugin.id"
                  class="flex items-center justify-between bg-blue-50 border border-blue-100 p-3 rounded-lg"
                >
                  <div class="flex items-center">
                    <i class="fa-solid mr-2 text-blue-500" :class="`fa-${plugin.icon}`"></i>
                    <span class="text-sm font-medium text-blue-900">{{ plugin.name }}</span>
                  </div>
                  <span class="text-xs text-blue-400">{{ plugin.count }} actions</span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-auto pt-6" v-if="!isFutureDate">
            <button 
              class="w-full py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg flex items-center justify-center group"
              @click="confirmDate"
            >
              {{ t('modal.confirm') }}
              <i class="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * @title Date Picker Modal
 * @description Dual-pane modal for selecting history dates with preview summaries.
 * @keywords-cn 日期选择, 历史回顾, 摘要预览
 * @keywords-en date-picker, history-review, summary-preview
 */
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const props = defineProps<{
  currentDate: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', date: string): void;
}>();

const { t } = useI18n();
const today = new Date();
const selectedDate = ref(new Date());
const displayDate = ref(new Date());

const isFutureDate = computed(() => {
  const selected = new Date(selectedDate.value);
  selected.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return selected > now;
});

const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const currentYear = computed(() => displayDate.value.getFullYear());
const currentMonth = computed(() => displayDate.value.getMonth());

interface CalendarDay {
  day: number;
  date: Date;
  isCurrentMonth: boolean;
}

// Mock Data Generator
const getMockData = (date: Date) => {
  const day = date.getDate();
  // Simple deterministic mock data based on day
  if (day % 2 === 0) {
    return {
      summary: "Discussed project architecture and defined core modules. User requested changes to the dashboard layout and sidebar navigation.",
      todos: [
        { id: 1, title: "Review PR #42" },
        { id: 2, title: "Update documentation" }
      ],
      plugins: [
        { id: 1, name: "Email", icon: "envelope", count: 3 },
        { id: 2, name: "Jira", icon: "jira", count: 1 }
      ]
    };
  } else {
    return {
      summary: "Analyzed system performance logs. Identified bottlenecks in the data processing pipeline.",
      todos: [
        { id: 3, title: "Optimize SQL queries" }
      ],
      plugins: [
        { id: 3, name: "GitHub", icon: "github", count: 5 }
      ]
    };
  }
};

const mockData = computed(() => getMockData(selectedDate.value));

const calendarDays = computed(() => {
  const year = displayDate.value.getFullYear();
  const month = displayDate.value.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const days: CalendarDay[] = [];
  
  // Previous month padding
  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ day: d.getDate(), date: d, isCurrentMonth: false });
  }
  
  // Current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push({ day: i, date: d, isCurrentMonth: true });
  }
  
  // Next month padding
  const endPadding = 42 - days.length;
  for (let i = 1; i <= endPadding; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ day: d.getDate(), date: d, isCurrentMonth: false });
  }
  
  return days;
});

const changeMonth = (delta: number) => {
  displayDate.value = new Date(displayDate.value.getFullYear(), displayDate.value.getMonth() + delta, 1);
};

const isSelected = (date: CalendarDay) => {
  return date.date.toDateString() === selectedDate.value.toDateString();
};

const isToday = (date: CalendarDay) => {
  return date.date.toDateString() === today.toDateString();
};

const hasData = (date: CalendarDay) => {
  return date.day % 3 !== 0; // Mock logic for dots
};

const selectDate = (date: CalendarDay) => {
  selectedDate.value = date.date;
  if (!date.isCurrentMonth) {
    displayDate.value = new Date(date.date.getFullYear(), date.date.getMonth(), 1);
  }
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const confirmDate = () => {
  emit('confirm', selectedDate.value.toISOString().split('T')[0]);
};
</script>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

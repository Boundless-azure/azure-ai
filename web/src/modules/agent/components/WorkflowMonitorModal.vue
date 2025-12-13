<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      @click.self="close"
    >
    <div
      class="bg-white shadow-2xl flex flex-col overflow-hidden animate-scale-in w-full h-full rounded-none md:w-[90vw] md:h-[85vh] md:rounded-2xl"
    >
      <!-- Header -->
      <div
        class="h-14 md:h-16 border-b border-gray-200 flex items-center justify-between px-4 md:px-6 bg-gray-50 flex-shrink-0"
      >
        <div class="flex items-center space-x-3">
          <div
            class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600"
          >
            <i class="fa-solid fa-diagram-project"></i>
          </div>
          <div>
            <h2 class="text-base md:text-lg font-bold text-gray-800">
              {{ t('monitor.title') }}
            </h2>
            <p class="text-[10px] md:text-xs text-gray-500">
              {{ t('monitor.subtitle') }}
            </p>
          </div>
        </div>
        <button
          @click="close"
          class="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
        >
          <i class="fa-solid fa-times text-lg"></i>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
        <!-- Sidebar: Workflow List -->
        <div class="w-full md:w-72 h-auto md:h-full border-b md:border-b-0 md:border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
          <div class="p-3 md:p-4 border-b border-gray-100 hidden md:block">
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Active Workflows
            </h3>
            <div class="relative">
              <i class="fa-solid fa-calendar absolute left-3 top-2.5 text-gray-400 text-xs"></i>
              <input
                type="text"
                :value="selectedDate"
                readonly
                class="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-gray-600 cursor-default"
              />
            </div>
          </div>
          
          <div class="flex-1 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto custom-scrollbar p-2 md:p-3 flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-2">
            <div
              v-for="wf in workflows"
              :key="wf.id"
              @click="selectWorkflow(wf.id)"
              class="p-2 md:p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm min-w-[160px] md:min-w-0 flex-shrink-0"
              :class="
                selectedWorkflowId === wf.id
                  ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100'
                  : 'bg-white border-gray-100 hover:border-blue-200'
              "
            >
              <div class="flex justify-between items-start mb-1 md:mb-2">
                <span
                  class="font-bold text-xs md:text-sm truncate mr-2"
                  :class="selectedWorkflowId === wf.id ? 'text-blue-700' : 'text-gray-700'"
                >
                  {{ wf.name }}
                </span>
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                  :class="{
                    'bg-blue-100 text-blue-700': wf.status === WorkflowGraphStatus.Running,
                    'bg-gray-100 text-gray-600': wf.status === WorkflowGraphStatus.Pending,
                    'bg-green-100 text-green-700': wf.status === WorkflowGraphStatus.Completed,
                    'bg-red-100 text-red-700': wf.status === WorkflowGraphStatus.Error,
                  }"
                >
                  {{ wf.status }}
                </span>
              </div>
              <div class="flex items-center text-xs text-gray-500">
                <i class="fa-solid fa-code-branch mr-1.5 text-[10px]"></i>
                <span class="truncate">{{ wf.nodes.length }} nodes</span>
                <span class="mx-2 text-gray-300">|</span>
                <i class="fa-regular fa-clock mr-1.5 text-[10px]"></i>
                <span class="truncate max-w-[80px] md:max-w-none">{{ wf.currentStep || 'Initialized' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Area: Diagram -->
        <div class="flex-1 bg-gray-50 relative overflow-hidden flex flex-col h-full">
           <!-- Toolbar (Zoom/Fit - Mock UI) -->
           <div class="absolute top-4 right-4 z-10 flex space-x-2">
              <button 
                @click="diagramRef?.fitView()"
                class="bg-white p-2 rounded shadow text-gray-500 hover:text-blue-600 text-xs active:bg-gray-100"
                title="Fit to Screen"
              >
                 <i class="fa-solid fa-compress"></i>
              </button>
              <button
                @click="diagramRef?.zoomIn()"
                class="bg-white p-2 rounded shadow text-gray-500 hover:text-blue-600 text-xs active:bg-gray-100"
                title="Zoom In"
              >
                 <i class="fa-solid fa-plus"></i>
              </button>
              <button
                @click="diagramRef?.zoomOut()"
                class="bg-white p-2 rounded shadow text-gray-500 hover:text-blue-600 text-xs active:bg-gray-100"
                title="Zoom Out"
              >
                 <i class="fa-solid fa-minus"></i>
              </button>
           </div>

           <WorkflowDiagram
             v-if="currentWorkflow"
             ref="diagramRef"
             :graph="currentWorkflow"
             class="flex-1"
           />
           
           <div v-else class="flex-1 flex items-center justify-center text-gray-400">
              Select a workflow to view details
           </div>
        </div>
      </div>
    </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * @title Workflow Monitor Modal
 * @description Modal interface for monitoring multiple agent workflows with visual diagrams.
 * @keywords-cn 工作流监控, 弹窗, 流程切换, 实时状态
 * @keywords-en workflow-monitor, modal, workflow-switching, real-time-status
 */
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useAgentStore } from '../store/agent.store';
import { useI18n } from '../composables/useI18n';
import type { WorkflowGraph } from '../types/agent.types';
import {
  WorkflowGraphStatus,
  WorkflowNodeStatus,
  WorkflowEdgeStatus,
  WorkflowNodeType,
} from '../enums/agent.enums';
import WorkflowDiagram from './WorkflowDiagram.vue';

const props = defineProps<{
  visible: boolean;
  initialWorkflowId?: string;
}>();

const emit = defineEmits(['close']);
const { t } = useI18n();
const store = useAgentStore();
const { selectedDate } = storeToRefs(store);

const diagramRef = ref<InstanceType<typeof WorkflowDiagram> | null>(null);

const close = () => {
  emit('close');
};

const selectedWorkflowId = ref<string | null>(null);

// Mock Data
const workflows = ref<WorkflowGraph[]>([
  {
    id: '1',
    name: '工作流A: 数据分析',
    status: WorkflowGraphStatus.Running,
    currentStep: 'Process Data',
    nodes: [
      { id: 'n1', label: 'Start', type: WorkflowNodeType.Start, status: WorkflowNodeStatus.Completed, x: 400, y: 50 },
      { id: 'n2', label: 'Fetch Data', type: WorkflowNodeType.Process, status: WorkflowNodeStatus.Completed, x: 400, y: 150 },
      { id: 'n3', label: 'Process Data', type: WorkflowNodeType.Process, status: WorkflowNodeStatus.Running, x: 400, y: 280 },
      { id: 'n4', label: 'Save Report', type: WorkflowNodeType.End, status: WorkflowNodeStatus.Pending, x: 400, y: 400 },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', status: WorkflowEdgeStatus.Success },
      { id: 'e2', source: 'n2', target: 'n3', status: WorkflowEdgeStatus.Active },
      { id: 'e3', source: 'n3', target: 'n4', status: WorkflowEdgeStatus.Default },
    ]
  },
  {
    id: '2',
    name: '工作流B: 邮件自动回复',
    status: WorkflowGraphStatus.Running,
    currentStep: 'Generate Reply',
    nodes: [
      { id: 'n1', label: 'Receive Email', type: WorkflowNodeType.Start, status: WorkflowNodeStatus.Completed, x: 400, y: 50 },
      { id: 'n2', label: 'Analyze Intent', type: WorkflowNodeType.Decision, status: WorkflowNodeStatus.Completed, x: 400, y: 150 },
      { id: 'n3a', label: 'Support Ticket', type: WorkflowNodeType.Process, status: WorkflowNodeStatus.Pending, x: 250, y: 300 },
      { id: 'n3b', label: 'Generate Reply', type: WorkflowNodeType.Process, status: WorkflowNodeStatus.Running, x: 550, y: 300 },
      { id: 'n4', label: 'Send Email', type: WorkflowNodeType.End, status: WorkflowNodeStatus.Pending, x: 400, y: 450 },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', status: WorkflowEdgeStatus.Success },
      { id: 'e2a', source: 'n2', target: 'n3a', status: WorkflowEdgeStatus.Default, label: 'Is Complaint' },
      { id: 'e2b', source: 'n2', target: 'n3b', status: WorkflowEdgeStatus.Active, label: 'Is General' },
      { id: 'e3a', source: 'n3a', target: 'n4', status: WorkflowEdgeStatus.Default },
      { id: 'e3b', source: 'n3b', target: 'n4', status: WorkflowEdgeStatus.Default },
    ]
  },
  {
    id: '3',
    name: '工作流C: 定时任务',
    status: WorkflowGraphStatus.Pending,
    currentStep: 'Wait',
    nodes: [
        { id: 'n1', label: 'Schedule Trigger', type: WorkflowNodeType.Start, status: WorkflowNodeStatus.Pending, x: 400, y: 50 },
        { id: 'n2', label: 'Execute Task', type: WorkflowNodeType.Process, status: WorkflowNodeStatus.Pending, x: 400, y: 150 },
        { id: 'n3', label: 'Log Result', type: WorkflowNodeType.End, status: WorkflowNodeStatus.Pending, x: 400, y: 250 },
    ],
    edges: [
        { id: 'e1', source: 'n1', target: 'n2', status: WorkflowEdgeStatus.Default },
        { id: 'e2', source: 'n2', target: 'n3', status: WorkflowEdgeStatus.Default },
    ]
  }
]);

const currentWorkflow = computed(() => {
  return workflows.value.find(w => w.id === selectedWorkflowId.value);
});

const selectWorkflow = (id: string) => {
  selectedWorkflowId.value = id;
};

onMounted(() => {
    if (props.initialWorkflowId) {
        selectedWorkflowId.value = props.initialWorkflowId;
    } else if (workflows.value.length > 0) {
        selectedWorkflowId.value = workflows.value[0].id;
    }
});
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}
.animate-scale-in {
  animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>

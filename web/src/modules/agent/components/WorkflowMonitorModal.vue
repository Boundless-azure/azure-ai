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
          <div
            class="w-full md:w-72 h-auto md:h-full border-b md:border-b-0 md:border-r border-gray-200 bg-white flex flex-col flex-shrink-0"
          >
            <div class="p-3 md:p-4 border-b border-gray-100 hidden md:block">
              <h3
                class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
              >
                Active Workflows
              </h3>
              <div class="relative">
                <i
                  class="fa-solid fa-calendar absolute left-3 top-2.5 text-gray-400 text-xs"
                ></i>
                <input
                  type="text"
                  :value="selectedDate"
                  readonly
                  class="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-gray-600 cursor-default"
                />
              </div>
            </div>

            <div
              class="flex-1 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto custom-scrollbar p-2 md:p-3 flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-2"
            >
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
                    :class="
                      selectedWorkflowId === wf.id
                        ? 'text-blue-700'
                        : 'text-gray-700'
                    "
                  >
                    {{ wf.name }}
                  </span>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                    :class="{
                      'bg-blue-100 text-blue-700':
                        wf.status === WorkflowGraphStatus.Running,
                      'bg-gray-100 text-gray-600':
                        wf.status === WorkflowGraphStatus.Pending,
                      'bg-green-100 text-green-700':
                        wf.status === WorkflowGraphStatus.Completed,
                      'bg-red-100 text-red-700':
                        wf.status === WorkflowGraphStatus.Error,
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
                  <span class="truncate max-w-[80px] md:max-w-none">{{
                    wf.currentStep || 'Initialized'
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Main Area: Diagram -->
          <div
            class="flex-1 bg-gray-50 relative overflow-hidden flex flex-col h-full"
          >
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

            <div
              v-else
              class="flex-1 flex items-center justify-center text-gray-400"
            >
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
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAgentStore } from '../store/agent.store';
import { useI18n } from '../composables/useI18n';
import type {
  WorkflowGraph,
  GroupListItem,
  ThreadListItem,
  CheckpointListItem,
} from '../types/agent.types';
import {
  WorkflowGraphStatus,
  WorkflowNodeStatus,
  WorkflowEdgeStatus,
  WorkflowNodeType,
} from '../enums/agent.enums';
import WorkflowDiagram from './WorkflowDiagram.vue';
import { agentApi } from '../../../api/agent';

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

const workflows = ref<WorkflowGraph[]>([]);

const currentWorkflow = computed(() => {
  return workflows.value.find((w) => w.id === selectedWorkflowId.value) || null;
});

const selectWorkflow = (id: string) => {
  selectedWorkflowId.value = id;
};

const buildGraph = (
  group: GroupListItem,
  items: CheckpointListItem[],
): WorkflowGraph => {
  const nodes = items.map((ck, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === items.length - 1;
    const type = isFirst
      ? WorkflowNodeType.Start
      : isLast
        ? WorkflowNodeType.End
        : WorkflowNodeType.Process;
    const status = WorkflowNodeStatus.Completed;
    const y = 60 + idx * 120;
    return {
      id: ck.checkpointId,
      label: new Date(ck.ts).toLocaleString(),
      type,
      status,
      x: 400,
      y,
    };
  });
  const edges = items
    .map((ck, idx) => {
      if (idx === items.length - 1) return null;
      const next = items[idx + 1];
      const status =
        idx === items.length - 2 && group.active
          ? WorkflowEdgeStatus.Active
          : WorkflowEdgeStatus.Success;
      return {
        id: `${ck.checkpointId}->${next.checkpointId}`,
        source: ck.checkpointId,
        target: next.checkpointId,
        status,
      };
    })
    .filter(
      (
        e,
      ): e is {
        id: string;
        source: string;
        target: string;
        status: WorkflowEdgeStatus;
      } => !!e,
    );
  const name = group.title || group.dayGroupId;
  const latestTs =
    items.length > 0 ? new Date(items[items.length - 1].ts).getTime() : null;
  const thresholdMs = 90 * 1000; // 90 seconds window for running
  const isRecent = latestTs !== null && Date.now() - latestTs <= thresholdMs;
  const graphStatus =
    isRecent && group.active
      ? WorkflowGraphStatus.Running
      : WorkflowGraphStatus.Completed;
  if (nodes.length > 0) {
    nodes[nodes.length - 1].status =
      graphStatus === WorkflowGraphStatus.Running
        ? WorkflowNodeStatus.Running
        : WorkflowNodeStatus.Completed;
  }
  const currentStep =
    nodes.length > 0 ? nodes[nodes.length - 1].label : undefined;
  return { id: group.id, name, status: graphStatus, currentStep, nodes, edges };
};

const loadWorkflows = async () => {
  try {
    const threadsRes = await agentApi.listThreads({ type: 'group' });
    const threads: ThreadListItem[] = threadsRes.data;
    const groups: GroupListItem[] = threads.map((t) => ({
      id: t.id,
      dayGroupId: t.id,
      title: t.title,
      chatClientId: t.chatClientId,
      active: true,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      latestMessage: t.lastMessage
        ? { role: 'assistant', content: t.lastMessage, timestamp: t.updatedAt }
        : undefined,
      threadType: t.threadType,
      isPinned: t.isPinned,
      isAiInvolved: t.isAiInvolved,
      participants: t.members,
    }));
    const result: WorkflowGraph[] = [];
    for (const g of groups) {
      const cpsRes = await agentApi.listCheckpoints(g.id, 20);
      const items = Array.isArray(cpsRes.data.items) ? cpsRes.data.items : [];
      const graph = buildGraph(g, items);
      result.push(graph);
    }
    workflows.value = result;
    if (!selectedWorkflowId.value && result.length > 0) {
      selectedWorkflowId.value = result[0].id;
    }
  } catch (e) {
    const ui = useAgentStore();
    const { selectedDate: _ } = storeToRefs(ui);
  }
};

onMounted(async () => {
  await loadWorkflows();
  if (props.initialWorkflowId) {
    selectedWorkflowId.value = props.initialWorkflowId;
  } else if (workflows.value.length > 0) {
    selectedWorkflowId.value = workflows.value[0].id;
  }
});

watch(selectedDate, async () => {
  await loadWorkflows();
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
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

<template>
  <div
    class="relative w-full h-full bg-gray-50 overflow-hidden select-none cursor-grab active:cursor-grabbing"
    ref="containerRef"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
  >
    <!-- Transform Container -->
    <div
      class="absolute inset-0 origin-top-left transition-transform duration-75 ease-out"
      :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }"
    >
      <!-- SVG Layer for Edges -->
      <svg class="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
          </marker>
          <marker
            id="arrowhead-active"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#2563EB" />
          </marker>
          <marker
            id="arrowhead-success"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#16A34A" />
          </marker>
          <marker
            id="arrowhead-error"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#DC2626" />
          </marker>
        </defs>

        <g v-for="edge in graph.edges" :key="edge.id">
          <!-- Background Line for easier clicking (optional) -->
          <path
            :d="getEdgePath(edge)"
            fill="none"
            stroke="transparent"
            stroke-width="10"
          />
          <!-- Visible Line -->
          <path
            :d="getEdgePath(edge)"
            fill="none"
            :stroke="getEdgeColor(edge.status)"
            stroke-width="2"
            :marker-end="`url(#arrowhead-${getEdgeMarker(edge.status)})`"
            :class="{ 'animate-dash': edge.status === WorkflowEdgeStatus.Active }"
            stroke-dasharray="5,5"
            v-if="edge.status === WorkflowEdgeStatus.Active"
          />
          <path
            v-else
            :d="getEdgePath(edge)"
            fill="none"
            :stroke="getEdgeColor(edge.status)"
            stroke-width="2"
            :marker-end="`url(#arrowhead-${getEdgeMarker(edge.status)})`"
          />
          
          <!-- Edge Label (Optional) -->
          <text
            v-if="edge.label"
            :x="getEdgeLabelPos(edge).x"
            :y="getEdgeLabelPos(edge).y"
            class="text-[10px] fill-gray-500 bg-white"
            text-anchor="middle"
          >
            {{ edge.label }}
          </text>
        </g>
      </svg>

      <!-- HTML Layer for Nodes -->
      <div
        v-for="node in graph.nodes"
        :key="node.id"
        class="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center p-3 rounded-lg border shadow-sm transition-all duration-300 w-40 z-10"
        :class="getNodeClasses(node.status)"
        :style="{ left: node.x + 'px', top: node.y + 'px' }"
      >
        <div class="flex items-center space-x-2 mb-1">
          <i :class="getNodeIcon(node.type)" class="text-xs"></i>
          <span class="text-xs font-bold truncate">{{ node.label }}</span>
        </div>
        <div class="flex items-center text-[10px] space-x-1 opacity-80">
          <i :class="getStatusIcon(node.status)"></i>
          <span class="capitalize">{{ node.status }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Workflow Diagram Component
 * @description A reusable component to visualize agent workflows using SVG and HTML.
 * @keywords-cn 工作流图, 流程图, 节点可视化, SVG连线
 * @keywords-en workflow-diagram, flowchart, node-visualization, svg-edges
 */
import { ref, onMounted, watch, nextTick } from 'vue';
import type { WorkflowGraph, WorkflowNode, WorkflowEdge } from '../types/agent.types';
import {
  WorkflowEdgeStatus,
  WorkflowNodeStatus,
  WorkflowNodeType,
} from '../enums/agent.enums';

const props = defineProps<{
  graph: WorkflowGraph;
}>();

const containerRef = ref<HTMLElement | null>(null);
const scale = ref(1);
const pan = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const startPos = ref({ x: 0, y: 0 });

const handleMouseDown = (e: MouseEvent) => {
  isDragging.value = true;
  startPos.value = { x: e.clientX - pan.value.x, y: e.clientY - pan.value.y };
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  pan.value = {
    x: e.clientX - startPos.value.x,
    y: e.clientY - startPos.value.y,
  };
};

const handleMouseUp = () => {
  isDragging.value = false;
};

// Auto-fit view logic
const fitView = () => {
  if (!containerRef.value || props.graph.nodes.length === 0) return;

  const nodes = props.graph.nodes;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  // Calculate bounding box of nodes (assuming node width ~160px, height ~80px)
  const NODE_WIDTH = 160;
  const NODE_HEIGHT = 80;

  nodes.forEach(node => {
    minX = Math.min(minX, node.x - NODE_WIDTH / 2);
    minY = Math.min(minY, node.y - NODE_HEIGHT / 2);
    maxX = Math.max(maxX, node.x + NODE_WIDTH / 2);
    maxY = Math.max(maxY, node.y + NODE_HEIGHT / 2);
  });

  // Add padding
  const PADDING = 40;
  minX -= PADDING;
  minY -= PADDING;
  maxX += PADDING;
  maxY += PADDING;

  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;

  const containerWidth = containerRef.value.clientWidth;
  const containerHeight = containerRef.value.clientHeight;

  if (graphWidth === 0 || graphHeight === 0) return;

  const scaleX = containerWidth / graphWidth;
  const scaleY = containerHeight / graphHeight;

  // Use the smaller scale to fit both dimensions
  let newScale = Math.min(scaleX, scaleY);
  // Cap scale at 1 to prevent zooming in too much on small graphs
  newScale = Math.min(newScale, 1);

  // Center the graph
  const scaledWidth = graphWidth * newScale;
  const scaledHeight = graphHeight * newScale;

  const x = (containerWidth - scaledWidth) / 2 - minX * newScale;
  const y = (containerHeight - scaledHeight) / 2 - minY * newScale;

  scale.value = newScale;
  pan.value = { x, y };
};

// Re-fit when graph changes
watch(() => props.graph, () => {
  nextTick(() => {
    fitView();
  });
}, { deep: true });

onMounted(() => {
  // Use ResizeObserver to handle container resize
  if (containerRef.value) {
    const ro = new ResizeObserver(() => fitView());
    ro.observe(containerRef.value);
  }
  // Initial fit
  nextTick(() => fitView());
});


// --- Edge Logic ---



const getEdgePath = (edge: WorkflowEdge) => {
  const sourceNode = props.graph.nodes.find((n) => n.id === edge.source);
  const targetNode = props.graph.nodes.find((n) => n.id === edge.target);

  if (!sourceNode || !targetNode) return '';

  const sx = sourceNode.x;
  const sy = sourceNode.y + 30; // Start from bottom of node
  const tx = targetNode.x;
  const ty = targetNode.y - 30; // End at top of node

  // Bezier Curve
  const cy = (sy + ty) / 2;
  return `M ${sx} ${sy} C ${sx} ${cy}, ${tx} ${cy}, ${tx} ${ty}`;
};

const getEdgeLabelPos = (edge: WorkflowEdge) => {
    // Simplified calculation for midpoint
    const sourceNode = props.graph.nodes.find((n) => n.id === edge.source);
    const targetNode = props.graph.nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return {x:0, y:0};
    return {
        x: (sourceNode.x + targetNode.x) / 2,
        y: (sourceNode.y + targetNode.y) / 2
    }
}

const getEdgeColor = (status: WorkflowEdge['status']) => {
  switch (status) {
    case WorkflowEdgeStatus.Active:
      return '#2563EB'; // Blue-600
    case WorkflowEdgeStatus.Success:
      return '#16A34A'; // Green-600
    case WorkflowEdgeStatus.Error:
      return '#DC2626'; // Red-600
    default:
      return '#9CA3AF'; // Gray-400
  }
};

const getEdgeMarker = (status: WorkflowEdge['status']) => {
    switch(status) {
        case WorkflowEdgeStatus.Active: return 'active';
        case WorkflowEdgeStatus.Success: return 'success';
        case WorkflowEdgeStatus.Error: return 'error';
        default: return 'arrowhead';
    }
}

// --- Node Logic ---

const getNodeClasses = (status: WorkflowNode['status']) => {
  switch (status) {
    case WorkflowNodeStatus.Running:
      return 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-100';
    case WorkflowNodeStatus.Completed:
      return 'bg-green-50 border-green-200 text-green-700';
    case WorkflowNodeStatus.Error:
      return 'bg-red-50 border-red-200 text-red-700';
    default:
      return 'bg-white border-gray-200 text-gray-600';
  }
};

const getNodeIcon = (type: WorkflowNode['type']) => {
  switch (type) {
    case WorkflowNodeType.Start:
      return 'fa-solid fa-play';
    case WorkflowNodeType.End:
      return 'fa-solid fa-stop';
    case WorkflowNodeType.Decision:
      return 'fa-solid fa-code-branch';
    default:
      return 'fa-solid fa-gear'; // process
  }
};

const getStatusIcon = (status: WorkflowNode['status']) => {
  switch (status) {
    case WorkflowNodeStatus.Running:
      return 'fa-solid fa-circle-notch fa-spin';
    case WorkflowNodeStatus.Completed:
      return 'fa-solid fa-check';
    case WorkflowNodeStatus.Error:
      return 'fa-solid fa-triangle-exclamation';
    default:
      return 'fa-regular fa-clock';
  }
};

const zoomIn = () => {
  scale.value = Math.min(scale.value * 1.2, 3);
};

const zoomOut = () => {
  scale.value = Math.max(scale.value / 1.2, 0.2);
};

defineExpose({
  fitView,
  zoomIn,
  zoomOut,
});
</script>

<style scoped>
.animate-dash {
  animation: dash 1s linear infinite;
}

@keyframes dash {
  from {
    stroke-dashoffset: 10;
  }
  to {
    stroke-dashoffset: 0;
  }
}
</style>

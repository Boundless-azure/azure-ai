<template>
  <Teleport to="body">
    <Transition name="iv-fade">
      <div
        v-if="open && src"
        class="iv-root"
        role="dialog"
        aria-modal="true"
        :aria-label="alt || '图片预览'"
        @click.self="close"
        @wheel.prevent="onWheel"
      >
        <img
          ref="imgEl"
          :src="src"
          :alt="alt || ''"
          class="iv-img"
          :style="imgStyle"
          draggable="false"
          @mousedown="onDragStart"
          @dblclick="onDoubleClick"
          @load="onImgLoad"
          @click.stop
        />

        <!-- 顶部工具栏 -->
        <div class="iv-toolbar" @click.stop>
          <button class="iv-btn" :title="'放大'" @click="zoomIn">
            <i class="fa-solid fa-plus"></i>
          </button>
          <button class="iv-btn" :title="'缩小'" @click="zoomOut">
            <i class="fa-solid fa-minus"></i>
          </button>
          <button class="iv-btn" :title="'适应窗口'" @click="reset">
            <i class="fa-solid fa-expand"></i>
          </button>
          <button class="iv-btn" :title="'旋转 90°'" @click="rotateRight">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
          <span class="iv-divider"></span>
          <button class="iv-btn" :title="'下载原图'" @click="download">
            <i class="fa-solid fa-download"></i>
          </button>
          <button class="iv-btn iv-close" :title="'关闭 (Esc)'" @click="close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- 底部缩放比例 -->
        <div class="iv-meta" @click.stop>
          <span>{{ Math.round(scale * 100) }}%</span>
          <span v-if="alt" class="iv-meta-name" :title="alt">{{ alt }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * @title ImageViewer (Lightbox)
 * @description 通用图片预览组件; Teleport 到 body 避免被祖先 transform/filter 创建的 containing block 影响。
 *   支持: 滚轮缩放, 拖拽移动, 双击 reset, 旋转, ESC 关闭, 下载原图。
 * @keywords-cn 图片预览, 图片查看器, 灯箱, 缩放, 拖拽
 * @keywords-en image-viewer, lightbox, zoom, pan, teleport
 */
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    src?: string | null;
    /** 用于 alt + 下载文件名提示 */
    alt?: string;
  }>(),
  { src: null, alt: '' },
);

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'close'): void;
}>();

const imgEl = ref<HTMLImageElement | null>(null);
const scale = ref(1);
const tx = ref(0);
const ty = ref(0);
const rotate = ref(0);

const imgStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value}) rotate(${rotate.value}deg)`,
  transition: dragging.value ? 'none' : 'transform 0.16s ease',
  cursor: scale.value > 1 ? (dragging.value ? 'grabbing' : 'grab') : 'zoom-in',
}));

const reset = () => {
  scale.value = 1;
  tx.value = 0;
  ty.value = 0;
  rotate.value = 0;
};

const zoomIn = () => (scale.value = Math.min(scale.value * 1.25, 8));
const zoomOut = () => (scale.value = Math.max(scale.value / 1.25, 0.2));
const rotateRight = () => (rotate.value = (rotate.value + 90) % 360);

const onWheel = (e: WheelEvent) => {
  const delta = -e.deltaY;
  const factor = delta > 0 ? 1.12 : 1 / 1.12;
  scale.value = Math.max(0.2, Math.min(8, scale.value * factor));
};

const onDoubleClick = () => {
  if (scale.value !== 1 || tx.value || ty.value || rotate.value) reset();
  else scale.value = 2;
};

// 拖拽: 仅当放大时
const dragging = ref(false);
let dragStartX = 0;
let dragStartY = 0;
let dragOriginX = 0;
let dragOriginY = 0;

const onDragStart = (e: MouseEvent) => {
  if (scale.value <= 1) return;
  dragging.value = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragOriginX = tx.value;
  dragOriginY = ty.value;
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
};

const onDragMove = (e: MouseEvent) => {
  if (!dragging.value) return;
  tx.value = dragOriginX + (e.clientX - dragStartX);
  ty.value = dragOriginY + (e.clientY - dragStartY);
};

const onDragEnd = () => {
  dragging.value = false;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
};

const onImgLoad = () => {
  // 加载完成: 给一帧时间渲染再淡入, 避免裸黑屏
};

const close = () => {
  emit('update:open', false);
  emit('close');
};

const onKeydown = (e: KeyboardEvent) => {
  if (!props.open) return;
  if (e.key === 'Escape') close();
  else if (e.key === '+' || e.key === '=') zoomIn();
  else if (e.key === '-' || e.key === '_') zoomOut();
  else if (e.key === '0') reset();
  else if (e.key === 'r' || e.key === 'R') rotateRight();
};

const download = () => {
  if (!props.src) return;
  const a = document.createElement('a');
  a.href = props.src;
  // 后端已经设置 Content-Disposition; 这里 download 属性仅作浏览器提示
  if (props.alt) a.download = props.alt;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// 打开时锁滚动 + 监听键盘
watch(
  () => props.open,
  (v) => {
    if (v) {
      reset();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  },
);

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.iv-root {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
}

.iv-img {
  max-width: 92vw;
  max-height: 88vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  will-change: transform;
}

.iv-toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.iv-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  background: transparent;
  transition: background 0.15s, color 0.15s;
  font-size: 14px;
}

.iv-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.iv-divider {
  width: 1px;
  align-self: stretch;
  background: rgba(255, 255, 255, 0.15);
  margin: 6px 4px;
}

.iv-close:hover {
  background: rgba(239, 68, 68, 0.6);
  color: #fff;
}

.iv-meta {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  max-width: 60vw;
}

.iv-meta-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.7;
}

.iv-fade-enter-active,
.iv-fade-leave-active {
  transition: opacity 0.18s ease;
}

.iv-fade-enter-from,
.iv-fade-leave-to {
  opacity: 0;
}
</style>

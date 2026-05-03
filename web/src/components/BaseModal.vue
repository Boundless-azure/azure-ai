<template>
  <!-- 通用 Modal :: backdrop + 居中卡片 + 关闭按钮
       使用方式 ::
         <BaseModal :open="show" title="..." size="md" @close="show=false">
           <div>内容...</div>
           <template #footer><button>...</button></template>
         </BaseModal>

       Teleport to body :: modal DOM 直接挂在 <body> 下,
       完全脱离任何父级 layout 干扰 (space-y-* / transform / overflow / z-index 栈层等)。
       keyword: base-modal -->
  <Teleport to="body">
    <transition name="modal-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[100001] flex items-center justify-center"
        role="dialog"
        aria-modal="true"
      >
        <!-- backdrop :: 点击关闭, 高于全局 sticky 元素 (聊天面板/工具栏) -->
        <div
          class="absolute inset-0 bg-black/30 backdrop-blur-sm"
          @click="onBackdropClick"
        ></div>

        <!-- card :: 居中, 按 size 给宽度预设 -->
        <div
          class="relative bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col overflow-hidden max-h-[90vh]"
          :class="sizeClass"
        >
          <!-- 头部 :: 标题 + 副标题 + 关闭 (有 title slot 时可完全自定义) -->
          <div
            v-if="$slots.title || title || closable"
            class="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4 flex-shrink-0"
          >
            <div class="flex-1 min-w-0">
              <slot name="title">
                <h3 v-if="title" class="text-lg font-bold text-gray-900 truncate">
                  {{ title }}
                </h3>
                <p
                  v-if="subtitle"
                  class="text-sm text-gray-500 mt-0.5 truncate"
                >
                  {{ subtitle }}
                </p>
              </slot>
            </div>
            <button
              v-if="closable"
              class="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 p-1 -mr-1"
              aria-label="关闭"
              @click="emit('close')"
            >
              <i class="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          <!-- 主体 :: 默认 slot, noPadding 时去除默认 px-6 py-4 (用于全屏 / 复杂内部 layout 场景) -->
          <div
            class="flex-1 overflow-y-auto min-h-0"
            :class="noPadding ? '' : 'px-6 py-4'"
          >
            <slot />
          </div>

          <!-- 底部 :: footer slot, 没 footer 时不渲染 -->
          <div
            v-if="$slots.footer"
            class="px-6 py-3 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0 bg-gray-50/40"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * @title BaseModal
 * @description 通用 Modal 组件 :: 统一 backdrop / z-index / 动画 / ESC / 关闭逻辑。
 *              业务侧只关心内容和 footer, 不再各自实现 fixed/inset-0/z-index/closeButton。
 *              z-[9999] 对齐项目高 z-index 元素, 低于 toast (z-[100000]); 确保 backdrop 全屏覆盖。
 * @keywords-cn 通用Modal, 弹窗, backdrop, z-index, ESC关闭
 * @keywords-en base-modal, dialog, backdrop, z-index, esc-close
 */
import { computed, onBeforeUnmount, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 是否打开 */
    open: boolean;
    /** 标题 (头部默认渲染); 有 #title slot 时优先 slot */
    title?: string;
    /** 副标题, 在标题下方一行小字 */
    subtitle?: string;
    /**
     * 尺寸预设 :: sm=400 / md=560 / lg=820 / xl=1080 / full=95vw
     */
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    /** 是否显示右上关闭按钮 (默认 true) */
    closable?: boolean;
    /** 是否点击 backdrop 关闭 (默认 true) */
    closeOnBackdrop?: boolean;
    /** 是否按 ESC 关闭 (默认 true) */
    closeOnEsc?: boolean;
    /**
     * 主体区域是否去除默认 px-6 py-4 padding (用于全屏 modal 或自带 layout 的复杂内容)
     * 默认 false (保留 padding)
     */
    noPadding?: boolean;
  }>(),
  {
    title: '',
    subtitle: '',
    size: 'md',
    closable: true,
    closeOnBackdrop: true,
    closeOnEsc: true,
    noPadding: false,
  },
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

/** 按 size 给宽度 class :: full 用 vw 做响应式 */
const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'w-[400px] max-w-[95vw]';
    case 'lg':
      return 'w-[820px] max-w-[95vw]';
    case 'xl':
      return 'w-[1080px] max-w-[95vw]';
    case 'full':
      return 'w-[95vw] h-[90vh]';
    case 'md':
    default:
      return 'w-[560px] max-w-[95vw]';
  }
});

/** 点击 backdrop 关闭 :: closeOnBackdrop=false 时无视 */
function onBackdropClick(): void {
  if (props.closeOnBackdrop) emit('close');
}

/** 全局 ESC 监听 :: 仅 open 时挂, 关闭时摘除 */
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.closeOnEsc && props.open) {
    emit('close');
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      window.addEventListener('keydown', onKeydown);
      // 简单锁滚 :: 打开时禁掉 body 滚动
      document.body.style.overflow = 'hidden';
    } else {
      window.removeEventListener('keydown', onKeydown);
      document.body.style.overflow = '';
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});
</script>

<style scoped>
/* fade + scale 入场动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active > .relative,
.modal-fade-leave-active > .relative {
  transition: transform 0.2s ease;
}
.modal-fade-enter-from > .relative,
.modal-fade-leave-to > .relative {
  transform: scale(0.96);
}
</style>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    @click.self="close"
  >
    <div
      class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 flex flex-col max-h-[90vh]"
    >
      <div class="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 class="text-lg font-bold text-gray-900">
          {{ title || '裁剪图片' }}
        </h3>
        <button
          class="text-gray-400 hover:text-gray-700 transition-colors"
          type="button"
          @click="close"
        >
          <i class="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto min-h-0">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
          <!-- Left: Crop Area -->
          <div class="lg:col-span-2 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <div
                class="text-sm font-semibold text-gray-700 flex items-center gap-2"
              >
                <span>编辑区域</span>
                <span
                  v-if="imageObjectUrl"
                  class="text-xs font-normal text-gray-400"
                >
                  (支持拖拽与缩放)
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="imageObjectUrl"
                  type="button"
                  class="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                  @click="resetState(true)"
                >
                  <i class="fa-solid fa-rotate-left mr-1"></i>重置
                </button>
                <label
                  class="px-3 py-1.5 rounded-lg border border-gray-200 text-sm cursor-pointer hover:bg-gray-50 transition-colors bg-white shadow-sm"
                >
                  <i class="fa-solid fa-upload mr-1.5 text-gray-400"></i
                  >选择图片
                  <input
                    class="hidden"
                    type="file"
                    accept="image/*"
                    @change="onPickFile"
                  />
                </label>
              </div>
            </div>

            <!-- Main Crop Box -->
            <div
              ref="cropBoxRef"
              class="w-full aspect-square rounded-xl bg-[#1a1a1a] overflow-hidden relative select-none touch-none shadow-inner border border-gray-200"
              @pointerdown="onPointerDown"
              @wheel.prevent="onWheel"
            >
              <!-- Image (Lower Layer) -->
              <img
                v-if="imageObjectUrl"
                :src="imageObjectUrl"
                class="absolute left-0 top-0 will-change-transform origin-center max-w-none max-h-none"
                :style="imgStyle"
                draggable="false"
                @load="onImgLoaded"
              />

              <!-- Overlay (Upper Layer) -->
              <div
                class="absolute inset-0 pointer-events-none flex items-center justify-center"
              >
                <!-- The "Hole" is created by a box shadow around the center box -->
                <!-- box-shadow: 0 0 0 9999px rgba(0,0,0,0.6) -->
                <div
                  class="relative border border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                  :style="{ width: cropSize + 'px', height: cropSize + 'px' }"
                >
                  <!-- Grid Lines (Only visible inside crop area) -->
                  <div
                    v-if="imageObjectUrl"
                    class="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-0 transition-opacity duration-200"
                    :class="{ 'opacity-100': dragging || isZooming }"
                  >
                    <div class="border-r border-b border-white/30"></div>
                    <div class="border-r border-b border-white/30"></div>
                    <div class="border-b border-white/30"></div>
                    <div class="border-r border-b border-white/30"></div>
                    <div class="border-r border-b border-white/30"></div>
                    <div class="border-b border-white/30"></div>
                    <div class="border-r border-white/30"></div>
                    <div class="border-r border-white/30"></div>
                    <div></div>
                  </div>
                </div>
              </div>

              <!-- Placeholder -->
              <div
                v-if="!imageObjectUrl"
                class="absolute inset-0 flex items-center justify-center text-gray-500"
              >
                <div class="flex flex-col items-center gap-3">
                  <div
                    class="w-20 h-20 rounded-full bg-gray-800/50 flex items-center justify-center border border-gray-700/50"
                  >
                    <i class="fa-regular fa-image text-3xl text-gray-400"></i>
                  </div>
                  <div class="text-sm font-medium">点击上方按钮选择图片</div>
                </div>
              </div>
            </div>

            <!-- Controls -->
            <div class="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div class="space-y-4">
                <!-- Zoom -->
                <div class="flex items-center gap-4">
                  <span class="text-xs font-medium text-gray-500 w-8"
                    >缩放</span
                  >
                  <i
                    class="fa-solid fa-magnifying-glass-minus text-gray-400 text-xs"
                  ></i>
                  <input
                    v-model.number="zoom"
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.01"
                    class="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                    :disabled="!imageObjectUrl"
                    @input="onZoomChange"
                  />
                  <i
                    class="fa-solid fa-magnifying-glass-plus text-gray-400 text-xs"
                  ></i>
                  <span class="text-xs text-gray-500 w-8 text-right"
                    >{{ Math.round(zoom * 100) }}%</span
                  >
                </div>

                <!-- Rotation -->
                <div class="flex items-center gap-4">
                  <span class="text-xs font-medium text-gray-500 w-8"
                    >旋转</span
                  >
                  <div class="flex items-center gap-2 flex-1">
                    <button
                      type="button"
                      class="p-2 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      :disabled="!imageObjectUrl"
                      @click="rotate(-90)"
                      title="向左旋转90度"
                    >
                      <i class="fa-solid fa-rotate-left"></i>
                    </button>
                    <button
                      type="button"
                      class="p-2 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      :disabled="!imageObjectUrl"
                      @click="rotate(90)"
                      title="向右旋转90度"
                    >
                      <i class="fa-solid fa-rotate-right"></i>
                    </button>
                    <div class="h-4 w-px bg-gray-300 mx-2"></div>
                    <span class="text-xs text-gray-400"
                      >当前: {{ rotation }}°</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Preview -->
          <div class="flex flex-col">
            <div class="text-sm font-semibold text-gray-700 mb-3">预览效果</div>

            <div
              class="bg-gray-50 rounded-xl p-6 border border-gray-100 flex flex-col items-center gap-6"
            >
              <!-- Square Preview -->
              <div class="flex flex-col items-center gap-2">
                <div
                  class="w-32 h-32 rounded-2xl bg-white overflow-hidden border border-gray-200 shadow-sm relative group"
                >
                  <img
                    v-if="previewUrl"
                    :src="previewUrl"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-gray-300 bg-gray-100"
                  >
                    <i class="fa-solid fa-user text-3xl"></i>
                  </div>
                  <div
                    class="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  >
                    方形预览
                  </div>
                </div>
                <span class="text-xs text-gray-500">方形</span>
              </div>

              <!-- Circle Preview -->
              <div class="flex flex-col items-center gap-2">
                <div
                  class="w-24 h-24 rounded-full bg-white overflow-hidden border border-gray-200 shadow-sm relative group"
                >
                  <img
                    v-if="previewUrl"
                    :src="previewUrl"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-gray-300 bg-gray-100"
                  >
                    <i class="fa-solid fa-user text-2xl"></i>
                  </div>
                  <div
                    class="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-full"
                  >
                    圆形预览
                  </div>
                </div>
                <span class="text-xs text-gray-500">圆形</span>
              </div>
            </div>

            <div class="mt-6 flex-1 text-sm text-gray-500 space-y-2">
              <div
                v-if="initialUrl && !imageObjectUrl"
                class="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100"
              >
                <img
                  :src="initialUrl"
                  class="w-10 h-10 rounded-lg object-cover bg-white"
                />
                <div class="flex flex-col">
                  <span class="font-medium">当前头像</span>
                  <span class="text-xs opacity-80">尚未选择新图片</span>
                </div>
              </div>

              <div
                v-if="errorMsg"
                class="p-3 bg-red-50 text-red-600 rounded-lg border border-red-100 flex items-start gap-2"
              >
                <i class="fa-solid fa-circle-exclamation mt-0.5"></i>
                <span>{{ errorMsg }}</span>
              </div>

              <div
                v-else
                class="p-4 rounded-xl border border-gray-100 bg-white shadow-sm space-y-2"
              >
                <div class="font-medium text-gray-700 mb-1">操作指南</div>
                <div class="flex items-center gap-2 text-xs">
                  <i
                    class="fa-solid fa-hand-pointer text-gray-400 w-4 text-center"
                  ></i>
                  <span>拖拽图片调整位置</span>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <i
                    class="fa-solid fa-magnifying-glass text-gray-400 w-4 text-center"
                  ></i>
                  <span>使用滑块或滚轮缩放</span>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <i
                    class="fa-solid fa-rotate text-gray-400 w-4 text-center"
                  ></i>
                  <span>支持90度旋转修正</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0"
      >
        <button
          type="button"
          class="px-6 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors font-medium"
          @click="close"
        >
          取消
        </button>
        <button
          type="button"
          class="px-8 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-gray-900/20 font-medium flex items-center gap-2"
          :disabled="!imageObjectUrl || !imgNaturalWidth || !imgNaturalHeight"
          @click="confirm"
        >
          <i v-if="processing" class="fa-solid fa-circle-notch fa-spin"></i>
          <span>{{ processing ? '处理中...' : '确认使用' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Square Avatar Crop Modal
 * @description 增强版方形头像裁剪弹窗组件，支持拖拽、缩放、旋转与网格辅助。
 * @keywords-cn 方形裁剪, 头像裁剪, 拖拽, 缩放, 旋转, 网格, 预览
 * @keywords-en square-crop, avatar-crop, drag, zoom, rotate, grid, preview
 */

import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
  onMounted,
  nextTick,
} from 'vue';

const props = defineProps<{
  open: boolean;
  title?: string;
  initialUrl?: string | null;
  outputSize?: number;
}>();

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'confirm', file: File): void;
}>();

const cropBoxRef = ref<HTMLDivElement | null>(null);
const containerRect = ref({ width: 320, height: 320 });
let resizeObserver: ResizeObserver | null = null;

const imageObjectUrl = ref<string | null>(null);
const previewUrl = ref<string | null>(null);
const errorMsg = ref<string | null>(null);
const processing = ref(false);

const imgNaturalWidth = ref(0);
const imgNaturalHeight = ref(0);
const baseScale = ref(1);
const zoom = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
const rotation = ref(0); // 0, 90, 180, 270

const dragging = ref(false);
const isZooming = ref(false);
const dragStart = ref({ x: 0, y: 0, ox: 0, oy: 0, pid: 0 });

// Viewport size is determined by the container
const viewportSize = computed(() => {
  const s = Math.min(containerRect.value.width, containerRect.value.height);
  return s > 0 ? s : 320;
});

// Crop Box Size (fixed padding from viewport)
// Let's use 80% of viewport
const cropSize = computed(() => {
  return viewportSize.value * 0.8;
});

const currentScale = computed(() => baseScale.value * zoom.value);

const imgStyle = computed(() => {
  if (!imgNaturalWidth.value) return {};
  const t = getCssTranslate();
  const scale = currentScale.value;
  return {
    transform: `translate(${t.x}px, ${t.y}px) rotate(${rotation.value}deg) scale(${scale})`,
    transformOrigin: 'center center',
    width: `${imgNaturalWidth.value}px`,
    height: `${imgNaturalHeight.value}px`,
  };
});

// Helper to get effective dimensions after rotation
const effectiveDims = computed(() => {
  const r = ((rotation.value % 360) + 360) % 360;
  const swap = r === 90 || r === 270;
  return {
    w: swap ? imgNaturalHeight.value : imgNaturalWidth.value,
    h: swap ? imgNaturalWidth.value : imgNaturalHeight.value,
  };
});

function close(_evt?: Event) {
  if (processing.value) return;
  emit('update:open', false);
}

function forceClose() {
  emit('update:open', false);
}

function revokeUrl(url: string | null) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    void 0;
  }
}

async function resetState(keepImage = false) {
  errorMsg.value = null;
  dragging.value = false;
  isZooming.value = false;
  detachPointerEvents();

  if (!keepImage) {
    zoom.value = 1;
    baseScale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    rotation.value = 0;
    imgNaturalWidth.value = 0;
    imgNaturalHeight.value = 0;
    revokeUrl(imageObjectUrl.value);
    imageObjectUrl.value = null;
    revokeUrl(previewUrl.value);
    previewUrl.value = null;
  } else if (imageObjectUrl.value) {
    // Reset visual transformations
    rotation.value = 0;
    zoom.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;

    // Wait for reactivity to propagate (especially effectiveDims)
    await nextTick();

    // Recalculate fit
    baseScale.value = computeBaseScale();
    centerImage(baseScale.value);
    void updatePreview();
  }
}

function updateContainerRect() {
  if (cropBoxRef.value) {
    const rect = cropBoxRef.value.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      containerRect.value = { width: rect.width, height: rect.height };
    }
  }
}

watch(
  () => props.open,
  (v) => {
    if (!v) {
      resetState();
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      return;
    }
    resetState();
    // Wait for DOM
    setTimeout(() => {
      if (cropBoxRef.value) {
        updateContainerRect();
        resizeObserver = new ResizeObserver(() => {
          updateContainerRect();
        });
        resizeObserver.observe(cropBoxRef.value);
      }
    }, 100);
  },
);

onBeforeUnmount(() => {
  resetState();
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

function onPickFile(evt: Event) {
  const input = evt.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    errorMsg.value = '请选择图片文件';
    return;
  }
  errorMsg.value = null;
  revokeUrl(imageObjectUrl.value);
  imageObjectUrl.value = URL.createObjectURL(file);
  revokeUrl(previewUrl.value);
  previewUrl.value = null;
  if (input.value) input.value = '';
}

// Calculate CSS translate values to position the image center at the calculated offset from container center
// Logic:
// 1. Target Center = Container Center + Offset
// 2. Top-Left = Target Center - Image Half Size

function getCssTranslate() {
  const vp = viewportSize.value;
  const w = imgNaturalWidth.value;
  const h = imgNaturalHeight.value;

  // The viewport is size `vp x vp`.
  // The center of viewport is (vp/2, vp/2).
  // `offsetX, offsetY` are the offset of Image Center from Viewport Center.

  const targetCx = vp / 2 + offsetX.value;
  const targetCy = vp / 2 + offsetY.value;

  const tx = targetCx - w / 2;
  const ty = targetCy - h / 2;
  return { x: tx, y: ty };
}

function clampOffsetsNew(vx: number, vy: number, scale: number) {
  // Ensure Image covers Crop Box.
  // Viewport Size: vp
  // Crop Box Size: cs
  // Crop Box is centered in Viewport.

  const vp = viewportSize.value;
  const cs = cropSize.value;
  const { w: effW, h: effH } = effectiveDims.value;
  const sw = effW * scale;
  const sh = effH * scale;

  // Visual Left Edge (relative to Viewport Center): vx - sw/2
  // Visual Right Edge: vx + sw/2
  // Crop Box Left Edge (relative to Viewport Center): -cs/2
  // Crop Box Right Edge: cs/2

  // We need:
  // Visual Left <= Crop Box Left => vx - sw/2 <= -cs/2 => vx <= sw/2 - cs/2
  // Visual Right >= Crop Box Right => vx + sw/2 >= cs/2 => vx >= cs/2 - sw/2

  // Range: [-(sw - cs)/2, (sw - cs)/2]
  // Max Offset = (sw - cs)/2

  const limitX = Math.max(0, (sw - cs) / 2);
  const limitY = Math.max(0, (sh - cs) / 2);

  let newVx = vx;
  let newVy = vy;

  // If image is smaller than crop box, force center (0)
  if (sw < cs) newVx = 0;
  else newVx = Math.max(-limitX, Math.min(limitX, vx));

  if (sh < cs) newVy = 0;
  else newVy = Math.max(-limitY, Math.min(limitY, vy));

  return { x: newVx, y: newVy };
}

function computeBaseScale() {
  const cs = cropSize.value;
  const { w, h } = effectiveDims.value;
  if (!w || !h) return 1;
  // Fit to cover CROP BOX, not Viewport
  const s = Math.max(cs / w, cs / h);
  return Number.isFinite(s) && s > 0 ? s : 1;
}

function centerImage(scale: number) {
  // With the new Center-Offset model, centering is just 0,0.
  // But we need to clamp just in case (though 0,0 should be safe if scale is baseScale).
  const clamped = clampOffsetsNew(0, 0, scale);
  offsetX.value = clamped.x;
  offsetY.value = clamped.y;
}

function onImgLoaded(e: Event) {
  const el = e.target as HTMLImageElement;
  const w = el.naturalWidth || 0;
  const h = el.naturalHeight || 0;
  imgNaturalWidth.value = w;
  imgNaturalHeight.value = h;
  rotation.value = 0;

  baseScale.value = computeBaseScale();
  zoom.value = 1;
  centerImage(baseScale.value);
  void updatePreview();
}

function onZoomChange() {
  isZooming.value = true;
  // When zooming, we want to keep the center stable, but clamp if edges come in.
  const scale = baseScale.value * zoom.value;
  const clamped = clampOffsetsNew(offsetX.value, offsetY.value, scale);
  offsetX.value = clamped.x;
  offsetY.value = clamped.y;
  void updatePreview();
  setTimeout(() => {
    isZooming.value = false;
  }, 200);
}

function onWheel(e: WheelEvent) {
  if (!imageObjectUrl.value) return;
  const delta = e.deltaY * -0.001;
  const newZoom = Math.min(Math.max(0.5, zoom.value + delta), 3);
  zoom.value = newZoom;
  onZoomChange();
}

function rotate(deg: number) {
  rotation.value = (rotation.value + deg) % 360;
  // After rotation, effective dims change.
  // We should re-calculate baseScale to ensure coverage?
  // User might want to keep zoom level?
  // Let's recalculate baseScale so it fits nicely.
  baseScale.value = computeBaseScale();
  // Reset zoom to 1 to avoid confusion or maintain?
  // Let's maintain relative zoom if possible, but simplicity is better.
  // Resetting zoom ensures we don't end up with a blank space.
  zoom.value = 1;
  centerImage(baseScale.value);
  void updatePreview();
}

function onPointerDown(evt: PointerEvent) {
  if (!imageObjectUrl.value) return;
  const el = cropBoxRef.value;
  if (!el) return;
  dragging.value = true;
  dragStart.value = {
    x: evt.clientX,
    y: evt.clientY,
    ox: offsetX.value,
    oy: offsetY.value,
    pid: evt.pointerId,
  };
  try {
    el.setPointerCapture(evt.pointerId);
  } catch {
    void 0;
  }
  attachPointerEvents();
}

function onPointerMove(evt: PointerEvent) {
  if (!dragging.value) return;
  if (evt.pointerId !== dragStart.value.pid) return;

  // Drag moves the image center directly in screen space (which aligns with container space)

  const dx = evt.clientX - dragStart.value.x;
  const dy = evt.clientY - dragStart.value.y;

  const scale = baseScale.value * zoom.value;
  const clamped = clampOffsetsNew(
    dragStart.value.ox + dx,
    dragStart.value.oy + dy,
    scale,
  );

  offsetX.value = clamped.x;
  offsetY.value = clamped.y;

  // Debounce preview update slightly?
  void updatePreview();
}

function onPointerUp(evt: PointerEvent) {
  if (!dragging.value) return;
  if (evt.pointerId !== dragStart.value.pid) return;
  dragging.value = false;
  detachPointerEvents();
}

function attachPointerEvents() {
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function detachPointerEvents() {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
}

async function buildCroppedBlob(): Promise<Blob> {
  const src = imageObjectUrl.value;
  if (!src) throw new Error('No image selected');
  const w = imgNaturalWidth.value;
  const h = imgNaturalHeight.value;
  if (!w || !h) throw new Error('Image not loaded');

  const outSize =
    props.outputSize && props.outputSize > 0 ? props.outputSize : 512;
  const cw = cropSize.value; // Use Crop Box Size as the reference
  const scale = currentScale.value;

  // We need to draw the visible portion of the image into the canvas.
  // Canvas size = outSize.
  // We can map: Crop Box -> Canvas.
  // Factor = outSize / cw.

  // Center of Canvas = (outSize/2, outSize/2).
  // Image Center relative to Crop Box Center was (offsetX, offsetY).

  const factor = outSize / cw;
  const canvasScale = scale * factor;
  const canvasOffsetX = offsetX.value * factor;
  const canvasOffsetY = offsetY.value * factor;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Failed to load image'));
    im.src = src;
  });

  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill background (just in case)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outSize, outSize);

  // Setup transform
  // 1. Move to center of canvas
  ctx.translate(outSize / 2, outSize / 2);
  // 2. Apply offset (move to image center)
  ctx.translate(canvasOffsetX, canvasOffsetY);
  // 3. Rotate
  ctx.rotate((rotation.value * Math.PI) / 180);
  // 4. Scale
  ctx.scale(canvasScale, canvasScale);
  // 5. Draw Image centered at 0,0
  ctx.drawImage(img, -w / 2, -h / 2);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) {
          reject(new Error('Failed to export image'));
          return;
        }
        resolve(b);
      },
      'image/png',
      0.92,
    );
  });
  return blob;
}

async function updatePreview() {
  if (!imageObjectUrl.value) return;
  try {
    const blob = await buildCroppedBlob();
    revokeUrl(previewUrl.value);
    previewUrl.value = URL.createObjectURL(blob);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
}

async function confirm() {
  if (processing.value) return;
  try {
    processing.value = true;
    errorMsg.value = null;
    const blob = await buildCroppedBlob();
    const file = new File([blob], 'avatar.png', { type: 'image/png' });
    emit('confirm', file);
    forceClose();
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    processing.value = false;
  }
}
</script>

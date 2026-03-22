<template>
  <!-- ==================== 资源库管理主组件 ==================== -->
  <!-- 区域描述: 资源库管理主区域 -->
  <!-- 区域关键词: storage-management, main-area -->
  <div class="space-y-4 h-full flex flex-col relative">

    <!-- ==================== Header ==================== -->
    <!-- 区域描述: 页面标题和描述 -->
    <!-- 区域关键词: header, page-title -->
    <div class="pt-8 pb-6">
      <h2 class="text-2xl font-bold text-gray-900">资源库</h2>
      <p class="text-sm text-gray-500 mt-1">管理文件与文件夹，支持目录结构和链接分享</p>
    </div>

    <!-- ==================== Toolbar ==================== -->
    <!-- 区域描述: 工具栏，包含搜索、上级目录、新建文件夹、上传、粘贴按钮 -->
    <!-- 区域关键词: toolbar, search, upload, paste -->
    <div class="flex flex-col md:flex-row md:items-center gap-3 bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm">
      <div class="flex-1 w-full md:w-auto">
        <div class="relative">
          <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            v-model="searchQuery"
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="搜索文件或文件夹"
            @keyup.enter="handleSearch"
          />
        </div>
      </div>

      <button
        class="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        :disabled="breadcrumbs.length === 0"
        @click="goUp"
      >
        <i class="fa-solid fa-arrow-up"></i>
        <span>上级目录</span>
      </button>

      <button
        class="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        @click="openCreateFolder"
      >
        <i class="fa-solid fa-folder-plus"></i>
        <span>新建文件夹</span>
      </button>

      <!-- 粘贴按钮（仅当剪贴板有内容时显示） -->
      <button
        v-if="clipboardStore.hasClipboard"
        class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        @click="handlePaste"
      >
        <i class="fa-solid fa-paste"></i>
        <span>粘贴 ({{ clipboardStore.clipboardCount }})</span>
      </button>

      <button
        class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
        @click="openUploadModal"
      >
        <i class="fa-solid fa-upload"></i>
        <span>上传文件</span>
      </button>
    </div>

    <!-- ==================== Breadcrumb ==================== -->
    <!-- 区域描述: 面包屑导航 -->
    <!-- 区域关键词: breadcrumb, navigation -->
    <div class="flex items-center gap-2 text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
      <button class="hover:text-gray-900" @click="navigateToRoot">
        <i class="fa-solid fa-home mr-1"></i>根目录
      </button>
      <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.id">
        <i class="fa-solid fa-chevron-right text-gray-400 text-xs"></i>
        <button class="hover:text-gray-900" @click="navigateTo(crumb)">{{ crumb.name }}</button>
      </template>
    </div>

    <!-- ==================== Content (拖拽区域) ==================== -->
    <!-- 区域描述: 文件列表区域，支持拖拽上传 -->
    <!-- 区域关键词: content, file-list, drag-drop-zone -->
    <div
      class="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
      :class="{ 'border-blue-400 border-2 border-dashed': isDraggingOver }"
      @dragover.prevent="isDraggingOver = true"
      @dragleave.prevent="isDraggingOver = false"
      @drop.prevent="handleDrop"
    >
      <div v-if="loading" class="flex items-center justify-center py-16 text-gray-400">
        <i class="fa-solid fa-spinner fa-spin text-xl"></i>
      </div>

      <!-- 上传进度显示 -->
      <div v-else-if="uploading" class="p-6 space-y-4">
        <div class="text-sm text-gray-600 mb-2">
          <i class="fa-solid fa-cloud-upload-alt mr-2"></i>
          正在上传 {{ uploadItems.length }} 个文件...
        </div>
        <div
          v-for="item in uploadItems"
          :key="item.id"
          class="flex items-center gap-3"
        >
          <i class="fa-solid fa-file text-gray-400"></i>
          <div class="flex-1">
            <div class="text-sm text-gray-700">{{ item.file.name }}</div>
            <div class="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                class="bg-green-500 h-1.55 rounded-full transition-all"
                :style="{ width: `${item.progress}%` }"
              ></div>
            </div>
          </div>
          <span class="text-xs text-gray-500">{{ item.progress }}%</span>
        </div>
      </div>

      <div v-else class="h-full overflow-y-auto">
        <!-- ==================== Grid View ==================== -->
        <!-- 区域描述: 文件网格视图 -->
        <!-- 区域关键词: grid-view, file-grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
          <div
            v-for="node in sortedNodes"
            :key="node.id"
            class="group flex flex-col items-center p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-all"
            @click="openNode(node)"
            @contextmenu.prevent="openContextMenu($event, node)"
          >
            <div class="w-12 h-12 rounded-lg flex items-center justify-center mb-2"
              :class="node.type === 'folder' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'">
              <i class="fa-solid text-xl" :class="node.type === 'folder' ? 'fa-folder' : 'fa-file'"></i>
            </div>
            <span class="text-sm text-gray-700 text-center truncate w-full">{{ node.name }}</span>
            <span class="text-xs text-gray-400 mt-1">{{ formatSize(node.size) }}</span>
          </div>

          <!-- 空状态 -->
          <div v-if="sortedNodes.length === 0" class="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
            <i class="fa-solid fa-folder-open text-4xl mb-4"></i>
            <p>该目录为空</p>
            <p class="text-xs mt-2">拖拽文件到此处上传</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Create Folder Modal ==================== -->
    <!-- 区域描述: 新建文件夹弹窗 -->
    <!-- 区域关键词: create-folder-modal -->
    <div v-if="showCreateFolder" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="showCreateFolder = false"></div>
      <div class="relative bg-white rounded-2xl shadow-xl w-[480px] max-w-[95vw] border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-gray-900">新建文件夹</h3>
            <p class="text-sm text-gray-500">在当前目录下创建新文件夹</p>
          </div>
          <button class="text-gray-400 hover:text-gray-700" @click="showCreateFolder = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">文件夹名称</label>
            <input
              v-model="newFolderName"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="请输入文件夹名称"
              @keyup.enter="submitCreateFolder"
            />
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50" @click="showCreateFolder = false">取消</button>
          <button class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800" @click="submitCreateFolder">创建</button>
        </div>
      </div>
    </div>

    <!-- ==================== Share Modal ==================== -->
    <!-- 区域描述: 分享弹窗 -->
    <!-- 区域关键词: share-modal -->
    <div v-if="showShare" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="showShare = false"></div>
      <div class="relative bg-white rounded-2xl shadow-xl w-[480px] max-w-[95vw] border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-gray-900">分享链接</h3>
            <p class="text-sm text-gray-500">创建文件分享链接</p>
          </div>
          <button class="text-gray-400 hover:text-gray-700" @click="showShare = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">分享方式</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="mode in shareModes"
                :key="mode.value"
                class="p-3 rounded-lg border text-left transition-all"
                :class="selectedShareMode === mode.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'"
                @click="selectedShareMode = mode.value"
              >
                <div class="font-medium text-sm">{{ mode.label }}</div>
                <div class="text-xs text-gray-500">{{ mode.desc }}</div>
              </button>
            </div>
          </div>

          <div v-if="selectedShareMode === 'password'">
            <label class="block text-sm font-medium text-gray-700 mb-1">访问密码</label>
            <input
              v-model="sharePassword"
              type="password"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="请输入访问密码"
            />
          </div>

          <div v-if="selectedShareMode === 'temp'">
            <label class="block text-sm font-medium text-gray-700 mb-1">过期时间（秒）</label>
            <input
              v-model.number="shareExpiresIn"
              type="number"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="默认 3600 秒（1小时）"
            />
          </div>

          <div v-if="shareLink" class="mt-4 p-3 bg-gray-50 rounded-lg">
            <div class="text-sm text-gray-600 mb-2">分享链接：</div>
            <div class="flex items-center gap-2">
              <input :value="shareLink" readonly class="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono" />
              <button class="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm" @click="copyShareLink">复制</button>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50" @click="showShare = false">关闭</button>
          <button v-if="!shareLink" class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800" @click="submitShare">创建分享</button>
        </div>
      </div>
    </div>

    <!-- ==================== Upload Modal ==================== -->
    <!-- 区域描述: 上传弹窗，支持多文件和拖拽 -->
    <!-- 区域关键词: upload-modal, multi-file, drag-drop -->
    <div v-if="showUpload" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="showUpload = false"></div>
      <div class="relative bg-white rounded-2xl shadow-xl w-[600px] max-w-[95vw] border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-gray-900">上传文件</h3>
            <p class="text-sm text-gray-500">拖拽文件到此处或点击选择</p>
          </div>
          <button class="text-gray-400 hover:text-gray-700" @click="showUpload = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="p-6 space-y-4">
          <!-- 拖拽上传区域 -->
          <div
            class="border-2 border-dashed rounded-xl p-8 text-center transition-colors"
            :class="isModalDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'"
            @dragover.prevent="isModalDragging = true"
            @dragleave.prevent="isModalDragging = false"
            @drop.prevent="handleModalDrop"
            @click="triggerFileInput"
          >
            <i class="fa-solid fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
            <p class="text-gray-600">将文件拖拽到此处</p>
            <p class="text-xs text-gray-400 mt-1">支持多文件上传，单文件最大 500MB</p>
            <input
              ref="fileInputRef"
              type="file"
              multiple
              class="hidden"
              @change="handleFileInputChange"
            />
          </div>

          <!-- 已选文件列表 -->
          <div v-if="pendingFiles.length > 0" class="space-y-2">
            <div class="text-sm font-medium text-gray-700">待上传文件 ({{ pendingFiles.length }})</div>
            <div
              v-for="(file, idx) in pendingFiles"
              :key="idx"
              class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center gap-2 min-w-0">
                <i class="fa-solid fa-file text-gray-400 flex-shrink-0"></i>
                <span class="text-sm text-gray-700 truncate">{{ file.name }}</span>
                <span class="text-xs text-gray-400 flex-shrink-0">({{ formatSize(String(file.size)) }})</span>
              </div>
              <button class="text-gray-400 hover:text-red-500 flex-shrink-0" @click="removePendingFile(idx)">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50" @click="showUpload = false">取消</button>
          <button
            class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
            :disabled="pendingFiles.length === 0 || uploadStarted"
            @click="submitUpload"
          >
            开始上传
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== Context Menu ==================== -->
    <!-- 区域描述: 右键菜单 -->
    <!-- 区域关键词: context-menu, right-click -->
    <Teleport to="body">
      <div
        v-if="contextMenu.show"
        class="fixed z-[9999] bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-44"
        :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
        @click.stop
      >
        <!-- 打开/进入 -->
        <div v-if="contextMenu.node?.type === 'folder'" class="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 flex items-center gap-2" @click="handleOpenNode">
          <i class="fa-solid fa-folder-open text-gray-400"></i>打开
        </div>
        <!-- 分享 -->
        <div class="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 flex items-center gap-2" @click="openShareModal">
          <i class="fa-solid fa-link text-gray-400"></i>分享
        </div>
        <!-- 重命名 -->
        <div class="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 flex items-center gap-2" @click="openRename">
          <i class="fa-solid fa-pen text-gray-400"></i>重命名
        </div>
        <!-- 复制 -->
        <div class="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 flex items-center gap-2" @click="handleCopy">
          <i class="fa-solid fa-copy text-gray-400"></i>复制
        </div>
        <div class="h-[1px] bg-gray-100 my-1"></div>
        <!-- 删除 -->
        <div class="px-4 py-2 hover:bg-red-50 cursor-pointer text-sm text-red-600 flex items-center gap-2" @click="confirmDelete">
          <i class="fa-solid fa-trash text-red-400"></i>删除
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * @title StorageManagement
 * @description 资源库管理主组件，支持拖拽上传、多文件上传、右键菜单（重命名/复制/粘贴/分享/删除）和断点续传
 * @keywords-cn 资源库管理, 拖拽上传, 多文件上传, 右键菜单, 复制粘贴
 * @keywords-en storage-management, drag-drop-upload, multi-file-upload, context-menu, copy-paste
 */
import { ref, reactive, onMounted, onUnmounted, shallowRef, computed } from 'vue';
import { useStorage } from '../hooks/useStorage';
import { useStorageClipboardStore, type ClipboardItem } from '../store/clipboard.store';
import { resourceApi } from '../../../api/resource';
import { storageNodeCopy } from '../../../api/storage';
import { storageUpload } from '../../../api/storage';
import type { StorageNode } from '../types/storage.types';
import { SHARE_MODE_LABEL, SHARE_MODE } from '../constants/storage.constants';

const {
  loading,
  nodes,
  loadRootNodes,
  loadChildren,
  createNode,
  updateNode,
  deleteNode,
  createShare,
} = useStorage();

// 文件夹优先，再按名字字母排序
const sortedNodes = computed(() => {
  return [...nodes.value].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });
});

const clipboardStore = useStorageClipboardStore();

const searchQuery = ref('');
const currentParentId = ref<string | null>(null);
const breadcrumbs = ref<StorageNode[]>([]);

// 新建文件夹
const showCreateFolder = ref(false);
const newFolderName = ref('');

// 分享
const showShare = ref(false);
const selectedShareMode = ref('permanent');
const sharePassword = ref('');
const shareExpiresIn = ref(3600);
const shareLink = ref('');
const sharingNode = ref<StorageNode | null>(null);

// 上传
const showUpload = ref(false);
const isModalDragging = ref(false);
const pendingFiles = shallowRef<File[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploadStarted = ref(false);
const isDraggingOver = ref(false);

// 本地上传进度状态
interface LocalUploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}
const uploadItems = shallowRef<LocalUploadItem[]>([]);
const abortControllers = new Map<string, AbortController>();

// 右键菜单
const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  node: null as StorageNode | null,
});

const shareModes = [
  { value: 'temp', label: '临时分享', desc: '一定时间后自动失效' },
  { value: 'permanent', label: '永久分享', desc: '永久有效' },
  { value: 'password', label: '密码分享', desc: '需要密码才能访问' },
];

// ==================== 导航 ====================

const handleSearch = () => { /* TODO */ };

const goUp = () => {
  if (breadcrumbs.value.length > 0) {
    const parent = breadcrumbs.value[breadcrumbs.value.length - 1];
    breadcrumbs.value = breadcrumbs.value.slice(0, -1);
    currentParentId.value = parent.parentId;
    loadChildren(currentParentId.value);
  }
};

const navigateToRoot = () => {
  breadcrumbs.value = [];
  currentParentId.value = null;
  loadRootNodes();
};

const navigateTo = (node: StorageNode) => {
  const idx = breadcrumbs.value.findIndex((b) => b.id === node.id);
  if (idx >= 0) {
    breadcrumbs.value = breadcrumbs.value.slice(0, idx + 1);
  } else {
    breadcrumbs.value.push(node);
  }
  currentParentId.value = node.id;
  loadChildren(node.id);
};

const openNode = (node: StorageNode) => {
  if (node.type === 'folder') {
    breadcrumbs.value.push(node);
    currentParentId.value = node.id;
    loadChildren(node.id);
  } else {
    // 打开文件详情或下载
    window.open(`/resources/${node.resourceId}`, '_blank');
  }
};

const handleOpenNode = () => {
  if (!contextMenu.node) return;
  openNode(contextMenu.node);
  contextMenu.show = false;
};

// ==================== 新建文件夹 ====================

const openCreateFolder = () => {
  newFolderName.value = '';
  showCreateFolder.value = true;
};

const submitCreateFolder = async () => {
  if (!newFolderName.value.trim()) return;
  await createNode({ name: newFolderName.value.trim(), type: 'folder', parentId: currentParentId.value });
  showCreateFolder.value = false;
  await loadChildren(currentParentId.value);
};

// ==================== 上传 ====================

const openUploadModal = () => {
  pendingFiles.value = [];
  uploadStarted.value = false;
  showUpload.value = true;
};

const triggerFileInput = () => fileInputRef.value?.click();

const handleFileInputChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files) {
    addFilesToPending(Array.from(input.files));
  }
  input.value = '';
};

const handleModalDrop = (e: DragEvent) => {
  isModalDragging.value = false;
  if (e.dataTransfer?.files) {
    addFilesToPending(Array.from(e.dataTransfer.files));
  }
};

const handleDrop = async (e: DragEvent) => {
  isDraggingOver.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const files = Array.from(e.dataTransfer.files);
    pendingFiles.value = files;
    uploadStarted.value = true;
    showUpload.value = true;
    // 直接开始上传（不在弹窗停留）
    await submitUpload();
  }
};

const addFilesToPending = (files: File[]) => {
  pendingFiles.value = [...pendingFiles.value, ...files];
};

const removePendingFile = (idx: number) => {
  pendingFiles.value = pendingFiles.value.filter((_, i) => i !== idx);
};

const submitUpload = async () => {
  if (pendingFiles.value.length === 0) return;
  uploadStarted.value = true;

  // 初始化本地进度项
  const items: LocalUploadItem[] = pendingFiles.value.map((file, idx) => ({
    id: `upload-${Date.now()}-${idx}`,
    file,
    status: 'pending',
    progress: 0,
  }));
  uploadItems.value = items;

  try {
    for (const item of items) {
      const abortCtrl = new AbortController();
      abortControllers.set(item.id, abortCtrl);

      item.status = 'uploading';
      try {
        await storageUpload(item.file, currentParentId.value, {
          signal: abortCtrl.signal,
          onProgress: (p) => {
            item.progress = p.percent;
          },
        });
        item.status = 'done';
        item.progress = 100;
      } catch (e) {
        item.status = 'error';
        item.error = e instanceof Error ? e.message : String(e);
      } finally {
        abortControllers.delete(item.id);
      }
    }
    await loadChildren(currentParentId.value);
    pendingFiles.value = [];
  } catch (e) {
    console.error('Upload failed:', e);
  } finally {
    uploadStarted.value = false;
    showUpload.value = false;
  }
};

// ==================== 右键菜单 ====================

const openContextMenu = (e: MouseEvent, node: StorageNode) => {
  contextMenu.show = true;
  contextMenu.node = node;
  contextMenu.x = e.clientX;
  contextMenu.y = e.clientY;
};

const openShareModal = () => {
  if (!contextMenu.node) return;
  sharingNode.value = contextMenu.node;
  selectedShareMode.value = 'permanent';
  sharePassword.value = '';
  shareExpiresIn.value = 3600;
  shareLink.value = '';
  showShare.value = true;
  contextMenu.show = false;
};

const openRename = () => {
  if (!contextMenu.node) return;
  const newName = prompt('请输入新名称', contextMenu.node.name);
  if (newName && newName !== contextMenu.node.name) {
    updateNode(contextMenu.node.id, { name: newName });
    loadChildren(currentParentId.value);
  }
  contextMenu.show = false;
};

const handleCopy = () => {
  if (!contextMenu.node) return;
  clipboardStore.copy([{
    nodeId: contextMenu.node.id,
    resourceId: contextMenu.node.resourceId || '',
    name: contextMenu.node.name,
    type: contextMenu.node.type === 'folder' ? 'folder' : 'file',
  }]);
  contextMenu.show = false;
};

const handlePaste = async () => {
  if (!clipboardStore.hasClipboard) return;
  try {
    const nodeIds = clipboardStore.clipboard.map(c => c.nodeId);
    await storageNodeCopy(nodeIds, currentParentId.value);
    await loadChildren(currentParentId.value);
    clipboardStore.clear();
  } catch (e) {
    console.error('Paste failed:', e);
  }
};

const confirmDelete = async () => {
  if (!contextMenu.node) return;
  if (confirm(`确定删除 "${contextMenu.node.name}"？`)) {
    await deleteNode(contextMenu.node.id);
    await loadChildren(currentParentId.value);
  }
  contextMenu.show = false;
};

const submitShare = async () => {
  if (!sharingNode.value) return;
  const modeMap: Record<string, string> = { temp: 'temp', permanent: 'permanent', password: 'password' };
  const share = await createShare(sharingNode.value.id, {
    mode: modeMap[selectedShareMode.value] as 'temp' | 'permanent' | 'password',
    password: sharePassword.value || undefined,
    expiresIn: shareExpiresIn.value,
  });
  if (share) {
    shareLink.value = share.url;
  }
};

const copyShareLink = async () => {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    alert('已复制到剪贴板');
  } catch {
    console.error('Failed to copy');
  }
};

const formatSize = (size: string | null): string => {
  if (!size) return '';
  const bytes = parseInt(size, 10);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const closeContextMenu = () => {
  contextMenu.show = false;
};

onMounted(() => {
  loadRootNodes();
  document.addEventListener('click', closeContextMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu);
  for (const ctrl of abortControllers.values()) {
    ctrl.abort();
  }
});
</script>

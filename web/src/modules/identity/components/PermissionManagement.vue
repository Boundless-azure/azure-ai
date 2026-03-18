<template>
  <div class="h-full flex flex-col space-y-4">
    <IdentitySectionHeader
      title="权限管理"
      description="浏览及配置系统权限规则"
    />
    <div
      class="flex-1 flex flex-col md:flex-row bg-white rounded-xl border border-gray-200 overflow-hidden"
    >
      <!-- Left Sidebar: Tabs (Horizontal on mobile) -->
      <div class="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50/60 flex flex-row md:flex-col p-2 md:p-3 space-x-2 md:space-x-0 md:space-y-2 overflow-x-auto flex-shrink-0">
        <button
          v-for="tab in nodeTabs"
          :key="tab.id"
          class="flex-shrink-0 flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap border"
          :class="
            activeType === tab.id
              ? 'bg-white text-gray-900 shadow-sm border-gray-200 font-medium'
              : 'text-gray-600 border-transparent hover:bg-gray-100'
          "
          @click="switchType(tab.id)"
        >
          <span class="flex items-center gap-2">
            <i class="fa-solid" :class="tab.icon"></i>
            {{ tab.label }}
          </span>
          <span class="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{{ getTypeCount(tab.id) }}</span>
        </button>
      </div>

      <!-- Right Content: Full Width List -->
      <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <!-- Toolbar -->
        <div class="px-3 md:px-6 py-3 md:py-4 border-b border-gray-100 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:justify-between flex-shrink-0">
          <div class="relative w-full md:w-72">
            <i
              class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
            ></i>
            <input
              v-model="searchSubject"
              class="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm"
              placeholder="搜索 Subject..."
            />
          </div>
          <button
            class="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 shadow-sm transition-colors flex items-center justify-center gap-2"
            @click="openAddResourceModal"
          >
            <i class="fa-solid fa-plus"></i>
            <span>添加 Subject</span>
          </button>
        </div>

        <!-- Subject List -->
        <div class="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-6 bg-white space-y-6 md:space-y-8">
          <div v-if="subjectCards.length > 0" class="w-full">
            <article
              v-for="card in subjectCards"
              :key="card.id"
              class="group/card w-full border-b border-gray-100 pb-8 last:border-0 last:pb-0"
            >
              <!-- Subject Header -->
              <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                <h3
                  class="text-lg font-bold text-gray-900 font-mono"
                >
                  {{ card.nodeKey }}
                </h3>
                <div class="hidden md:block h-px bg-gray-200 flex-1"></div>

                <div
                  class="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-all duration-200 md:translate-x-2 md:group-hover/card:translate-x-0"
                >
                  <button
                    class="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-medium border border-gray-200 md:border-0"
                    @click="openEditSubjectModal(card)"
                  >
                    <i class="fa-solid fa-pen"></i>
                    编辑
                  </button>
                  <button
                    class="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-medium border border-gray-200 md:border-0"
                    @click="openAddActionModal(card)"
                  >
                    <i class="fa-solid fa-plus"></i>
                    添加节点
                  </button>
                  <button
                    class="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors border border-gray-200 md:border-0"
                    title="删除 Subject"
                    @click="handleDeleteSubject(card)"
                  >
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </div>

            <!-- Subject Meta/Description -->
            <p class="text-xs text-gray-500 mb-4 font-medium">
              {{
                card.description ||
                `包含 ${card.items.length} 个权限定义节点`
              }}
            </p>

            <!-- Nodes List (Tags) -->
            <div class="flex flex-wrap gap-3">
              <div
                v-for="def in card.items"
                :key="def.id"
                class="group/tag flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                @click="openEditActionModal(def)"
              >
                <span class="text-sm font-mono font-medium text-gray-700 mr-2">
                  {{ def.nodeKey }}
                </span>
                <span
                  class="text-xs text-gray-400 mr-2 border-l border-gray-200 pl-2 group-hover/tag:text-gray-500 transition-colors"
                >
                  {{ def.description || '无描述' }}
                </span>
                <button
                  class="text-gray-300 hover:text-red-500 opacity-0 group-hover/tag:opacity-100 transition-all ml-1 w-0 group-hover/tag:w-4 overflow-hidden"
                  @click.stop="handleDeleteDefinition(def)"
                >
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>
          </article>
        </div>

          <div
            v-else
            class="h-full flex flex-col items-center justify-center text-gray-400 min-h-[400px]"
          >
          <div
            class="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 border border-gray-100"
          >
            <i class="fa-solid fa-folder-open text-2xl text-gray-300"></i>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-1">
            {{ searchSubject ? '未找到相关 Subject' : '当前分类暂无定义' }}
          </h3>
          <p class="text-sm text-gray-500">
             {{
               searchSubject
                 ? '请尝试更换搜索关键词'
                 : '请点击右上角“添加 Subject”开始'
             }}
          </p>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showResourceModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/30 backdrop-blur-sm"
        @click="showResourceModal = false"
      ></div>
      <div
        class="relative bg-white rounded-2xl shadow-xl w-[420px] max-w-[95vw] border border-gray-200 p-6"
      >
        <h3 class="text-lg font-bold text-gray-900 mb-4">添加 Subject</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              v-model="newResourceForm.nodeKey"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
              placeholder="e.g. user, menu, report"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Subject 描述</label>
            <textarea
              v-model="newResourceForm.description"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              rows="2"
              placeholder="例如：组织与成员关系管理相关权限"
            ></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">初始节点</label>
            <input
              v-model="newResourceForm.initialActionNodeKey"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
              placeholder="e.g. read"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              初始节点描述（Action Description）
            </label>
            <textarea
              v-model="newResourceForm.initialActionDescription"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              rows="3"
              placeholder="例如：允许读取组织成员列表"
            ></textarea>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            @click="showResourceModal = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            @click="submitNewResource"
          >
            添加
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showActionModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/30 backdrop-blur-sm"
        @click="showActionModal = false"
      ></div>
      <div
        class="relative bg-white rounded-2xl shadow-xl w-[420px] max-w-[95vw] border border-gray-200 p-6"
      >
        <h3 class="text-lg font-bold text-gray-900 mb-4">
          添加权限节点 ({{ actionTargetSubjectName }})
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <input
              v-model="newActionForm.nodeKey"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
              placeholder="e.g. create, update, delete"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              v-model="newActionForm.description"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            @click="showActionModal = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            @click="submitNewAction"
          >
            添加
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="showEditSubjectModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/30 backdrop-blur-sm"
        @click="showEditSubjectModal = false"
      ></div>
      <div
        class="relative bg-white rounded-2xl shadow-xl w-[420px] max-w-[95vw] border border-gray-200 p-6"
      >
        <h3 class="text-lg font-bold text-gray-900 mb-4">
          编辑 Subject: {{ editSubjectForm.nodeKey }}
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Subject 名称</label>
            <input
              v-model="editSubjectForm.nodeKey"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Subject 描述</label
            >
            <textarea
              v-model="editSubjectForm.description"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            @click="showEditSubjectModal = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            @click="submitEditSubject"
          >
            保存
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showEditActionModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/30 backdrop-blur-sm"
        @click="showEditActionModal = false"
      ></div>
      <div
        class="relative bg-white rounded-2xl shadow-xl w-[420px] max-w-[95vw] border border-gray-200 p-6"
      >
        <h3 class="text-lg font-bold text-gray-900 mb-4">
          编辑权限节点: {{ editActionForm.nodeKey }}
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >节点标识</label
            >
            <input
              v-model="editActionForm.nodeKey"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >描述</label
            >
            <textarea
              v-model="editActionForm.description"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            @click="showEditActionModal = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            @click="submitEditAction"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Permission Definition Management
 * @description 权限定义管理页面，按管理/数据/菜单节点分栏展示 Subject 卡片与权限节点。
 * @keywords-cn 权限定义, 权限节点, 数据权限节点, 菜单节点, Subject卡片
 * @keywords-en permission-definition, permission-node, data-node, menu-node, subject-card
 */
import { ref, computed, onMounted, reactive } from 'vue';
import IdentitySectionHeader from './IdentitySectionHeader.vue';
import { usePermissionDefinitions } from '../hooks/usePermissionDefinitions';
import { useUIStore } from '../../agent/store/ui.store';
import type {
  PermissionDefinitionItem as PermissionDefinition,
  PermissionDefinitionType,
} from '../types/identity.types';

const nodeTabs: Array<{
  id: PermissionDefinitionType;
  label: string;
  icon: string;
}> = [
  { id: 'management', label: '管理权限节点', icon: 'fa-shield-halved' },
  { id: 'data', label: '数据权限节点', icon: 'fa-database' },
  { id: 'menu', label: '菜单节点', icon: 'fa-bars' },
];

const ui = useUIStore();
const { list, create, remove, update } = usePermissionDefinitions();
const definitions = ref<PermissionDefinition[]>([]);
const activeType = ref<PermissionDefinitionType>('management');
const searchSubject = ref('');
const showResourceModal = ref(false);
const showActionModal = ref(false);
const showEditSubjectModal = ref(false);
const showEditActionModal = ref(false);
const actionTargetSubjectId = ref('');
const actionTargetSubjectName = ref('');
const editingSubjectId = ref('');
const editingActionId = ref('');
const newResourceForm = reactive({
  nodeKey: '',
  description: '',
  initialActionNodeKey: 'read',
  initialActionDescription: '',
});
const newActionForm = reactive({ nodeKey: '', description: '' });
const editSubjectForm = reactive({ nodeKey: '', description: '' });
const editActionForm = reactive({ nodeKey: '', description: '' });

const activeTypeDefinitions = computed(() =>
  definitions.value.filter((d) => d.permissionType === activeType.value),
);

const subjectCards = computed(() => {
  const subjects = activeTypeDefinitions.value
    .filter((d) => !d.fid)
    .filter((d) =>
      searchSubject.value
        ? d.nodeKey.toLowerCase().includes(searchSubject.value.toLowerCase())
        : true,
    )
    .sort((a, b) => a.nodeKey.localeCompare(b.nodeKey));

  return subjects.map((subject) => ({
    ...subject,
    items: activeTypeDefinitions.value
      .filter((d) => d.fid === subject.id)
      .sort((a, b) => a.nodeKey.localeCompare(b.nodeKey)),
  }));
});

onMounted(() => {
  loadData();
});

function switchType(type: PermissionDefinitionType) {
  activeType.value = type;
}

function getTypeCount(type: PermissionDefinitionType): number {
  return definitions.value.filter((d) => d.permissionType === type).length;
}

async function loadData() {
  try {
    definitions.value = await list();
  } catch (error) {
    console.error(error);
  }
}

function openAddResourceModal() {
  newResourceForm.nodeKey = '';
  newResourceForm.description = '';
  newResourceForm.initialActionNodeKey = 'read';
  newResourceForm.initialActionDescription = '';
  showResourceModal.value = true;
}

function openAddActionModal(subject?: PermissionDefinition) {
  if (!subject) return;
  actionTargetSubjectId.value = subject.id;
  actionTargetSubjectName.value = subject.nodeKey;
  newActionForm.nodeKey = '';
  newActionForm.description = '';
  showActionModal.value = true;
}

async function submitNewResource() {
  if (
    !newResourceForm.nodeKey ||
    !newResourceForm.description ||
    !newResourceForm.initialActionNodeKey
  ) {
    ui.showToast('请填写完整', 'warning');
    return;
  }

  try {
    const subject = await create({
      nodeKey: newResourceForm.nodeKey,
      description: newResourceForm.description,
      permissionType: activeType.value,
      fid: null,
    });
    await create({
      nodeKey: newResourceForm.initialActionNodeKey,
      description: newResourceForm.initialActionDescription || 'Initial action',
      permissionType: activeType.value,
      fid: subject.id,
    });
    await loadData();
    showResourceModal.value = false;
    ui.showToast('Subject 添加成功', 'success');
  } catch (error) {
    console.error(error);
  }
}

async function submitNewAction() {
  if (!actionTargetSubjectId.value || !newActionForm.nodeKey) {
    ui.showToast('请填写操作标识', 'warning');
    return;
  }

  try {
    await create({
      fid: actionTargetSubjectId.value,
      nodeKey: newActionForm.nodeKey,
      permissionType: activeType.value,
      description: newActionForm.description,
    });
    await loadData();
    showActionModal.value = false;
    ui.showToast('权限节点添加成功', 'success');
  } catch (error) {
    console.error(error);
  }
}

async function handleDeleteDefinition(def: PermissionDefinition) {
  if (!confirm(`确认删除权限点 ${def.nodeKey} 吗？`)) return;
  try {
    await remove(def.id);
    await loadData();
    ui.showToast('删除成功', 'success');
  } catch (error) {
    console.error(error);
  }
}

async function handleDeleteSubject(subject: PermissionDefinition) {
  if (!confirm(`确认删除资源 "${subject.nodeKey}" 及其所有权限节点吗？`))
    return;
  try {
    await remove(subject.id);
    await loadData();
    ui.showToast(`资源 ${subject.nodeKey} 已删除`, 'success');
  } catch (error) {
    console.error(error);
  }
}

function openEditSubjectModal(subject: PermissionDefinition) {
  editingSubjectId.value = subject.id;
  editSubjectForm.nodeKey = subject.nodeKey;
  editSubjectForm.description = subject.description || '';
  showEditSubjectModal.value = true;
}

function openEditActionModal(def: PermissionDefinition) {
  editingActionId.value = def.id;
  editActionForm.nodeKey = def.nodeKey;
  editActionForm.description = def.description || '';
  showEditActionModal.value = true;
}

async function submitEditSubject() {
  if (!editingSubjectId.value) return;

  try {
    await update(editingSubjectId.value, {
      nodeKey: editSubjectForm.nodeKey,
      description: editSubjectForm.description,
    });
    await loadData();
    showEditSubjectModal.value = false;
    ui.showToast('Subject 更新成功', 'success');
  } catch (error) {
    console.error(error);
  }
}

async function submitEditAction() {
  if (!editingActionId.value) return;
  try {
    await update(editingActionId.value, {
      nodeKey: editActionForm.nodeKey,
      description: editActionForm.description,
    });
    await loadData();
    showEditActionModal.value = false;
    ui.showToast('权限节点更新成功', 'success');
  } catch (error) {
    console.error(error);
  }
}
</script>

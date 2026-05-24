<template>
  <div class="space-y-4 h-full flex flex-col">
    <!-- Header -->
    <div class="pt-8 pb-6">
      <h2 class="text-2xl font-bold text-gray-900">{{ t('solution.title') }}</h2>
      <p class="text-sm text-gray-500 mt-1">{{ t('solution.subtitle') }}</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 border-b border-gray-200 pb-2">
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="activeTab === 'my-solutions' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
        @click="activeTab = 'my-solutions'"
      >
        <i class="fa-solid fa-box-open mr-2"></i>{{ t('solution.tabs.mySolutions') }}
      </button>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="activeTab === 'marketplace' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
        @click="activeTab = 'marketplace'"
      >
        <i class="fa-solid fa-store mr-2"></i>{{ t('solution.tabs.marketplace') }}
      </button>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="activeTab === 'my-purchases' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
        @click="activeTab = 'my-purchases'"
      >
        <i class="fa-solid fa-receipt mr-2"></i>{{ t('solution.tabs.myPurchases') }}
      </button>
    </div>

    <!-- My Solutions Tab -->
    <div v-if="activeTab === 'my-solutions'" class="flex-1 flex gap-4 min-h-0">
      <!-- Solution List -->
      <div class="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <!-- Toolbar -->
        <div class="p-4 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <!-- 聚合提示 :: 后端自动跨所有 mounted Runner 拉取真实数据 -->
            <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-500">
              <i class="fa-solid fa-server"></i>
              <span>聚合所有在线 Runner · {{ onlineRunnerCount }} 台在线</span>
            </div>
            <div class="flex-1 relative">
              <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                v-model="searchQuery"
                class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                :placeholder="t('solution.filters.search')"
                @keyup.enter="handleSearch"
              />
            </div>
            <button
              class="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm"
              @click="reloadSolutions"
              :disabled="loading"
            >
              <i class="fa-solid fa-rotate" :class="{ 'fa-spin': loading }"></i>
            </button>
          </div>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto p-4">
          <div v-if="loading" class="flex items-center justify-center py-16 text-gray-400">
            <i class="fa-solid fa-spinner fa-spin text-xl"></i>
          </div>
          <div v-else-if="solutions.length === 0" class="text-center py-16 text-gray-400">
            <i class="fa-solid fa-box-open text-4xl mb-4"></i>
            <p>{{ t('solution.empty.noSolutions') }}</p>
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="solution in solutions"
              :key="solution.id"
              class="bg-white p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
              @click="openDetail(solution)"
            >
              <div class="flex items-start gap-3">
                <div class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">
                  <i :class="solution.iconUrl || 'fa-solid fa-box-open'"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-bold text-gray-900 truncate">{{ solution.name }}</h4>
                  <p class="text-sm text-gray-500">v{{ solution.version }}</p>
                  <p class="text-xs text-gray-400 mt-1 truncate">{{ solution.summary || solution.description || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center justify-between mt-3 text-xs text-gray-400">
                <div class="flex items-center gap-3">
                  <span>
                    <i class="fa-solid fa-server mr-1"></i>{{ t('solution.badges.runners', { count: solution.runnerIds?.length || 0 }) }}
                  </span>
                  <span><i class="fa-solid fa-star mr-1"></i>{{ solution.rating }}</span>
                  <span v-if="solution.source === 'marketplace'" class="text-green-600">
                    <i class="fa-solid fa-store mr-1"></i>{{ t('solution.badges.source.marketplace') }}
                  </span>
                  <span v-else class="text-blue-600">
                    <i class="fa-solid fa-building mr-1"></i>{{ t('solution.badges.source.selfDeveloped') }}
                  </span>
                </div>
                <button
                  class="px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                  @click.stop="openUninstall(solution)"
                >
                  {{ t('solution.actions.uninstall') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="pagination.totalPages > 0" class="flex items-center justify-center gap-2 mt-4">
            <button
              class="px-3 py-1 rounded-lg border border-gray-200 text-sm"
              :disabled="pagination.page <= 1"
              @click="handlePageChange(pagination.page - 1)"
            >
              {{ t('common.prev') || '上一页' }}
            </button>
            <span class="text-sm text-gray-600">{{ pagination.page }} / {{ pagination.totalPages }}</span>
            <button
              class="px-3 py-1 rounded-lg border border-gray-200 text-sm"
              :disabled="pagination.page >= pagination.totalPages"
              @click="handlePageChange(pagination.page + 1)"
            >
              {{ t('common.next') || '下一页' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Marketplace Tab (under development placeholder) -->
    <div v-if="activeTab === 'marketplace'" class="flex-1 flex items-center justify-center min-h-0">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center max-w-md">
        <div class="w-20 h-20 rounded-full bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center text-orange-500 mx-auto mb-6">
          <i class="fa-solid fa-screwdriver-wrench text-3xl"></i>
        </div>
        <h3 class="text-xl font-bold text-gray-900 mb-2">解决方案市场 · 正在开发</h3>
        <p class="text-sm text-gray-500 leading-relaxed">
          市场功能正在打磨中,敬请期待。后续将支持解决方案的发布、安装与版本管理。
        </p>
      </div>
    </div>

    <!-- My Purchases Tab (under development placeholder) -->
    <div v-if="activeTab === 'my-purchases'" class="flex-1 flex items-center justify-center min-h-0">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center max-w-md">
        <div class="w-20 h-20 rounded-full bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center text-orange-500 mx-auto mb-6">
          <i class="fa-solid fa-screwdriver-wrench text-3xl"></i>
        </div>
        <h3 class="text-xl font-bold text-gray-900 mb-2">我的购买 · 正在开发</h3>
        <p class="text-sm text-gray-500 leading-relaxed">
          购买记录与安装管理正在打磨中,敬请期待。
        </p>
      </div>
    </div>

    <!-- Install Modal :: BaseModal -->
    <BaseModal
      :open="showInstallModal && !!installTargetSolution"
      :title="t('solution.modals.installTitle')"
      size="md"
      @close="showInstallModal = false"
    >
      <template v-if="installTargetSolution">
        <div>
          <div class="mb-4">
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                <i :class="installTargetSolution.iconUrl || 'fa-solid fa-box-open'"></i>
              </div>
              <div>
                <h4 class="font-bold text-gray-900">{{ installTargetSolution.name }}</h4>
                <p class="text-xs text-gray-500">v{{ installTargetSolution.version }}</p>
              </div>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ t('solution.modals.selectRunners') }}</label>
            <p class="text-xs text-gray-500 mb-2">{{ t('solution.modals.alreadyInstalled') }}</p>
            <div class="space-y-2 max-h-60 overflow-y-auto">
              <label
                v-for="runner in runners"
                :key="runner.id"
                class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
                :class="installSelectedRunners.includes(runner.id) ? 'border-green-500 bg-green-50' : ''"
              >
                <input
                  type="checkbox"
                  :value="runner.id"
                  v-model="installSelectedRunners"
                  class="w-4 h-4 text-green-600 rounded"
                />
                <div class="flex-1">
                  <span class="font-medium text-gray-900">{{ runner.alias }}</span>
                  <span
                    class="ml-2 px-2 py-0.5 rounded text-xs"
                    :class="runner.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                  >
                    {{ runner.status === 'online' ? '在线' : '离线' }}
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <button
          class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          @click="showInstallModal = false"
        >
          {{ t('solution.modals.cancel') }}
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
          :disabled="installSelectedRunners.length === 0"
          @click="confirmInstall"
        >
          {{ t('solution.modals.confirmInstall', { count: installSelectedRunners.length }) }}
        </button>
      </template>
    </BaseModal>

    <!-- Uninstall Modal :: BaseModal -->
    <BaseModal
      :open="showUninstallModal && !!uninstallTargetSolution"
      :title="t('solution.modals.uninstallTitle')"
      size="md"
      @close="showUninstallModal = false"
    >
      <template v-if="uninstallTargetSolution">
        <div>
          <div class="mb-4">
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                <i :class="uninstallTargetSolution.iconUrl || 'fa-solid fa-box-open'"></i>
              </div>
              <div>
                <h4 class="font-bold text-gray-900">{{ uninstallTargetSolution.name }}</h4>
                <p class="text-xs text-gray-500">v{{ uninstallTargetSolution.version }}</p>
              </div>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ t('solution.modals.selectUninstallRunners') }}</label>
            <div class="flex gap-2 mb-3">
              <button
                class="px-3 py-1 rounded-lg bg-gray-100 text-sm hover:bg-gray-200"
                @click="selectAllUninstallRunners"
              >
                {{ t('solution.modals.selectAll') }}
              </button>
              <button
                class="px-3 py-1 rounded-lg bg-gray-100 text-sm hover:bg-gray-200"
                @click="uninstallSelectedRunners = []"
              >
                {{ t('solution.modals.clearAll') }}
              </button>
            </div>
            <div class="space-y-2 max-h-60 overflow-y-auto">
              <label
                v-for="runnerId in uninstallTargetSolution.runnerIds"
                :key="runnerId"
                class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
                :class="uninstallSelectedRunners.includes(runnerId) ? 'border-red-500 bg-red-50' : ''"
              >
                <input
                  type="checkbox"
                  :value="runnerId"
                  v-model="uninstallSelectedRunners"
                  class="w-4 h-4 text-red-600 rounded"
                />
                <span class="font-medium text-gray-900">{{ getRunnerAlias(runnerId) }}</span>
              </label>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <button
          class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          @click="showUninstallModal = false"
        >
          {{ t('solution.modals.cancel') }}
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          :disabled="uninstallSelectedRunners.length === 0"
          @click="confirmUninstall"
        >
          {{ t('solution.modals.confirmUninstall', { count: uninstallSelectedRunners.length }) }}
        </button>
      </template>
    </BaseModal>

    <!-- Detail Modal :: BaseModal (lg, 自定义 title slot 含 icon) -->
    <BaseModal
      :open="showDetail && !!currentSolution"
      size="lg"
      @close="showDetail = false"
    >
      <template v-if="currentSolution" #title>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
            <i :class="currentSolution.iconUrl || 'fa-solid fa-box-open'"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-gray-900">{{ currentSolution.name }}</h3>
            <p class="text-sm text-gray-500">v{{ currentSolution.version }} · {{ currentSolution.authorName || '-' }}</p>
          </div>
        </div>
      </template>
      <template v-if="currentSolution">
        <!-- Tabs -->
        <div class="flex border-b border-gray-100 -mx-6 -mt-4 px-6 mb-4">
          <button
            class="px-4 py-3 text-sm font-medium transition-colors"
            :class="detailTab === 'detail' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="detailTab = 'detail'"
          >
            <i class="fa-solid fa-info-circle mr-2"></i>{{ t('solution.detail.title') }}
          </button>
          <button
            class="px-4 py-3 text-sm font-medium transition-colors"
            :class="detailTab === 'install-info' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="detailTab = 'install-info'"
          >
            <i class="fa-solid fa-server mr-2"></i>{{ t('solution.detail.installInfo') }}
          </button>
        </div>

        <!-- Detail Tab -->
        <div v-if="detailTab === 'detail'">
          <div class="grid grid-cols-3 gap-6">
            <!-- Main Content -->
            <div class="col-span-2">
              <h4 class="text-sm font-bold text-gray-700 mb-2">{{ t('solution.detail.description') }}</h4>
              <p class="text-sm text-gray-600 mb-4">{{ currentSolution.summary || currentSolution.description || '-' }}</p>

              <h4 v-if="currentSolution.markdownContent" class="text-sm font-bold text-gray-700 mb-2">{{ t('solution.detail.detailedInfo') }}</h4>
              <div v-if="currentSolution.markdownContent" class="prose prose-sm max-w-none text-gray-600">
                {{ currentSolution.markdownContent }}
              </div>

              <div v-if="currentSolution.includes && currentSolution.includes.length" class="mt-4">
                <h4 class="text-sm font-bold text-gray-700 mb-2">{{ t('solution.detail.includes') }}</h4>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="include in currentSolution.includes"
                    :key="include"
                    class="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs"
                  >
                    {{ t(`solution.includes.${include}`) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Sidebar -->
            <div class="space-y-4">
              <div class="bg-gray-50 rounded-lg p-4">
                <h5 class="text-xs font-bold text-gray-500 uppercase mb-2">{{ t('solution.detail.detailedInfo') }}</h5>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">{{ t('solution.detail.info.installCount') }}</span>
                    <span>{{ currentSolution.installCount }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">{{ t('solution.detail.info.rating') }}</span>
                    <span>{{ currentSolution.rating }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">{{ t('solution.detail.info.status') }}</span>
                    <span :class="currentSolution.status === 'active' ? 'text-green-600' : 'text-gray-500'">
                      {{ currentSolution.status === 'active' ? t('solution.detail.info.active') : t('solution.detail.info.inactive') }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">{{ t('solution.detail.info.source') }}</span>
                    <span :class="currentSolution.source === 'marketplace' ? 'text-green-600' : 'text-blue-600'">
                      {{ currentSolution.source === 'marketplace' ? t('solution.badges.source.marketplace') : t('solution.badges.source.selfDeveloped') }}
                    </span>
                  </div>
                  <div v-if="currentSolution.tags && currentSolution.tags.length" class="pt-2 border-t border-gray-200">
                    <span class="text-gray-500">{{ t('solution.detail.info.tags') }}</span>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <span
                        v-for="tag in currentSolution.tags"
                        :key="tag"
                        class="px-2 py-0.5 rounded-full bg-gray-200 text-xs"
                      >
                        {{ tag }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Install Info Tab -->
        <div v-if="detailTab === 'install-info'">
          <div class="mb-4">
            <h4 class="text-sm font-bold text-gray-700 mb-2">{{ t('solution.detail.installedRunners') }}</h4>
            <p class="text-xs text-gray-500 mb-3">{{ t('solution.detail.installedDesc') }}</p>
            <div v-if="currentSolution.runnerIds && currentSolution.runnerIds.length > 0" class="space-y-2">
              <div
                v-for="runnerId in currentSolution.runnerIds"
                :key="runnerId"
                class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div class="flex items-center gap-3">
                  <i class="fa-solid fa-server text-gray-400"></i>
                  <span class="font-medium text-gray-900">{{ getRunnerAlias(runnerId) }}</span>
                </div>
                <button
                  class="px-3 py-1 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50"
                  @click="quickUninstallFromRunner(runnerId)"
                >
                  {{ t('solution.actions.uninstall') }}
                </button>
              </div>
            </div>
            <div v-else class="text-center py-8 text-gray-400">
              <i class="fa-solid fa-server text-4xl mb-4"></i>
              <p>{{ t('solution.empty.noInstallInfo') }}</p>
            </div>
          </div>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
/**
 * @title SolutionManagement
 * @description 解决方案管理主组件，支持我的解决方案列表、解决方案市场和我的购买
 * @keywords-cn 解决方案管理, 解决方案市场, 我的解决方案, 我的购买
 * @keywords-en solution-management, solution-marketplace, my-solutions, my-purchases
 */
import { ref, onMounted, computed } from 'vue';
import BaseModal from '../../../components/BaseModal.vue';
import { useI18n } from '../../agent/composables/useI18n';
import { useSolutions } from '../hooks/useSolutions';
import type { Solution } from '../types/solution.types';

const { t } = useI18n();

const {
  loading,
  solutions,
  currentSolution,
  runners,
  pagination,
  loadSolutions,
  loadRunners,
  installSolution,
  uninstallSolution,
  setPage,
} = useSolutions();

const activeTab = ref('my-solutions');
const searchQuery = ref('');
const showDetail = ref(false);
const detailTab = ref('detail');

// 在线 Runner 数 :: 数据已跨 Runner 自动聚合, UI 仅展示提示
const onlineRunnerCount = computed(
  () => runners.value.filter((r) => r.status === 'online').length,
);

// Install Modal
const showInstallModal = ref(false);
const installTargetSolution = ref<Solution | null>(null);
const installSelectedRunners = ref<string[]>([]);

// Uninstall Modal
const showUninstallModal = ref(false);
const uninstallTargetSolution = ref<Solution | null>(null);
const uninstallSelectedRunners = ref<string[]>([]);

const handleSearch = () => {
  setPage(1);
  loadSolutions({ q: searchQuery.value });
};

const handlePageChange = (newPage: number) => {
  setPage(newPage);
  loadSolutions({ q: searchQuery.value });
};

/**
 * 重新拉取聚合后的 Solution 列表 :: 用于刷新按钮 / Runner 上下线变化
 * @keyword-en reload-solutions
 */
const reloadSolutions = async () => {
  await Promise.all([loadRunners(), loadSolutions({ q: searchQuery.value })]);
};

const openDetail = (solution: Solution) => {
  currentSolution.value = solution;
  detailTab.value = 'detail';
  showDetail.value = true;
};

const openInstall = (solution: Solution) => {
  installTargetSolution.value = solution;
  // Pre-select runners that are not yet installed
  const installedRunnerIds = new Set(solution.runnerIds || []);
  installSelectedRunners.value = runners.value
    .filter((r) => r.status === 'online' && !installedRunnerIds.has(r.id))
    .map((r) => r.id);
  showInstallModal.value = true;
};

const openUninstall = (solution: Solution) => {
  uninstallTargetSolution.value = solution;
  uninstallSelectedRunners.value = [...(solution.runnerIds || [])];
  showUninstallModal.value = true;
};

const confirmInstall = async () => {
  if (installTargetSolution.value && installSelectedRunners.value.length > 0) {
    await installSolution(installTargetSolution.value.id, installSelectedRunners.value);
    showInstallModal.value = false;
    installTargetSolution.value = null;
    installSelectedRunners.value = [];
  }
};

const confirmUninstall = async () => {
  if (uninstallTargetSolution.value && uninstallSelectedRunners.value.length > 0) {
    await uninstallSolution(uninstallTargetSolution.value.id, uninstallSelectedRunners.value);
    showUninstallModal.value = false;
    uninstallTargetSolution.value = null;
    uninstallSelectedRunners.value = [];
  }
};

const selectAllUninstallRunners = () => {
  if (uninstallTargetSolution.value) {
    uninstallSelectedRunners.value = [...(uninstallTargetSolution.value.runnerIds || [])];
  }
};

const getRunnerAlias = (runnerId: string): string => {
  const runner = runners.value.find((r) => r.id === runnerId);
  return runner?.alias || runnerId;
};

const quickUninstallFromRunner = async (runnerId: string) => {
  if (currentSolution.value) {
    await uninstallSolution(currentSolution.value.id, [runnerId]);
    // Refresh current solution
    const solution = solutions.value.find((s) => s.id === currentSolution.value?.id);
    if (solution) {
      currentSolution.value = solution;
    }
  }
};

onMounted(async () => {
  // 仅加载 my-solutions 所需数据 :: 市场和我的购买已切到"开发中"占位, 不再调用其接口
  await Promise.all([loadSolutions(), loadRunners()]);
});
</script>

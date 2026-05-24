<!--
  @title DomainTab Component
  @description Runner 域名管理表格
  @keywords-cn 域名管理, 表格, 域名列表
  @keywords-en domain-tab, table, domain-list
-->
<template>
  <div class="space-y-4">
    <!-- 操作栏 -->
    <div class="flex justify-end gap-3">
      <button
        v-if="!freeDomainClaimed"
        @click="handleClaimFreeDomain"
        :disabled="claiming"
        class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
      >
        <i class="fa-solid fa-gift"></i>
        <span v-if="claiming"><i class="fa-solid fa-spinner fa-spin mr-1"></i>领取中...</span>
        <span v-else>领取免费域名</span>
      </button>
      <button
        @click="showAddModal = true"
        class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
      >
        <i class="fa-solid fa-plus"></i>
        添加域名
      </button>
    </div>

    <!-- 域名表格 -->
    <div class="bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-hide">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">域名</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">路径规则</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="domain in domains" :key="domain.id">
            <td class="px-4 py-3 text-sm text-gray-900">{{ domain.domain }}</td>
            <td class="px-4 py-3 text-xs text-gray-500 font-mono">{{ domain.pathPattern }}</td>
            <td class="px-4 py-3 text-sm">
              <span
                class="px-2 py-1 rounded-full text-xs font-medium"
                :class="domain.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
              >
                {{ domain.active ? '活跃' : '停用' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right text-sm">
              <button
                @click="handleDelete(domain)"
                class="text-red-600 hover:text-red-800"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
          <tr v-if="domains.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-gray-500">
              暂无域名配置
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 添加域名弹窗 -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showAddModal = false"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-bold mb-4">添加域名</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">域名</label>
            <input
              v-model="newDomain"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="app.example.com"
            />
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showAddModal = false"
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            取消
          </button>
          <button
            @click="handleAdd"
            :disabled="adding"
            class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            <span v-if="adding"><i class="fa-solid fa-spinner fa-spin mr-1"></i>添加中...</span>
            <span v-else>添加</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title DomainTab
 * @description Runner 域名管理表格，提供域名的增删查能力。
 * @keywords-cn 域名管理, 表格, 域名列表
 * @keywords-en domain-tab, table, domain-list
 */
import { ref, onMounted } from 'vue';
import { runnerPanelApi, type RunnerDomain } from '../../../../api/runner';

const props = defineProps<{
  runnerId: string;
}>();

const domains = ref<RunnerDomain[]>([]);
const showAddModal = ref(false);
const newDomain = ref('');
const adding = ref(false);
const freeDomainClaimed = ref(false);
const claiming = ref(false);

async function loadDomains() {
  try {
    const res = await runnerPanelApi.listDomains(props.runnerId);
    domains.value = res.data;
    const claimRes = await runnerPanelApi.checkFreeDomainClaimed(props.runnerId);
    freeDomainClaimed.value = claimRes.data.exists;
  } catch (err) {
    console.error('Failed to load domains:', err);
  }
}

async function handleClaimFreeDomain() {
  claiming.value = true;
  try {
    await runnerPanelApi.claimFreeDomain(props.runnerId);
    freeDomainClaimed.value = true;
    await loadDomains();
  } catch (err: any) {
    alert(err?.message || '领取失败');
  } finally {
    claiming.value = false;
  }
}

async function handleAdd() {
  if (!newDomain.value.trim()) return;
  adding.value = true;
  try {
    await runnerPanelApi.createDomain(props.runnerId, newDomain.value.trim());
    showAddModal.value = false;
    newDomain.value = '';
    await loadDomains();
  } catch (err) {
    console.error('Failed to create domain:', err);
  } finally {
    adding.value = false;
  }
}

async function handleDelete(domain: RunnerDomain) {
  if (!confirm(`确定删除域名 "${domain.domain}" 吗？`)) return;
  try {
    await runnerPanelApi.deleteDomain(props.runnerId, domain.id);
    await loadDomains();
  } catch (err) {
    console.error('Failed to delete domain:', err);
  }
}

onMounted(async () => {
  await loadDomains();
});
</script>

/**
 * @title useSolutions Hook
 * @description Solution module composable hook
 * @keywords-cn SolutionHook, Solution管理Hook
 * @keywords-en solution-hook, solution-management-hook
 */
import { ref } from 'vue';
import * as solutionApi from '../../../api/solution';
import type {
  Solution,
  CreateSolutionRequest,
  UpdateSolutionRequest,
  ListSolutionsQuery,
  PaginatedSolutionsResponse,
  TagResponse,
  InstallSolutionRequest,
  UninstallSolutionRequest,
  RunnerInfo,
  SolutionPurchase,
  PurchaseSolutionRequest,
} from '../types/solution.types';

export function useSolutions() {
  const loading = ref(false);
  const solutions = ref<Solution[]>([]);
  const marketplaceSolutions = ref<Solution[]>([]);
  const currentSolution = ref<Solution | null>(null);
  const purchases = ref<SolutionPurchase[]>([]);
  const tags = ref<TagResponse[]>([]);
  const runners = ref<RunnerInfo[]>([]);
  const error = ref<string | null>(null);

  // 分页状态
  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  const marketplacePagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // 加载我的 Solutions
  async function loadSolutions(query: ListSolutionsQuery = {}) {
    loading.value = true;
    error.value = null;
    try {
      const result = await solutionApi.listSolutions({
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        ...query,
      });
      solutions.value = result.items;
      pagination.value.total = result.total;
      pagination.value.totalPages = result.totalPages;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load solutions';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 加载市场 Solutions
  async function loadMarketplaceSolutions(query: ListSolutionsQuery = {}) {
    loading.value = true;
    error.value = null;
    try {
      const result = await solutionApi.listMarketplaceSolutions({
        page: marketplacePagination.value.page,
        pageSize: marketplacePagination.value.pageSize,
        ...query,
      });
      marketplaceSolutions.value = result.items;
      marketplacePagination.value.total = result.total;
      marketplacePagination.value.totalPages = result.totalPages;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load marketplace';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 加载购买记录
  async function loadPurchases() {
    loading.value = true;
    error.value = null;
    try {
      purchases.value = await solutionApi.getPurchases();
      return purchases.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load purchases';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 加载标签
  async function loadTags() {
    try {
      tags.value = await solutionApi.getTags();
    } catch {
      // ignore
    }
  }

  // 加载 Runner 列表
  async function loadRunners() {
    try {
      runners.value = await solutionApi.getRunners();
    } catch {
      // ignore
    }
  }

  // 获取 Solution 详情
  async function getSolution(id: string) {
    loading.value = true;
    error.value = null;
    try {
      currentSolution.value = await solutionApi.getSolution(id);
      return currentSolution.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to get solution';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 创建 Solution
  async function createSolution(data: CreateSolutionRequest): Promise<Solution | null> {
    loading.value = true;
    error.value = null;
    try {
      const solution = await solutionApi.createSolution(data);
      await loadSolutions();
      return solution;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create solution';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 更新 Solution
  async function updateSolution(id: string, data: UpdateSolutionRequest): Promise<Solution | null> {
    loading.value = true;
    error.value = null;
    try {
      const solution = await solutionApi.updateSolution(id, data);
      currentSolution.value = solution;
      await loadSolutions();
      return solution;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update solution';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 删除 Solution
  async function deleteSolution(id: string): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      await solutionApi.deleteSolution(id);
      await loadSolutions();
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete solution';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // 安装 Solution
  async function installSolution(id: string, runnerIds: string[]): Promise<Solution | null> {
    loading.value = true;
    error.value = null;
    try {
      const solution = await solutionApi.installSolution(id, { runnerIds });
      await loadSolutions();
      await loadMarketplaceSolutions();
      return solution;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to install solution';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 卸载 Solution
  async function uninstallSolution(id: string, runnerIds: string[]): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      await solutionApi.uninstallSolution(id, { runnerIds });
      await loadSolutions();
      await loadMarketplaceSolutions();
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to uninstall solution';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // 购买 Solution
  async function purchaseSolution(data: PurchaseSolutionRequest): Promise<SolutionPurchase | null> {
    loading.value = true;
    error.value = null;
    try {
      const purchase = await solutionApi.purchaseSolution(data);
      await loadPurchases();
      return purchase;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to purchase solution';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 分页控制
  function setPage(page: number) {
    pagination.value.page = page;
  }

  function setMarketplacePage(page: number) {
    marketplacePagination.value.page = page;
  }

  return {
    loading,
    solutions,
    marketplaceSolutions,
    currentSolution,
    purchases,
    tags,
    runners,
    error,
    pagination,
    marketplacePagination,
    loadSolutions,
    loadMarketplaceSolutions,
    loadPurchases,
    loadTags,
    loadRunners,
    getSolution,
    createSolution,
    updateSolution,
    deleteSolution,
    installSolution,
    uninstallSolution,
    purchaseSolution,
    setPage,
    setMarketplacePage,
  };
}

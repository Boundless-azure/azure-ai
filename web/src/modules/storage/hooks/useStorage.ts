/**
 * @title useStorage Hook
 * @description Storage module composable hook
 * @keywords-cn 存储Hook, 资源库Hook
 * @keywords-en storage-hook, resource-library-hook
 */
import { ref } from 'vue';
import * as storageApi from '../../../api/storage';
import type {
  StorageNode,
  CreateNodeRequest,
  UpdateNodeRequest,
  CreateShareRequest,
  ShareLinkResponse,
  ListNodesQuery,
} from '../types/storage.types';

export function useStorage() {
  const loading = ref(false);
  const nodes = ref<StorageNode[]>([]);
  const currentNode = ref<StorageNode | null>(null);
  const error = ref<string | null>(null);

  // 加载根目录
  async function loadRootNodes() {
    loading.value = true;
    error.value = null;
    try {
      nodes.value = await storageApi.getRootNodes();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load nodes';
    } finally {
      loading.value = false;
    }
  }

  // 加载节点列表
  async function loadNodes(query: ListNodesQuery) {
    loading.value = true;
    error.value = null;
    try {
      nodes.value = await storageApi.listNodes(query);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load nodes';
    } finally {
      loading.value = false;
    }
  }

  // 加载子节点
  async function loadChildren(parentId: string | null) {
    loading.value = true;
    error.value = null;
    try {
      // parentId 为 null 时查询根目录
      if (parentId === null) {
        nodes.value = await storageApi.getRootNodes();
      } else {
        nodes.value = await storageApi.listNodes({ parentId });
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load children';
    } finally {
      loading.value = false;
    }
  }

  // 获取节点详情
  async function getNode(id: string) {
    loading.value = true;
    error.value = null;
    try {
      currentNode.value = await storageApi.getNode(id);
      return currentNode.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to get node';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 创建节点
  async function createNode(data: CreateNodeRequest): Promise<StorageNode | null> {
    loading.value = true;
    error.value = null;
    try {
      const node = await storageApi.createNode(data);
      return node;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create node';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 更新节点
  async function updateNode(id: string, data: UpdateNodeRequest): Promise<StorageNode | null> {
    loading.value = true;
    error.value = null;
    try {
      const node = await storageApi.updateNode(id, data);
      return node;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update node';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 删除节点
  async function deleteNode(id: string): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      await storageApi.deleteNode(id);
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete node';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // 创建分享链接
  async function createShare(
    id: string,
    data: CreateShareRequest,
  ): Promise<ShareLinkResponse | null> {
    loading.value = true;
    error.value = null;
    try {
      const share = await storageApi.createShare(id, data);
      return share;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create share';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 删除分享链接
  async function removeShare(id: string): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      await storageApi.removeShare(id);
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to remove share';
      return false;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    nodes,
    currentNode,
    error,
    loadRootNodes,
    loadNodes,
    loadChildren,
    getNode,
    createNode,
    updateNode,
    deleteNode,
    createShare,
    removeShare,
  };
}

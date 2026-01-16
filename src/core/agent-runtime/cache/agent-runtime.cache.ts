/**
 * @title AgentRuntime 简易缓存
 * @description 提供内存级别的已加载 Agent 目录缓存，减少重复转译与导入。
 * @keywords-cn 缓存, 内存, 目录映射
 * @keywords-en cache, memory, dir-map
 */
export class AgentRuntimeCache<T> {
  private map = new Map<string, T>();

  get(key: string): T | undefined {
    return this.map.get(key);
  }

  set(key: string, value: T): void {
    this.map.set(key, value);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }
}

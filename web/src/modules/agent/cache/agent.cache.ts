/**
 * @title Agent Cache
 * @description Cache handling for Agent module (e.g., local storage).
 * @keywords-cn 缓存, 本地存储
 * @keywords-en cache, local-storage
 */

export class AgentCache {
  private static readonly SESSION_KEY = 'agent_current_session_id';

  public static getCurrentSessionId(): string | null {
    return localStorage.getItem(this.SESSION_KEY);
  }

  public static setCurrentSessionId(sessionId: string): void {
    localStorage.setItem(this.SESSION_KEY, sessionId);
  }

  public static clearCurrentSessionId(): void {
    localStorage.removeItem(this.SESSION_KEY);
  }
}

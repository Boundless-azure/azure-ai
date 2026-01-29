/**
 * @title useAuth
 * @description 登录/登出与状态读取的组合函数；包装 Pinia store 并提供统一事件。
 * @keywords-cn 认证, 登录, 登出, 状态
 * @keywords-en auth, login, logout, state
 */
import { ref } from 'vue';
import { useAuthStore } from '../store/auth.store';
import { AUTH_EVENT_NAMES } from '../constants/auth.constants';

export function useAuth() {
  const store = useAuthStore();
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function login(payload: Record<string, unknown>) {
    loading.value = true;
    error.value = null;
    try {
      const ok = await store.login(payload);
      if (ok) {
        window.dispatchEvent(new CustomEvent(AUTH_EVENT_NAMES.loggedIn));
      }
      return ok;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'login failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    store.logout();
    window.dispatchEvent(new CustomEvent(AUTH_EVENT_NAMES.loggedOut));
  }

  function isLoggedIn() {
    return !!store.token;
  }

  return { loading, error, login, logout, isLoggedIn, store };
}

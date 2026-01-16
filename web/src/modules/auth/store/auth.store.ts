import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { LoginResponse, Principal, AbilityRule } from '../types/auth.types';
import { authService } from '../services/auth.service';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('token') || '');
  const principal = ref<Principal | null>(
    localStorage.getItem('principal')
      ? JSON.parse(localStorage.getItem('principal')!)
      : null
  );
  const abilityRules = ref<AbilityRule[]>(
    localStorage.getItem('abilityRules')
      ? JSON.parse(localStorage.getItem('abilityRules')!)
      : []
  );

  async function login(payload: Record<string, any>) {
    try {
      const res = await authService.login(payload);
      if (res && res.token) {
        setSession(res);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Login failed', e);
      throw e;
    }
  }

  function setSession(data: LoginResponse) {
    token.value = data.token;
    principal.value = data.principal;
    abilityRules.value = data.ability.rules;

    localStorage.setItem('token', data.token);
    localStorage.setItem('principal', JSON.stringify(data.principal));
    localStorage.setItem('abilityRules', JSON.stringify(data.ability.rules));
  }

  function logout() {
    token.value = '';
    principal.value = null;
    abilityRules.value = [];
    localStorage.removeItem('token');
    localStorage.removeItem('principal');
    localStorage.removeItem('abilityRules');
    
    // Redirect to login if not already there
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  return {
    token,
    principal,
    abilityRules,
    login,
    logout,
  };
});

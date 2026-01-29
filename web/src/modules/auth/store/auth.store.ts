/**
 * @title Auth Store
 * @description Pinia store for managing authentication state and user session.
 * @keywords-cn 认证存储, 状态管理, 用户会话
 * @keywords-en auth-store, state-management, user-session
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  LoginResponse,
  Principal,
  AbilityRule,
} from '../types/auth.types';
import { authService } from '../services/auth.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPrincipal(value: unknown): value is Principal {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.displayName !== 'string') return false;
  if (typeof value.principalType !== 'string') return false;
  const email = value.email;
  if (!(email === undefined || email === null || typeof email === 'string')) {
    return false;
  }
  const phone = value.phone;
  if (!(phone === undefined || phone === null || typeof phone === 'string')) {
    return false;
  }
  const tenantId = value.tenantId;
  if (
    !(
      tenantId === undefined ||
      tenantId === null ||
      typeof tenantId === 'string'
    )
  ) {
    return false;
  }
  return true;
}

function isAbilityRule(value: unknown): value is AbilityRule {
  if (!isRecord(value)) return false;
  if (typeof value.subject !== 'string') return false;
  if (typeof value.action !== 'string') return false;
  const conditions = value.conditions;
  if (
    !(
      conditions === undefined ||
      (typeof conditions === 'object' && conditions !== null)
    )
  ) {
    return false;
  }
  return true;
}

function isAbilityRuleArray(value: unknown): value is AbilityRule[] {
  return Array.isArray(value) && value.every(isAbilityRule);
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('token') || '');
  const principalRaw = localStorage.getItem('principal');
  let principalInit: Principal | null = null;
  if (principalRaw) {
    try {
      const parsed = JSON.parse(principalRaw);
      principalInit = isPrincipal(parsed) ? parsed : null;
    } catch {
      principalInit = null;
    }
  }
  const principal = ref<Principal | null>(principalInit);

  const abilityRulesRaw = localStorage.getItem('abilityRules');
  let abilityRulesInit: AbilityRule[] = [];
  if (abilityRulesRaw) {
    try {
      const parsed = JSON.parse(abilityRulesRaw);
      abilityRulesInit = isAbilityRuleArray(parsed) ? parsed : [];
    } catch {
      abilityRulesInit = [];
    }
  }
  const abilityRules = ref<AbilityRule[]>(abilityRulesInit);

  async function login(payload: Record<string, any>) {
    try {
      const res = await authService.login(payload);
      if (res && res.data && res.data.token) {
        setSession(res.data);
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

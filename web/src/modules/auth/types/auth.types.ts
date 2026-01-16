export interface AbilityRule {
  subject: string;
  action: string;
  conditions?: Record<string, unknown>;
}

export interface Principal {
  id: string;
  displayName: string;
  principalType: string;
  email?: string | null;
  phone?: string | null;
  tenantId?: string | null;
}

export interface LoginResponse {
  token: string;
  principal: Principal;
  ability: {
    rules: AbilityRule[];
  };
}

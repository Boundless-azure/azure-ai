import type { PluginHookTuple } from '../../src/core/plugin/types';

export interface CustomerCreatedPayload {
  id: string;
  email: string;
  channel?: string;
  createdAt: string; // ISO timestamp
}

export interface CustomerProfileUpdatedPayload {
  id: string;
  changes: Record<string, unknown>; // 变更字段集合
  updatedAt: string; // ISO timestamp
}

export interface OrderPaidPayload {
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  method: 'alipay' | 'wechat' | 'card' | 'paypal';
  paidAt: string; // ISO timestamp
}

export type PluginHooks =
  | PluginHookTuple<'customer.created', CustomerCreatedPayload>
  | PluginHookTuple<'customer.profile.updated', CustomerProfileUpdatedPayload>
  | PluginHookTuple<'order.paid', OrderPaidPayload>;

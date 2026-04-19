import { computed, ref } from 'vue';
import type { Socket } from 'socket.io-client';
import { hookbusDebugApi } from '../../../api/hookbus-debug';
import {
  HOOKBUS_DEBUG_DEFAULT_ENDPOINT,
  HOOKBUS_DEBUG_DEFAULT_PAYLOAD,
} from '../constants/hookbus-debug.constants';
import {
  HookBusRegistrationSchema,
  type HookBusConnectPayload,
  type HookBusDebugRecord,
  type HookBusRegistration,
} from '../types/hookbus-debug.types';

/**
 * @title useHookbusDebug
 * @description 提供 HookBus 调试连接、请求发送、历史记录与结果管理。
 * @keywords-cn hookbus调试hook, 连接, 请求历史
 * @keywords-en use-hookbus-debug, connect, request-history
 */
export function useHookbusDebug() {
  const endpoint = ref(HOOKBUS_DEBUG_DEFAULT_ENDPOINT);
  const connectKey = ref('');
  const connected = ref(false);
  const connecting = ref(false);
  const selectedHook = ref('');
  const payloadText = ref(HOOKBUS_DEBUG_DEFAULT_PAYLOAD);
  const resultText = ref('');
  const errorText = ref('');
  const hooks = ref<HookBusRegistration[]>([]);
  const history = ref<HookBusDebugRecord[]>([]);
  const debugLogs = ref<string[]>([]);
  const gatewayEnabled = ref(false);
  const gatewayUpdating = ref(false);

  let socket: Socket | null = null;

  const hookCount = computed(() => hooks.value.length);

  const disconnect = () => {
    if (!socket) return;
    socket.disconnect();
    socket = null;
    connected.value = false;
    connecting.value = false;
  };

  const connect = (payload?: Partial<HookBusConnectPayload>) => {
    const targetEndpoint = payload?.endpoint ?? endpoint.value;
    const key = payload?.key ?? connectKey.value;
    endpoint.value = targetEndpoint;
    connectKey.value = key;
    errorText.value = '';
    connecting.value = true;
    disconnect();
    try {
      const normalized = hookbusDebugApi.normalizeEndpoint(targetEndpoint);
      endpoint.value = normalized;
      socket = hookbusDebugApi.connect(normalized, key || undefined);
      socket.on('connect', () => {
        connected.value = true;
        connecting.value = false;
        socket?.emit('hookbus/list');
      });
      socket.on('disconnect', () => {
        connected.value = false;
      });
      socket.on('connect_error', (err: Error) => {
        connecting.value = false;
        connected.value = false;
        errorText.value = err.message;
      });
      socket.on('hookbus/debug_disabled', (payload: { message?: string }) => {
        connecting.value = false;
        connected.value = false;
        errorText.value = payload?.message ?? 'hookbus debug is disabled';
      });
      socket.on('hookbus/registrations', (raw: { items?: unknown[] }) => {
        const next = (raw.items ?? [])
          .map((item) => HookBusRegistrationSchema.safeParse(item))
          .filter((item) => item.success)
          .map((item) => item.data);
        hooks.value = next;
        if (!selectedHook.value && next.length > 0) {
          selectedHook.value = next[0].name;
        }
      });
      socket.on('hookbus/debug', (event: unknown) => {
        debugLogs.value.unshift(JSON.stringify(event));
        if (debugLogs.value.length > 50) {
          debugLogs.value.length = 50;
        }
      });
    } catch (error) {
      connecting.value = false;
      connected.value = false;
      errorText.value = error instanceof Error ? error.message : 'connect failed';
    }
  };

  const sendDebug = async () => {
    if (!socket || !connected.value) {
      errorText.value = 'socket not connected';
      return;
    }
    if (!selectedHook.value) {
      errorText.value = 'please select a hook';
      return;
    }
    let parsedPayload: unknown = {};
    try {
      parsedPayload = payloadText.value.trim()
        ? JSON.parse(payloadText.value)
        : {};
    } catch {
      errorText.value = 'payload must be valid JSON';
      return;
    }
    const reqId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await new Promise<void>((resolve) => {
      socket?.emit(
        'hookbus/emit',
        { name: selectedHook.value, payload: parsedPayload },
        (resp: { ok: boolean; results?: unknown; message?: string; ts?: number }) => {
          const formatted = JSON.stringify(resp, null, 2);
          resultText.value = formatted;
          history.value.unshift({
            id: reqId,
            hookName: selectedHook.value,
            endpoint: endpoint.value,
            payloadText: payloadText.value,
            createdAt: Date.now(),
            resultText: formatted,
            ok: Boolean(resp.ok),
          });
          if (history.value.length > 100) history.value.length = 100;
          resolve();
        },
      );
    });
  };

  const loadHistory = (recordId: string) => {
    const record = history.value.find((item) => item.id === recordId);
    if (!record) return;
    selectedHook.value = record.hookName;
    payloadText.value = record.payloadText;
    resultText.value = record.resultText;
  };

  const refreshGatewayState = async () => {
    try {
      const resp = await hookbusDebugApi.getGatewayState();
      gatewayEnabled.value = Boolean(resp.data?.enabled);
    } catch (error) {
      errorText.value =
        error instanceof Error ? error.message : 'load gateway state failed';
    }
  };

  const setGatewayEnabled = async (enabled: boolean) => {
    gatewayUpdating.value = true;
    errorText.value = '';
    try {
      const resp = await hookbusDebugApi.setGatewayState(enabled);
      gatewayEnabled.value = Boolean(resp.data?.enabled);
    } catch (error) {
      errorText.value =
        error instanceof Error ? error.message : 'update gateway state failed';
    } finally {
      gatewayUpdating.value = false;
    }
  };

  return {
    endpoint,
    connectKey,
    connected,
    connecting,
    selectedHook,
    payloadText,
    resultText,
    errorText,
    hooks,
    gatewayEnabled,
    gatewayUpdating,
    hookCount,
    history,
    debugLogs,
    connect,
    disconnect,
    sendDebug,
    loadHistory,
    refreshGatewayState,
    setGatewayEnabled,
  };
}

import type { ZodTypeAny } from 'zod';
import type { HookMetadata } from '../types/hook.types';

/**
 * @title Hook Controller decorators
 * @description Define hook-first controller methods that receive payload array items as positional args.
 * @keywords-en hook-controller, positional-args, llm-payload-array
 */

export const HOOK_CONTROLLER_METADATA = 'hookbus:hook-controller';
export const HOOK_ROUTE_METADATA = 'hookbus:hook-route';

export interface HookControllerOptions {
  pluginName?: string;
  tags?: string[];
}

export interface HookRouteOptions {
  hook: string;
  description: string;
  /**
   * Positional argument schemas. LLM-facing payload is always an array, and
   * item i is passed to controller arg i.
   */
  args?: ZodTypeAny[];
  metadata?: Omit<
    HookMetadata,
    'description' | 'payloadSchema' | 'pluginName' | 'tags'
  > & {
    pluginName?: string;
    tags?: string[];
  };
}

export interface HookControllerMeta extends HookControllerOptions {
  isHookController: true;
}

export interface HookRouteMeta extends HookRouteOptions {
  className?: string;
  methodName?: string;
  methodRef?: string;
}

export function HookController(
  options: HookControllerOptions = {},
): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(
      HOOK_CONTROLLER_METADATA,
      { ...options, isHookController: true },
      target,
    );
  };
}

export function HookRoute(options: HookRouteOptions) {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => unknown>,
  ) => {
    if (!descriptor.value) return;
    const className =
      target && (target as { constructor?: { name?: string } }).constructor
        ? (target as { constructor?: { name?: string } }).constructor?.name
        : 'UnknownController';
    const methodName = String(propertyKey);
    Reflect.defineMetadata(
      HOOK_ROUTE_METADATA,
      {
        ...options,
        className,
        methodName,
        methodRef: `${className}.${methodName}`,
      } satisfies HookRouteMeta,
      descriptor.value,
    );
  };
}

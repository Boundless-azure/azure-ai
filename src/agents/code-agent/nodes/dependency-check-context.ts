import type {
  CodeGraphActionKind,
  CodeGraphRequest,
  RunnerSolutionSummary,
} from './dependency-check.types';

/**
 * Read a standard `{ items }` hook payload or array payload.
 * @keyword-cn Hook数据, 列表读取
 * @keyword-en hook-data, item-list
 */
export function readItems(value: unknown): Record<string, unknown>[] {
  const rawItems =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>).items
      : value;
  if (!Array.isArray(rawItems)) return [];
  return rawItems.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  );
}

/**
 * Read one string field from an unknown record.
 * @keyword-cn 字段读取, Hook数据
 * @keyword-en field-read, hook-data
 */
export function readStringField(
  value: Record<string, unknown>,
  field: string,
): string {
  const raw = value[field];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Read a string field from code graph context.
 * @keyword-cn Graph上下文, 字段读取
 * @keyword-en graph-context, field-read
 */
export function readContextString(
  context: CodeGraphRequest['context'],
  field: string,
): string | undefined {
  const raw = context[field];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

/**
 * Read an object field from code graph context.
 * @keyword-cn Graph上下文, 字段读取
 * @keyword-en graph-context, field-read
 */
export function readContextRecord(
  context: CodeGraphRequest['context'],
  field: string,
): Record<string, unknown> | undefined {
  const raw = context[field];
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : undefined;
}

/**
 * Resolve a model-produced solution choice to a real runner solution.
 * @keyword-cn Solution选择, 依赖判定
 * @keyword-en solution-selection, dependency-decision
 */
export function resolveSolutionChoice(
  choice: { id?: string; solutionId?: string; name?: string },
  solutions: RunnerSolutionSummary[],
): RunnerSolutionSummary | null {
  const ids = [choice.solutionId, choice.id]
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => item.trim());
  const names = [choice.name]
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => item.trim().toLowerCase());
  return (
    solutions.find(
      (solution) =>
        ids.includes(solution.solutionId) ||
        ids.includes(solution.id) ||
        names.includes(solution.name.toLowerCase()),
    ) ?? null
  );
}

/**
 * Normalize action names used by the dependency check node.
 * @keyword-cn 动作选择, 动作类型
 * @keyword-en action-selection, target-kind
 */
export function normalizeActionChoice(
  value: string | undefined,
): CodeGraphActionKind | null {
  if (value === 'app' || value === 'unit' || value === 'data-point') {
    return value;
  }
  return null;
}

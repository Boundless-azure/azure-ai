import { Logger } from '@nestjs/common';
import z from 'zod';
import type { AgentAiServer } from '@/core/agent-runtime/types/agent-runtime.types';
import { readItems, readStringField } from './dependency-check-context';
import {
  parseJsonObjectLoose,
  selectLogicModel,
} from './dependency-check-decision';
import type { SaasHookBusLike, SelectedManuals } from './change-plan.types';
import type {
  CodeGenOrchestrateInput,
  CodeGraphNodeLogger,
  CodeGraphTargetRouteDecision,
  WorkflowContext,
} from './dependency-check.types';

const logger = new Logger('CodeAgentChangePlanKnowledge');
const MANUAL_TEXT_CAP = 8000;

type CandidateBook = {
  id: string;
  name: string;
  description: string;
  tags: string[];
};

const BookPickSchema = z.object({
  bookIds: z.array(z.string()).optional(),
  notice: z.string().optional(),
});

/**
 * Select knowledge books by routePlan and load their chapters as the generation manual.
 * @keyword-cn 选书读书, 手册加载
 * @keyword-en select-load-books, manual-load
 */
export async function loadPlanningManuals(args: {
  hookBus: SaasHookBusLike | null;
  workflowContext: WorkflowContext | null;
  aiAdapter: AgentAiServer;
  input: CodeGenOrchestrateInput;
  requirement: string;
  targetPlan: CodeGraphTargetRouteDecision[];
  graphLog: CodeGraphNodeLogger;
}): Promise<SelectedManuals> {
  const empty: SelectedManuals = { bookIds: [], manualText: '' };
  const frontendTargets = args.targetPlan.filter(
    (t) => t.action === 'app',
  ).length;
  args.graphLog.info('knowledge:start', 'selecting planning manuals', {
    hasHookBus: Boolean(args.hookBus),
    frontendTargets,
    targets: args.targetPlan.length,
  });
  if (!args.hookBus) {
    args.graphLog.warn(
      'knowledge:skip',
      'no SaaS HookBus injected into change-plan; planning without manual',
    );
    return empty;
  }
  // 当前只有前端手册; 没有 app 目标就不必选书 (后端/数据手册尚未建)。
  if (frontendTargets === 0) {
    args.graphLog.info(
      'knowledge:skip',
      'no frontend (app) target; no manual needed yet',
    );
    return empty;
  }

  try {
    const candidates = await listCandidateBooks(
      args.hookBus,
      args.workflowContext,
    );
    if (candidates.length === 0) {
      args.graphLog.warn(
        'knowledge:skip',
        'saas.app.knowledge.search returned no books; planning without manual',
      );
      return empty;
    }
    const { bookIds, notice } = await pickBooks({
      aiAdapter: args.aiAdapter,
      input: args.input,
      requirement: args.requirement,
      targetPlan: args.targetPlan,
      candidates,
      graphLog: args.graphLog,
    });
    if (bookIds.length === 0) {
      args.graphLog.warn(
        'knowledge:skip',
        'no book selected for this routePlan; planning without manual',
        { candidates: candidates.length },
      );
      return empty;
    }
    const records = await loadChapterRecords(
      args.hookBus,
      args.workflowContext,
      bookIds,
    );
    const manualText = assembleManual(records);
    // 章节目录 (id+title) 给 change-plan 让 LLM 按文件选章; 正文由 dispatch 按选中章加载
    const catalog = records.map((c) => ({ id: c.id, title: c.title }));
    args.graphLog.info('knowledge:selected', 'selected planning manuals', {
      bookIds,
      chapters: catalog.length,
      manualChars: manualText.length,
      notice: notice ?? null,
    });
    return {
      bookIds,
      manualText,
      chapters: catalog,
      ...(notice ? { notice } : {}),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`change-plan manual selection failed: ${reason}`);
    args.graphLog.warn(
      'knowledge:fail',
      'manual selection failed; planning without manual',
      {
        error: reason,
      },
    );
    return empty;
  }
}

/**
 * List candidate knowledge books visible to this agent via the SaaS knowledge hook.
 * @keyword-cn 候选书本, 知识列举
 * @keyword-en candidate-books, knowledge-list
 */
async function listCandidateBooks(
  hookBus: SaasHookBusLike,
  workflowContext: WorkflowContext | null,
): Promise<CandidateBook[]> {
  const data = await callSaasHook(
    hookBus,
    'saas.app.knowledge.search',
    { limit: 100 },
    workflowContext,
  );
  return readItems(data)
    .map((item) => ({
      id: readStringField(item, 'id'),
      name: readStringField(item, 'name'),
      description: readStringField(item, 'description'),
      tags: Array.isArray(item.tags)
        ? item.tags.filter((t): t is string => typeof t === 'string')
        : [],
    }))
    .filter((book) => Boolean(book.id));
}

/**
 * Ask the logic model which books apply to this routePlan; fall back to frontend-tagged books.
 * @keyword-cn 选书判定, 回退策略
 * @keyword-en pick-books, fallback-decision
 */
async function pickBooks(args: {
  aiAdapter: AgentAiServer;
  input: CodeGenOrchestrateInput;
  requirement: string;
  targetPlan: CodeGraphTargetRouteDecision[];
  candidates: CandidateBook[];
  graphLog: CodeGraphNodeLogger;
}): Promise<{ bookIds: string[]; notice?: string }> {
  const fallback = args.candidates
    .filter(
      (book) =>
        book.tags.some((tag) => /前端|frontend/i.test(tag)) ||
        /frontend|前端/i.test(book.id),
    )
    .map((book) => book.id);
  try {
    const model = selectLogicModel(args.aiAdapter, args.input);
    const response = await model.chat({
      source: 'code-agent.change-plan.book-select',
      isolateCallbacks: true,
      messages: [
        {
          role: 'user',
          content: buildBookPickPrompt(
            args.requirement,
            args.targetPlan,
            args.candidates,
          ),
        },
      ],
      params: { temperature: 0, responseFormat: { type: 'json_object' } },
    });
    const parsed = BookPickSchema.parse(parseJsonObjectLoose(response.content));
    const valid = new Set(args.candidates.map((book) => book.id));
    const picked = (parsed.bookIds ?? []).filter((id) => valid.has(id));
    const notice =
      typeof parsed.notice === 'string' && parsed.notice.trim()
        ? parsed.notice.trim()
        : undefined;
    return picked.length > 0
      ? { bookIds: picked, ...(notice ? { notice } : {}) }
      : { bookIds: fallback };
  } catch (error) {
    args.graphLog.warn(
      'knowledge:pick-fallback',
      'book pick LLM failed; using frontend-tagged fallback',
      { error: error instanceof Error ? error.message : String(error) },
    );
    return { bookIds: fallback };
  }
}

/**
 * Build the strict JSON prompt that selects applicable books for the routePlan.
 * @keyword-cn 选书提示, JSON输出
 * @keyword-en book-pick-prompt, json-output
 */
function buildBookPickPrompt(
  requirement: string,
  targetPlan: CodeGraphTargetRouteDecision[],
  candidates: CandidateBook[],
): string {
  const targets = targetPlan.map((t) => ({
    action: t.action,
    summary: t.summary,
  }));
  const books = candidates.map((book) => ({
    id: book.id,
    name: book.name,
    description: book.description,
    tags: book.tags,
  }));
  return [
    'You select which knowledge books apply to a code-agent file-planning (change-plan) step. Return strict JSON only.',
    'Pick the books whose conventions should govern how files are planned for these targets (e.g. a frontend manual for app/page targets). Pick 0-3 books; prefer the most specific. Skip unrelated books.',
    'Also return a short user-facing `notice` (1 sentence) written IN THE SAME NATURAL LANGUAGE AS THE REQUIREMENT (Chinese requirement => Chinese notice), plainly telling the user which development manual / conventions will guide building this (name the manual). The selected manual is authoritative for the project archetype: describe it by the manual\'s archetype (e.g. an Astro site) — do NOT echo "single file / static single page / no framework" wording from the requirement. No ids / JSON / field names; speak like a teammate. If you pick no book, omit notice.',
    'JSON shape: {"bookIds":["book-id-1"],"notice":"我会按《前端开发手册》的 Astro 规范来搭这个站点。"}',
    '',
    `Requirement:\n${requirement}`,
    '',
    `Targets:\n${JSON.stringify(targets, null, 2)}`,
    '',
    `Available books:\n${JSON.stringify(books, null, 2)}`,
  ].join('\n');
}

/** 一章的加载结果 (id 供按文件选章; title/content 供拼装手册) */
export type ChapterRecord = { id: string; title: string; content: string };

/**
 * Load the picked books' chapters as records (id/title/content). getChapter without chapterIds only
 * returns LM必读 for local books, so getToc first to pull ALL chapterIds (incl detail chapters).
 * @keyword-cn 章节记录加载, 手册章节
 * @keyword-en load-chapter-records, manual-chapters
 */
export async function loadChapterRecords(
  hookBus: SaasHookBusLike,
  workflowContext: WorkflowContext | null,
  bookIds: string[],
): Promise<ChapterRecord[]> {
  const tocData = await callSaasHook(
    hookBus,
    'saas.app.knowledge.getToc',
    { bookIds },
    workflowContext,
  );
  const chapterIds = collectChapterRecords(tocData, bookIds)
    .map((c) => readStringField(c, 'id'))
    .filter(Boolean);
  const data = await callSaasHook(
    hookBus,
    'saas.app.knowledge.getChapter',
    { bookIds, ...(chapterIds.length > 0 ? { chapterIds } : {}) },
    workflowContext,
  );
  return collectChapterRecords(data, bookIds)
    .map((chapter) => ({
      id: readStringField(chapter, 'id'),
      title: readStringField(chapter, 'title'),
      content: readStringField(chapter, 'content'),
    }))
    .filter((c) => Boolean(c.content));
}

/**
 * Assemble chapter records into one manual text, capped in length (chapters kept in given order).
 * @keyword-cn 手册拼接, 章节拼装
 * @keyword-en manual-assemble, assemble-chapters
 */
export function assembleManual(
  chapters: ChapterRecord[],
  cap = MANUAL_TEXT_CAP,
): string {
  const parts: string[] = [];
  let total = 0;
  for (const chapter of chapters) {
    if (!chapter.content) continue;
    const block = `## ${chapter.title}\n${chapter.content}`.trim();
    if (total + block.length > cap) break;
    parts.push(block);
    total += block.length;
  }
  return parts.join('\n\n');
}

/**
 * Load and assemble chapter content (incl LM必读) for the picked books, capped in length.
 * @keyword-cn 章节加载, 手册拼接
 * @keyword-en load-chapters, manual-assemble
 */
export async function loadChapters(
  hookBus: SaasHookBusLike,
  workflowContext: WorkflowContext | null,
  bookIds: string[],
): Promise<string> {
  return assembleManual(
    await loadChapterRecords(hookBus, workflowContext, bookIds),
  );
}

/**
 * Flatten knowledge toc/chapter data into chapter records, tolerant of shape.
 * @description getChapterContent/getTocByBookIds return Record<bookId, chapter[]>; this also
 *   accepts a flat array or `{ items }`. Records are ordered by the given bookIds first.
 * @keyword-cn 章节展平, 形状兼容
 * @keyword-en flatten-chapters, shape-tolerant
 */
function collectChapterRecords(
  data: unknown,
  bookIds: string[],
): Array<Record<string, unknown>> {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data)) return data.filter(isRecord);
  const rec = data as Record<string, unknown>;
  if (Array.isArray(rec.items)) return rec.items.filter(isRecord);
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const bid of bookIds) {
    const value = rec[bid];
    if (Array.isArray(value)) {
      out.push(...value.filter(isRecord));
      seen.add(bid);
    }
  }
  for (const [key, value] of Object.entries(rec)) {
    if (seen.has(key) || !Array.isArray(value)) continue;
    out.push(...value.filter(isRecord));
  }
  return out;
}

/**
 * Type guard for a plain object record.
 * @keyword-cn 记录守卫, 类型守卫
 * @keyword-en record-guard, type-guard
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Call one SaaS knowledge hook through the HookBus and unwrap its single-handler data.
 * @keyword-cn SaaSHook调用, 知识读取
 * @keyword-en saas-hook-call, knowledge-read
 */
async function callSaasHook(
  hookBus: SaasHookBusLike,
  hookName: string,
  payload: unknown,
  workflowContext: WorkflowContext | null,
): Promise<unknown> {
  if (hookBus.select(hookName).length === 0) {
    throw new Error(`${hookName} is not registered on saas.`);
  }
  const results = await hookBus.emit({
    name: hookName,
    payload,
    context: {
      source: 'llm',
      principalId: workflowContext?.agentPrincipalId,
      principalType: 'agent',
      extras: {
        ...(workflowContext?.sessionId
          ? { sessionId: workflowContext.sessionId }
          : {}),
        ...(workflowContext?.agentId
          ? { agentId: workflowContext.agentId }
          : {}),
      },
    },
  });
  const data: unknown[] = [];
  const errors: string[] = [];
  for (const result of results) {
    if (result?.status === 'error' || result?.error) {
      errors.push(result.error ?? 'hook-error');
    } else if (result?.status === 'skipped') {
      errors.push(`${hookName} was skipped by hook middleware.`);
    } else {
      data.push(result?.data);
    }
  }
  if (errors.length > 0)
    throw new Error(`${hookName} failed: ${errors.join('; ')}`);
  return data.length === 1 ? data[0] : data;
}

/**
 * Build a compact manual section appended to the change-plan generation prompt.
 * @keyword-cn 手册段落, 提示注入
 * @keyword-en manual-section, prompt-inject
 */
export function buildManualPromptSection(manualText: string): string {
  if (!manualText.trim()) return '';
  return [
    '',
    'Development manual — AUTHORITATIVE for project archetype, tech stack, file layout, module chunking, and resource/JS-CSS separation. It OVERRIDES any conflicting structure/stack wording in the requirement: if the requirement says things like "single index.html", "one file", "no framework", "plain static HTML", treat those as INTENT (a simple, self-contained site) — NOT as literal file or stack constraints — and STILL apply this manual\'s archetype (e.g. Astro multi-file: src/pages + src/components + src/layouts + src/styles + src/scripts + public). The requirement governs content, sections, features, copy, and visual style; this manual governs HOW the files are structured. Plan files strictly per the manual below:',
    manualText,
  ].join('\n');
}

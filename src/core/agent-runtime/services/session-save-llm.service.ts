import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { AIModelService } from '@core/ai/services/ai-model.service';
import { HookBusService } from '@/core/hookbus/services/hook.bus.service';
import { RunnerHookRpcService } from '@/app/runner/services/runner-hook-rpc.service';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { buildCallHookTool } from '../tools/call-hook.tools';
import {
  SessionCallTrackerService,
  type CallRecord,
} from './session-call-tracker.service';

/**
 * @title 会话级 sessionData 沉淀 LLM
 * @description 主对话 LLM 完成 call_hook 后, 由 SessionCallTracker 低频硬匹配命中即异步触发本 service. 用同 agent model 跑一次独立 LLM session, 给它 call_hook 记录 + 现有 sessionData listing, 让它决定是否调 saas.app.conversation.sessionData.save (0~N 次). 主对话 LLM 不再操心 save, 沉淀全自动.
 *              防自我触发 :: ctx.extras.disableTracker=true 注入, buildCallHookTool 检测到此 flag 跳过 record/trigger.
 *              触发完后 resetTriggers, records 保留(下次 LLM 决策仍可见).
 * @keywords-cn 沉淀LLM, 独立链路, 硬触发, 主对话不感知, 防自我触发
 * @keywords-en save-llm, isolated-chain, hard-trigger, main-dialogue-unaware, anti-self-trigger
 */

const SAVE_LLM_SYSTEM_PROMPT = [
  '你是 sessionData 沉淀决策器。任务: 看主对话 LLM 的 call_hook 记录, 决定是否调 saas.app.conversation.sessionData.save 沉淀有价值的经验。',
  '',
  '## 沉淀白名单 (只允许这 4 种, key 第一段决定 category, 沿用约定)',
  '1. 调过 `saas.app.knowledge.getChapter` → key=`knowledge.<bookId>.<chapterId>`, value=章节里的可复用知识 (payload 字段表 / 调用模式 / 注意事项)',
  '2. 多 hook 串联 (≥2 跳) 查到答案 → key=`recipe.<task>`, value={steps 步骤模板, result 形态}',
  '3. 试错→成功 (前面有过 errorMsg) → key=`hook.<name>.recipe`, value={correctPayloadShape, lesson}',
  '4. 拿到本会话复用的实体 id → key=`entity.<kind>.<slug>`, value={id, displayName}',
  '',
  '## 禁止 save',
  '- key 前缀 `handbook.*` :: 那是系统 seed 的必读手册槽位, **沉淀 LLM 不许写**, 会破坏按身份过滤的隔离语义',
  '- 发送消息流水 (`*.sent` / `*.done` / messageIds / sentAt)',
  '- 单次纯查询 / 闲聊 / 问候回应',
  '- 跟现有 listing 重复的 key (除非新值有本质差异)',
  '- 任何"我刚做了 X"的操作日志 (这类已经走 callHistory 硬记录, 不用经验沉淀)',
  '',
  '## 核心标准',
  'value 是"**下次怎么做**"的知识/模板/经验, 不是"**这次做了啥**"流水。不确定 → 不存。',
  '',
  '## title 与 value 的分工 (最关键, 决定下次能否命中 + 用得上)',
  '',
  '`title` 和 `value` 职责分开, **不能把 value 内容塞进 title**:',
  '',
  '### `title` = **场景命中信号** (索引/书脊)',
  '',
  '- 下次 LLM 扫 list **只看 title** 判断"我现在做的事跟这条相关吗", 相关才 `get` 取 value 看详情',
  '- 必须用**业务/任务名词** + (可选)动词, 让 LLM 一眼识别"我在做的事属于这个领域"',
  '- 不要塞具体字段规则 / 单复数提示 / payload 形态 — 这些是 value 的事',
  '',
  '✅ title 正例 (场景命中信号, 简短):',
  '- `"saas 对话/IM 模块 hook 调用要点 (发消息 / 会话管理 / 主动对话)"`',
  '- `"saas 知识库 hook 调用规范 (getToc / getChapter 字段 + 单复数)"`',
  '- `"角色权限查询场景 (roleList → rolePermissionList 多步配方)"`',
  '- `"主体管理 (Principal/Membership) hook 速查"`',
  '',
  '❌ title 反例 (把 value 内容塞 title):',
  '- `"调 getChapter 时 bookIds/chapterIds 必须数组 (单数会 schema 错), 返回 markdown 章节全文"` — 这是 value 内容',
  '- `"membershipList payload 必含 input{} 不能裸字段"` — 这是 value 内容',
  '- `"X hook 调用配方"` / `"Y 的字段说明"` — 太空泛',
  '- `"intro.sent"` / `"已发送..."` — 流水',
  '',
  '### `value` = **详细使用指南** (书内容)',
  '',
  '存所有具体细节:',
  '- `payloadShape`: call_hook payload 数组形态 / 字段名 / 类型 / 必填可选 / 单复数',
  '- `usage`: 何时用 / 怎么用 / 步骤',
  '- `hints`: 踩过的坑 / 常见错 / 纠错提示 (单数错 / 拼到外层 / 字段名想当然)',
  '- `examples?`: 关键示例 payload',
  '- `relatedHooks?`: 串联用到的相关 hook',
  '',
  '✅ value 正例 (对应上面 saas 知识库 title):',
  '```json',
  '{',
  '  "hooks": ["saas.app.knowledge.getToc", "saas.app.knowledge.getChapter"],',
  '  "payloadShape": "[{ bookIds: string[], chapterIds?: string[] }]",',
  '  "hints": ["call_hook payload 必须是数组; 单参 hook 传 [{...}], 不能传 {...}", "bookIds/chapterIds 必须是数组 (复数 s), 单数会 payload-schema-invalid", "返回内容是 markdown 章节全文"],',
  '  "usage": "getToc 拿目录后 getChapter 取正文; isLmRequired=true 章节会自动返回"',
  '}',
  '```',
  '',
  '**自检**: 写完 title 自问"下次扫 list 看到这一行, 能识别出是哪个业务场景吗?" → 能 ✓; 看 value 自问"细节够不够 LLM 直接抄?" → 够 ✓.',
  '',
  '## 输出',
  '调 `call_hook({ calls: [{ target:"saas", hookName:"saas.app.conversation.sessionData.save", payload:[{ key, value, title }] }] })` 0~N 次; 多条 save 可塞进同一个 `calls` 数组一次并发提交。',
  '注意: call_hook 的 payload 永远是位置参数数组; sessionData.save/list/get 都是单参对象, 所以分别是 `[{ key, value, title }]` / `[{}]` / `[{ key }]`。',
  '`sessionId` 留空, 服务端从 ctx 自动补当前会话。',
  '`title` 长度: **简短** (10~30 字), 业务名词为主, 不含"已X" / 单纯 hook 名 / 详细字段规则.',
  '`value`: 完整详细, 包含 payloadShape / hints / usage 等结构化字段, 让下次取出来直接用.',
  '不需要存就什么都不调, 直接结束.',
].join('\n');

@Injectable()
export class SessionSaveLlmService {
  private readonly logger = new Logger(SessionSaveLlmService.name);

  constructor(
    private readonly aiModel: AIModelService,
    private readonly hookBus: HookBusService,
    @Inject(forwardRef(() => RunnerHookRpcService))
    private readonly hookRpc: RunnerHookRpcService,
    private readonly tracker: SessionCallTrackerService,
  ) {}

  /**
   * 异步执行一次 sessionData 沉淀决策 (fire-and-forget)
   * - 不阻塞主对话; 出错只 log, 不抛
   * - 触发完 resetTriggers 防累计反复触发
   * @keyword-en run-async-save-llm
   */
  async runAsync(opts: {
    sessionId: string;
    aiModelIds: string[];
    invocationContext: HookInvocationContext;
  }): Promise<void> {
    const { sessionId, aiModelIds, invocationContext } = opts;
    const records = this.tracker.getRecords(sessionId);
    if (records.length === 0) {
      this.tracker.resetTriggers(sessionId);
      return;
    }
    const modelId = aiModelIds[0];
    if (!modelId) {
      this.logger.warn(
        `[session-save-llm] no modelId for session=${sessionId}, skip`,
      );
      this.tracker.resetTriggers(sessionId);
      return;
    }

    try {
      // 拉现有 sessionData listing 作上下文
      const listingResults = await this.hookBus.emit({
        name: 'saas.app.conversation.sessionData.list',
        payload: [{}],
        context: { ...invocationContext, source: 'system' },
      });
      const listing =
        (listingResults?.[0]?.data as { listing?: string } | undefined)
          ?.listing ?? '(空)';

      // 防自我触发: ctx.extras.disableTracker=true → buildCallHookTool 内 record 跳过
      const llmCtx: HookInvocationContext = {
        ...invocationContext,
        source: 'system',
        extras: {
          ...(invocationContext.extras ?? {}),
          disableTracker: true,
        },
      };
      const tools = [
        buildCallHookTool(this.hookBus, this.hookRpc, () => llmCtx),
      ];

      const userMessage = this.buildUserMessage(records, listing);

      // 走主对话相同的 chatStream 接口, drain 所有事件让 LLM 跑完工具循环
      const stream = this.aiModel.chatStream({
        modelId,
        messages: [{ role: 'user', content: userMessage }],
        systemPrompt: SAVE_LLM_SYSTEM_PROMPT,
        tools,
      });
      let saveCount = 0;
      for await (const ev of stream as AsyncGenerator<unknown>) {
        // 简单识别工具调用事件 (供 log)
        if (
          typeof ev === 'object' &&
          ev !== null &&
          'type' in ev &&
          (ev as { type: string }).type === 'tool_use'
        ) {
          saveCount += 1;
        }
      }
      this.logger.log(
        `[session-save-llm] session=${sessionId} done, save attempts=${saveCount}, records=${records.length}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `[session-save-llm] failed session=${sessionId}: ${msg}`,
      );
    } finally {
      this.tracker.resetTriggers(sessionId);
    }
  }

  /**
   * 拼 user message :: 给 LLM 看 records + 现有 listing
   * @keyword-en build-save-user-message
   */
  private buildUserMessage(records: CallRecord[], listing: string): string {
    // records preview: 控制 token, 每条只取 hookName + 是否 ok + 简短预览
    const recordPreview = records
      .slice(-100) // 只给 LLM 看最近 100 条够决策
      .map((r) => {
        const ok = r.errorMsg.length === 0 ? 'ok' : 'err';
        const errPreview =
          r.errorMsg.length > 0
            ? ` errMsg=${truncate(r.errorMsg.join('; '), 120)}`
            : '';
        const payloadPreview = ` payload=${truncate(safeJson(r.payload), 200)}`;
        const resultPreview =
          ok === 'ok' && r.result !== null
            ? ` result=${truncate(safeJson(r.result), 200)}`
            : '';
        return `- [${ok}] ${r.target}::${r.hookName}${payloadPreview}${resultPreview}${errPreview}`;
      })
      .join('\n');

    return [
      '## 主对话 LLM 本次累积的 call_hook 记录',
      '',
      recordPreview || '(无记录)',
      '',
      '## 当前 sessionData listing (现有记忆, 不要重复存)',
      '',
      listing,
      '',
      '请按沉淀白名单决定调 saas.app.conversation.sessionData.save 几次 (或 0 次).',
    ].join('\n');
  }
}

function safeJson(v: unknown): string {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

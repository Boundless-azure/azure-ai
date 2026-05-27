import { Logger } from '@nestjs/common';
import { tool } from 'langchain';
import { z } from 'zod';
import type { CurrentSessionService } from '@/app/conversation/services/current-session.service';
import type { InvocationContextProvider } from './call-hook.tools';

/**
 * @title init_tip 工具 (top-level tool, 跟 call_hook 平级)
 * @description 本轮 turn 第一步必备 tool, 声明 needKnowledge/needHook 并接收**三大标准发现链路** (callLog / knowledge / hook);
 *              不走 call_hook 路由, 直接命中 CurrentSessionService 写状态.
 *              返回 discoveryChains (三条 tag → search → detail 自底向上 SOP, 静态完整) + tipNote (一句话本轮总览, 按 declared 强调走哪条);
 *              不返回 callHistory/handbook 具体数据 — LLM 想看按链路自己调对应 hook.
 * @keywords-cn 初始化提示, 发现链路, top-level tool, 标准操作流程
 * @keywords-en init-tip, discovery-chains, top-level-tool, tag-search-detail
 */

const toolLogger = new Logger('InitTipTool');

/**
 * init_tip tool 输入 schema; LLM 在每轮第一步诚实声明 needKnowledge/needHook.
 * @keyword-en init-tip-schema
 */
const initTipSchema = z.object({
  needKnowledge: z
    .boolean()
    .describe('本轮是否需要查知识库/手册 (saas.app.knowledge.* / handbook.*)'),
  needHook: z
    .boolean()
    .describe(
      '本轮是否需要调业务 hook 拿实时数据或触发动作 (saas.app.<domain>.<action>)',
    ),
  needHistory: z
    .boolean()
    .optional()
    .describe(
      '本轮是否需要回看本会话历史消息. 用户问"我们之前聊过...","上次提到的","昨天那件事","之前的方案"等需要回溯历史的问题时必须置 true; ' +
        '置 true 会拿到 smart 三步检索链路 (smartTags → smartSearch → smartMessages). 默认 false (本轮最近 18 条窗口已够用).',
    ),
  reason: z
    .string()
    .optional()
    .describe('简短说明判定理由; 帮助 LLM 自我对齐, 服务端不强校验'),
});

type InitTipInput = z.infer<typeof initTipSchema>;

/**
 * 构建 init_tip top-level tool; 注入 CurrentSessionService 闭包.
 *  - 直接调 setInitTip + produceInitTip (同步聚合)
 *  - 返回 { acknowledged, declared, discoveryChains: { callLog, knowledge, hook }, usageRules, tipNote }
 *  - discoveryChains 是步骤明细 (按 tag → search → detail), usageRules 是 cross-cutting 行为约束 (commit / no-loop / no-skip / must-sendMsg)
 * @keyword-en build-init-tip-tool
 */
export function buildInitTipTool(
  currentSession: CurrentSessionService,
  getCtx: InvocationContextProvider,
) {
  return tool(
    (input: InitTipInput): string => {
      const ctx = getCtx();
      const sessionId = (
        typeof ctx.extras?.sessionId === 'string' ? ctx.extras.sessionId : ''
      ).trim();
      const principalId = ctx.principalId?.trim() ?? '';
      if (!sessionId || !principalId) {
        toolLogger.warn(
          `[init_tip] missing sessionId/principalId; session=${sessionId} principal=${principalId}`,
        );
        return JSON.stringify({
          error:
            'sessionId/principalId 缺失, 无法记录 init_tip 状态. 请检查 invocationContext.',
        });
      }
      const declared = {
        needKnowledge: input.needKnowledge,
        needHook: input.needHook,
        ...(input.needHistory ? { needHistory: input.needHistory } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
      };
      currentSession.setInitTip(sessionId, principalId, declared);
      const suggestions = currentSession.produceInitTip(declared);
      toolLogger.log(
        `[init_tip] session=${sessionId} declared=${JSON.stringify(declared)} ` +
          `directHooks=${suggestions.directHooks.length} ` +
          `chains=${Object.entries(suggestions.discoveryChains)
            .map(([k, v]) => `${k}:${v.length}`)
            .join('/')} ` +
          `usageRules=${suggestions.usageRules.length} ` +
          `tipNote="${suggestions.tipNote}"`,
      );
      return JSON.stringify({
        acknowledged: true,
        declared,
        directHooks: suggestions.directHooks,
        discoveryChains: suggestions.discoveryChains,
        usageRules: suggestions.usageRules,
        tipNote: suggestions.tipNote,
      });
    },
    {
      name: 'init_tip',
      description:
        '本轮 turn 第一步必备 tool :: 声明本轮需求 + 接收**三大标准发现链路**.\n\n' +
        '<when_to_call>\n' +
        '每个 user message 进来, 我的第一步必调 init_tip. ' +
        '通过 needKnowledge / needHook 诚实声明本轮需求, 拿回三条 SOP (callLog / knowledge / hook 发现链路) + 一句话本轮总览.\n' +
        '</when_to_call>\n\n' +
        '<input>\n' +
        '- needKnowledge :: 是否要读知识库 / handbook 拿权威背景\n' +
        '- needHook :: 是否要调业务 hook 拿实时数据 / 触发动作\n' +
        '- needHistory? :: **是否要回看本会话历史消息**. 用户说"之前/上次/昨天/我们聊过..."等需要回溯的关键词时务必置 true; 这条会触发 smart 三步检索链路 (本轮最近 18 条窗口已是默认上下文, 不够再开这个)\n' +
        '- reason? :: 简短判定理由\n' +
        '</input>\n\n' +
        '<output>\n' +
        '- directHooks :: **已知常用 hook 快捷入口**, 不需要 search 直接 call_hook 即可. 包括 currentSession.context (双方身份 + IP + 时间), currentSession.get (本轮临时态), setPendingAction (缺参挂起), callHistory.query.\n' +
        '- discoveryChains :: 五条标准链路 (component 优先级最高, needHook=true 时强制先走):\n' +
        '    - **component** (🔴 needHook=true 时强制第一步): Web Component Hook 是数据获取简化器 — 有匹配组件时无需调数据 hook, 直接在 sendMsg content 里嵌入 hook fence 即完成. ' +
        '(get_hook_tag isWeb:true → search_hook isWeb:true → get_hook_info 看 payloadSchema → 把 fence 写入 sendMsg content → 调 sendMsg. 不可用 call_hook 调组件.)\n' +
        '      hook fence 格式 (嵌在 sendMsg content 文字里):\n' +
        '      ```hook\n' +
        '      {"actionHook":"saas.app.xxx.yyy","payload":{...按 payloadSchema 填筛选条件}}\n' +
        '      ```\n' +
        '      前端识别此 fence 后自动挂载组件, 组件自行获取数据. 不需要 LLM 处理任何数据.\n' +
        '      ⚠ 面向用户说话时禁止提及 "payload" / "参数" / "JSON" / "hookName" 等技术细节;\n' +
        '         用自然语言描述功能, 例如 "以下是用户列表，你可以按类型或关键字筛选".\n' +
        '    - callLog: 复用近期成功 hook (callHistory.query [{}] → 匹配 title → includeDetail 取详情 → 复用业务 hook → sendMsg)\n' +
        '    - knowledge: 查权威知识 (knowledge.getTag → search → getToc → getChapter → sendMsg)\n' +
        '    - hook: 发现业务能力 (get_hook_tag → search_hook → get_hook_info → call_hook → sendMsg)\n' +
        '    - **history**: 回看会话历史 (conversation.smartTags → smartSearch → smartMessages → sendMsg); 用户说"之前/上次/我说过"等回溯关键词时必走\n' +
        '- usageRules :: 4 条 cross-cutting 行为约束, 走任何链路都必须遵守:\n' +
        '    · commit early: 1-2 个候选立即 call_hook commit, 不要反复 search\n' +
        '    · no loops: 整 turn search + info 合计 ≤ 3 次, 超过强行 commit\n' +
        '    · no skip: ①→②→③→④→⑤ 顺序, 不跳步\n' +
        '    · must sendMsg: 业务/知识完成后必发 sendMsg, 否则消息丢失\n' +
        '- tipNote :: 一句话本轮总览, 按 declared 强调走哪条\n' +
        '⚠ **先看 directHooks**: 想知道对方身份 / IP / 时间, 直接调 currentSession.context, 不要走 hook 发现链路 (它注册在 conversation 命名空间, search 按 identity/user 标签找不到).\n' +
        '⚠ **回看历史走 history 链路**: 不要从 18 条窗口外硬猜, 也不要凭训练记忆瞎答 "我们之前聊到...". 走 smartTags → smartSearch → smartMessages 三步拿真实的过往对话。\n' +
        '</output>\n\n' +
        '<example>\n' +
        '纯聊天: init_tip({needKnowledge:false, needHook:false, reason:"chat"}) → tipNote 提示直接 sendMsg, 不走链路\n' +
        '查待办: init_tip({needKnowledge:false, needHook:true, reason:"list todos"}) → tipNote 提示先 callLog 复用, 没匹配再走 hook 链路\n' +
        '解释能力: init_tip({needKnowledge:true, needHook:false, reason:"capability"}) → tipNote 提示走 knowledge 链路 (getTag → search → getToc → getChapter)\n' +
        '回看历史: init_tip({needKnowledge:false, needHook:false, needHistory:true, reason:"recall past chat"}) → tipNote 提示走 history 链路 (smartTags → smartSearch → smartMessages)\n' +
        '查看用户列表: init_tip({needKnowledge:false, needHook:true, reason:"view users"}) → 走 component 链路 → 找到 saas.app.identity.userTable → sendMsg content 嵌入:\n' +
        '  ```hook\n' +
        '  {"actionHook":"saas.app.identity.userTable","payload":{}}\n' +
        '  ```\n' +
        '</example>',
      schema: initTipSchema,
    },
  );
}

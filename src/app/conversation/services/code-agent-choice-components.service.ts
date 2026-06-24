import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { HookComponent } from '@/core/hookbus/decorators/hook-component.decorator';

/**
 * Code-agent action enum used by the dependency choice card.
 * @keyword-cn 代码智能体选择, 目标动作
 * @keyword-en code-agent-choice-action, target-action
 */
const codeAgentActionSchema = z.enum(['app', 'unit', 'data-point']);

/**
 * Runner solution summary shown in the dependency choice card.
 * @keyword-cn Solution选择, Runner摘要
 * @keyword-en solution-choice-summary, runner-summary
 */
const codeAgentSolutionChoiceSchema = z
  .object({
    id: z.string().optional(),
    runnerId: z.string().optional(),
    solutionId: z.string().optional(),
    name: z.string().optional(),
    version: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    includes: z.array(z.string()).optional(),
    isInitialized: z.boolean().optional(),
  })
  .passthrough();

const codeAgentNewSolutionOptionSchema = z
  .object({
    id: z.string().optional(),
    kind: z.literal('new-solution').optional(),
    name: z.string().optional(),
    version: z.string().optional(),
    summary: z.string().optional(),
    reason: z.string().optional(),
    targetKind: codeAgentActionSchema.optional(),
  })
  .passthrough();

/**
 * Localized labels and helper copy rendered by the dependency choice card.
 * @keyword-cn 代码智能体选择卡片, 语义文案
 * @keyword-en code-agent-choice-card, semantic-copy
 */
const codeAgentChoiceUiTextSchema = z.record(z.string(), z.unknown());

/**
 * Payload schema for the code-agent dependency choice card.
 * @keyword-cn 代码智能体选择卡片, payload模式
 * @keyword-en code-agent-choice-card, payload-schema
 */
const codeAgentDependencyChoicePayloadSchema = z.object({
  sessionId: z.string().optional(),
  runnerId: z.string(),
  agentPrincipalId: z.string().optional(),
  agentId: z.string().optional(),
  aiModelIds: z.array(z.string()).optional(),
  threadId: z.string().optional(),
  checkpointId: z.string().nullable().optional(),
  interruptId: z.string().nullable().optional(),
  requirement: z.string().optional(),
  uiText: codeAgentChoiceUiTextSchema.optional(),
  reason: z.string().optional(),
  requiresNewSolution: z.boolean().optional(),
  newSolutionReason: z.string().optional(),
  newSolutionOption: codeAgentNewSolutionOptionSchema.nullable().optional(),
  waitChoose: z.array(codeAgentSolutionChoiceSchema).optional(),
  useSolution: codeAgentSolutionChoiceSchema.nullable().optional(),
  waitChooseAction: z.array(codeAgentActionSchema).optional(),
  useAction: codeAgentActionSchema.nullable().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

/**
 * @title Code Agent Choice Components Service
 * @description Declares Web Component Hooks used by code-agent conversation cards.
 * @keyword-cn 代码智能体组件, 选择卡片, Web组件Hook
 * @keyword-en code-agent-components, choice-card, web-component-hook
 */
@Injectable()
export class CodeAgentChoiceComponentsService {
  /**
   * Web Component Hook: saas.app.conversation.codeAgentDependencyChoice.
   * @keyword-cn 代码智能体选择卡片, 依赖检查
   * @keyword-en code-agent-choice-card, dependency-check
   */
  @HookComponent('saas.app.conversation.codeAgentDependencyChoice', {
    description:
      'Interactive card for code-agent dependency-check pauses. ' +
      'Lets the user choose a Runner solution and target action, then submits to codeAgentChoiceSubmit.',
    tags: ['conversation', 'code-agent', 'component', 'selection'],
    payloadSchema: codeAgentDependencyChoicePayloadSchema,
  })
  readonly dependencyChoice = /* js */ `
/**
 * saas.app.conversation.codeAgentDependencyChoice
 * payload: { sessionId?, runnerId, agentPrincipalId?, threadId?, checkpointId?, interruptId?, uiText?, requiresNewSolution?, newSolutionReason?, newSolutionOption?, waitChoose?, useSolution?, waitChooseAction?, useAction?, context? }
 */
export function render(el, payload, ctx) {
  var p = payload || {};
  var ui = p.uiText && typeof p.uiText === 'object' ? p.uiText : {};
  var NEW_SOLUTION_ID = '__new_solution__';
  var existingSolutionOptions = Array.isArray(p.waitChoose) && p.waitChoose.length
    ? p.waitChoose
    : (p.useSolution ? [p.useSolution] : []);
  var newSolutionOption = p.newSolutionOption || (p.requiresNewSolution ? {
    id: NEW_SOLUTION_ID,
    kind: 'new-solution',
    name: readText('newSolutionName', '新建 Solution'),
    summary: readText('newSolutionSummary', '为当前需求创建或绑定新的 Solution。'),
    reason: readText('newSolutionHelp', '')
  } : null);
  if (newSolutionOption) {
    newSolutionOption.id = NEW_SOLUTION_ID;
    newSolutionOption.kind = 'new-solution';
  }
  var solutionOptions = existingSolutionOptions.concat(newSolutionOption ? [newSolutionOption] : []);
  var actionOptions = Array.isArray(p.waitChooseAction) && p.waitChooseAction.length
    ? p.waitChooseAction
    : (p.useAction ? [p.useAction] : []);
  var selectedSolutionId = p.useSolution ? solutionIdOf(p.useSolution) : (solutionOptions.length === 1 && !p.requiresNewSolution ? solutionIdOf(solutionOptions[0]) : '');
  var selectedAction = p.useAction || (actionOptions.length === 1 ? actionOptions[0] : '');
  var submitting = false;
  var submitted = false;
  var hydrated = false;
  var errorText = '';
  var resumeText = '';

  function solutionIdOf(item) {
    if (item && item.kind === 'new-solution') return NEW_SOLUTION_ID;
    return String((item && (item.solutionId || item.id)) || '');
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readText(key, fallback) {
    var value = ui && ui[key];
    return typeof value === 'string' && value ? value : fallback;
  }

  function actionMeta(value) {
    var labels = ui && ui.actionLabels && typeof ui.actionLabels === 'object'
      ? ui.actionLabels
      : {};
    var item = labels[value] && typeof labels[value] === 'object' ? labels[value] : {};
    var fallback = {
      app: {
        label: 'App',
        description: 'Create or update an app/page target.',
      },
      unit: {
        label: 'Unit',
        description: 'Create or update a callable unit.',
      },
      'data-point': {
        label: 'Data Point',
        description: 'Create or update a data integration point.',
      },
    }[value] || { label: value || '-', description: '' };
    return {
      label: typeof item.label === 'string' && item.label ? item.label : fallback.label,
      description: typeof item.description === 'string' && item.description ? item.description : fallback.description,
    };
  }

  function actionDisplayName(value) {
    return actionMeta(value).label;
  }

  function formatIncludes(values) {
    if (!Array.isArray(values) || !values.length) return '';
    return values.map(function(value) {
      return {
        app: actionDisplayName('app'),
        unit: actionDisplayName('unit'),
        'data-point': actionDisplayName('data-point'),
        view: readText('legacyViewLabel', '展示页/轻量页面'),
      }[value] || value;
    }).join(', ');
  }

  function selectedSolution() {
    for (var i = 0; i < solutionOptions.length; i += 1) {
      if (solutionIdOf(solutionOptions[i]) === selectedSolutionId) return solutionOptions[i];
    }
    return p.useSolution || null;
  }

  function hasSolutionOption(id) {
    for (var i = 0; i < solutionOptions.length; i += 1) {
      if (solutionIdOf(solutionOptions[i]) === id) return true;
    }
    return false;
  }

  function buttonStyle(active) {
    return [
      'width:100%;text-align:left;border:1px solid ',
      active ? '#2563eb' : '#e5e7eb',
      ';background:',
      active ? '#eff6ff' : '#ffffff',
      ';color:#111827;border-radius:8px;padding:12px;cursor:pointer;transition:120ms ease;display:block',
    ].join('');
  }

  function actionStyle(active) {
    return [
      'flex:1 1 160px;text-align:left;border:1px solid ',
      active ? '#2563eb' : '#e5e7eb',
      ';background:',
      active ? '#eff6ff' : '#ffffff',
      ';color:',
      active ? '#1d4ed8' : '#374151',
      ';border-radius:8px;padding:10px 12px;cursor:pointer;font-size:13px;font-weight:600;min-height:62px',
    ].join('');
  }

  function renderSolutions() {
    if (!solutionOptions.length) {
      return '<div style="padding:10px 12px;border:1px dashed #d1d5db;border-radius:8px;color:#6b7280;font-size:13px">' + esc(readText('noSolutions', '没有可选择的 Solution')) + '</div>';
    }
    return solutionOptions.map(function(item, index) {
      var id = solutionIdOf(item);
      var active = id && id === selectedSolutionId;
      var isNew = item.kind === 'new-solution';
      var summary = isNew
        ? readText('newSolutionSummary', item.summary || item.description || '')
        : (item.summary || item.description || '');
      var helper = isNew
        ? readText('newSolutionHelp', '后续会先创建新的 Solution，再把本次目标放进去。')
        : readText('existingSolutionHelp', '复用这个 Solution，后续会在它下面继续创建或更新目标。');
      var version = item.version ? '<span style="color:#9ca3af;font-weight:400"> @' + esc(item.version) + '</span>' : '';
      var includes = formatIncludes(item.includes);
      var badge = isNew ? readText('newSolutionBadge', '新建') : readText('existingSolutionBadge', '复用');
      var meta = isNew
        ? readText('newSolutionMeta', '将创建新的 Solution')
        : readText('solutionIdLabel', 'id') + ': ' + (id || '-');
      var includesLine = includes
        ? '<div style="margin-top:6px;color:#9ca3af;font-size:11px">' + esc(readText('includesLabel', '可承载')) + ': ' + esc(includes) + '</div>'
        : '';
      return '<button type="button" data-solution-index="' + index + '" style="' + buttonStyle(active) + '">' +
        '<div style="font-size:13px;font-weight:700;line-height:1.35"><span style="display:inline-block;margin-right:6px;color:' + (isNew ? '#92400e' : '#1d4ed8') + '">' + esc(badge) + '</span>' + esc(item.name || id || 'Unnamed Solution') + version + '</div>' +
        '<div style="margin-top:6px;color:#374151;font-size:12px;line-height:1.45">' + esc(helper) + '</div>' +
        (summary ? '<div style="margin-top:4px;color:#6b7280;font-size:12px;line-height:1.45">' + esc(summary) + '</div>' : '') +
        '<div style="margin-top:6px;color:#9ca3af;font-size:11px">' + esc(meta) + '</div>' +
        includesLine +
      '</button>';
    }).join('<div style="height:8px"></div>');
  }

  function renderActions() {
    if (!actionOptions.length) {
      return '<div style="color:#6b7280;font-size:13px">' + esc(readText('noActions', '没有可选择的目标动作')) + '</div>';
    }
    return actionOptions.map(function(action) {
      var meta = actionMeta(action);
      return '<button type="button" data-action="' + esc(action) + '" style="' + actionStyle(action === selectedAction) + '">' +
        '<div style="font-size:13px;font-weight:800;line-height:1.35">' + esc(meta.label) + '</div>' +
        (meta.description ? '<div style="margin-top:4px;font-size:11px;line-height:1.35;color:#6b7280;font-weight:400">' + esc(meta.description) + '</div>' : '') +
      '</button>';
    }).join('');
  }

  function renderStatus() {
    if (errorText) {
      return '<div style="margin-top:10px;color:#dc2626;font-size:12px;line-height:1.45">' + esc(errorText) + '</div>';
    }
    if (submitted) {
      return '<div style="margin-top:10px;color:#16a34a;font-size:12px;line-height:1.45">' + esc(resumeText || readText('submittedMessage', '选择已提交，LangGraph 将在后台继续执行。')) + '</div>';
    }
    return '';
  }

  function renderNewSolutionNotice() {
    if (!p.requiresNewSolution) return '';
    return '<div style="border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.5">' +
      '<div style="font-weight:800;margin-bottom:4px">' + esc(readText('newSolutionNoticeTitle', '可能需要新的 Solution')) + '</div>' +
      esc(readText('newSolutionNoticeBody', '现有 Solution 可能不适合承载当前需求。')) +
      '<div style="margin-top:4px;color:#a16207">' + esc(readText('newSolutionNoticeHelp', '如果确认复用已有 Solution，请手动选择下面的项后继续。')) + '</div>' +
    '</div>';
  }

  function paint() {
    var canSubmit = Boolean(selectedSolutionId && selectedAction) && !submitting && !submitted;
    var submitStyle = [
      'border:0;border-radius:8px;padding:9px 12px;font-size:13px;font-weight:700;',
      canSubmit ? 'background:#111827;color:#ffffff;cursor:pointer' : 'background:#e5e7eb;color:#9ca3af;cursor:not-allowed',
    ].join('');
    el.innerHTML =
      '<div style="font-family:inherit;border:1px solid #e5e7eb;border-radius:8px;background:#fff;overflow:hidden;max-width:720px">' +
        '<div style="padding:12px 14px;border-bottom:1px solid #f3f4f6">' +
          '<div style="font-size:14px;font-weight:800;color:#111827;line-height:1.35">' + esc(readText('title', 'code-agent 需要确认目标')) + '</div>' +
          '<div style="margin-top:4px;color:#6b7280;font-size:12px;line-height:1.45">' + esc(readText('subtitle', '请选择本次需求的承载位置和目标类型。')) + '</div>' +
          (readText('decisionNote', '') ? '<div style="margin-top:6px;color:#4b5563;font-size:12px;line-height:1.45">' + esc(readText('decisionNote', '')) + '</div>' : '') +
        '</div>' +
        '<div style="padding:14px;display:grid;gap:14px">' +
          renderNewSolutionNotice() +
          '<div>' +
            '<div style="margin-bottom:4px;color:#374151;font-size:12px;font-weight:700">' + esc(readText('solutionTitle', '承载位置')) + '</div>' +
            '<div style="margin-bottom:8px;color:#6b7280;font-size:11px;line-height:1.4">' + esc(readText('solutionHelp', '选择复用已有 Solution，还是新建一个 Solution。')) + '</div>' +
            renderSolutions() +
          '</div>' +
          '<div>' +
            '<div style="margin-bottom:4px;color:#374151;font-size:12px;font-weight:700">' + esc(readText('actionTitle', '目标类型')) + '</div>' +
            '<div style="margin-bottom:8px;color:#6b7280;font-size:11px;line-height:1.4">' + esc(readText('actionHelp', '决定下一步要创建或更新的对象。')) + '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' + renderActions() + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;justify-content:space-between;border-top:1px solid #f3f4f6;padding-top:12px">' +
            '<div style="min-width:0;color:#9ca3af;font-size:11px;line-height:1.4">' + esc(readText('footerRunnerLabel', 'runner')) + ': ' + esc(p.runnerId || '-') + (p.threadId ? '<br>' + esc(readText('footerThreadLabel', 'thread')) + ': ' + esc(p.threadId) : '') + (p.checkpointId ? '<br>' + esc(readText('footerCheckpointLabel', 'checkpoint')) + ': ' + esc(p.checkpointId) : '') + '</div>' +
            '<button type="button" data-submit="true" ' + (canSubmit ? '' : 'disabled') + ' style="' + submitStyle + '">' + (submitting ? esc(readText('submitting', '提交中...')) : submitted ? esc(readText('submitted', '已提交')) : esc(readText('submit', '确认选择'))) + '</button>' +
          '</div>' +
          renderStatus() +
        '</div>' +
      '</div>';

    Array.prototype.forEach.call(el.querySelectorAll('[data-solution-index]'), function(btn) {
      btn.addEventListener('click', function() {
        if (submitted) return;
        var index = Number(btn.getAttribute('data-solution-index'));
        var item = solutionOptions[index];
        selectedSolutionId = solutionIdOf(item);
        errorText = '';
        paint();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-action]'), function(btn) {
      btn.addEventListener('click', function() {
        if (submitted) return;
        selectedAction = btn.getAttribute('data-action') || '';
        errorText = '';
        paint();
      });
    });
    var submit = el.querySelector('[data-submit]');
    if (submit) {
      submit.addEventListener('click', submitChoice);
    }
  }

  function hydrateSubmittedState() {
    if (hydrated || submitted || !ctx || typeof ctx.callHook !== 'function') return;
    hydrated = true;
    if (!p.threadId && !p.checkpointId && !p.interruptId) return;
    ctx.callHook('saas.app.conversation.codeAgentChoiceState', {
      sessionId: p.sessionId || ctx.sessionId,
      runnerId: p.runnerId,
      threadId: p.threadId,
      checkpointId: p.checkpointId || null,
      interruptId: p.interruptId || null,
    }, { live: true })
      .then(function(result) {
        var data = result && result.data ? result.data : result;
        if (!data || !data.submitted || !data.choice) return;
        var choice = data.choice;
        selectedSolutionId = String(choice.chooseSolution || selectedSolutionId || '');
        selectedAction = String(choice.chooseAction || selectedAction || '');
        if (choice.selectedSolution && selectedSolutionId && !hasSolutionOption(selectedSolutionId)) {
          solutionOptions.push(choice.selectedSolution);
        }
        submitted = true;
        resumeText = readText('submittedMessage', '选择已提交，LangGraph 将在后台继续执行。');
        paint();
      })
      .catch(function() {
        // State hydration is best-effort; keep the original card interactive on failure.
      });
  }

  function submitChoice() {
    if (!selectedSolutionId || !selectedAction || submitting || submitted) return;
    submitting = true;
    errorText = '';
    paint();
    var solution = selectedSolution();
    var nextContext = Object.assign({}, p.context || {}, {
      chooseSolution: selectedSolutionId,
      chooseAction: selectedAction,
      selectedSolution: solution || undefined,
    });
    ctx.callHook('saas.app.conversation.codeAgentChoiceSubmit', {
      sessionId: p.sessionId || ctx.sessionId,
      runnerId: p.runnerId,
      agentPrincipalId: p.agentPrincipalId,
      agentId: p.agentId,
      aiModelIds: p.aiModelIds,
      threadId: p.threadId,
      checkpointId: p.checkpointId || null,
      interruptId: p.interruptId || null,
      requirement: p.requirement,
      chooseSolution: selectedSolutionId,
      chooseAction: selectedAction,
      selectedSolution: solution || undefined,
      context: nextContext,
    }, { live: true })
      .then(function(result) {
        submitting = false;
        submitted = true;
        var data = result && result.data ? result.data : result;
        var resume = data && data.resume ? data.resume : null;
        if (resume && (resume.status === 'scheduled' || resume.status === 'resumed')) {
          resumeText = readText('submittedMessage', '选择已提交，LangGraph 将在后台继续执行。');
        } else if (resume && resume.status === 'failed') {
          resumeText = readText('failedPrefix', '选择已提交，但 LangGraph 恢复失败：') + (resume.message || '-');
        } else if (resume && resume.message) {
          resumeText = readText('submitted', '选择已提交') + '：' + resume.message;
        }
        paint();
      })
      .catch(function(err) {
        submitting = false;
        errorText = err && err.message ? err.message : String(err);
        paint();
      });
  }

  paint();
  hydrateSubmittedState();
}
`;
}

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { HookComponent } from '@/core/hookbus/decorators/hook-component.decorator';

/**
 * Code-agent action enum used by the dependency choice card.
 * @keyword-cn 代码智能体选择, 目标动作
 * @keyword-en code-agent-choice-action, target-action
 */
const codeAgentActionSchema = z.enum(['solution', 'app', 'view', 'unit']);

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
  reason: z.string().optional(),
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
 * payload: { sessionId?, runnerId, agentPrincipalId?, threadId?, checkpointId?, interruptId?, waitChoose?, useSolution?, waitChooseAction?, useAction?, context? }
 */
export function render(el, payload, ctx) {
  var p = payload || {};
  var solutionOptions = Array.isArray(p.waitChoose) && p.waitChoose.length
    ? p.waitChoose
    : (p.useSolution ? [p.useSolution] : []);
  var actionOptions = Array.isArray(p.waitChooseAction) && p.waitChooseAction.length
    ? p.waitChooseAction
    : (p.useAction ? [p.useAction] : []);
  var selectedSolutionId = p.useSolution ? solutionIdOf(p.useSolution) : (solutionOptions.length === 1 ? solutionIdOf(solutionOptions[0]) : '');
  var selectedAction = p.useAction || (actionOptions.length === 1 ? actionOptions[0] : '');
  var submitting = false;
  var submitted = false;
  var errorText = '';
  var resumeText = '';

  function solutionIdOf(item) {
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

  function actionLabel(value) {
    return {
      solution: 'Solution',
      app: 'App',
      view: 'View',
      unit: 'Unit',
    }[value] || value || '-';
  }

  function selectedSolution() {
    for (var i = 0; i < solutionOptions.length; i += 1) {
      if (solutionIdOf(solutionOptions[i]) === selectedSolutionId) return solutionOptions[i];
    }
    return p.useSolution || null;
  }

  function buttonStyle(active) {
    return [
      'width:100%;text-align:left;border:1px solid ',
      active ? '#2563eb' : '#e5e7eb',
      ';background:',
      active ? '#eff6ff' : '#ffffff',
      ';color:#111827;border-radius:8px;padding:10px 12px;cursor:pointer;transition:120ms ease;display:block',
    ].join('');
  }

  function actionStyle(active) {
    return [
      'border:1px solid ',
      active ? '#2563eb' : '#e5e7eb',
      ';background:',
      active ? '#eff6ff' : '#ffffff',
      ';color:',
      active ? '#1d4ed8' : '#374151',
      ';border-radius:8px;padding:8px 10px;cursor:pointer;font-size:13px;font-weight:600',
    ].join('');
  }

  function renderSolutions() {
    if (!solutionOptions.length) {
      return '<div style="padding:10px 12px;border:1px dashed #d1d5db;border-radius:8px;color:#6b7280;font-size:13px">没有可选择的 Solution</div>';
    }
    return solutionOptions.map(function(item, index) {
      var id = solutionIdOf(item);
      var active = id && id === selectedSolutionId;
      var summary = item.summary || item.description || '';
      var version = item.version ? '<span style="color:#9ca3af;font-weight:400"> @' + esc(item.version) + '</span>' : '';
      var includes = Array.isArray(item.includes) && item.includes.length
        ? '<div style="margin-top:6px;color:#9ca3af;font-size:11px">includes: ' + esc(item.includes.join(', ')) + '</div>'
        : '';
      return '<button type="button" data-solution-index="' + index + '" style="' + buttonStyle(active) + '">' +
        '<div style="font-size:13px;font-weight:700;line-height:1.35">' + esc(item.name || id || 'Unnamed Solution') + version + '</div>' +
        (summary ? '<div style="margin-top:4px;color:#4b5563;font-size:12px;line-height:1.45">' + esc(summary) + '</div>' : '') +
        '<div style="margin-top:6px;color:#9ca3af;font-size:11px">id: ' + esc(id || '-') + '</div>' +
        includes +
      '</button>';
    }).join('<div style="height:8px"></div>');
  }

  function renderActions() {
    if (!actionOptions.length) {
      return '<div style="color:#6b7280;font-size:13px">没有可选择的目标动作</div>';
    }
    return actionOptions.map(function(action) {
      return '<button type="button" data-action="' + esc(action) + '" style="' + actionStyle(action === selectedAction) + '">' + esc(actionLabel(action)) + '</button>';
    }).join('');
  }

  function renderStatus() {
    if (errorText) {
      return '<div style="margin-top:10px;color:#dc2626;font-size:12px;line-height:1.45">' + esc(errorText) + '</div>';
    }
    if (submitted) {
      return '<div style="margin-top:10px;color:#16a34a;font-size:12px;line-height:1.45">' + esc(resumeText || '选择已提交，LangGraph 已恢复。') + '</div>';
    }
    return '';
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
          '<div style="font-size:14px;font-weight:800;color:#111827;line-height:1.35">code-agent 需要确认目标</div>' +
          (p.reason ? '<div style="margin-top:4px;color:#6b7280;font-size:12px;line-height:1.45">' + esc(p.reason) + '</div>' : '') +
        '</div>' +
        '<div style="padding:14px;display:grid;gap:14px">' +
          '<div>' +
            '<div style="margin-bottom:8px;color:#374151;font-size:12px;font-weight:700">Solution</div>' +
            renderSolutions() +
          '</div>' +
          '<div>' +
            '<div style="margin-bottom:8px;color:#374151;font-size:12px;font-weight:700">目标类型</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' + renderActions() + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;justify-content:space-between;border-top:1px solid #f3f4f6;padding-top:12px">' +
            '<div style="min-width:0;color:#9ca3af;font-size:11px;line-height:1.4">runner: ' + esc(p.runnerId || '-') + (p.threadId ? '<br>thread: ' + esc(p.threadId) : '') + (p.checkpointId ? '<br>checkpoint: ' + esc(p.checkpointId) : '') + '</div>' +
            '<button type="button" data-submit="true" ' + (canSubmit ? '' : 'disabled') + ' style="' + submitStyle + '">' + (submitting ? '提交中...' : submitted ? '已提交' : '确认选择') + '</button>' +
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
        if (resume && resume.status === 'resumed') {
          resumeText = '选择已提交，LangGraph 已恢复。';
        } else if (resume && resume.status === 'failed') {
          resumeText = '选择已提交，但 LangGraph 恢复失败：' + (resume.message || '-');
        } else if (resume && resume.message) {
          resumeText = '选择已提交：' + resume.message;
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
}
`;
}

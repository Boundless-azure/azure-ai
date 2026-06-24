import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { HookComponent } from '@/core/hookbus/decorators/hook-component.decorator';

/**
 * Code-agent action enum used by the dependency choice card.
 * @keyword-cn 代码智能体选择, 动作选择
 * @keyword-en code-agent-choice-action, route-action
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
 * Route plan item rendered by the dependency choice card.
 * @keyword-cn 代码智能体选择卡片, 路由计划
 * @keyword-en code-agent-choice-card, route-plan
 */
const codeAgentRoutePlanSchema = z
  .object({
    id: z.string().optional(),
    requirement: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    useAction: codeAgentActionSchema.nullable().optional(),
    waitChooseAction: z.array(codeAgentActionSchema).optional(),
    useSolution: codeAgentSolutionChoiceSchema.nullable().optional(),
    waitChoose: z.array(codeAgentSolutionChoiceSchema).optional(),
    reason: z.string().optional(),
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
  useActions: z.array(codeAgentActionSchema).optional(),
  routePlan: z.array(codeAgentRoutePlanSchema).min(1),
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
      'Lets the user confirm each routePlan step, then submits routePlan to codeAgentChoiceSubmit.',
    tags: ['conversation', 'code-agent', 'component', 'selection'],
    payloadSchema: codeAgentDependencyChoicePayloadSchema,
  })
  readonly dependencyChoice = /* js */ `
/**
 * saas.app.conversation.codeAgentDependencyChoice
 * payload: { sessionId?, runnerId, agentPrincipalId?, threadId?, checkpointId?, interruptId?, uiText?, requiresNewSolution?, newSolutionReason?, newSolutionOption?, waitChoose?, useSolution?, waitChooseAction?, useAction?, useActions?, routePlan?, context? }
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
    : (Array.isArray(p.useActions) && p.useActions.length ? p.useActions : (p.useAction ? [p.useAction] : []));
  var selectedSolutionId = p.useSolution ? solutionIdOf(p.useSolution) : (solutionOptions.length === 1 && !p.requiresNewSolution ? solutionIdOf(solutionOptions[0]) : '');
  var selectedAction = p.useAction || (actionOptions.length === 1 ? actionOptions[0] : '');
  var routePlan = Array.isArray(p.routePlan) ? p.routePlan : [];
  if (!routePlan.length) {
    routePlan = [{
      id: 'step-1',
      requirement: p.requirement || '',
      title: readText('routePlanTitle', 'Requirement route'),
      summary: p.requirement || '',
      waitChoose: p.useSolution ? [] : existingSolutionOptions,
      useSolution: p.useSolution || null,
      waitChooseAction: p.useAction ? [] : actionOptions,
      useAction: p.useAction || null,
    }];
  }
  var routeSelections = {};
  var currentStep = 0;
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
        description: 'Continue in the app/page lane.',
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

  function routePlanId(item, index) {
    return String((item && item.id) || ('route-' + (index + 1)));
  }

  function findRouteSolution(item, solutionId) {
    var choices = item && Array.isArray(item.waitChoose) ? item.waitChoose : [];
    for (var i = 0; i < choices.length; i += 1) {
      if (solutionIdOf(choices[i]) === solutionId) return choices[i];
    }
    for (var j = 0; j < solutionOptions.length; j += 1) {
      if (solutionIdOf(solutionOptions[j]) === solutionId) return solutionOptions[j];
    }
    return null;
  }

  function routeAction(item) {
    if (item && item.useAction) return item.useAction;
    if (item && Array.isArray(item.waitChooseAction) && item.waitChooseAction.length) return item.waitChooseAction.join(', ');
    return '';
  }

  function routeSolutionName(item) {
    if (item && item.useSolution) return item.useSolution.name || item.useSolution.solutionId || item.useSolution.id || '';
    if (item && Array.isArray(item.waitChoose) && item.waitChoose.length) return item.waitChoose.map(function(solution) {
      return solution.name || solution.solutionId || solution.id || '';
    }).filter(Boolean).join(', ');
    return '';
  }

  function resolvedRoutePlan() {
    return routePlan.map(function(item, index) {
      var routeId = routePlanId(item, index);
      var selection = routeSelections[routeId] || {};
      var next = Object.assign({}, item || {});
      if (selection.solutionId) {
        var solution = findRouteSolution(item, selection.solutionId);
        if (solution) {
          next.useSolution = solution;
          next.waitChoose = [];
        }
      }
      if (selection.action) {
        next.useAction = selection.action;
        next.waitChooseAction = [];
      }
      return next;
    });
  }

  function hasPendingRouteChoices() {
    var plan = resolvedRoutePlan();
    for (var i = 0; i < plan.length; i += 1) {
      var item = plan[i] || {};
      if (!item.useSolution && Array.isArray(item.waitChoose) && item.waitChoose.length) return true;
      if (!item.useAction && Array.isArray(item.waitChooseAction) && item.waitChooseAction.length) return true;
    }
    return false;
  }

  function shortText(value, maxLength) {
    var text = String(value == null ? '' : value).replace(/\\s+/g, ' ').trim();
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, Math.max(0, maxLength - 1)).trim() + '…';
  }

  function routeSolutionChoices(item) {
    var choices = item && Array.isArray(item.waitChoose) ? item.waitChoose.slice() : [];
    if (!choices.length && item && !item.useSolution) {
      choices = existingSolutionOptions.slice();
    }
    if (!item.useSolution && newSolutionOption) {
      var newId = solutionIdOf(newSolutionOption);
      var exists = choices.some(function(choice) {
        return solutionIdOf(choice) === newId;
      });
      if (!exists) choices.push(newSolutionOption);
    }
    return choices;
  }

  function routeActionChoices(item) {
    var choices = item && Array.isArray(item.waitChooseAction) ? item.waitChooseAction.slice() : [];
    if (!choices.length && item && !item.useAction) {
      choices = actionOptions.slice();
    }
    return choices;
  }

  function routeComplete(item) {
    return Boolean(item && item.useSolution && item.useAction);
  }

  function allRoutesComplete() {
    var plan = resolvedRoutePlan();
    return Boolean(plan.length) && plan.every(routeComplete);
  }

  function primaryRouteSolution(plan) {
    for (var i = 0; i < plan.length; i += 1) {
      if (plan[i] && plan[i].useSolution) return plan[i].useSolution;
    }
    return null;
  }

  function primaryRouteAction(plan) {
    for (var i = 0; i < plan.length; i += 1) {
      if (plan[i] && plan[i].useAction) return plan[i].useAction;
    }
    return '';
  }

  function routeActions(plan) {
    var actions = [];
    plan.forEach(function(item) {
      if (item && item.useAction && actions.indexOf(item.useAction) < 0) {
        actions.push(item.useAction);
      }
    });
    return actions;
  }

  function stepCountLabel() {
    return String(Math.min(currentStep + 1, routePlan.length)) + ' / ' + String(routePlan.length);
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

  function routeChoiceStyle(active) {
    return [
      'width:100%;text-align:left;border:1px solid ',
      active ? '#2563eb' : '#e5e7eb',
      ';background:',
      active ? '#eff6ff' : '#ffffff',
      ';color:#111827;border-radius:8px;padding:8px 10px;cursor:pointer;display:block;font-size:12px;line-height:1.35',
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
      return '<div style="color:#6b7280;font-size:13px">' + esc(readText('noActions', '没有可选择的动作类型')) + '</div>';
    }
    return actionOptions.map(function(action) {
      var meta = actionMeta(action);
      return '<button type="button" data-action="' + esc(action) + '" style="' + actionStyle(action === selectedAction) + '">' +
        '<div style="font-size:13px;font-weight:800;line-height:1.35">' + esc(meta.label) + '</div>' +
        (meta.description ? '<div style="margin-top:4px;font-size:11px;line-height:1.35;color:#6b7280;font-weight:400">' + esc(meta.description) + '</div>' : '') +
      '</button>';
    }).join('');
  }

  function renderRoutePlan() {
    if (!routePlan.length) return '';
    var resolvedPlan = resolvedRoutePlan();
    function renderRouteSolutionChoices(item, index) {
      if (item && item.useSolution) return '';
      var choices = item && Array.isArray(item.waitChoose) ? item.waitChoose : [];
      if (!choices.length) return '';
      var routeId = routePlanId(item, index);
      var selectedId = (routeSelections[routeId] || {}).solutionId || '';
      return '<div style="margin-top:8px">' +
        '<div style="margin-bottom:6px;color:#6b7280;font-size:11px;font-weight:700">' + esc(readText('solutionTitle', '承载位置')) + '</div>' +
        choices.map(function(solution, choiceIndex) {
          var id = solutionIdOf(solution);
          return '<button type="button" data-route-solution-index="' + index + '" data-route-solution-id="' + esc(id) + '" style="' + routeChoiceStyle(id === selectedId) + '">' +
            '<strong>' + esc(solution.name || id || ('Solution ' + (choiceIndex + 1))) + '</strong>' +
            (solution.reason ? '<div style="margin-top:3px;color:#6b7280">' + esc(solution.reason) + '</div>' : '') +
          '</button>';
        }).join('<div style="height:6px"></div>') +
      '</div>';
  }

  return '';
  }

  function renderRouteStep() {
    var index = Math.min(currentStep, routePlan.length - 1);
    var original = routePlan[index] || {};
    var resolved = resolvedRoutePlan()[index] || original;
    var solutionChoices = routeSolutionChoices(original);
    var actionChoices = routeActionChoices(original);
    var selectedRouteSolutionId = resolved.useSolution ? solutionIdOf(resolved.useSolution) : '';
    var selectedRouteAction = resolved.useAction || '';
    var canGoNext = routeComplete(resolved);
    var nextLabel = index >= routePlan.length - 1 ? readText('review', 'Review') : readText('next', 'Next');
    var summary = shortText(resolved.summary || resolved.requirement || '', 150);
    var solutionBlock = solutionChoices.length > 1 || !selectedRouteSolutionId
      ? '<div style="margin-top:12px">' +
          '<div style="margin-bottom:6px;color:#374151;font-size:12px;font-weight:800">' + esc(readText('solutionQuestion', 'Which Solution should carry this step?')) + '</div>' +
          solutionChoices.map(function(solution, choiceIndex) {
            var id = solutionIdOf(solution);
            var active = id && id === selectedRouteSolutionId;
            var isNew = solution.kind === 'new-solution';
            return '<button type="button" data-route-solution-index="' + index + '" data-route-solution-id="' + esc(id) + '" style="' + routeChoiceStyle(active) + '">' +
              '<strong>' + esc(solution.name || id || ('Solution ' + (choiceIndex + 1))) + '</strong>' +
              (isNew ? '<span style="margin-left:6px;color:#92400e;font-weight:800">' + esc(readText('newSolutionBadge', 'New')) + '</span>' : '') +
              (solution.summary ? '<div style="margin-top:3px;color:#6b7280">' + esc(shortText(solution.summary, 90)) + '</div>' : '') +
            '</button>';
          }).join('<div style="height:6px"></div>') +
        '</div>'
      : '<div style="margin-top:12px;color:#1d4ed8;font-size:12px;font-weight:800">' + esc(readText('solutionTitle', 'Solution')) + ': ' + esc(routeSolutionName(resolved) || '-') + '</div>';
    var actionBlock = actionChoices.length > 1 || !selectedRouteAction
      ? '<div style="margin-top:12px">' +
          '<div style="margin-bottom:6px;color:#374151;font-size:12px;font-weight:800">' + esc(readText('actionQuestion', 'Which action lane should this step use?')) + '</div>' +
          '<div style="display:grid;gap:6px">' +
            actionChoices.map(function(action) {
              return '<button type="button" data-route-action-index="' + index + '" data-route-action="' + esc(action) + '" style="' + routeChoiceStyle(action === selectedRouteAction) + '">' + esc(actionDisplayName(action)) + '</button>';
            }).join('') +
          '</div>' +
        '</div>'
      : '<div style="margin-top:8px;color:#1d4ed8;font-size:12px;font-weight:800">' + esc(readText('actionTitle', 'Action')) + ': ' + esc(actionDisplayName(selectedRouteAction)) + '</div>';
    return '<div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">' +
        '<div style="color:#6b7280;font-size:12px;font-weight:800">' + esc(readText('stepLabel', 'Step')) + ' ' + esc(stepCountLabel()) + '</div>' +
        '<div style="height:6px;flex:1;background:#f3f4f6;border-radius:999px;overflow:hidden">' +
          '<div style="height:100%;width:' + esc(String(((index + 1) / routePlan.length) * 100)) + '%;background:#2563eb"></div>' +
        '</div>' +
      '</div>' +
      '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#ffffff">' +
        '<div style="font-size:14px;font-weight:800;color:#111827;line-height:1.35">' + esc(resolved.title || ('Route ' + (index + 1))) + '</div>' +
        (summary ? '<div style="margin-top:6px;color:#6b7280;font-size:12px;line-height:1.45">' + esc(summary) + '</div>' : '') +
        solutionBlock +
        actionBlock +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px">' +
        '<button type="button" data-prev-step="true" ' + (index <= 0 ? 'disabled' : '') + ' style="border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#374151;padding:8px 10px;font-size:12px;font-weight:700;cursor:' + (index <= 0 ? 'not-allowed' : 'pointer') + '">' + esc(readText('previous', 'Previous')) + '</button>' +
        '<button type="button" data-next-step="true" ' + (canGoNext ? '' : 'disabled') + ' style="border:0;border-radius:8px;background:' + (canGoNext ? '#111827' : '#e5e7eb') + ';color:' + (canGoNext ? '#fff' : '#9ca3af') + ';padding:8px 12px;font-size:12px;font-weight:800;cursor:' + (canGoNext ? 'pointer' : 'not-allowed') + '">' + esc(nextLabel) + '</button>' +
      '</div>' +
    '</div>';
  }

  function renderRouteSummary() {
    var plan = resolvedRoutePlan();
    return '<div>' +
      '<div style="font-size:14px;font-weight:800;color:#111827">' + esc(readText('summaryTitle', 'Review Route Plan')) + '</div>' +
      '<div style="margin-top:6px;color:#6b7280;font-size:12px;line-height:1.45">' + esc(readText('summaryHelp', 'Confirm these route choices before continuing.')) + '</div>' +
      '<div style="margin-top:12px;display:grid;gap:8px">' +
        plan.map(function(item, index) {
          return '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:#ffffff">' +
            '<div style="font-size:12px;font-weight:800;color:#111827;line-height:1.35">' + esc(index + 1) + '. ' + esc(shortText(item.title || item.summary || item.requirement || ('Route ' + (index + 1)), 80)) + '</div>' +
            '<div style="margin-top:6px;color:#1d4ed8;font-size:11px;font-weight:800;line-height:1.4">' +
              esc(routeSolutionName(item) || '-') + ' / ' + esc(item.useAction ? actionDisplayName(item.useAction) : '-') +
            '</div>' +
            '<button type="button" data-edit-step="' + index + '" style="margin-top:8px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#374151;padding:6px 8px;font-size:11px;font-weight:700;cursor:pointer">' + esc(readText('edit', 'Edit')) + '</button>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function renderRouteWizard() {
    if (currentStep >= routePlan.length) return renderRouteSummary();
    return renderRouteStep();
  }
  /*
    function renderRouteActionChoices(item, index) {
      if (item && item.useAction) return '';
      var choices = item && Array.isArray(item.waitChooseAction) ? item.waitChooseAction : [];
      if (!choices.length) return '';
      var routeId = routePlanId(item, index);
      var selected = (routeSelections[routeId] || {}).action || '';
      return '<div style="margin-top:8px">' +
        '<div style="margin-bottom:6px;color:#6b7280;font-size:11px;font-weight:700">' + esc(readText('actionTitle', '动作')) + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          choices.map(function(action) {
            return '<button type="button" data-route-action-index="' + index + '" data-route-action="' + esc(action) + '" style="' + routeChoiceStyle(action === selected) + '">' + esc(actionDisplayName(action)) + '</button>';
          }).join('') +
        '</div>' +
      '</div>';
    }
    return '<div>' +
      '<div style="margin-bottom:4px;color:#374151;font-size:12px;font-weight:700">' + esc(readText('routePlanTitle', '需求路由')) + '</div>' +
      '<div style="margin-bottom:8px;color:#6b7280;font-size:11px;line-height:1.4">' + esc(readText('routePlanHelp', '这些需求项只确认对应的 Solution 与 action。')) + '</div>' +
      routePlan.map(function(item, index) {
        var resolved = resolvedPlan[index] || item;
        var action = routeAction(resolved);
        var solutionName = routeSolutionName(resolved);
        var routeMeta = [solutionName ? ('Solution: ' + solutionName) : '', action ? ('Action: ' + actionDisplayName(action)) : ''].filter(Boolean).join(' / ');
        return '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:#ffffff">' +
          '<div style="font-size:13px;font-weight:800;color:#111827;line-height:1.35">' + esc(resolved.title || ('Route ' + (index + 1))) + '</div>' +
          (resolved.requirement ? '<div style="margin-top:4px;color:#374151;font-size:12px;line-height:1.4">' + esc(resolved.requirement) + '</div>' : '') +
          (resolved.summary ? '<div style="margin-top:4px;color:#6b7280;font-size:12px;line-height:1.4">' + esc(resolved.summary) + '</div>' : '') +
          (routeMeta ? '<div style="margin-top:6px;color:#1d4ed8;font-size:11px;font-weight:800;line-height:1.35">' + esc(routeMeta) + '</div>' : '') +
          renderRouteSolutionChoices(item, index) +
          renderRouteActionChoices(item, index) +
        '</div>';
      }).join('<div style="height:8px"></div>') +
    '</div>';
  }
  */

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
    var canSubmit = currentStep >= routePlan.length && allRoutesComplete() && !submitting && !submitted;
    var submitStyle = [
      'border:0;border-radius:8px;padding:9px 12px;font-size:13px;font-weight:700;',
      canSubmit ? 'background:#111827;color:#ffffff;cursor:pointer' : 'background:#e5e7eb;color:#9ca3af;cursor:not-allowed',
    ].join('');
    el.innerHTML =
      '<div style="font-family:inherit;border:1px solid #e5e7eb;border-radius:8px;background:#fff;overflow:hidden;max-width:720px">' +
        '<div style="padding:12px 14px;border-bottom:1px solid #f3f4f6">' +
          '<div style="font-size:14px;font-weight:800;color:#111827;line-height:1.35">' + esc(readText('title', 'code-agent 需要确认 Solution 与动作')) + '</div>' +
          '<div style="margin-top:4px;color:#6b7280;font-size:12px;line-height:1.45">' + esc(readText('subtitle', '请选择本次需求的承载位置和动作类型。')) + '</div>' +
          (readText('decisionNote', '') ? '<div style="margin-top:6px;color:#4b5563;font-size:12px;line-height:1.45">' + esc(readText('decisionNote', '')) + '</div>' : '') +
        '</div>' +
        '<div style="padding:14px;display:grid;gap:14px">' +
          renderNewSolutionNotice() +
          '<div style="display:none">' +
            '<div style="margin-bottom:4px;color:#374151;font-size:12px;font-weight:700">' + esc(readText('solutionTitle', '承载位置')) + '</div>' +
            '<div style="margin-bottom:8px;color:#6b7280;font-size:11px;line-height:1.4">' + esc(readText('solutionHelp', '选择复用已有 Solution，还是新建一个 Solution。')) + '</div>' +
            renderSolutions() +
          '</div>' +
          '<div style="display:none">' +
            '<div style="margin-bottom:4px;color:#374151;font-size:12px;font-weight:700">' + esc(readText('actionTitle', '动作')) + '</div>' +
            '<div style="margin-bottom:8px;color:#6b7280;font-size:11px;line-height:1.4">' + esc(readText('actionHelp', '决定后续 graph 走 app、unit 还是 data-point 通道。')) + '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' + renderActions() + '</div>' +
          '</div>' +
          renderRouteWizard() +
          '<div style="display:flex;align-items:center;gap:10px;justify-content:flex-end;border-top:1px solid #f3f4f6;padding-top:12px">' +
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
    Array.prototype.forEach.call(el.querySelectorAll('[data-route-solution-index]'), function(btn) {
      btn.addEventListener('click', function() {
        if (submitted) return;
        var index = Number(btn.getAttribute('data-route-solution-index'));
        var routeItem = routePlan[index];
        var routeKey = routePlanId(routeItem, index);
        routeSelections[routeKey] = Object.assign({}, routeSelections[routeKey] || {}, {
          solutionId: btn.getAttribute('data-route-solution-id') || '',
        });
        errorText = '';
        paint();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-route-action-index]'), function(btn) {
      btn.addEventListener('click', function() {
        if (submitted) return;
        var index = Number(btn.getAttribute('data-route-action-index'));
        var routeItem = routePlan[index];
        var routeKey = routePlanId(routeItem, index);
        routeSelections[routeKey] = Object.assign({}, routeSelections[routeKey] || {}, {
          action: btn.getAttribute('data-route-action') || '',
        });
        errorText = '';
        paint();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-prev-step]'), function(btn) {
      btn.addEventListener('click', function() {
        if (submitted || currentStep <= 0) return;
        currentStep -= 1;
        errorText = '';
        paint();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-next-step]'), function(btn) {
      btn.addEventListener('click', function() {
        if (submitted) return;
        var index = Math.min(currentStep, routePlan.length - 1);
        var item = resolvedRoutePlan()[index];
        if (!routeComplete(item)) return;
        currentStep = Math.min(routePlan.length, currentStep + 1);
        errorText = '';
        paint();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-edit-step]'), function(btn) {
      btn.addEventListener('click', function() {
        if (submitted) return;
        var index = Number(btn.getAttribute('data-edit-step'));
        if (!Number.isFinite(index)) return;
        currentStep = Math.max(0, Math.min(routePlan.length - 1, index));
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
        if (choice.context && Array.isArray(choice.context.routePlan)) {
          routePlan = choice.context.routePlan;
        }
        if (choice.selectedSolution && selectedSolutionId && !hasSolutionOption(selectedSolutionId)) {
          solutionOptions.push(choice.selectedSolution);
        }
        submitted = true;
        currentStep = routePlan.length;
        resumeText = readText('submittedMessage', '选择已提交，LangGraph 将在后台继续执行。');
        paint();
      })
      .catch(function() {
        // State hydration is best-effort; keep the original card interactive on failure.
      });
  }

  function submitChoice() {
    if (!allRoutesComplete() || submitting || submitted) return;
    submitting = true;
    errorText = '';
    paint();
    var finalRoutePlan = resolvedRoutePlan();
    var solution = primaryRouteSolution(finalRoutePlan);
    var selectedSolutionId = solution ? solutionIdOf(solution) : '';
    var selectedAction = primaryRouteAction(finalRoutePlan);
    var selectedActions = routeActions(finalRoutePlan);
    var nextContext = Object.assign({}, p.context || {}, {
      chooseSolution: selectedSolutionId,
      chooseAction: selectedAction,
      chooseActions: selectedActions,
      routePlan: finalRoutePlan,
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
      chooseActions: selectedActions,
      routePlan: finalRoutePlan,
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

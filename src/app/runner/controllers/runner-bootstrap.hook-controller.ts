import { Injectable } from '@nestjs/common';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';

/**
 * @title Runner Bootstrap Hook Controller
 * @description 各功能块的 `saas.app.<module>.runnerBootstrap` 占位 hook 声明层 (从 RunnerHookRegisterService 迁出)。
 *   仅系统内部在 runner 挂载时触发, 外部/LLM 不可达 → 按 P2 例外不挂 @CheckAbility; 无入参 (args:[]), 回 { moduleName }。
 * @keywords-cn Runner启动占位Hook, 单对象payload, 系统事件
 * @keywords-en runner-bootstrap-hook-controller, single-object-payload, system-event
 */
@Injectable()
@HookController({ pluginName: 'runner', tags: ['bootstrap'] })
export class RunnerBootstrapHookController {
  /**
   * agent 功能块启动占位。
   * @keyword-cn agent启动占位
   * @keyword-en agent-bootstrap
   */
  @HookRoute({
    hook: 'saas.app.agent.runnerBootstrap',
    description: 'agent 功能块 runner 启动占位 hook (无入参)',
    args: [],
    metadata: { tags: ['agent'] },
  })
  agent() {
    return { moduleName: 'agent' };
  }

  /**
   * conversation 功能块启动占位。
   * @keyword-cn 对话启动占位
   * @keyword-en conversation-bootstrap
   */
  @HookRoute({
    hook: 'saas.app.conversation.runnerBootstrap',
    description: 'conversation 功能块 runner 启动占位 hook (无入参)',
    args: [],
    metadata: { tags: ['conversation'] },
  })
  conversation() {
    return { moduleName: 'conversation' };
  }

  /**
   * identity 功能块启动占位。
   * @keyword-cn 身份启动占位
   * @keyword-en identity-bootstrap
   */
  @HookRoute({
    hook: 'saas.app.identity.runnerBootstrap',
    description: 'identity 功能块 runner 启动占位 hook (无入参)',
    args: [],
    metadata: { tags: ['identity'] },
  })
  identity() {
    return { moduleName: 'identity' };
  }

  /**
   * resource 功能块启动占位。
   * @keyword-cn 资源启动占位
   * @keyword-en resource-bootstrap
   */
  @HookRoute({
    hook: 'saas.app.resource.runnerBootstrap',
    description: 'resource 功能块 runner 启动占位 hook (无入参)',
    args: [],
    metadata: { tags: ['resource'] },
  })
  resource() {
    return { moduleName: 'resource' };
  }

  /**
   * todo 功能块启动占位。
   * @keyword-cn 待办启动占位
   * @keyword-en todo-bootstrap
   */
  @HookRoute({
    hook: 'saas.app.todo.runnerBootstrap',
    description: 'todo 功能块 runner 启动占位 hook (无入参)',
    args: [],
    metadata: { tags: ['todo'] },
  })
  todo() {
    return { moduleName: 'todo' };
  }

  /**
   * plugin 功能块启动占位。
   * @keyword-cn 插件启动占位
   * @keyword-en plugin-bootstrap
   */
  @HookRoute({
    hook: 'saas.app.plugin.runnerBootstrap',
    description: 'plugin 功能块 runner 启动占位 hook (无入参)',
    args: [],
    metadata: { tags: ['plugin'] },
  })
  plugin() {
    return { moduleName: 'plugin' };
  }

  /**
   * runner 功能块启动占位。
   * @keyword-cn Runner启动占位
   * @keyword-en runner-bootstrap
   */
  @HookRoute({
    hook: 'saas.app.runner.runnerBootstrap',
    description: 'runner 功能块 runner 启动占位 hook (无入参)',
    args: [],
    metadata: { tags: ['runner'] },
  })
  runner() {
    return { moduleName: 'runner' };
  }
}

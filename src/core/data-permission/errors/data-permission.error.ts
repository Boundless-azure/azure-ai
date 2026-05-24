import { ForbiddenException } from '@nestjs/common';

/**
 * @title 数据权限错误类
 * @description applyTo 校验失败时抛出, 包含全部失败节点的元数据 (供前端 / LLM 解读, 知道改什么 payload 才能过)。
 *              continue ForbiddenException 体系, AbilityGuard / HookAbilityMiddleware 同样能识别。
 * @keywords-cn 数据权限错误, payload 校验失败, 前端解读
 * @keywords-en data-permission-error, payload-validation-fail, frontend-readable
 */
export interface DataPermissionFailureItem {
  subject: string;
  action: string;
  errorMsg: string;
  weight?: number;
}

export class DataPermissionError extends ForbiddenException {
  constructor(public readonly failures: DataPermissionFailureItem[]) {
    super({
      code: 'data-permission-failed',
      message:
        failures.length === 1
          ? failures[0].errorMsg
          : `数据权限校验未通过 (${failures.length} 项), 任一节点通过即可: ${failures
              .map((f) => `[${f.subject}:${f.action}] ${f.errorMsg}`)
              .join('; ')}`,
      failures,
    });
  }
}

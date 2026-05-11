import { z } from 'zod';
import type { Queue } from 'bullmq';

/**
 * @title 触点调度 (定时触发) 工具
 * @description Schedule zod schema + BullMQ Repeatable Job 操作封装. cron / interval 走 upsertJobScheduler (BullMQ 5+ 新 API), once 走普通 delayed job. 错过触发不补发, 跟 BullMQ 默认行为一致, 避免雪崩.
 * @keywords-cn 触点调度, 定时触发, cron, interval, once, BullMQ Repeatable, 不补发
 * @keywords-en touchpoint-schedule, scheduled-trigger, cron, interval, once, bullmq-repeatable, no-catchup
 */

/**
 * Schedule 形态: union 三选一 (cron / interval / once); 字段名互斥, 不带 type 标识
 *  - cron     :: { cron: '0 9 * * *', timezone?: 'Asia/Shanghai' }
 *  - interval :: { interval: 60_000 }  // ms, 最少 1 秒
 *  - once     :: { once: '2026-06-01T09:00:00+08:00' }  // ISO 8601, 触发后 trigger.service 自动 enabled=false
 * @keyword-en schedule-schema
 */
export const ScheduleSchema = z.union([
  z.strictObject({
    cron: z.string().min(1),
    timezone: z.string().optional(),
  }),
  z.strictObject({
    interval: z.number().int().positive().min(1_000),
  }),
  z.strictObject({
    once: z.string().datetime({ offset: true }),
  }),
]);
export type Schedule = z.infer<typeof ScheduleSchema>;

/**
 * Schedule 类型的 BullMQ job data
 * @keyword-en schedule-job-data
 */
export interface ScheduleJobData {
  touchpointId: string;
  /** once 类型触发时为 true, trigger.service 跑完会自动 enabled=false */
  once?: boolean;
}

/**
 * 每个触点的 scheduler 唯一 key (BullMQ 5+ jobScheduler id)
 * @keyword-en scheduler-key
 */
function schedulerKey(touchpointId: string): string {
  return `tp:schedule:${touchpointId}`;
}

function onceJobId(touchpointId: string): string {
  return `tp:once:${touchpointId}`;
}

/**
 * 注册/更新触点的 schedule (cron/interval Repeatable, once 走 delayed job).
 * 先移除旧的, 再注册新的, 保证幂等.
 * @keyword-en upsert-touchpoint-schedule
 */
export async function upsertTouchpointSchedule(
  queue: Queue,
  touchpointId: string,
  schedule: Schedule,
): Promise<void> {
  await removeTouchpointSchedule(queue, touchpointId);

  const data: ScheduleJobData = { touchpointId };

  if ('cron' in schedule) {
    await queue.upsertJobScheduler(
      schedulerKey(touchpointId),
      {
        pattern: schedule.cron,
        ...(schedule.timezone ? { tz: schedule.timezone } : {}),
      },
      {
        name: 'schedule',
        data,
        opts: {
          removeOnComplete: { age: 3_600, count: 1_000 },
          removeOnFail: { age: 24 * 3_600 },
        },
      },
    );
    return;
  }

  if ('interval' in schedule) {
    await queue.upsertJobScheduler(
      schedulerKey(touchpointId),
      { every: schedule.interval },
      {
        name: 'schedule',
        data,
        opts: {
          removeOnComplete: { age: 3_600, count: 1_000 },
          removeOnFail: { age: 24 * 3_600 },
        },
      },
    );
    return;
  }

  if ('once' in schedule) {
    const targetMs = new Date(schedule.once).getTime();
    const delay = Math.max(0, targetMs - Date.now());
    if (delay <= 0) {
      // 过去时间不调度 (但仍清除已存在的 once job, 避免遗留)
      return;
    }
    await queue.add(
      'schedule',
      { ...data, once: true } satisfies ScheduleJobData,
      {
        delay,
        jobId: onceJobId(touchpointId),
        removeOnComplete: { age: 3_600 },
        removeOnFail: { age: 24 * 3_600 },
      },
    );
  }
}

/**
 * 移除触点的所有 schedule (Repeatable scheduler + 待执行的 once job)
 * 触点 update / delete 时调用. 找不到也不报错.
 * @keyword-en remove-touchpoint-schedule
 */
export async function removeTouchpointSchedule(
  queue: Queue,
  touchpointId: string,
): Promise<void> {
  // BullMQ 5+ 新 API
  try {
    const removeFn = (queue as unknown as {
      removeJobScheduler?: (id: string) => Promise<unknown>;
    }).removeJobScheduler;
    if (typeof removeFn === 'function') {
      await removeFn.call(queue, schedulerKey(touchpointId));
    }
  } catch {
    // ignore
  }
  try {
    const onceJob = await queue.getJob(onceJobId(touchpointId));
    if (onceJob) {
      await onceJob.remove();
    }
  } catch {
    // ignore
  }
}

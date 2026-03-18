import { RunnerDbMigrationService } from './services/runner-db.migration.service';
import { RunnerDbService } from './services/runner-db.service';

/**
 * @title Runner 管理库模块导出
 * @description 统一导出 runner 管理库服务与迁移工具。
 * @keywords-cn Runner库模块, 导出, 迁移服务
 * @keywords-en runner-db-module, exports, migration-service
 */
export const RunnerDbModule = {
  services: {
    RunnerDbService,
    RunnerDbMigrationService,
  },
};

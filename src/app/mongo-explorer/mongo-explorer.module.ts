import { Module } from '@nestjs/common';
import { MongoExplorerService } from './services/mongo-explorer.service';
import { MongoExplorerController } from './controllers/mongo-explorer.controller';
import { RunnerModule } from '@/app/runner/runner.module';

/**
 * @title MongoDB Explorer 模块
 * @description MongoDB 浏览器模块，通过 Runner 代理提供数据库/集合查询和 Schema 查看功能
 * @keywords-cn MongoDB浏览器, Runner代理, 数据库查询, Schema查看, 集合管理
 * @keywords-en mongo-explorer, runner-proxy, database-query, schema-view, collection-management
 */
@Module({
  imports: [RunnerModule],
  providers: [MongoExplorerService],
  controllers: [MongoExplorerController],
  exports: [MongoExplorerService],
})
export class MongoExplorerModule {}

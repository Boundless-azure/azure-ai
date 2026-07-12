import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourceEntity } from './entities/resource.entity';
import { ResourceService } from './services/resource.service';
import { ResourceSignService } from './services/resource-sign.service';
import { ResourceController } from './controllers/resource.controller';
import { ResourceHookController } from './controllers/resource.hook-controller';

/**
 * @title Resource 模块
 * @description 提供统一资源上传与访问接口，以及资源元信息持久化。
 * @keywords-cn 资源模块, 上传, 访问, 去重, 流式
 * @keywords-en resource-module, upload, access, dedup, streaming
 */
@Module({
  imports: [TypeOrmModule.forFeature([ResourceEntity])],
  providers: [ResourceService, ResourceSignService, ResourceHookController],
  controllers: [ResourceController],
  exports: [ResourceService, ResourceSignService],
})
export class ResourceModule {}

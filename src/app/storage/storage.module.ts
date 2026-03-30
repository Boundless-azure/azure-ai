import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageNodeEntity } from './entities/storage-node.entity';
import { StorageService } from './services/storage.service';
import { StorageController } from './controllers/storage.controller';
import { ResourceModule } from '../resource/resource.module';

/**
 * @title Storage 模块
 * @description 资源库存储模块，提供目录结构和分享功能
 * @keywords-cn 存储模块, 资源库, 目录管理, 分享
 * @keywords-en storage-module, resource-library, directory-management, share
 */
@Module({
  imports: [TypeOrmModule.forFeature([StorageNodeEntity]), ResourceModule],
  providers: [StorageService],
  controllers: [StorageController],
  exports: [StorageService],
})
export class StorageModule {}

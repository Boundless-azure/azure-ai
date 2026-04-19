import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AICoreModule } from '@core/ai';
import { KnowledgeBookEntity } from './entities/knowledge-book.entity';
import { KnowledgeChapterEntity } from './entities/knowledge-chapter.entity';
import { KnowledgeService } from './services/knowledge.service';
import { KnowledgeController } from './controllers/knowledge.controller';
import { AuthModule } from '@/core/auth/auth.module';

/**
 * @title 知识模块
 * @description 提供知识书本（技能/学识）的管理、章节编辑和向量语义检索能力。
 * @keywords-cn 知识模块, 书本, 章节, 向量检索
 * @keywords-en knowledge-module, book, chapter, vector-search
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeBookEntity, KnowledgeChapterEntity]),
    AICoreModule.forRoot({}),
    AuthModule,
  ],
  providers: [KnowledgeService],
  controllers: [KnowledgeController],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}

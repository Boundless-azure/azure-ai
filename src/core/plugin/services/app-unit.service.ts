import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Db, Collection } from 'mongodb';
import { randomUUID } from 'crypto';
import { AppUnitEntity } from '../entities/app-unit.entity';
import type { AppUnitDoc } from '../../../mongo/types/mongo.types';
import { CreateAppUnitDto, QueryAppUnitDto, UpdateAppUnitDto } from '../types';

/**
 * @title 应用子单元服务
 * @description 提供 app-unit 的列表、获取、创建、更新与删除（软删除）能力。
 * @keywords-cn app-unit服务, 子模块, CRUD, 列表, 更新, 删除
 * @keywords-en app-unit-service, submodule, crud, list, update, delete
 */
@Injectable()
export class AppUnitService {
  constructor(
    @InjectRepository(AppUnitEntity)
    private readonly repo: Repository<AppUnitEntity>,
    @Optional() @Inject('MONGO_DB') private readonly mongoDb?: Db,
  ) {}

  async list(query: QueryAppUnitDto): Promise<AppUnitEntity[]> {
    if (this.useMongo()) {
      const col = this.unitCollection();
      if (!col) return [];
      const where: Record<string, unknown> = { isDelete: { $ne: true } };
      if (query.runnerId) where['runnerId'] = query.runnerId;
      if (query.sessionId) where['sessionId'] = query.sessionId;
      if (query.appId) where['appId'] = query.appId;
      const docs = await col
        .find(where)
        .sort({ updatedAt: -1 })
        .limit(500)
        .toArray();
      return docs.map((d) => this.toEntity(d));
    }

    const where: Record<string, unknown> = { isDelete: false };
    if (query.runnerId) where['runnerId'] = query.runnerId;
    if (query.sessionId) where['sessionId'] = query.sessionId;
    if (query.appId) where['appId'] = query.appId;
    return await this.repo.find({ where, order: { updatedAt: 'DESC' } });
  }

  async get(id: string): Promise<AppUnitEntity | null> {
    if (this.useMongo()) {
      const col = this.unitCollection();
      if (!col) return null;
      const doc = await col.findOne({ _id: id } as unknown as Record<
        string,
        unknown
      >);
      return doc ? this.toEntity(doc) : null;
    }
    return await this.repo.findOne({ where: { id, isDelete: false } });
  }

  async create(dto: CreateAppUnitDto): Promise<AppUnitEntity> {
    if (this.useMongo()) {
      const col = this.unitCollection();
      if (!col) throw new Error('MongoDB not available');
      const now = new Date();
      const doc: AppUnitDoc = {
        _id: randomUUID(),
        runnerId: dto.runnerId ?? null,
        sessionId: dto.sessionId,
        appId: dto.appId,
        name: dto.name,
        version: dto.version ?? null,
        description: dto.description ?? null,
        embedding: null,
        keywords: null,
        keywordsZh: null,
        keywordsEn: null,
        active: true,
        createdAt: now,
        updatedAt: now,
        isDelete: false,
      };
      await col.insertOne(doc);
      const saved = await col.findOne({ _id: doc._id });
      if (!saved) throw new Error('AppUnit insert failed');
      return this.toEntity(saved);
    }

    const entity = this.repo.create({
      runnerId: dto.runnerId ?? null,
      sessionId: dto.sessionId ?? null,
      appId: dto.appId,
      name: dto.name,
      version: dto.version ?? null,
      description: dto.description ?? null,
      embedding: null,
      keywords: null,
      keywordsZh: null,
      keywordsEn: null,
      active: true,
      isDelete: false,
    });
    return await this.repo.save(entity);
  }

  async update(id: string, dto: UpdateAppUnitDto): Promise<AppUnitEntity> {
    if (this.useMongo()) {
      const col = this.unitCollection();
      if (!col) throw new Error('MongoDB not available');
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (dto.runnerId !== undefined) patch['runnerId'] = dto.runnerId;
      if (dto.sessionId !== undefined) patch['sessionId'] = dto.sessionId;
      if (dto.name !== undefined) patch['name'] = dto.name;
      if (dto.version !== undefined) patch['version'] = dto.version;
      if (dto.description !== undefined) patch['description'] = dto.description;
      if (dto.active !== undefined) patch['active'] = dto.active;
      await col.updateOne(
        { _id: id },
        {
          $set: patch,
        },
      );
      const saved = await col.findOne({ _id: id });
      if (!saved) throw new Error('AppUnit update failed');
      return this.toEntity(saved);
    }

    const entity = await this.repo.findOneOrFail({ where: { id } });
    if (dto.runnerId !== undefined) entity.runnerId = dto.runnerId;
    if (dto.sessionId !== undefined) entity.sessionId = dto.sessionId;
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.version !== undefined) entity.version = dto.version;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.active !== undefined) entity.active = dto.active;
    entity.updatedAt = new Date();
    return await this.repo.save(entity);
  }

  async delete(id: string): Promise<void> {
    if (this.useMongo()) {
      const col = this.unitCollection();
      if (!col) return;
      await col.updateOne(
        { _id: id },
        {
          $set: { isDelete: true, updatedAt: new Date() },
        },
      );
      return;
    }
    const entity = await this.repo.findOneOrFail({ where: { id } });
    entity.isDelete = true;
    await this.repo.save(entity);
  }

  private useMongo(): boolean {
    return (process.env.MONGO_ENABLED ?? 'false') === 'true' && !!this.mongoDb;
  }

  private unitCollection(): Collection<AppUnitDoc> | undefined {
    if (!this.mongoDb) return undefined;
    return this.mongoDb.collection<AppUnitDoc>('app_units');
  }

  private toEntity(doc: AppUnitDoc): AppUnitEntity {
    const e = new AppUnitEntity();
    (e as unknown as { id?: string }).id =
      doc._id ?? `${doc.appId}:${doc.name}`;
    e.runnerId = doc.runnerId ?? null;
    e.sessionId = doc.sessionId ?? null;
    e.appId = doc.appId;
    e.name = doc.name;
    e.version = doc.version ?? null;
    e.description = doc.description ?? null;
    e.embedding = typeof doc.embedding === 'string' ? doc.embedding : null;
    e.keywords = Array.isArray(doc.keywords) ? doc.keywords : null;
    e.keywordsZh = doc.keywordsZh ?? null;
    e.keywordsEn = doc.keywordsEn ?? null;
    e.active = doc.active ?? true;
    (e as unknown as { createdAt?: Date }).createdAt =
      doc.createdAt ?? new Date();
    (e as unknown as { updatedAt?: Date }).updatedAt =
      doc.updatedAt ?? new Date();
    (e as unknown as { isDelete?: boolean }).isDelete = doc.isDelete ?? false;
    return e;
  }
}

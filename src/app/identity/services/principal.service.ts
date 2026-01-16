import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { PrincipalEntity } from '../entities/principal.entity';
import type {
  QueryPrincipalDto,
  CreatePrincipalDto,
  UpdatePrincipalDto,
} from '../types/identity.types';
import type { Db, Collection } from 'mongodb';
import { PrincipalType } from '../enums/principal.enums';

/**
 * @title Principal 服务
 * @description 提供统一主体的增删改查。
 * @keywords-cn 主体服务, 查询, 新增, 更新, 删除
 * @keywords-en principal-service, query, create, update, delete
 */
@Injectable()
export class PrincipalService {
  constructor(
    @InjectRepository(PrincipalEntity)
    private readonly repo: Repository<PrincipalEntity>,
    @Optional() @Inject('MONGO_DB') private readonly mongoDb?: Db,
  ) {}

  async list(query: QueryPrincipalDto): Promise<PrincipalEntity[]> {
    if (this.useMongo()) {
      const col = this.principalCollection();
      if (!col) return [];
      const filter: Record<string, unknown> = { isDelete: { $ne: true } };
      if (query.type) filter['principalType'] = query.type;
      if (query.tenantId) filter['tenantId'] = query.tenantId;
      let cursor = col.find(filter).sort({ createdAt: -1 }).limit(500);
      if (query.q && query.q.trim()) {
        const q = query.q.trim();
        cursor = col
          .find({
            ...filter,
            $or: [
              { displayName: { $regex: q, $options: 'i' } },
              { email: { $regex: q, $options: 'i' } },
              { phone: { $regex: q, $options: 'i' } },
            ],
          })
          .sort({ createdAt: -1 })
          .limit(500);
      }
      const docs = await cursor.toArray();
      return docs.map((d) => this.toEntity(d));
    }
    const where: Record<string, unknown> = { isDelete: false };
    if (query.type) where['principalType'] = query.type;
    if (query.tenantId) where['tenantId'] = query.tenantId;
    if (query.q && query.q.trim()) {
      const q = `%${query.q.trim()}%`;
      return await this.repo.find({
        where: [
          { displayName: Like(q), isDelete: false },
          { email: Like(q), isDelete: false },
          { phone: Like(q), isDelete: false },
        ],
        order: { createdAt: 'DESC' },
      });
    }
    return await this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async create(dto: CreatePrincipalDto): Promise<PrincipalEntity> {
    const typeMap: Record<CreatePrincipalDto['principalType'], PrincipalType> =
      {
        user_enterprise: PrincipalType.UserEnterprise,
        user_consumer: PrincipalType.UserConsumer,
        official_account: PrincipalType.OfficialAccount,
        agent: PrincipalType.Agent,
        system: PrincipalType.System,
      };
    const entity = this.repo.create({
      displayName: dto.displayName,
      principalType: typeMap[dto.principalType],
      avatarUrl: dto.avatarUrl ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      tenantId: dto.tenantId ?? null,
      active: true,
      isDelete: false,
    });
    return await this.repo.save(entity);
  }

  async update(id: string, dto: UpdatePrincipalDto): Promise<void> {
    const patch: Partial<PrincipalEntity> = {};
    if (dto.displayName !== undefined) patch.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) patch.avatarUrl = dto.avatarUrl;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.active !== undefined) patch.active = !!dto.active;
    await this.repo.update({ id }, patch);
  }

  async delete(id: string): Promise<void> {
    await this.repo.update({ id }, { isDelete: true, active: false });
  }

  private useMongo(): boolean {
    return (process.env.MONGO_ENABLED ?? 'false') === 'true' && !!this.mongoDb;
  }

  private principalCollection():
    | Collection<Record<string, unknown>>
    | undefined {
    if (!this.mongoDb) return undefined;
    return this.mongoDb.collection<Record<string, unknown>>('principals');
  }

  private toEntity(doc: Record<string, unknown>): PrincipalEntity {
    const e = new PrincipalEntity();

    const toSafeString = (value: unknown): string => {
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      if (
        value !== null &&
        typeof value === 'object' &&
        'toString' in (value as Record<string, unknown>) &&
        typeof (value as { toString: () => string }).toString === 'function'
      ) {
        const s = (value as { toString: () => string }).toString();
        return typeof s === 'string' ? s : '';
      }
      return '';
    };

    const getStringOrNull = (value: unknown): string | null => {
      return typeof value === 'string' ? value : null;
    };

    e.id = toSafeString(doc['_id']);
    e.displayName = toSafeString(doc['displayName']);

    const tp = toSafeString(doc['principalType']);
    const allowed: Record<string, PrincipalType> = {
      [PrincipalType.UserEnterprise]: PrincipalType.UserEnterprise,
      [PrincipalType.UserConsumer]: PrincipalType.UserConsumer,
      [PrincipalType.OfficialAccount]: PrincipalType.OfficialAccount,
      [PrincipalType.Agent]: PrincipalType.Agent,
      [PrincipalType.System]: PrincipalType.System,
    };
    e.principalType = allowed[tp] ?? PrincipalType.UserConsumer;

    e.avatarUrl = getStringOrNull(doc['avatarUrl']);
    e.email = getStringOrNull(doc['email']);
    e.phone = getStringOrNull(doc['phone']);
    e.tenantId = getStringOrNull(doc['tenantId']);
    e.active = Boolean(doc['active'] ?? true);
    e.createdAt = (doc['createdAt'] as Date) ?? new Date();
    e.updatedAt = (doc['updatedAt'] as Date) ?? new Date();
    e.isDelete = Boolean(doc['isDelete'] ?? false);
    return e;
  }
}

import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { randomBytes, scryptSync } from 'crypto';
import { PrincipalEntity } from '../entities/principal.entity';
import { UserEntity } from '../entities/user.entity';
import type {
  QueryPrincipalDto,
  CreatePrincipalDto,
  UpdatePrincipalDto,
  QueryUsersDto,
  CreateUserDto,
  UpdateUserDto,
} from '../types/identity.types';
import type { Db, Collection } from 'mongodb';
import { v7 as uuidv7 } from 'uuid';
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
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
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
    if (query.type) where['principalType'] = this.toDbPrincipalType(query.type);
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
    const items = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    for (const e of items) {
      e.principalType = this.fromDbPrincipalType(
        e.principalType as unknown as string,
      );
    }
    return items;
  }

  async listUsers(query: QueryUsersDto): Promise<PrincipalEntity[]> {
    if (this.useMongo()) {
      const col = this.principalCollection();
      const userCol = this.userCollection();
      if (!col || !userCol) return [];
      const allowed = [
        PrincipalType.UserEnterprise,
        PrincipalType.UserConsumer,
        PrincipalType.System,
      ];
      const principalFilter: Record<string, unknown> = {
        isDelete: { $ne: true },
        principalType: query.type ? query.type : { $in: allowed },
      };
      if (query.tenantId) principalFilter['tenantId'] = query.tenantId;
      const userFilter: Record<string, unknown> = {
        isDelete: { $ne: true },
      };
      if (query.q && query.q.trim()) {
        const q = query.q.trim();
        userFilter['email'] = { $regex: q, $options: 'i' };
        principalFilter['$or'] = [
          { displayName: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } },
        ];
      }
      const userDocs = await userCol
        .find(userFilter)
        .project({ principalId: 1 })
        .limit(500)
        .toArray();
      if (!userDocs.length) return [];
      const ids = userDocs
        .map((d) =>
          typeof d['principalId'] === 'string' ? d['principalId'] : '',
        )
        .filter((v) => v);
      if (!ids.length) return [];
      principalFilter['_id'] = { $in: ids };
      const docs = await col
        .find(principalFilter)
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray();
      return docs.map((d) => this.toEntity(d));
    }

    const qb = this.repo.createQueryBuilder('p');
    qb.innerJoin(
      UserEntity,
      'u',
      'u.principal_id = p.id AND u.is_delete = false',
    );
    qb.where('p.is_delete = false');
    const dbTypes = ['enterprise', 'consumer', 'system'];
    if (query.type) {
      qb.andWhere('p.principal_type = :type', {
        type: this.toDbPrincipalType(query.type),
      });
    } else {
      qb.andWhere('p.principal_type IN (:...types)', { types: dbTypes });
    }
    if (query.tenantId) {
      qb.andWhere('p.tenant_id = :tenantId', { tenantId: query.tenantId });
    }
    if (query.q && query.q.trim()) {
      const q = `%${query.q.trim()}%`;
      qb.andWhere(
        '(p.display_name LIKE :q OR p.email LIKE :q OR p.phone LIKE :q OR u.email LIKE :q)',
        { q },
      );
    }
    qb.orderBy('p.created_at', 'DESC');
    const rows = await qb.getMany();
    for (const e of rows) {
      e.principalType = this.fromDbPrincipalType(
        e.principalType as unknown as string,
      );
    }
    return rows;
  }

  async createUser(dto: CreateUserDto): Promise<PrincipalEntity> {
    if (!dto.email || !dto.email.trim()) {
      throw new BadRequestException('email is required');
    }
    const password = this.normalizePassword(dto.password);
    const salt = password ? this.generateSalt() : null;
    const hash = password && salt ? this.hashPassword(password, salt) : null;
    const allowedTypes: CreateUserDto['principalType'][] = [
      PrincipalType.UserEnterprise,
      PrincipalType.UserConsumer,
      PrincipalType.System,
    ];
    if (!allowedTypes.includes(dto.principalType)) {
      throw new BadRequestException('invalid principalType');
    }
    if (this.useMongo()) {
      const col = this.principalCollection();
      const userCol = this.userCollection();
      if (!col || !userCol) {
        throw new BadRequestException('MongoDB not ready');
      }
      const existed = await userCol.findOne({
        email: dto.email,
        isDelete: { $ne: true },
      });
      if (existed) {
        throw new BadRequestException('email already exists');
      }
      const now = new Date();
      const id = uuidv7();
      await col.insertOne({
        _id: id,
        displayName: dto.displayName,
        principalType: dto.principalType,
        avatarUrl: null,
        email: dto.email,
        phone: dto.phone ?? null,
        tenantId: dto.tenantId ?? null,
        active: true,
        isDelete: false,
        createdAt: now,
        updatedAt: now,
      });
      await userCol.insertOne({
        principalId: id,
        email: dto.email,
        passwordHash: hash,
        passwordSalt: salt,
        lastLoginAt: null,
        loginAttempts: 0,
        lockedUntil: null,
        isDelete: false,
        createdAt: now,
        updatedAt: now,
      });
      return this.toEntity({
        _id: id,
        displayName: dto.displayName,
        principalType: dto.principalType,
        avatarUrl: null,
        email: dto.email,
        phone: dto.phone ?? null,
        tenantId: dto.tenantId ?? null,
        active: true,
        createdAt: now,
        updatedAt: now,
        isDelete: false,
      });
    }
    const existing = await this.userRepo.findOne({
      where: { email: dto.email, isDelete: false },
    });
    if (existing) {
      throw new BadRequestException('email already exists');
    }
    return await this.repo.manager.transaction(async (manager) => {
      const principalRepo = manager.getRepository(PrincipalEntity);
      const userRepo = manager.getRepository(UserEntity);
      const entityDb = principalRepo.create({
        displayName: dto.displayName,
        principalType: this.toDbPrincipalType(
          dto.principalType,
        ) as unknown as PrincipalType,
        avatarUrl: null,
        email: dto.email,
        phone: dto.phone ?? null,
        tenantId: dto.tenantId ?? null,
        active: true,
        isDelete: false,
      });
      const saved = await principalRepo.save(entityDb);
      const user = userRepo.create({
        principalId: saved.id,
        email: dto.email,
        passwordHash: hash,
        passwordSalt: salt,
        lastLoginAt: null,
        loginAttempts: 0,
        lockedUntil: null,
        isDelete: false,
      });
      await userRepo.save(user);
      return {
        ...saved,
        principalType: this.fromDbPrincipalType(
          saved.principalType as unknown as string,
        ),
      } as PrincipalEntity;
    });
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<void> {
    if (this.useMongo()) {
      const col = this.principalCollection();
      const userCol = this.userCollection();
      if (!col || !userCol) {
        throw new BadRequestException('MongoDB not ready');
      }
      if (dto.email) {
        const existed = await userCol.findOne({
          email: dto.email,
          isDelete: { $ne: true },
        });
        if (existed && existed['principalId'] !== id) {
          throw new BadRequestException('email already exists');
        }
      }
      const principalPatch: Record<string, unknown> = {};
      if (dto.displayName !== undefined)
        principalPatch['displayName'] = dto.displayName;
      if (dto.email !== undefined) principalPatch['email'] = dto.email;
      if (dto.phone !== undefined) principalPatch['phone'] = dto.phone;
      if (dto.active !== undefined) principalPatch['active'] = !!dto.active;
      if (Object.keys(principalPatch).length) {
        principalPatch['updatedAt'] = new Date();
        await col.updateOne({ _id: id }, { $set: principalPatch });
      }
      if (dto.email !== undefined) {
        await userCol.updateOne(
          { principalId: id },
          { $set: { email: dto.email, updatedAt: new Date() } },
        );
      }
      return;
    }
    const user = await this.userRepo.findOne({
      where: { principalId: id, isDelete: false },
    });
    if (!user) {
      throw new NotFoundException('user not found');
    }
    if (dto.email) {
      const existed = await this.userRepo.findOne({
        where: { email: dto.email, isDelete: false },
      });
      if (existed && existed.principalId !== id) {
        throw new BadRequestException('email already exists');
      }
    }
    await this.repo.manager.transaction(async (manager) => {
      const principalRepo = manager.getRepository(PrincipalEntity);
      const userRepo = manager.getRepository(UserEntity);
      const patch: Partial<PrincipalEntity> = {};
      if (dto.displayName !== undefined) patch.displayName = dto.displayName;
      if (dto.email !== undefined) patch.email = dto.email;
      if (dto.phone !== undefined) patch.phone = dto.phone;
      if (dto.active !== undefined) patch.active = !!dto.active;
      if (Object.keys(patch).length) {
        await principalRepo.update({ id }, patch);
      }
      const userPatch: Partial<UserEntity> = {};
      if (dto.email !== undefined) userPatch.email = dto.email;
      if (Object.keys(userPatch).length) {
        await userRepo.update({ principalId: id }, userPatch);
      }
    });
  }

  async deleteUser(id: string): Promise<void> {
    if (this.useMongo()) {
      const col = this.principalCollection();
      const userCol = this.userCollection();
      if (!col || !userCol) {
        throw new BadRequestException('MongoDB not ready');
      }
      const now = new Date();
      await userCol.updateOne(
        { principalId: id },
        { $set: { isDelete: true, updatedAt: now } },
      );
      await col.updateOne(
        { _id: id },
        { $set: { isDelete: true, active: false, updatedAt: now } },
      );
      return;
    }
    await this.repo.manager.transaction(async (manager) => {
      const principalRepo = manager.getRepository(PrincipalEntity);
      const userRepo = manager.getRepository(UserEntity);
      await userRepo.update({ principalId: id }, { isDelete: true });
      await principalRepo.update({ id }, { isDelete: true, active: false });
    });
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
    const entityDb = this.repo.create({
      displayName: dto.displayName,
      principalType: this.toDbPrincipalType(
        typeMap[dto.principalType],
      ) as unknown as PrincipalType,
      avatarUrl: dto.avatarUrl ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      tenantId: dto.tenantId ?? null,
      active: true,
      isDelete: false,
    });
    const saved = await this.repo.save(entityDb);
    return {
      ...saved,
      principalType: this.fromDbPrincipalType(
        saved.principalType as unknown as string,
      ),
    } as PrincipalEntity;
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

  private normalizePassword(value?: string): string | null {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    return v ? v : null;
  }

  private generateSalt(): string {
    return randomBytes(16).toString('hex');
  }

  private hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, 32).toString('hex');
  }

  private principalCollection():
    | Collection<Record<string, unknown>>
    | undefined {
    if (!this.mongoDb) return undefined;
    return this.mongoDb.collection<Record<string, unknown>>('principals');
  }

  private userCollection(): Collection<Record<string, unknown>> | undefined {
    if (!this.mongoDb) return undefined;
    return this.mongoDb.collection<Record<string, unknown>>('users');
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
    e.principalType = this.fromDbPrincipalType(tp);

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

  /**
   * Map app principal type to DB enum label
   */
  private toDbPrincipalType(tp: string): string {
    const map: Record<string, string> = {
      user_enterprise: 'enterprise',
      user_consumer: 'consumer',
      official_account: 'official',
      agent: 'agent',
      system: 'system',
    };
    return map[tp] ?? tp;
  }

  /**
   * Map DB enum label to app principal type
   */
  private fromDbPrincipalType(tp: string): PrincipalType {
    const map: Record<string, PrincipalType> = {
      enterprise: PrincipalType.UserEnterprise,
      consumer: PrincipalType.UserConsumer,
      official: PrincipalType.OfficialAccount,
      agent: PrincipalType.Agent,
      system: PrincipalType.System,
      user: PrincipalType.UserConsumer,
      [PrincipalType.UserEnterprise]: PrincipalType.UserEnterprise,
      [PrincipalType.UserConsumer]: PrincipalType.UserConsumer,
      [PrincipalType.OfficialAccount]: PrincipalType.OfficialAccount,
    };
    return map[tp] ?? PrincipalType.UserConsumer;
  }
}

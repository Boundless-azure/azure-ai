import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { RunnerEntity } from '../entities/runner.entity';
import {
  CreateRunnerDto,
  QueryRunnerDto,
  RunnerCreateResult,
  RunnerView,
  UpdateRunnerDto,
} from '../types/runner.types';
import { RunnerStatus } from '../enums/runner.enums';
import { PrincipalService } from '@/app/identity/services/principal.service';

/**
 * @title Runner 服务
 * @description 提供 Runner 的增删改查、密钥生成、注册校验与状态维护能力。
 * @keywords-cn Runner服务, 增删改查, 注册校验, 状态维护
 * @keywords-en runner-service, crud, register-verify, status-maintain
 */
@Injectable()
export class RunnerService {
  constructor(
    @InjectRepository(RunnerEntity)
    private readonly repo: Repository<RunnerEntity>,
    private readonly principalService: PrincipalService,
  ) {}

  async list(query: QueryRunnerDto): Promise<RunnerView[]> {
    const where: Record<string, unknown> = { isDelete: false };
    if (query.status) where['status'] = query.status;
    if (query.principalId) where['principalId'] = query.principalId;
    if (query.q && query.q.trim()) {
      const q = `%${query.q.trim()}%`;
      const list = await this.repo.find({
        where: [
          { alias: Like(q), isDelete: false },
          { description: Like(q), isDelete: false },
        ],
        order: { updatedAt: 'DESC' },
      });
      return list.map((item) => this.toView(item));
    }
    const list = await this.repo.find({ where, order: { updatedAt: 'DESC' } });
    return list.map((item) => this.toView(item));
  }

  async get(id: string): Promise<RunnerView | null> {
    const entity = await this.repo.findOne({ where: { id, isDelete: false } });
    if (!entity) return null;
    return this.toView(entity);
  }

  async create(dto: CreateRunnerDto): Promise<RunnerCreateResult> {
    const key = this.generateRunnerKey();
    const keyHash = this.hashKey(key);
    const principal = await this.principalService.create({
      displayName: dto.principalDisplayName ?? dto.alias,
      principalType: 'system',
      avatarUrl: null,
      email: null,
      phone: null,
      tenantId: null,
    });
    const entity = this.repo.create({
      alias: dto.alias.trim(),
      runnerKeyHash: keyHash,
      runnerKeyPlain: key,
      principalId: principal.id,
      description: dto.description ?? null,
      status: RunnerStatus.Offline,
      lastSeenAt: null,
      active: true,
      isDelete: false,
    });
    const saved = await this.repo.save(entity);
    return {
      id: saved.id,
      alias: saved.alias,
      principalId: saved.principalId,
      description: saved.description,
      status: saved.status,
      active: saved.active,
      runnerKey: saved.status === RunnerStatus.Offline ? key : '-',
      lastSeenAt: saved.lastSeenAt,
    };
  }

  async update(id: string, dto: UpdateRunnerDto): Promise<RunnerView> {
    const entity = await this.repo.findOne({ where: { id, isDelete: false } });
    if (!entity) throw new NotFoundException('runner not found');
    if (dto.alias !== undefined) entity.alias = dto.alias.trim();
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.active !== undefined) entity.active = dto.active;
    const saved = await this.repo.save(entity);
    return this.toView(saved);
  }

  async delete(id: string): Promise<void> {
    const entity = await this.repo.findOne({ where: { id, isDelete: false } });
    if (!entity) throw new NotFoundException('runner not found');
    entity.isDelete = true;
    entity.status = RunnerStatus.Offline;
    entity.active = false;
    await this.repo.save(entity);
  }

  async verifyRegistration(
    runnerId: string | undefined,
    key: string,
  ): Promise<RunnerEntity | null> {
    const keyHash = this.hashKey(key);
    if (runnerId && runnerId.trim()) {
      const entity = await this.repo.findOne({
        where: { id: runnerId, isDelete: false, active: true },
      });
      if (!entity) return null;
      if (keyHash !== entity.runnerKeyHash) return null;
      return entity;
    }
    const entity = await this.repo.findOne({
      where: { runnerKeyHash: keyHash, isDelete: false, active: true },
      order: { updatedAt: 'DESC' },
    });
    if (!entity) return null;
    return entity;
  }

  async markStatus(id: string, status: RunnerStatus): Promise<void> {
    const entity = await this.repo.findOne({ where: { id, isDelete: false } });
    if (!entity) return;
    entity.status = status;
    entity.lastSeenAt = new Date();
    await this.repo.save(entity);
  }

  private generateRunnerKey(): string {
    return randomBytes(24).toString('hex');
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private toView(entity: RunnerEntity): RunnerView {
    return {
      id: entity.id,
      alias: entity.alias,
      principalId: entity.principalId,
      description: entity.description,
      status: entity.status,
      active: entity.active,
      runnerKey:
        entity.status === RunnerStatus.Offline
          ? (entity.runnerKeyPlain ?? '-')
          : '-',
      lastSeenAt: entity.lastSeenAt,
    };
  }
}

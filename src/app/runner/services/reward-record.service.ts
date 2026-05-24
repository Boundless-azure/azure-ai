import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RewardRecordEntity } from '../entities/reward-record.entity';

/**
 * @title 奖励记录服务
 * @description 提供奖励记录的创建与查询能力。
 * @keywords-cn 奖励记录, 奖励查询, 奖励发放
 * @keywords-en reward-record, reward-query, reward-grant
 */
@Injectable()
export class RewardRecordService {
  constructor(
    @InjectRepository(RewardRecordEntity)
    private readonly repo: Repository<RewardRecordEntity>,
  ) {}

  /**
   * @title 创建奖励记录
   * @description 创建新的奖励发放记录。
   * @param rewardType 奖励类型
   * @param relatedId 关联主体 ID
   * @param description 奖励描述（可选）
   * @returns 创建的奖励记录
   * @keywords-cn 创建奖励, 奖励发放
   * @keywords-en create-reward, reward-grant
   */
  async create(
    rewardType: string,
    relatedId: string,
    description?: string,
  ): Promise<RewardRecordEntity> {
    const record = this.repo.create({
      rewardType,
      relatedId,
      description: description ?? null,
    });
    return this.repo.save(record);
  }

  /**
   * @title 查询奖励是否已发放
   * @description 根据奖励类型和关联 ID 判断是否已存在发放记录。
   * @param rewardType 奖励类型
   * @param relatedId 关联主体 ID
   * @returns 是否已存在
   * @keywords-cn 奖励查询, 是否已发放
   * @keywords-en reward-exists, already-granted
   */
  async existsByTypeAndRelatedId(
    rewardType: string,
    relatedId: string,
  ): Promise<boolean> {
    const count = await this.repo.count({
      where: { rewardType, relatedId, isDelete: false },
    });
    return count > 0;
  }

  /**
   * @title 查询奖励记录
   * @description 根据奖励类型和关联 ID 查询奖励记录。
   * @param rewardType 奖励类型
   * @param relatedId 关联主体 ID
   * @returns 奖励记录
   * @keywords-cn 奖励查询, 记录查找
   * @keywords-en find-reward, record-lookup
   */
  async findByTypeAndRelatedId(
    rewardType: string,
    relatedId: string,
  ): Promise<RewardRecordEntity | null> {
    return this.repo.findOne({
      where: { rewardType, relatedId, isDelete: false },
    });
  }
}

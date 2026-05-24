import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RewardRecordService } from '../services/reward-record.service';

/**
 * @title 奖励记录控制器
 * @description 提供奖励记录的查询与发放接口。
 * @keywords-cn 奖励记录, 发放查询, 奖励类型
 * @keywords-en reward-record, grant-query, reward-type
 */
@Controller('reward-records')
export class RewardRecordController {
  constructor(private readonly rewardRecordService: RewardRecordService) {}

  /**
   * @title 查询奖励是否已发放
   * @description 根据奖励类型和关联 ID 查询奖励是否已存在。
   * @param rewardType 奖励类型
   * @param relatedId 关联主体 ID
   * @returns 是否已发放
   * @keywords-cn 奖励查询, 是否已发放
   * @keywords-en reward-exists, already-granted
   */
  @Get('exists')
  async exists(
    @Query('rewardType') rewardType: string,
    @Query('relatedId') relatedId: string,
  ): Promise<{ exists: boolean }> {
    const exists = await this.rewardRecordService.existsByTypeAndRelatedId(
      rewardType,
      relatedId,
    );
    return { exists };
  }

  /**
   * @title 创建奖励记录
   * @description 发放奖励并记录。
   * @param rewardType 奖励类型
   * @param relatedId 关联主体 ID
   * @param description 奖励描述
   * @returns 创建的奖励记录
   * @keywords-cn 创建奖励, 奖励发放
   * @keywords-en create-reward, reward-grant
   */
  @Post()
  async create(
    @Body()
    body: {
      rewardType: string;
      relatedId: string;
      description?: string;
    },
  ): Promise<{
    id: string;
    rewardType: string;
    relatedId: string;
    description: string | null;
  }> {
    const record = await this.rewardRecordService.create(
      body.rewardType,
      body.relatedId,
      body.description,
    );
    return {
      id: record.id,
      rewardType: record.rewardType,
      relatedId: record.relatedId,
      description: record.description,
    };
  }
}

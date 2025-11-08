import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIModelEntity } from '../entities';

/*
    @description 统计消息中的token数量
*/
export class CountTokenService {
  constructor(
    @InjectRepository(AIModelEntity)
    private readonly aiModelRepository: Repository<AIModelEntity>,
  ) {}
}

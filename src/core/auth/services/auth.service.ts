import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrincipalEntity } from '@/app/identity/entities/principal.entity';
import type { LoginDto, LoginResponse, AbilityRule } from '../types/auth.types';
import { AbilityService } from '@/app/identity/services/ability.service';
import { CommonRedisService } from '@/redis/services/common.service';

/**
 * @title 认证服务
 * @description 提供密码哈希/校验、主体校验与 JWT 签发。
 * @keywords-cn 认证服务, JWT, 密码哈希
 * @keywords-en auth-service, jwt, password-hash
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(PrincipalEntity)
    private readonly principalRepo: Repository<PrincipalEntity>,
    private readonly jwt: JwtService,
    private readonly abilityService: AbilityService,
    private readonly redis: CommonRedisService,
  ) {}

  /** 生成随机盐 */
  generateSalt(): string {
    return randomBytes(16).toString('hex');
  }

  /** 使用 scrypt 计算哈希 */
  hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, 32).toString('hex');
  }

  /** 常数时间比较，避免时序攻击 */
  verifyPassword(password: string, salt: string, hash: string): boolean {
    const candidate = Buffer.from(this.hashPassword(password, salt));
    const expected = Buffer.from(hash);
    return timingSafeEqual(candidate, expected);
  }

  private ensureString(value: string | null): string {
    if (typeof value === 'string') return value;
    throw new UnauthorizedException('invalid credentials');
  }

  /**
   * 主体登录（邮箱或手机号）
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const where: Record<string, unknown> = { isDelete: false, active: true };
    if (dto.email) where['email'] = dto.email;
    if (dto.phone) where['phone'] = dto.phone;
    if (!dto.email && !dto.phone)
      throw new UnauthorizedException('missing identifier');
    const principal = await this.principalRepo.findOne({ where });
    if (!principal || !principal.passwordSalt || !principal.passwordHash) {
      throw new UnauthorizedException('invalid credentials');
    }
    const ok = this.verifyPassword(
      dto.password,
      this.ensureString(principal.passwordSalt),
      this.ensureString(principal.passwordHash),
    );
    if (!ok) throw new UnauthorizedException('invalid credentials');

    const payload = { id: principal.id, type: principal.principalType };
    const jwtSvc: { sign: (p: typeof payload) => string } = this.jwt;
    const token = jwtSvc.sign(payload);

    // 构建 CASL 兼容权限规则
    const ability = await this.abilityService.buildForPrincipal(principal.id);
    const rules: AbilityRule[] = ability.rules.map((r) => ({
      subject: r.subject,
      action: r.action,
      conditions: r.conditions ?? undefined,
    }));

    // 可选缓存：将 JWT 与权限规则写入 Redis（TTL 24h），用于会话与快速校验
    if (this.redis.isAvailable()) {
      const baseKey = `auth:principal:${principal.id}`;
      // token
      await this.redis.setString(`${baseKey}:jwt`, token, 24 * 60 * 60);
      // ability rules
      await this.redis.setJSON(
        `${baseKey}:ability`,
        { rules },
        {
          ttlSeconds: 24 * 60 * 60,
        },
      );
    }
    return {
      token,
      principal: {
        id: principal.id,
        displayName: principal.displayName,
        principalType: principal.principalType,
        email: principal.email,
        phone: principal.phone,
        tenantId: principal.tenantId,
      },
      ability: { rules },
    };
  }
}

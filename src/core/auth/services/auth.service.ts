import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrincipalEntity } from '@/app/identity/entities/principal.entity';
import { UserEntity } from '@/app/identity/entities/user.entity';
import type {
  AbilityRule,
  ChangePasswordDto,
  LoginDto,
  LoginResponse,
} from '../types/auth.types';
import { AbilityService } from '@/app/identity/services/ability.service';
import { CommonRedisService } from '@/redis/services/common.service';
import { HookBusService } from '@/core/hookbus/services/hook.bus.service';

/**
 * @title 认证服务
 * @description 提供密码哈希/校验、主体校验与 JWT 签发。使用 UserEntity 存储密码信息。
 * @keywords-cn 认证服务, JWT, 密码哈希
 * @keywords-en auth-service, jwt, password-hash
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(PrincipalEntity)
    private readonly principalRepo: Repository<PrincipalEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwt: JwtService,
    private readonly abilityService: AbilityService,
    private readonly redis: CommonRedisService,
    @Optional() private readonly hookBus?: HookBusService,
  ) {}

  /** 校验并解析 JWT，返回载荷 */
  verifyToken(token: string): { id: string; type: string } {
    try {
      const payload = this.jwt.verify<{ id: string; type: string }>(token);
      return { id: payload.id, type: payload.type };
    } catch {
      throw new UnauthorizedException('invalid token');
    }
  }

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
    if (!dto.email && !dto.phone) {
      await this.emitAuthHook('onAuthLoginFailed', {
        identifier: dto.email || dto.phone || '',
        reason: 'missing identifier',
      });
      throw new UnauthorizedException('missing identifier');
    }

    // 1. 首先从 users 表查找用户
    let user: UserEntity | null = null;
    if (dto.email) {
      user = await this.userRepo.findOne({
        where: { email: dto.email, isDelete: false },
      });
    }

    if (!user || !user.passwordSalt || !user.passwordHash) {
      await this.emitAuthHook('onAuthLoginFailed', {
        identifier: dto.email || dto.phone || '',
        reason: 'invalid credentials',
      });
      throw new UnauthorizedException('invalid credentials');
    }

    // 检查账号锁定
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.emitAuthHook('onAuthLoginFailed', {
        identifier: dto.email || dto.phone || '',
        reason: 'account is locked',
      });
      throw new UnauthorizedException('account is locked');
    }

    // 2. 验证密码
    const ok = this.verifyPassword(
      dto.password,
      this.ensureString(user.passwordSalt),
      this.ensureString(user.passwordHash),
    );

    if (!ok) {
      // 更新登录失败次数
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 锁定15分钟
      }
      await this.userRepo.save(user);
      await this.emitAuthHook('onAuthLoginFailed', {
        identifier: dto.email || dto.phone || '',
        reason: 'invalid credentials',
      });
      throw new UnauthorizedException('invalid credentials');
    }

    // 3. 获取关联的 principal
    const principal = await this.principalRepo.findOne({
      where: { id: user.principalId, isDelete: false, active: true },
    });

    if (!principal) {
      await this.emitAuthHook('onAuthLoginFailed', {
        identifier: dto.email || dto.phone || '',
        reason: 'principal not found',
      });
      throw new UnauthorizedException('principal not found');
    }

    // 重置登录失败次数和更新最后登录时间
    user.loginAttempts = 0;
    user.lastLoginAt = new Date();
    user.lockedUntil = null;
    await this.userRepo.save(user);

    const payload: { id: string; type: string; tenantId?: string } = {
      id: principal.id,
      type: principal.principalType,
    };
    if (principal.tenantId) {
      payload.tenantId = principal.tenantId;
    }
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
    const defaultAvatarUrl = '/static/system/avatars/default.svg';
    const resolvedAvatarUrl = (() => {
      const raw =
        principal.avatarUrl && principal.avatarUrl.trim()
          ? principal.avatarUrl
          : user.avatarUrl && user.avatarUrl.trim()
            ? user.avatarUrl
            : defaultAvatarUrl;
      return raw;
    })();

    await this.emitAuthHook('onAuthLoginSuccess', {
      principalId: principal.id,
      userId: user.id,
      loginAt: user.lastLoginAt?.toISOString() ?? new Date().toISOString(),
    });

    return {
      token,
      principal: {
        id: principal.id,
        displayName: principal.displayName,
        principalType: principal.principalType,
        avatarUrl: resolvedAvatarUrl,
        email: principal.email,
        phone: principal.phone,
        tenantId: principal.tenantId,
      },
      ability: { rules },
    };
  }

  /**
   * @title 修改密码
   * @description 校验当前密码后更新新的密码哈希与盐值。
   * @keywords-cn 修改密码, 密码更新, 账户安全
   * @keywords-en change-password, password-update, account-security
   */
  async changePassword(
    principalId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    if (!principalId || !principalId.trim()) {
      await this.emitAuthHook('onAuthPasswordChanged', {
        principalId: '',
        ok: false,
      });
      throw new UnauthorizedException('invalid principal');
    }
    const current = dto.currentPassword?.trim();
    const next = dto.nextPassword?.trim();
    if (!current || !next) {
      await this.emitAuthHook('onAuthPasswordChanged', {
        principalId,
        ok: false,
      });
      throw new UnauthorizedException('missing password');
    }
    const user = await this.userRepo.findOne({
      where: { principalId, isDelete: false },
    });
    if (!user || !user.passwordSalt || !user.passwordHash) {
      await this.emitAuthHook('onAuthPasswordChanged', {
        principalId,
        ok: false,
      });
      throw new UnauthorizedException('invalid credentials');
    }
    const ok = this.verifyPassword(
      current,
      this.ensureString(user.passwordSalt),
      this.ensureString(user.passwordHash),
    );
    if (!ok) {
      await this.emitAuthHook('onAuthPasswordChanged', {
        principalId,
        ok: false,
      });
      throw new UnauthorizedException('invalid credentials');
    }
    const salt = this.generateSalt();
    const hash = this.hashPassword(next, salt);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await this.userRepo.save(user);
    await this.emitAuthHook('onAuthPasswordChanged', {
      principalId,
      ok: true,
    });
  }

  private async emitAuthHook(name: string, payload: Record<string, unknown>) {
    if (!this.hookBus) return;
    try {
      await this.hookBus.emit({ name, payload });
    } catch {
      return;
    }
  }
}

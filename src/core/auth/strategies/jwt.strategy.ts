import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { JwtPayload } from '../types/auth.types';

/**pnpm
 * @title JWT 策略
 * @description 从 Authorization Bearer 中解析并校验 JWT。
 * @keywords-cn JWT策略, Passport, 解析
 * @keywords-en jwt-strategy, passport, extract
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: (req: Request): string | null => {
        const auth = req.headers?.authorization;
        if (!auth) return null;
        const [scheme, token] = auth.split(' ');
        return /^Bearer$/i.test(scheme) ? (token ?? null) : null;
      },
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev_secret',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return { id: payload.id, type: payload.type };
  }
}

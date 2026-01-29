import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrincipalEntity } from '@/app/identity/entities/principal.entity';
import { UserEntity } from '@/app/identity/entities/user.entity';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { IdentityModule } from '@/app/identity/identity.module';

/**
 * @title 认证模块
 * @description 提供登录与 JWT 鉴权，面向全局使用。
 * @keywords-cn 认证模块, JWT, 登录
 * @keywords-en auth-module, jwt, login
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PrincipalEntity, UserEntity]),
    PassportModule,
    IdentityModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: JwtService,
      useFactory: (): JwtService => {
        const svc = new JwtService({
          secret: process.env.JWT_SECRET || 'dev_secret',
        });
        return svc;
      },
    },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}

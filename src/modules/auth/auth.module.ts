import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './services/password.service';
import { ResetTokenService } from './services/reset-token.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { AccessTokenService } from './services/access-token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { EmailService } from '../notifications/services/email.service';

import { ConfigType } from '@nestjs/config';
import { jwtConfig } from 'src/common/config/namespaces/jwt.config';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      useFactory: (jwt: ConfigType<typeof jwtConfig>) => ({
        secret: jwt.secret,
        signOptions: {
          expiresIn: jwt.expiration,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    ResetTokenService,
    RefreshTokenService,
    AccessTokenService,
    JwtStrategy,
    EmailService,
  ],
  exports: [AuthService],
})
export class AuthModule {}

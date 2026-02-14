import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { jwtConfig } from './common/config/jwt.config';
import { appConfig } from './common/config/app.config';
import { rateLimitConfig } from './common/config/rate-limit.config';
import { validationSchema } from './common/config/validation.schema';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    // global config with validation
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, appConfig, rateLimitConfig],
      validationSchema,
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },
    }),
    PrismaModule,
    AuthModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'short',
          ttl: config.getOrThrow<number>('rateLimit.short.ttl'),
          limit: config.getOrThrow<number>('rateLimit.short.limit'),
        },
        {
          name: 'medium',
          ttl: config.getOrThrow<number>('rateLimit.medium.ttl'),
          limit: config.getOrThrow<number>('rateLimit.medium.limit'),
        },
        {
          name: 'long',
          ttl: config.getOrThrow<number>('rateLimit.long.ttl'),
          limit: config.getOrThrow<number>('rateLimit.long.limit'),
        },
      ],
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

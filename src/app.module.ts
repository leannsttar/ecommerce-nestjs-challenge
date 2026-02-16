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
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';

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
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: false,
      csrfPrevention: false, //problems with testing request
      context: ({ req, res }) => ({ req, res }), //req.user accessible to resolvers/guards
    }),
    ProductsModule,
    CategoriesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // }, 
    // Disabled for now, problems with graphql playground
    // Only working in reset and forgot password routes
  ],
})
export class AppModule {}

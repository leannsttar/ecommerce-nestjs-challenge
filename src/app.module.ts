import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { jwtConfig } from './common/config/namespaces/jwt.config';
import { appConfig } from './common/config/namespaces/app.config';
import { rateLimitConfig } from './common/config/namespaces/rate-limit.config';
import { s3Config } from './common/config/namespaces/s3.config';
import { validationSchema } from './common/config/validation.schema';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CartModule } from './modules/cart/cart.module';
import { CaslModule } from './common/casl/casl.module';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { PromoModule } from './modules/promo/promo.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UploadsModule } from './modules/uploads/uploads.module';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    // global config with validation
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, appConfig, rateLimitConfig, s3Config],
      validationSchema,
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          url: configService.get('REDIS_URL'),
        },
      }),
    }),
    ScheduleModule.forRoot(),
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
      plugins: [ApolloServerPluginLandingPageDisabled()],
      csrfPrevention: false, //problems with testing request
      context: ({ req, res }) => ({ req, res }), //req.user accessible to resolvers/guards
      formatError: (error) => {
        return {
          message: error.message,
          path: error.path,
          locations: error.locations,
          extensions: {
            code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
            statusCode: error.extensions?.statusCode || 500,
            timestamp: new Date().toISOString(),
          },
        };
      },
    }),
    ProductsModule,
    CategoriesModule,
    CartModule,
    PromoModule,
    FavoritesModule,
    StripeModule,
    OrdersModule,
    UploadsModule,
    CaslModule,
    NotificationsModule,
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
  ],
})
export class AppModule {}

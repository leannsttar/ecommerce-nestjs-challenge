import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { jwtConfig } from './common/config/jwt.config';
import { appConfig } from './common/config/app.config';
import { validationSchema } from './common/config/validation.schema';

@Module({
  imports: [
    // global config with validation
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, appConfig],
      validationSchema,
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },
    })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

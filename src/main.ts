import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { ConfigType } from '@nestjs/config';
import { appConfig } from './common/config/namespaces/app.config';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enables req.rawBody for webhook signature verification
  });
  const appConfigInstance = app.get<ConfigType<typeof appConfig>>(
    appConfig.KEY,
  );

  app.use(helmet());

  app.use(cookieParser());

  app.enableCors({
    origin: appConfigInstance.corsOrigin,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // removes props not in dto
      forbidNonWhitelisted: true, // throw error when extra props are sent
      transform: true, // auto transform to dto
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = appConfigInstance.port;
  await app.listen(port);
  Logger.log(
    `Application is running on: http://localhost:${port}/api`,
    'Bootstrap',
  );
}
bootstrap();

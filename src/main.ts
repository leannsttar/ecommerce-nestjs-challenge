import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());

  app.use(cookieParser());

  app.enableCors({
    origin: configService.get<string>('app.corsOrigin'),
    credentials: true,
  });

  app.setGlobalPrefix('api');

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

  const port = configService.getOrThrow<number>('app.port');
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);

}
bootstrap();

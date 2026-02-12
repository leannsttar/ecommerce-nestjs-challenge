import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());

  app.enableCors({
    origin: configService.get<string>('app.corsOrigin', '*'),
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

  await app.listen(configService.getOrThrow<number>('app.port'));

}
bootstrap();

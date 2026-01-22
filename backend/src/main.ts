import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  const bodyLimit = '20mb';
  app.use(json({ limit: bodyLimit }));
  app.use(
    urlencoded({
      limit: bodyLimit,
      extended: true,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
        excludeExtraneousValues: false,
      },
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Health check endpoint está em HealthController

  await app.listen(port);
  console.log(`🚀 Backend ERP rodando na porta ${port}`);
  console.log(`📦 Ambiente: ${nodeEnv}`);
}

bootstrap();

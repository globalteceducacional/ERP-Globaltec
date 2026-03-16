import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';

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
  // Servir arquivos estáticos enviados
  const uploadsDirEnv = process.env.UPLOADS_DIR;
  const uploadsUrlPrefix = process.env.UPLOADS_URL_PREFIX || '/uploads';

  // Se UPLOADS_DIR for um caminho local (não URL), usar esse diretório
  if (uploadsDirEnv && !/^https?:\/\//i.test(uploadsDirEnv)) {
    const uploadsRoot = uploadsDirEnv.startsWith('.')
      ? join(process.cwd(), uploadsDirEnv)
      : uploadsDirEnv;

    if (!fs.existsSync(uploadsRoot)) {
      fs.mkdirSync(uploadsRoot, { recursive: true });
    }

    app.use(uploadsUrlPrefix, express.static(uploadsRoot));
  } else {
    // Fallback padrão: ./uploads
    const uploadsRoot = join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsRoot)) {
      fs.mkdirSync(uploadsRoot, { recursive: true });
    }
    app.use('/uploads', express.static(uploadsRoot));
  }

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

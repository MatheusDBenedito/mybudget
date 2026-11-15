import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

/**
 * Configures global CORS and validation pipes on a NestJS application instance.
 */
export function configureNestApp(app: INestApplication): void {
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  const vercelOrigins = [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .filter((host): host is string => Boolean(host))
    .map((host) => (host.startsWith('http') ? host : `https://${host}`));

  const allowedOrigins = Array.from(
    new Set([
      ...(process.env.FRONTEND_URL || 'http://localhost:3000')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      ...vercelOrigins,
    ]),
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}

/**
 * Creates and initializes a NestJS application backed by the given Express instance
 * (or Nest's default Express instance when omitted).
 */
export async function createConfiguredNestApp(
  expressApp?: ConstructorParameters<typeof ExpressAdapter>[0],
): Promise<INestApplication> {
  const app = expressApp
    ? await NestFactory.create(AppModule, new ExpressAdapter(expressApp))
    : await NestFactory.create(AppModule);

  configureNestApp(app);
  await app.init();
  return app;
}

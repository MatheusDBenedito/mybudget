import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';

/**
 * Configures global CORS and validation pipes on a NestJS application instance.
 */
export function configureNestApp(app: INestApplication): void {
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

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

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureNestApp } from './app.setup';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from the root project directory when running locally via "backend"
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureNestApp(app);
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3333);
}
bootstrap();

import express from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { createConfiguredNestApp } from './app.setup';

const server = express();
let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = createConfiguredNestApp(server).then(() => undefined);
  }
  return initPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensureInitialized();
  return server(req as Parameters<typeof server>[0], res as Parameters<typeof server>[1]);
}


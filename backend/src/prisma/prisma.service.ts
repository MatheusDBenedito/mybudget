import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function resolveServerlessDatabaseUrl(): string | undefined {
    const raw = process.env.DATABASE_URL;
    if (!raw || !process.env.VERCEL) return raw;

    try {
        const url = new URL(raw);
        if (!url.searchParams.has('connection_limit')) {
            url.searchParams.set('connection_limit', '1');
        }
        if (!url.searchParams.has('pool_timeout')) {
            url.searchParams.set('pool_timeout', '20');
        }
        return url.toString();
    } catch {
        return raw;
    }
}

const resolvedUrl = resolveServerlessDatabaseUrl();

export const prismaClientInstance = new PrismaClient(
    resolvedUrl ? { datasources: { db: { url: resolvedUrl } } } : undefined,
);

@Injectable()
export class PrismaService extends PrismaClient {
    // This class acts as a token for typings. Actual injection uses the instance.
}

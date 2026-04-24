import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export const prismaClientInstance = new PrismaClient();

@Injectable()
export class PrismaService extends PrismaClient {
    // This class acts as a token for typings. Actual injection uses the instance.
}

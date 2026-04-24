import { Global, Module } from '@nestjs/common';
import { PrismaService, prismaClientInstance } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useValue: prismaClientInstance,
    }
  ],
  exports: [PrismaService],
})
export class PrismaModule { }

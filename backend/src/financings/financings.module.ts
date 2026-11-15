import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FinancingsController } from './financings.controller';
import { FinancingsService } from './financings.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinancingsController],
  providers: [FinancingsService],
  exports: [FinancingsService],
})
export class FinancingsModule {}

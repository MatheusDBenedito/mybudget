import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OpenFinanceController } from './open-finance.controller';
import { OpenFinanceService } from './open-finance.service';
import { PluggyProvider } from './providers/pluggy.provider';

@Module({
    imports: [PrismaModule],
    controllers: [OpenFinanceController],
    providers: [OpenFinanceService, PluggyProvider],
    exports: [OpenFinanceService],
})
export class OpenFinanceModule {}


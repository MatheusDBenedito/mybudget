import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InvestmentsModule } from '../investments/investments.module';
import { InvestmentGoalsController } from './investment-goals.controller';
import { InvestmentGoalsService } from './investment-goals.service';

@Module({
    imports: [PrismaModule, InvestmentsModule],
    controllers: [InvestmentGoalsController],
    providers: [InvestmentGoalsService],
})
export class InvestmentGoalsModule {}

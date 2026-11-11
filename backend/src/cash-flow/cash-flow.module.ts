import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { CardTransactionsModule } from '../card-transactions/card-transactions.module';
import { CashFlowController } from './cash-flow.controller';
import { CashFlowService } from './cash-flow.service';

@Module({
    imports: [PrismaModule, TransactionsModule, CardTransactionsModule],
    controllers: [CashFlowController],
    providers: [CashFlowService],
})
export class CashFlowModule { }

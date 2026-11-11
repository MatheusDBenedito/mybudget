import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CardTransactionsModule } from './card-transactions/card-transactions.module';
import { RecurringExpensesModule } from './recurring-expenses/recurring-expenses.module';
import { ReportsModule } from './reports/reports.module';
import { CreditCardsModule } from './credit-cards/credit-cards.module';
import { SeedModule } from './seed/seed.module';
import { CategoriesModule } from './categories/categories.module';
import { AccountsModule } from './accounts/accounts.module';
import { InvestmentsModule } from './investments/investments.module';
import { MilesModule } from './miles/miles.module';
import { CashFlowModule } from './cash-flow/cash-flow.module';
import { DashboardLayoutModule } from './dashboard-layout/dashboard-layout.module';
import { CardHoldersModule } from './card-holders/card-holders.module';

@Module({
  imports: [PrismaModule, TransactionsModule, CardTransactionsModule, RecurringExpensesModule, ReportsModule, CreditCardsModule, CardHoldersModule, SeedModule, CategoriesModule, AccountsModule, InvestmentsModule, MilesModule, CashFlowModule, DashboardLayoutModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

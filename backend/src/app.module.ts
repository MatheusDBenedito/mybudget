import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { WorkspaceRbacGuard } from './auth/guards/workspace-rbac.guard';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { AdminRbacModule } from './admin-rbac/admin-rbac.module';
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
import { OpenFinanceModule } from './open-finance/open-finance.module';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        WorkspacesModule,
        AdminRbacModule,
        TransactionsModule,
        CardTransactionsModule,
        RecurringExpensesModule,
        ReportsModule,
        CreditCardsModule,
        CardHoldersModule,
        SeedModule,
        CategoriesModule,
        AccountsModule,
        InvestmentsModule,
        MilesModule,
        CashFlowModule,
        DashboardLayoutModule,
        OpenFinanceModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: WorkspaceRbacGuard },
    ],
})
export class AppModule {}

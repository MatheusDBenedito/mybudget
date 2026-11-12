import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { AccountYieldService } from './yield/account-yield.service';
import { YieldPotsService } from './yield/yield-pots.service';
import { TransfersService } from './transfers.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountYieldService, YieldPotsService, TransfersService],
  exports: [AccountsService],
})
export class AccountsModule {}

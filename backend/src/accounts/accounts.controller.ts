import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreatePotDto, FreeBalanceDto, PotAdjustDto, PotAmountDto, UpdatePotDto } from './dto/pot.dto';
import { YieldPotsService } from './yield/yield-pots.service';
import { CreateTransferDto } from './dto/transfer.dto';
import { TransfersService } from './transfers.service';

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly potsService: YieldPotsService,
    private readonly transfersService: TransfersService,
  ) { }

  @Post()
  create(@Body() createAccountDto: CreateAccountDto) {
    return this.accountsService.create(createAccountDto);
  }

  @Get()
  findAll() {
    return this.accountsService.findAll();
  }

  /** Credits pending daily yields now (also runs automatically on startup and every hour). */
  @Post('yields/accrue')
  accrueYields() {
    return this.accountsService.accrueYields();
  }

  @Get('transfers')
  listTransfers() {
    return this.transfersService.list();
  }

  /** Moves money between two of the user's accounts (not income nor expense). */
  @Post('transfers')
  createTransfer(@Body() dto: CreateTransferDto) {
    return this.transfersService.create(dto);
  }

  /** Undoes a transfer, returning the money to the source account. */
  @Delete('transfers/:transferId')
  removeTransfer(@Param('transferId') transferId: string) {
    return this.transfersService.remove(transferId);
  }

  @Patch('pots/:potId')
  updatePot(@Param('potId') potId: string, @Body() dto: UpdatePotDto) {
    return this.potsService.update(potId, dto);
  }

  @Delete('pots/:potId')
  removePot(@Param('potId') potId: string) {
    return this.potsService.remove(potId);
  }

  /** Sets the pot balance to the value shown in the bank app (difference recorded as an adjustment). */
  @Post('pots/:potId/adjust')
  adjustPot(@Param('potId') potId: string, @Body() dto: PotAdjustDto) {
    return this.potsService.adjust(potId, dto.balance);
  }

  /** Guardar: moves money from the account's free balance into the pot. */
  @Post('pots/:potId/deposit')
  depositPot(@Param('potId') potId: string, @Body() dto: PotAmountDto) {
    return this.potsService.deposit(potId, dto.amount, dto.date);
  }

  /** Retirar: moves money from the pot back to the account's free balance. */
  @Post('pots/:potId/withdraw')
  withdrawPot(@Param('potId') potId: string, @Body() dto: PotAmountDto) {
    return this.potsService.withdraw(potId, dto.amount, dto.date);
  }

  /** Recalculates the account's yields from `from` (yyyy-mm-dd), or from its earliest start when omitted. */
  @Post(':id/yields/recompute')
  recomputeYields(@Param('id') id: string, @Body() body: { from?: string }) {
    return this.accountsService.recomputeYields(id, body?.from);
  }

  /** Sets the free balance (outside the cofrinhos) of a yielding account; 0 zeroes it. */
  @Patch(':id/free-balance')
  setFreeBalance(@Param('id') id: string, @Body() dto: FreeBalanceDto) {
    return this.accountsService.setFreeBalance(id, dto.balance);
  }

  @Get(':id/yields')
  yieldHistory(@Param('id') id: string) {
    return this.accountsService.yieldHistory(id);
  }

  /** Deposits ("lots") of the free balance and each pot, with age and IR bracket. */
  @Get(':id/lots')
  lots(@Param('id') id: string) {
    return this.accountsService.lots(id);
  }

  @Get(':id/pots')
  listPots(@Param('id') id: string) {
    return this.potsService.list(id);
  }

  @Post(':id/pots')
  createPot(@Param('id') id: string, @Body() dto: CreatePotDto) {
    return this.potsService.create(id, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAccountDto: UpdateAccountDto) {
    return this.accountsService.update(id, updateAccountDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.accountsService.remove(id);
  }
}

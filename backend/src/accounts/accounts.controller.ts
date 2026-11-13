import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import {
  CurrentWorkspace,
  RequireAnyPermissions,
  RequirePermissions,
  type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
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
  ) {}

  @Post()
  @RequirePermissions('create:conta')
  create(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Body() createAccountDto: CreateAccountDto) {
    return this.accountsService.create(ctx.workspaceId, createAccountDto);
  }

  @Get()
  @RequireAnyPermissions('view:conta', 'view:resumo')
  findAll(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
    return this.accountsService.findAll(ctx.workspaceId);
  }

  /** Credits pending daily yields now (also runs automatically on startup and every hour). */
  @Post('yields/accrue')
  @RequirePermissions('edit:conta')
  accrueYields() {
    return this.accountsService.accrueYields();
  }

  @Get('transfers')
  @RequirePermissions('view:conta')
  listTransfers(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
    return this.transfersService.list(ctx.workspaceId);
  }

  /** Moves money between two of the user's accounts (not income nor expense). */
  @Post('transfers')
  @RequirePermissions('edit:conta')
  createTransfer(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Body() dto: CreateTransferDto) {
    return this.transfersService.create(ctx.workspaceId, dto);
  }

  /** Undoes a transfer, returning the money to the source account. */
  @Delete('transfers/:transferId')
  @RequirePermissions('delete:conta')
  removeTransfer(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('transferId') transferId: string) {
    return this.transfersService.remove(ctx.workspaceId, transferId);
  }

  @Patch('pots/:potId')
  @RequirePermissions('edit:conta')
  updatePot(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('potId') potId: string, @Body() dto: UpdatePotDto) {
    return this.potsService.update(ctx.workspaceId, potId, dto);
  }

  @Delete('pots/:potId')
  @RequirePermissions('delete:conta')
  removePot(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('potId') potId: string) {
    return this.potsService.remove(ctx.workspaceId, potId);
  }

  /** Sets the pot balance to the value shown in the bank app (difference recorded as an adjustment). */
  @Post('pots/:potId/adjust')
  @RequirePermissions('edit:conta')
  adjustPot(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('potId') potId: string, @Body() dto: PotAdjustDto) {
    return this.potsService.adjust(ctx.workspaceId, potId, dto.balance);
  }

  /** Guardar: moves money from the account's free balance into the pot. */
  @Post('pots/:potId/deposit')
  @RequirePermissions('edit:conta')
  depositPot(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('potId') potId: string, @Body() dto: PotAmountDto) {
    return this.potsService.deposit(ctx.workspaceId, potId, dto.amount, dto.date);
  }

  /** Retirar: moves money from the pot back to the account's free balance. */
  @Post('pots/:potId/withdraw')
  @RequirePermissions('edit:conta')
  withdrawPot(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('potId') potId: string, @Body() dto: PotAmountDto) {
    return this.potsService.withdraw(ctx.workspaceId, potId, dto.amount, dto.date);
  }

  /** Recalculates the account's yields from `from` (yyyy-mm-dd), or from its earliest start when omitted. */
  @Post(':id/yields/recompute')
  @RequirePermissions('edit:conta')
  recomputeYields(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string, @Body() body: { from?: string }) {
    return this.accountsService.recomputeYields(ctx.workspaceId, id, body?.from);
  }

  /** Sets the free balance (outside the cofrinhos) of a yielding account; 0 zeroes it. */
  @Patch(':id/free-balance')
  @RequirePermissions('edit:conta')
  setFreeBalance(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string, @Body() dto: FreeBalanceDto) {
    return this.accountsService.setFreeBalance(ctx.workspaceId, id, dto.balance);
  }

  @Get(':id/yields')
  @RequirePermissions('view:conta')
  yieldHistory(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string) {
    return this.accountsService.yieldHistory(ctx.workspaceId, id);
  }

  /** Deposits ("lots") of the free balance and each pot, with age and IR bracket. */
  @Get(':id/lots')
  @RequirePermissions('view:conta')
  lots(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string) {
    return this.accountsService.lots(ctx.workspaceId, id);
  }

  @Get(':id/pots')
  @RequirePermissions('view:conta')
  listPots(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string) {
    return this.potsService.list(ctx.workspaceId, id);
  }

  @Post(':id/pots')
  @RequirePermissions('create:conta')
  createPot(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string, @Body() dto: CreatePotDto) {
    return this.potsService.create(ctx.workspaceId, id, dto);
  }

  @Get(':id')
  @RequirePermissions('view:conta')
  findOne(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string) {
    return this.accountsService.findOne(ctx.workspaceId, id);
  }

  @Patch(':id')
  @RequirePermissions('edit:conta')
  update(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string, @Body() updateAccountDto: UpdateAccountDto) {
    return this.accountsService.update(ctx.workspaceId, id, updateAccountDto);
  }

  @Delete(':id')
  @RequirePermissions('delete:conta')
  remove(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string) {
    return this.accountsService.remove(ctx.workspaceId, id);
  }
}

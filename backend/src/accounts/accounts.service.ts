import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType } from '@prisma/client';
import { AccountYieldService, MAIN_BUCKET } from './yield/account-yield.service';
import { toDateKey } from './yield/account-yield.calculator';

@Injectable()
export class AccountsService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly yields: AccountYieldService,
  ) { }

  async create(createAccountDto: CreateAccountDto) {
    const yieldFields = this.resolveYieldFields(createAccountDto.type ?? 'CHECKING', createAccountDto.cdiPercentage, null);
    return this.prisma.account.create({
      data: {
        name: createAccountDto.name.trim(),
        balance: createAccountDto.balance || 0,
        ...yieldFields,
      },
    });
  }

  /**
   * Checking accounts never yield; yielding accounts must have a % of CDI.
   * Keeps type, cdiPercentage and yieldSince consistent regardless of what the client sends.
   * A yielding account starts earning on the day it becomes yielding (no retroactive yield).
   */
  private resolveYieldFields(type: AccountType, cdiPercentage: number | null | undefined, currentYieldSince: Date | null) {
    if (type === 'CHECKING') {
      return { type, cdiPercentage: null, yieldSince: null };
    }
    if (cdiPercentage == null || cdiPercentage <= 0) {
      throw new BadRequestException('Informe o % do CDI que a conta remunerada rende.');
    }
    const today = new Date();
    return {
      type,
      cdiPercentage,
      yieldSince: currentYieldSince ?? new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    };
  }

  /**
   * Accounts with the yield credited in the current month (0 for checking accounts), their pots and the
   * free balance (total balance minus what is kept in pots).
   */
  async findAll() {
    const today = new Date();
    const [accounts, totals] = await Promise.all([
      this.prisma.account.findMany({ orderBy: { name: 'asc' }, include: { pots: { orderBy: { createdAt: 'asc' } } } }),
      this.yields.monthTotals(today.getFullYear(), today.getMonth() + 1),
    ]);
    return accounts.map(a => {
      const potsTotal = a.pots.reduce((acc, p) => acc + p.balance, 0);
      const round = (v: number) => Math.round(v * 100) / 100;
      return {
        ...a,
        balance: round(a.balance),
        monthYield: totals.byAccount.get(a.id) ?? 0,
        freeBalance: round(a.balance - potsTotal),
        freeMonthYield: totals.byBucket.get(`${a.id}:${MAIN_BUCKET}`) ?? 0,
        pots: a.pots.map(p => ({ ...p, balance: round(p.balance), monthYield: totals.byBucket.get(`${a.id}:${p.id}`) ?? 0 })),
      };
    });
  }

  async lots(id: string) {
    await this.findOne(id);
    return this.yields.lots(id);
  }

  /** Runs the daily yield accrual now (it also runs automatically on startup and hourly). */
  accrueYields() {
    return this.yields.accrueAll();
  }

  /**
   * Recalculates every yield of a yielding account from `from` (yyyy-mm-dd) — by default from the earliest start
   * among the account and its cofrinhos. Credits from that day on are reversed and replayed.
   */
  async recomputeYields(id: string, from?: string) {
    const account = await this.prisma.account.findUnique({ where: { id }, include: { pots: { select: { createdAt: true } } } });
    if (!account) throw new NotFoundException(`Account with ID ${id} not found`);
    if (account.type !== 'YIELDING' || !account.yieldSince) throw new BadRequestException('A conta não é remunerada.');
    const starts = [account.yieldSince, ...account.pots.map(p => p.createdAt)];
    const earliest = starts.reduce((min, d) => (d < min ? d : min));
    const fromKey = from?.slice(0, 10) ?? toDateKey(earliest);
    return this.yields.recomputeFrom(id, fromKey);
  }

  async yieldHistory(id: string) {
    await this.findOne(id);
    return this.yields.history(id);
  }

  async findOne(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async update(id: string, updateAccountDto: UpdateAccountDto) {
    // Check if account exists first
    const existing = await this.findOne(id);

    const { type, cdiPercentage, name, ...rest } = updateAccountDto;
    if (type === 'CHECKING' && existing.type === 'YIELDING') {
      const pots = await this.prisma.yieldPot.count({ where: { accountId: id } });
      if (pots > 0) {
        throw new BadRequestException('Exclua os cofrinhos antes de transformar a conta em conta corrente.');
      }
    }
    if (rest.balance !== undefined) {
      const { _sum } = await this.prisma.yieldPot.aggregate({ where: { accountId: id }, _sum: { balance: true } });
      if (rest.balance < (_sum.balance ?? 0) - 0.005) {
        throw new BadRequestException('O saldo da conta não pode ser menor que o total guardado nos cofrinhos.');
      }
    }
    // Validate against the merged state so a partial update can't leave a yielding account without a rate
    const yieldFields = type !== undefined || cdiPercentage !== undefined
      ? this.resolveYieldFields(
        type ?? existing.type,
        cdiPercentage === undefined ? existing.cdiPercentage : cdiPercentage,
        // Keep the original start date while it stays yielding; restart it when it becomes yielding again
        existing.type === 'YIELDING' ? existing.yieldSince : null,
      )
      : {};

    // A manual balance change is recorded with today's date, so yields change from today on (not retroactively)
    const delta = rest.balance !== undefined ? Math.round((rest.balance - existing.balance) * 100) / 100 : 0;
    const [updated] = await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id },
        data: { ...rest, ...(name !== undefined ? { name: name.trim() } : {}), ...yieldFields },
      }),
      ...(Math.abs(delta) >= 0.005 ? [this.prisma.balanceAdjustment.create({ data: { accountId: id, amount: delta } })] : []),
    ]);

    // Still yielding with a new % of CDI: the new rate applies since it started yielding
    if (existing.type === 'YIELDING' && updated.type === 'YIELDING' && updated.yieldSince
      && updated.cdiPercentage !== existing.cdiPercentage && toDateKey(updated.yieldSince) < toDateKey(new Date())) {
      await this.yields.recomputeFrom(id, toDateKey(updated.yieldSince));
      return this.findOne(id);
    }
    return updated;
  }

  /**
   * Sets the free balance of a yielding account (what is outside the cofrinhos), e.g. to zero.
   * The account total becomes cofrinhos + the new free balance; the difference is a dated adjustment.
   */
  async setFreeBalance(id: string, freeBalance: number) {
    if (!(freeBalance >= 0)) throw new BadRequestException('O saldo livre não pode ser negativo.');
    const account = await this.prisma.account.findUnique({ where: { id }, include: { pots: { select: { balance: true } } } });
    if (!account) throw new NotFoundException(`Account with ID ${id} not found`);
    const potsTotal = account.pots.reduce((acc, p) => acc + p.balance, 0);
    const delta = Math.round((potsTotal + freeBalance - account.balance) * 100) / 100;
    if (Math.abs(delta) >= 0.005) {
      await this.prisma.$transaction([
        this.prisma.account.update({ where: { id }, data: { balance: { increment: delta } } }),
        this.prisma.balanceAdjustment.create({ data: { accountId: id, amount: delta } }),
      ]);
    }
    return (await this.findAll()).find(a => a.id === id);
  }

  async remove(id: string) {
    const account = await this.findOne(id);

    // Check if it's safe to delete (no transactions associated)
    const transactionsCount = await this.prisma.transaction.count({
      where: { accountId: id }
    });

    if (transactionsCount > 0) {
      throw new BadRequestException(`Cannot delete account with ID ${id} because it has ${transactionsCount} associated transactions.`);
    }

    const transfersCount = await this.prisma.accountTransfer.count({
      where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
    });
    if (transfersCount > 0) {
      throw new BadRequestException(`Não é possível excluir esta conta: existem ${transfersCount} transferência(s) vinculadas a ela.`);
    }

    // Also check for Card transactions or recurring expenses?
    // Let's count credit cards first
    const cardsCount = await this.prisma.creditCard.count({
      where: { accountId: id }
    });

    if (cardsCount > 0) {
      throw new BadRequestException(`Cannot delete account with ID ${id} because it has ${cardsCount} associated credit cards.`);
    }

    return this.prisma.account.delete({
      where: { id },
    });
  }
}

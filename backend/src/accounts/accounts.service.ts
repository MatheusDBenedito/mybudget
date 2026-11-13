import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType } from '@prisma/client';
import { AccountYieldService, MAIN_BUCKET } from './yield/account-yield.service';
import { toDateKey } from './yield/account-yield.calculator';

const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  private usdRate: number | null = null;
  private usdRateExpiry = 0;
  private readonly USD_RATE_TTL_MS = 1000 * 60 * 5; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly yields: AccountYieldService,
  ) { }

  /**
   * Fetches the live USD -> BRL exchange rate (AwesomeAPI primary, Yahoo Finance fallback).
   */
  async getUsdRate(): Promise<number | null> {
    if (this.usdRate != null && Date.now() < this.usdRateExpiry) {
      return this.usdRate;
    }

    // 1. Primary: AwesomeAPI
    try {
      const response = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
      if (response.ok) {
        const data = await response.json();
        const bid = Number(data?.USDBRL?.bid);
        if (bid > 0) {
          this.usdRate = bid;
          this.usdRateExpiry = Date.now() + this.USD_RATE_TTL_MS;
          return this.usdRate;
        }
      }
    } catch (error) {
      this.logger.warn(`AwesomeAPI USD-BRL failed: ${(error as Error).message}`);
    }

    // 2. Fallback: Yahoo Finance USDBRL=X
    try {
      const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d&range=1d', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (response.ok) {
        const data = await response.json();
        const price = Number(data?.chart?.result?.[0]?.meta?.regularMarketPrice);
        if (price > 0) {
          this.usdRate = price;
          this.usdRateExpiry = Date.now() + this.USD_RATE_TTL_MS;
          return this.usdRate;
        }
      }
    } catch (error) {
      this.logger.warn(`Yahoo Finance USDBRL=X failed: ${(error as Error).message}`);
    }

    return this.usdRate;
  }

  private async resolveCurrencyFields(input: {
    currency?: string;
    balance?: number;
    balanceUsd?: number | null;
    investedBrl?: number | null;
    purchaseExchangeRate?: number | null;
  }) {
    const currency = input.currency === 'USD' ? 'USD' : 'BRL';
    if (currency === 'BRL') {
      return {
        currency: 'BRL',
        balance: round2(input.balance ?? 0),
        balanceUsd: null,
        investedBrl: null,
        purchaseExchangeRate: null,
      };
    }

    const balanceUsd = round2(input.balanceUsd ?? 0);
    let investedBrl = input.investedBrl != null ? round2(input.investedBrl) : null;
    let purchaseExchangeRate = input.purchaseExchangeRate != null ? round4(input.purchaseExchangeRate) : null;

    if (balanceUsd > 0) {
      if (investedBrl != null && (purchaseExchangeRate == null || purchaseExchangeRate <= 0)) {
        purchaseExchangeRate = round4(investedBrl / balanceUsd);
      } else if (purchaseExchangeRate != null && purchaseExchangeRate > 0 && investedBrl == null) {
        investedBrl = round2(balanceUsd * purchaseExchangeRate);
      }
    } else {
      investedBrl = investedBrl ?? 0;
    }

    const liveRate = await this.getUsdRate();
    const effectiveRate = liveRate ?? purchaseExchangeRate ?? 1;
    const balanceBrl = round2(balanceUsd * effectiveRate);

    return {
      currency: 'USD',
      balance: balanceBrl,
      balanceUsd,
      investedBrl: investedBrl ?? balanceBrl,
      purchaseExchangeRate: purchaseExchangeRate ?? round4(effectiveRate),
    };
  }

  async create(workspaceId: string, createAccountDto: CreateAccountDto) {
    const isUsd = createAccountDto.currency === 'USD';
    const effectiveType = isUsd ? 'CHECKING' : (createAccountDto.type ?? 'CHECKING');
    const yieldFields = this.resolveYieldFields(effectiveType, isUsd ? null : createAccountDto.cdiPercentage, null);
    const currencyFields = await this.resolveCurrencyFields(createAccountDto);

    return this.prisma.account.create({
      data: {
        workspaceId,
        name: createAccountDto.name.trim(),
        ...currencyFields,
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
   * For USD accounts, balance fluctuates with today's live USD-BRL rate while preserving investedBrl and purchaseExchangeRate.
   */
  async findAll(workspaceId: string) {
    const today = new Date();
    const [accounts, totals] = await Promise.all([
      this.prisma.account.findMany({ where: { workspaceId }, orderBy: { name: 'asc' }, include: { pots: { orderBy: { createdAt: 'asc' } } } }),
      this.yields.monthTotals(today.getFullYear(), today.getMonth() + 1),
    ]);

    const hasUsd = accounts.some(a => a.currency === 'USD');
    const liveUsdRate = hasUsd ? await this.getUsdRate() : null;

    // Synchronize stored BRL balance of USD accounts if live rate changed
    if (liveUsdRate != null && liveUsdRate > 0) {
      const updates = accounts
        .filter(a => a.currency === 'USD' && a.balanceUsd != null)
        .map(a => {
          const newBrl = round2((a.balanceUsd ?? 0) * liveUsdRate);
          if (Math.abs(newBrl - a.balance) >= 0.01) {
            a.balance = newBrl;
            return this.prisma.account.update({ where: { id: a.id }, data: { balance: newBrl } });
          }
          return null;
        })
        .filter(Boolean);
      if (updates.length > 0) {
        await Promise.allSettled(updates);
      }
    }

    return accounts.map(a => {
      const potsTotal = a.pots.reduce((acc, p) => acc + p.balance, 0);
      if (a.currency === 'USD') {
        const balanceUsd = round2(a.balanceUsd ?? 0);
        const purchaseRate = a.purchaseExchangeRate ?? (balanceUsd > 0 && a.investedBrl ? round4(a.investedBrl / balanceUsd) : null);
        const currentRate = liveUsdRate ?? purchaseRate ?? (balanceUsd > 0 ? round4(a.balance / balanceUsd) : 1);
        const currentBalanceBrl = round2(balanceUsd * currentRate);
        const investedBrl = round2(a.investedBrl ?? (purchaseRate ? balanceUsd * purchaseRate : currentBalanceBrl));
        const variationBrl = round2(currentBalanceBrl - investedBrl);
        const variationPct = investedBrl > 0 ? round2(((currentBalanceBrl - investedBrl) / investedBrl) * 100) : 0;

        return {
          ...a,
          currency: 'USD' as const,
          balance: currentBalanceBrl,
          grossBalance: currentBalanceBrl,
          taxAmount: 0,
          balanceUsd,
          investedBrl,
          purchaseExchangeRate: purchaseRate ? round4(purchaseRate) : null,
          currentExchangeRate: round4(currentRate),
          variationBrl,
          variationPct,
          monthYield: 0,
          freeBalance: currentBalanceBrl,
          freeGrossBalance: currentBalanceBrl,
          freeTaxAmount: 0,
          freeMonthYield: 0,
          pots: [],
        };
      }

      const freeBalance = round2(a.balance - potsTotal);
      const freeTaxAmount = freeBalance > 0.005 ? (totals.taxByBucket.get(`${a.id}:${MAIN_BUCKET}`) ?? 0) : 0;
      const pots = a.pots.map(p => {
        const potBalance = round2(p.balance);
        const potTax = potBalance > 0.005 ? (totals.taxByBucket.get(`${a.id}:${p.id}`) ?? 0) : 0;
        return {
          ...p,
          balance: potBalance,
          grossBalance: round2(potBalance + potTax),
          taxAmount: potTax,
          monthYield: totals.byBucket.get(`${a.id}:${p.id}`) ?? 0,
        };
      });
      const taxAmount = round2(freeTaxAmount + pots.reduce((acc, p) => acc + p.taxAmount, 0));

      return {
        ...a,
        currency: 'BRL' as const,
        balance: round2(a.balance),
        grossBalance: round2(a.balance + taxAmount),
        taxAmount,
        monthYield: totals.byAccount.get(a.id) ?? 0,
        freeBalance,
        freeGrossBalance: round2(freeBalance + freeTaxAmount),
        freeTaxAmount,
        freeMonthYield: totals.byBucket.get(`${a.id}:${MAIN_BUCKET}`) ?? 0,
        pots,
      };
    });
  }

  async lots(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
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
  async recomputeYields(workspaceId: string, id: string, from?: string) {
    const account = await this.prisma.account.findFirst({ where: { id, workspaceId }, include: { pots: { select: { createdAt: true } } } });
    if (!account) throw new NotFoundException(`Account with ID ${id} not found`);
    if (account.type !== 'YIELDING' || !account.yieldSince) throw new BadRequestException('A conta não é remunerada.');
    const starts = [account.yieldSince, ...account.pots.map(p => p.createdAt)];
    const earliest = starts.reduce((min, d) => (d < min ? d : min));
    const fromKey = from?.slice(0, 10) ?? toDateKey(earliest);
    return this.yields.recomputeFrom(id, fromKey);
  }

  async yieldHistory(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.yields.history(id);
  }

  async findOne(workspaceId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, workspaceId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async update(workspaceId: string, id: string, updateAccountDto: UpdateAccountDto) {
    // Check if account exists first
    const existing = await this.findOne(workspaceId, id);

    const { type, cdiPercentage, name, currency, balanceUsd, investedBrl, purchaseExchangeRate, ...rest } = updateAccountDto;
    const targetCurrency = (currency ?? existing.currency ?? 'BRL') as 'BRL' | 'USD';
    const effectiveType = targetCurrency === 'USD' ? 'CHECKING' : (type ?? existing.type);

    if (effectiveType === 'CHECKING' && existing.type === 'YIELDING') {
      const pots = await this.prisma.yieldPot.count({ where: { accountId: id } });
      if (pots > 0) {
        throw new BadRequestException('Exclua os cofrinhos antes de transformar a conta em conta corrente ou dólar.');
      }
    }

    const currencyFields = await this.resolveCurrencyFields({
      currency: targetCurrency,
      balance: rest.balance !== undefined ? rest.balance : existing.balance,
      balanceUsd: balanceUsd !== undefined ? balanceUsd : existing.balanceUsd,
      investedBrl: investedBrl !== undefined ? investedBrl : existing.investedBrl,
      purchaseExchangeRate: purchaseExchangeRate !== undefined ? purchaseExchangeRate : existing.purchaseExchangeRate,
    });

    if (targetCurrency === 'BRL' && rest.balance !== undefined) {
      const { _sum } = await this.prisma.yieldPot.aggregate({ where: { accountId: id }, _sum: { balance: true } });
      if (rest.balance < (_sum.balance ?? 0) - 0.005) {
        throw new BadRequestException('O saldo da conta não pode ser menor que o total guardado nos cofrinhos.');
      }
    }

    // Validate against the merged state so a partial update can't leave a yielding account without a rate
    const yieldFields = type !== undefined || cdiPercentage !== undefined || targetCurrency === 'USD'
      ? this.resolveYieldFields(
        effectiveType,
        targetCurrency === 'USD' ? null : (cdiPercentage === undefined ? existing.cdiPercentage : cdiPercentage),
        // Keep the original start date while it stays yielding; restart it when it becomes yielding again
        existing.type === 'YIELDING' && effectiveType === 'YIELDING' ? existing.yieldSince : null,
      )
      : {};

    // A manual balance change is recorded with today's date, so yields change from today on (not retroactively)
    const delta = targetCurrency === 'BRL' && rest.balance !== undefined
      ? round2(rest.balance - existing.balance)
      : 0;

    const [updated] = await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id },
        data: {
          ...currencyFields,
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...yieldFields,
        },
      }),
      ...(Math.abs(delta) >= 0.005 ? [this.prisma.balanceAdjustment.create({ data: { accountId: id, workspaceId, amount: delta } })] : []),
    ]);

    // Still yielding with a new % of CDI: the new rate applies since it started yielding
    if (existing.type === 'YIELDING' && updated.type === 'YIELDING' && updated.yieldSince
      && updated.cdiPercentage !== existing.cdiPercentage && toDateKey(updated.yieldSince) < toDateKey(new Date())) {
      await this.yields.recomputeFrom(id, toDateKey(updated.yieldSince));
      return this.findOne(workspaceId, id);
    }
    return updated;
  }

  /**
   * Sets the free balance of a yielding account (what is outside the cofrinhos), e.g. to zero.
   * The account total becomes cofrinhos + the new free balance; the difference is a dated adjustment.
   */
  async setFreeBalance(workspaceId: string, id: string, freeBalance: number) {
    if (!(freeBalance >= 0)) throw new BadRequestException('O saldo livre não pode ser negativo.');
    const account = await this.prisma.account.findFirst({ where: { id, workspaceId }, include: { pots: { select: { balance: true } } } });
    if (!account) throw new NotFoundException(`Account with ID ${id} not found`);
    const potsTotal = account.pots.reduce((acc, p) => acc + p.balance, 0);
    const delta = Math.round((potsTotal + freeBalance - account.balance) * 100) / 100;
    if (Math.abs(delta) >= 0.005) {
      await this.prisma.$transaction([
        this.prisma.account.update({ where: { id }, data: { balance: { increment: delta } } }),
        this.prisma.balanceAdjustment.create({ data: { accountId: id, workspaceId, amount: delta } }),
      ]);
    }
    return (await this.findAll(workspaceId)).find(a => a.id === id);
  }

  async remove(workspaceId: string, id: string) {
    const account = await this.findOne(workspaceId, id);

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

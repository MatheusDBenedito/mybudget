import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  compareAmortizeVsInvest,
  computeFgtsEligibility,
  simulateAmortization,
} from './financing-calculator';
import {
  ParsedExtraAmortization,
  ParsedFinancingContract,
  ParsedInstallment,
  parseFgtsStatementText,
  parseFinancingStatementText,
} from './financing-statement.parser';
import {
  CreateExtraAmortizationDto,
  CreateFinancingDto,
  SimulateFinancingDto,
  UpdateFinancingDto,
  UpdateInstallmentStatusDto,
} from './dto/financing.dto';

interface TextItem {
  str: string;
  transform: number[];
}

export interface ConfirmStatementImportPayload {
  financingId?: string;
  name?: string;
  contract?: ParsedFinancingContract;
  installments: ParsedInstallment[];
  extraAmortizations?: ParsedExtraAmortization[];
  replaceExistingInstallments?: boolean;
}

@Injectable()
export class FinancingsService {
  private cachedCdi: { ratePct: number; fetchedAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string) {
    const items = await this.prisma.financing.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        _count: {
          select: {
            installments: true,
            extraAmortizations: true,
          },
        },
      },
    });

    return items.map((item) => ({
      ...item,
      fgtsEligibility: computeFgtsEligibility(item.lastFgtsUsageDate),
    }));
  }

  async getOne(workspaceId: string, id: string) {
    const financing = await this.prisma.financing.findFirst({
      where: { id, workspaceId },
      include: {
        installments: {
          orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
        },
        extraAmortizations: {
          orderBy: [{ date: 'desc' }],
        },
      },
    });

    if (!financing) {
      throw new NotFoundException('Financiamento não encontrado.');
    }

    return financing;
  }

  async create(workspaceId: string, dto: CreateFinancingDto) {
    return this.prisma.financing.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        bankName: dto.bankName.trim(),
        contractNumber: dto.contractNumber?.trim() || null,
        propertyAddress: dto.propertyAddress?.trim() || null,
        system: dto.system ?? 'SAC',
        indexer: dto.indexer ?? 'TR',
        propertyValue: dto.propertyValue,
        downPayment: dto.downPayment ?? 0,
        financedAmount: dto.financedAmount,
        currentBalance: dto.currentBalance,
        nominalRateAnnual: dto.nominalRateAnnual,
        effectiveRateAnnual: dto.effectiveRateAnnual ?? null,
        cetAnnual: dto.cetAnnual ?? null,
        totalMonths: dto.totalMonths,
        dueDay: dto.dueDay ?? 21,
        contractDate: new Date(dto.contractDate),
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : null,
        monthlyAdminFee: dto.monthlyAdminFee ?? 25,
        monthlyInsurance: dto.monthlyInsurance ?? 0,
        fgtsBalance: dto.fgtsBalance ?? 0,
        lastFgtsUsageDate: dto.lastFgtsUsageDate
          ? new Date(dto.lastFgtsUsageDate)
          : null,
        linkedFixedDescription: dto.linkedFixedDescription?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateFinancingDto) {
    await this.ensureOwned(workspaceId, id);

    return this.prisma.financing.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.bankName !== undefined ? { bankName: dto.bankName.trim() } : {}),
        ...(dto.contractNumber !== undefined
          ? { contractNumber: dto.contractNumber?.trim() || null }
          : {}),
        ...(dto.propertyAddress !== undefined
          ? { propertyAddress: dto.propertyAddress?.trim() || null }
          : {}),
        ...(dto.system !== undefined ? { system: dto.system } : {}),
        ...(dto.indexer !== undefined ? { indexer: dto.indexer } : {}),
        ...(dto.propertyValue !== undefined ? { propertyValue: dto.propertyValue } : {}),
        ...(dto.downPayment !== undefined ? { downPayment: dto.downPayment } : {}),
        ...(dto.financedAmount !== undefined ? { financedAmount: dto.financedAmount } : {}),
        ...(dto.currentBalance !== undefined ? { currentBalance: dto.currentBalance } : {}),
        ...(dto.nominalRateAnnual !== undefined
          ? { nominalRateAnnual: dto.nominalRateAnnual }
          : {}),
        ...(dto.effectiveRateAnnual !== undefined
          ? { effectiveRateAnnual: dto.effectiveRateAnnual }
          : {}),
        ...(dto.cetAnnual !== undefined ? { cetAnnual: dto.cetAnnual } : {}),
        ...(dto.totalMonths !== undefined ? { totalMonths: dto.totalMonths } : {}),
        ...(dto.dueDay !== undefined ? { dueDay: dto.dueDay } : {}),
        ...(dto.contractDate !== undefined
          ? { contractDate: new Date(dto.contractDate) }
          : {}),
        ...(dto.releaseDate !== undefined
          ? { releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : null }
          : {}),
        ...(dto.monthlyAdminFee !== undefined ? { monthlyAdminFee: dto.monthlyAdminFee } : {}),
        ...(dto.monthlyInsurance !== undefined ? { monthlyInsurance: dto.monthlyInsurance } : {}),
        ...(dto.fgtsBalance !== undefined ? { fgtsBalance: dto.fgtsBalance } : {}),
        ...(dto.lastFgtsUsageDate !== undefined
          ? {
              lastFgtsUsageDate: dto.lastFgtsUsageDate
                ? new Date(dto.lastFgtsUsageDate)
                : null,
            }
          : {}),
        ...(dto.linkedFixedDescription !== undefined
          ? { linkedFixedDescription: dto.linkedFixedDescription?.trim() || null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
    });
  }

  async getFixedExpenseOptions(workspaceId: string) {
    const fixedTxs = await this.prisma.transaction.findMany({
      where: {
        workspaceId,
        type: 'EXPENSE',
        isFixed: true,
      },
      include: {
        category: { select: { name: true } },
      },
      orderBy: [{ date: 'desc' }],
    });

    const seen = new Map<
      string,
      {
        description: string;
        amount: number;
        categoryName: string | null;
        accountId: string | null;
        lastDate: string;
      }
    >();

    for (const tx of fixedTxs) {
      const key = tx.description.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.set(key, {
        description: tx.description.trim(),
        amount: tx.amount,
        categoryName: tx.category?.name ?? null,
        accountId: tx.accountId ?? null,
        lastDate: tx.date.toISOString().slice(0, 10),
      });
    }

    return Array.from(seen.values());
  }

  async remove(workspaceId: string, id: string) {
    await this.ensureOwned(workspaceId, id);
    await this.prisma.financing.delete({ where: { id } });
    return { deleted: true };
  }

  async getDashboardSummary(workspaceId: string, id: string) {
    const financing = await this.getOne(workspaceId, id);
    const cdiAnnualRatePct = await this.getCdiAnnualRatePct();

    const paidInstallments = financing.installments.filter(
      (inst) => inst.status === 'PAID'
    );

    const installmentPrincipalPaid = paidInstallments.reduce(
      (sum, inst) => sum + inst.principalAmount,
      0
    );
    const totalInterestPaid = paidInstallments.reduce(
      (sum, inst) => sum + inst.interestAmount,
      0
    );
    const totalFeesPaid = paidInstallments.reduce(
      (sum, inst) =>
        sum + inst.mipAmount + inst.dfiAmount + inst.tsaAmount + inst.fineAmount,
      0
    );
    const totalInstallmentsPaidAmount = paidInstallments.reduce(
      (sum, inst) => sum + (inst.paidAmount > 0 ? inst.paidAmount : inst.totalAmount),
      0
    );
    const totalExtraAmortized = financing.extraAmortizations.reduce(
      (sum, extra) => sum + extra.amount,
      0
    );
    const totalMonthsReducedByExtra = financing.extraAmortizations.reduce(
      (sum, extra) => sum + (extra.installmentsReduced ?? 0),
      0
    );

    const paidMonthsCount = paidInstallments.filter(
      (i) => (i.installmentNumber ?? 0) > 0
    ).length;

    const remainingMonths = Math.max(
      0,
      financing.totalMonths - paidMonthsCount - totalMonthsReducedByExtra
    );

    const realAmortizationPaid =
      installmentPrincipalPaid + totalExtraAmortized > 0
        ? installmentPrincipalPaid + totalExtraAmortized
        : Math.max(0, financing.financedAmount - financing.currentBalance);

    const progressPct =
      financing.financedAmount > 0
        ? Math.min(
            100,
            Math.max(
              0,
              ((financing.financedAmount - financing.currentBalance) /
                financing.financedAmount) *
                100
            )
          )
        : 0;

    let prevBalance = financing.financedAmount;
    let totalTrPaid = 0;

    const evolutionSeries = financing.installments.map((inst) => {
      let factor = inst.monetaryCorrection;
      if (factor > 1.8) factor = factor / 2;
      const trRatePct = factor > 1 ? Number(((factor - 1) * 100).toFixed(4)) : 0;
      const trAmount =
        trRatePct > 0 ? Number((prevBalance * (trRatePct / 100)).toFixed(2)) : 0;

      if (inst.status === 'PAID') {
        totalTrPaid += trAmount;
      }
      if (inst.balanceAfter > 0) {
        prevBalance = inst.balanceAfter;
      }

      return {
        id: inst.id,
        code: inst.installmentCode,
        installmentNumber: inst.installmentNumber,
        month: inst.dueDate.toISOString().slice(0, 7),
        dueDate: inst.dueDate.toISOString().slice(0, 10),
        principal: Number(inst.principalAmount.toFixed(2)),
        interest: Number(inst.interestAmount.toFixed(2)),
        fees: Number(
          (inst.mipAmount + inst.dfiAmount + inst.tsaAmount + inst.fineAmount).toFixed(2)
        ),
        total: Number(inst.totalAmount.toFixed(2)),
        balance: Number(inst.balanceAfter.toFixed(2)),
        status: inst.status,
        trRatePct,
        trAmount,
      };
    });

    return {
      financing,
      kpis: {
        currentBalance: Number(financing.currentBalance.toFixed(2)),
        financedAmount: Number(financing.financedAmount.toFixed(2)),
        realAmortizationPaid: Number(realAmortizationPaid.toFixed(2)),
        installmentPrincipalPaid: Number(installmentPrincipalPaid.toFixed(2)),
        totalExtraAmortized: Number(totalExtraAmortized.toFixed(2)),
        totalInterestPaid: Number(totalInterestPaid.toFixed(2)),
        totalFeesPaid: Number(totalFeesPaid.toFixed(2)),
        totalTrPaid: Number(totalTrPaid.toFixed(2)),
        totalPaidOverall: Number(
          (totalInstallmentsPaidAmount + totalExtraAmortized).toFixed(2)
        ),
        paidInstallmentsCount: paidMonthsCount,
        totalMonths: financing.totalMonths,
        remainingMonths,
        monthsReducedByExtra: totalMonthsReducedByExtra,
        progressPct: Number(progressPct.toFixed(1)),
      },
      fgtsEligibility: computeFgtsEligibility(financing.lastFgtsUsageDate),
      cdiAnnualRatePct,
      evolutionSeries,
    };
  }

  async simulate(workspaceId: string, id: string, dto: SimulateFinancingDto) {
    const summary = await this.getDashboardSummary(workspaceId, id);
    const { financing, kpis } = summary;

    const remainingMonths = Math.max(1, kpis.remainingMonths || financing.totalMonths);
    const extraAmount = dto.extraAmount ?? 10000;
    const monthlyExtra = dto.monthlyExtra ?? 0;
    const annualRatePct = financing.effectiveRateAnnual ?? financing.nominalRateAnnual;

    const regularInstallments = financing.installments.filter(
      (i) => (i.installmentNumber ?? 0) > 0,
    );
    const nextInst =
      regularInstallments.find((i) => i.status === 'PENDING') ??
      [...regularInstallments].reverse().find((i) => i.status === 'PAID');
    const monthlyInsurance =
      financing.monthlyInsurance > 0
        ? financing.monthlyInsurance
        : nextInst
          ? Number((nextInst.mipAmount + nextInst.dfiAmount).toFixed(2))
          : 0;
    const monthlyAdminFee =
      financing.monthlyAdminFee > 0
        ? financing.monthlyAdminFee
        : nextInst
          ? Number(nextInst.tsaAmount.toFixed(2))
          : 0;

    const simulation = simulateAmortization({
      currentBalance: financing.currentBalance,
      annualInterestRatePct: annualRatePct,
      remainingMonths,
      system: financing.system,
      monthlyAdminFee,
      monthlyInsurance,
      extraAmount,
      monthlyExtra,
    });

    const cdiAnnualRatePct = dto.cdiAnnualRatePct ?? summary.cdiAnnualRatePct;

    const comparison = compareAmortizeVsInvest({
      amount: Math.max(1, extraAmount),
      currentBalance: financing.currentBalance,
      financingAnnualRatePct: annualRatePct,
      remainingMonths,
      system: financing.system,
      cdiAnnualRatePct,
      cdiPercentage: dto.cdiPercentage ?? 100,
      investmentType: dto.investmentType ?? 'CDB',
      customAnnualRatePct: dto.customAnnualRatePct,
      horizonMonths: dto.horizonMonths ?? Math.min(60, remainingMonths),
    });

    if (!dto.includeSchedule) {
      return {
        simulation: {
          baseline: { ...simulation.baseline, schedule: [] },
          reduceTerm: { ...simulation.reduceTerm, schedule: [] },
          reduceInstallment: { ...simulation.reduceInstallment, schedule: [] },
        },
        comparison,
      };
    }

    return { simulation, comparison };
  }

  async addExtraAmortization(
    workspaceId: string,
    id: string,
    dto: CreateExtraAmortizationDto
  ) {
    const financing = await this.ensureOwned(workspaceId, id);
    const source = dto.source ?? 'OWN_FUNDS';
    const strategy = dto.strategy ?? 'REDUCE_TERM';
    const extraDate = new Date(dto.date);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.financingExtraAmortization.create({
        data: {
          financingId: id,
          date: extraDate,
          amount: dto.amount,
          strategy,
          source,
          installmentsReduced: dto.installmentsReduced ?? 0,
          notes: dto.notes?.trim() || null,
        },
      });

      const nextBalance = Math.max(
        0,
        Number((financing.currentBalance - dto.amount).toFixed(2))
      );

      const shouldUpdateFgtsDate =
        source === 'FGTS' &&
        (!financing.lastFgtsUsageDate || extraDate > financing.lastFgtsUsageDate);

      const nextFgtsBalance =
        source === 'FGTS'
          ? Math.max(0, Number((financing.fgtsBalance - dto.amount).toFixed(2)))
          : financing.fgtsBalance;

      await tx.financing.update({
        where: { id },
        data: {
          currentBalance: nextBalance,
          ...(shouldUpdateFgtsDate ? { lastFgtsUsageDate: extraDate } : {}),
          fgtsBalance: nextFgtsBalance,
        },
      });

      return created;
    });
  }

  async deleteExtraAmortization(
    workspaceId: string,
    id: string,
    extraId: string
  ) {
    const financing = await this.ensureOwned(workspaceId, id);
    const extra = await this.prisma.financingExtraAmortization.findFirst({
      where: { id: extraId, financingId: id },
    });

    if (!extra) {
      throw new NotFoundException('Amortização extra não encontrada.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.financingExtraAmortization.delete({ where: { id: extraId } });
      await tx.financing.update({
        where: { id },
        data: {
          currentBalance: Number(
            (financing.currentBalance + extra.amount).toFixed(2)
          ),
        },
      });
    });

    return { deleted: true };
  }

  async updateInstallmentStatus(
    workspaceId: string,
    id: string,
    installmentId: string,
    dto: UpdateInstallmentStatusDto
  ) {
    await this.ensureOwned(workspaceId, id);
    const inst = await this.prisma.financingInstallment.findFirst({
      where: { id: installmentId, financingId: id },
    });
    if (!inst) {
      throw new NotFoundException('Parcela não encontrada.');
    }

    return this.prisma.financingInstallment.update({
      where: { id: installmentId },
      data: {
        status: dto.status,
        paidDate:
          dto.status === 'PAID'
            ? dto.paidDate
              ? new Date(dto.paidDate)
              : new Date()
            : null,
        paidAmount:
          dto.status === 'PAID' ? dto.paidAmount ?? inst.totalAmount : 0,
      },
    });
  }

  async previewStatementImport(
    buffer: Buffer,
    fileName?: string,
    password?: string
  ) {
    const text = await this.extractTextFromUpload(buffer, fileName, password);
    return parseFinancingStatementText(text, fileName);
  }

  async confirmStatementImport(
    workspaceId: string,
    payload: ConfirmStatementImportPayload
  ) {
    if (!payload.installments || payload.installments.length === 0) {
      throw new BadRequestException(
        'Nenhuma parcela informada para importação.'
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let financingId = payload.financingId;
      const contract = payload.contract ?? {};

      const fgtsExtras = (payload.extraAmortizations ?? []).filter(
        (e) => e.source === 'FGTS' || e.fgtsAmount > 0
      );
      fgtsExtras.sort((a, b) => b.date.localeCompare(a.date));
      const latestFgtsDate = fgtsExtras[0]?.date
        ? new Date(fgtsExtras[0].date)
        : undefined;

      const lastPaidBalance = [...payload.installments]
        .filter((i) => i.status === 'PAID' && i.endingBalance > 0)
        .pop()?.endingBalance;

      if (financingId) {
        await this.ensureOwned(workspaceId, financingId);
        await tx.financing.update({
          where: { id: financingId },
          data: {
            ...(contract.bankName ? { bankName: contract.bankName } : {}),
            ...(contract.contractNumber
              ? { contractNumber: contract.contractNumber }
              : {}),
            ...(contract.contractDate
              ? { contractDate: new Date(contract.contractDate) }
              : {}),
            ...(contract.releaseDate
              ? { releaseDate: new Date(contract.releaseDate) }
              : {}),
            ...(contract.propertyValue !== undefined
              ? { propertyValue: contract.propertyValue }
              : {}),
            ...(contract.financedAmount !== undefined
              ? { financedAmount: contract.financedAmount }
              : {}),
            ...(contract.currentBalance !== undefined
              ? { currentBalance: contract.currentBalance }
              : lastPaidBalance !== undefined
                ? { currentBalance: lastPaidBalance }
                : {}),
            ...(contract.totalMonths !== undefined
              ? { totalMonths: contract.totalMonths }
              : {}),
            ...(contract.amortizationSystem
              ? { system: contract.amortizationSystem }
              : {}),
            ...(contract.indexer ? { indexer: contract.indexer } : {}),
            ...(contract.nominalAnnualRate !== undefined
              ? { nominalRateAnnual: contract.nominalAnnualRate }
              : {}),
            ...(contract.effectiveAnnualRate !== undefined
              ? { effectiveRateAnnual: contract.effectiveAnnualRate }
              : {}),
            ...(contract.cetAnnualRate !== undefined
              ? { cetAnnual: contract.cetAnnualRate }
              : {}),
            ...(latestFgtsDate ? { lastFgtsUsageDate: latestFgtsDate } : {}),
          },
        });

        if (payload.replaceExistingInstallments !== false) {
          await tx.financingInstallment.deleteMany({
            where: { financingId },
          });
          if ((payload.extraAmortizations ?? []).length > 0) {
            await tx.financingExtraAmortization.deleteMany({
              where: { financingId },
            });
          }
        }
      } else {
        const firstDate = payload.installments[0]?.dueDate
          ? new Date(payload.installments[0].dueDate)
          : new Date();

        const created = await tx.financing.create({
          data: {
            workspaceId,
            name:
              payload.name?.trim() ||
              `Financiamento ${contract.bankName ?? 'Imobiliário'}`,
            bankName: contract.bankName ?? 'Banco',
            contractNumber: contract.contractNumber ?? null,
            contractDate: contract.contractDate
              ? new Date(contract.contractDate)
              : firstDate,
            releaseDate: contract.releaseDate
              ? new Date(contract.releaseDate)
              : null,
            propertyValue: contract.propertyValue ?? contract.financedAmount ?? 0,
            financedAmount: contract.financedAmount ?? 0,
            currentBalance:
              contract.currentBalance ??
              lastPaidBalance ??
              contract.financedAmount ??
              0,
            totalMonths: contract.totalMonths ?? payload.installments.length,
            system: contract.amortizationSystem ?? 'SAC',
            indexer: contract.indexer ?? 'TR',
            nominalRateAnnual:
              contract.nominalAnnualRate ?? contract.effectiveAnnualRate ?? 10,
            effectiveRateAnnual: contract.effectiveAnnualRate ?? null,
            cetAnnual: contract.cetAnnualRate ?? null,
            lastFgtsUsageDate: latestFgtsDate ?? null,
          },
        });
        financingId = created.id;
      }

      // Deduplicate installmentCode inside the batch (keep last occurrence)
      const seenCodes = new Map<string, ParsedInstallment>();
      payload.installments.forEach((inst, idx) => {
        const code = inst.code || String(inst.installmentNumber ?? idx);
        seenCodes.set(code, inst);
      });

      await tx.financingInstallment.createMany({
        data: Array.from(seenCodes.entries()).map(([code, inst]) => ({
          financingId: financingId!,
          installmentCode: code,
          installmentNumber: inst.installmentNumber,
          dueDate: new Date(inst.dueDate),
          paidDate: inst.paidDate ? new Date(inst.paidDate) : null,
          status: inst.status === 'PAID' ? 'PAID' : 'PENDING',
          totalAmount: inst.totalAmount,
          principalAmount: inst.principalAmount,
          interestAmount: inst.interestAmount,
          mipAmount: inst.mipInsurance,
          dfiAmount: inst.dfiInsurance,
          tsaAmount: inst.adminFee,
          fineAmount: inst.penaltyAmount + inst.lateInterest,
          monetaryCorrection:
            inst.balanceCorrection > 0
              ? inst.balanceCorrection
              : inst.indexerCorrection,
          paidAmount: inst.paidAmount ?? 0,
          balanceAfter: inst.endingBalance,
        })),
      });

      if ((payload.extraAmortizations ?? []).length > 0) {
        await tx.financingExtraAmortization.createMany({
          data: (payload.extraAmortizations ?? []).map((extra) => ({
            financingId: financingId!,
            date: new Date(extra.date),
            amount: extra.totalAmount,
            strategy: extra.strategy,
            source: extra.source === 'FGTS' ? 'FGTS' : 'OWN_FUNDS',
            installmentsReduced: extra.monthsReduced ?? 0,
          })),
        });
      }

      return {
        financingId,
        importedInstallments: seenCodes.size,
        importedExtras: (payload.extraAmortizations ?? []).length,
      };
    });
  }

  async previewFgtsStatementImport(
    buffer: Buffer,
    fileName?: string,
    password?: string
  ) {
    const text = await this.extractTextFromUpload(buffer, fileName, password);
    return parseFgtsStatementText(text);
  }

  async getCdiAnnualRatePct(): Promise<number> {
    const now = Date.now();
    if (this.cachedCdi && now - this.cachedCdi.fetchedAt < 3600_000) {
      return this.cachedCdi.ratePct;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json',
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const json = (await res.json()) as Array<{ valor?: string }>;
        const dailyPct = Number(json?.[0]?.valor);
        if (Number.isFinite(dailyPct) && dailyPct > 0) {
          const annualPct = Number(
            ((Math.pow(1 + dailyPct / 100, 252) - 1) * 100).toFixed(2)
          );
          this.cachedCdi = { ratePct: annualPct, fetchedAt: now };
          return annualPct;
        }
      }
    } catch {
      // Fallback safely when offline or BCB API times out
    }

    return this.cachedCdi?.ratePct ?? 14.65;
  }

  private async ensureOwned(workspaceId: string, id: string) {
    const existing = await this.prisma.financing.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Financiamento não encontrado.');
    }
    return existing;
  }

  private async extractTextFromUpload(
    buffer: Buffer,
    fileName?: string,
    password?: string
  ): Promise<string> {
    const isPdf =
      (fileName && fileName.toLowerCase().endsWith('.pdf')) ||
      buffer.subarray(0, 4).toString('utf8') === '%PDF';

    if (!isPdf) {
      return buffer.toString('utf8');
    }

    if (!password) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const parsed = await pdfParse(buffer);
        if (parsed?.text && parsed.text.trim().length > 0) {
          return parsed.text;
        }
      } catch {
        // Fallback to pdfjs-dist below
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      password: password ?? '',
    });

    const pdfDoc = await loadingTask.promise;
    const allLines: string[] = [];

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      allLines.push(...this.reconstructLines(content.items as TextItem[]));
    }

    return allLines.join('\n');
  }

  private reconstructLines(items: TextItem[]): string[] {
    if (!items.length) return [];

    const TOLERANCE = 2.5;
    const groups = new Map<number, { x: number; str: string }[]>();

    for (const item of items) {
      const str = item.str?.trim();
      if (!str) continue;
      const x = item.transform[4];
      const y = item.transform[5];

      let matchedY: number | undefined;
      for (const keyY of groups.keys()) {
        if (Math.abs(keyY - y) <= TOLERANCE) {
          matchedY = keyY;
          break;
        }
      }

      if (matchedY !== undefined) {
        groups.get(matchedY)!.push({ x, str });
      } else {
        groups.set(y, [{ x, str }]);
      }
    }

    const sortedYs = [...groups.keys()].sort((a, b) => b - a);
    return sortedYs.map((y) => {
      const row = groups.get(y)!.sort((a, b) => a.x - b.x);
      return row.map((r) => r.str).join(' ');
    });
  }
}

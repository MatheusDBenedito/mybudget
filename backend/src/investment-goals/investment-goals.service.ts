import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvestmentsService } from '../investments/investments.service';
import {
    CreateInvestmentGoalDto,
    UpdateInvestmentGoalDto,
} from './dto/investment-goal.dto';

@Injectable()
export class InvestmentGoalsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly investmentsService: InvestmentsService,
    ) {}

    async listWithContext(workspaceId: string) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const [goals, cdiAnnualRatePct, investments, fixedTxs] = await Promise.all([
            this.prisma.investmentGoal.findMany({
                where: { workspaceId },
                orderBy: [{ createdAt: 'asc' }],
            }),
            this.investmentsService.getCurrentCdiAnnualPct(),
            this.investmentsService.findAll(workspaceId),
            this.prisma.transaction.findMany({
                where: {
                    workspaceId,
                    isFixed: true,
                    status: { not: 'CANCELLED' },
                    date: { gte: monthStart, lte: monthEnd },
                },
                select: { type: true, amount: true },
            }),
        ]);

        let portfolioNetBalance = 0;
        let fixedIncomeNetBalance = 0;
        for (const inv of investments as Array<any>) {
            const val = Number(inv.netValue ?? inv.currentValue ?? inv.investedAmount ?? 0);
            if (!Number.isFinite(val)) continue;
            portfolioNetBalance += val;
            if (inv.type === 'FIXED_INCOME') {
                fixedIncomeNetBalance += val;
            }
        }

        const suggestedMonthlySalary = fixedTxs
            .filter((t) => t.type === 'INCOME')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const suggestedMonthlyExpense = fixedTxs
            .filter((t) => t.type === 'EXPENSE')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        return {
            goals,
            context: {
                cdiAnnualRatePct,
                portfolioNetBalance: Math.round(portfolioNetBalance * 100) / 100,
                fixedIncomeNetBalance: Math.round(fixedIncomeNetBalance * 100) / 100,
                suggestedMonthlySalary: Math.round(suggestedMonthlySalary * 100) / 100,
                suggestedMonthlyExpense: Math.round(suggestedMonthlyExpense * 100) / 100,
            },
        };
    }

    async create(workspaceId: string, dto: CreateInvestmentGoalDto) {
        return this.prisma.investmentGoal.create({
            data: {
                workspaceId,
                name: dto.name.trim(),
                initialAmount: dto.initialAmount ?? 0,
                usePortfolioAsInitial: dto.usePortfolioAsInitial ?? false,
                monthlySalary: dto.monthlySalary,
                monthlyExpense: dto.monthlyExpense ?? 0,
                emergencyReserveMonths: dto.emergencyReserveMonths ?? 6,
                savingsRatePct: dto.savingsRatePct,
                cdiPercentage: dto.cdiPercentage ?? 100,
                cdiAnnualRatePct: dto.cdiAnnualRatePct ?? null,
                horizonMonths: dto.horizonMonths ?? 120,
                targetAmount: dto.targetAmount ?? null,
                startMonth: dto.startMonth ?? null,
                startYear: dto.startYear ?? null,
                notes: dto.notes?.trim() || null,
            },
        });
    }

    async update(workspaceId: string, id: string, dto: UpdateInvestmentGoalDto) {
        const existing = await this.prisma.investmentGoal.findFirst({
            where: { id, workspaceId },
        });
        if (!existing) {
            throw new NotFoundException('Meta não encontrada.');
        }

        return this.prisma.investmentGoal.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.initialAmount !== undefined ? { initialAmount: dto.initialAmount } : {}),
                ...(dto.usePortfolioAsInitial !== undefined
                    ? { usePortfolioAsInitial: dto.usePortfolioAsInitial }
                    : {}),
                ...(dto.monthlySalary !== undefined ? { monthlySalary: dto.monthlySalary } : {}),
                ...(dto.monthlyExpense !== undefined ? { monthlyExpense: dto.monthlyExpense } : {}),
                ...(dto.emergencyReserveMonths !== undefined
                    ? { emergencyReserveMonths: dto.emergencyReserveMonths }
                    : {}),
                ...(dto.savingsRatePct !== undefined ? { savingsRatePct: dto.savingsRatePct } : {}),
                ...(dto.cdiPercentage !== undefined ? { cdiPercentage: dto.cdiPercentage } : {}),
                ...(dto.cdiAnnualRatePct !== undefined ? { cdiAnnualRatePct: dto.cdiAnnualRatePct } : {}),
                ...(dto.horizonMonths !== undefined ? { horizonMonths: dto.horizonMonths } : {}),
                ...(dto.targetAmount !== undefined ? { targetAmount: dto.targetAmount } : {}),
                ...(dto.startMonth !== undefined ? { startMonth: dto.startMonth } : {}),
                ...(dto.startYear !== undefined ? { startYear: dto.startYear } : {}),
                ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
            },
        });
    }

    async remove(workspaceId: string, id: string) {
        const existing = await this.prisma.investmentGoal.findFirst({
            where: { id, workspaceId },
        });
        if (!existing) {
            throw new NotFoundException('Meta não encontrada.');
        }
        await this.prisma.investmentGoal.delete({ where: { id } });
        return { deleted: true, id };
    }
}

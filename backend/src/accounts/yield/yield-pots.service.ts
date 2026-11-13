import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePotDto, UpdatePotDto } from '../dto/pot.dto';
import { AccountYieldService, MAIN_BUCKET } from './account-yield.service';
import { toDateKey } from './account-yield.calculator';

const round2 = (v: number) => Math.round(v * 100) / 100;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatKey = (key: string) => key.split('-').reverse().join('/');

/**
 * Cofrinhos inside a yielding account. The account balance stays the total (free balance + pots):
 * guardar/retirar only moves money between the free balance and a pot.
 * Pots can be created, and money moved, on past dates: the yields are then recalculated from that day.
 */
@Injectable()
export class YieldPotsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly yields: AccountYieldService,
    ) { }

    private async yieldingAccount(workspaceId: string, accountId: string) {
        const account = await this.prisma.account.findFirst({ where: { id: accountId, workspaceId }, include: { pots: true } });
        if (!account) throw new NotFoundException(`Account with ID ${accountId} not found`);
        if (account.type !== 'YIELDING') {
            throw new BadRequestException('Cofrinhos só existem em contas remuneradas.');
        }
        return account;
    }

    private async pot(workspaceId: string, potId: string) {
        const pot = await this.prisma.yieldPot.findFirst({
            where: { id: potId, account: { workspaceId } },
            include: { movements: true },
        });
        if (!pot) throw new NotFoundException(`Cofrinho ${potId} não encontrado`);
        return pot;
    }

    private freeBalance(account: { balance: number; pots: { balance: number }[] }) {
        return round2(account.balance - account.pots.reduce((acc, p) => acc + p.balance, 0));
    }

    /** Day of the operation (today by default, never in the future), stored at local noon so the day never shifts. */
    private resolveDate(input?: string): { key: string; date: Date; past: boolean } {
        const todayKey = toDateKey(new Date());
        const key = input ? input.slice(0, 10) : todayKey;
        if (key > todayKey) throw new BadRequestException('A data não pode ser futura.');
        return { key, date: key === todayKey ? new Date() : new Date(`${key}T12:00:00`), past: key < todayKey };
    }

    /** Free balance available on `key`: today's free balance without the free-balance yield credited since then. */
    private async freeBalanceOn(account: { id: string; balance: number; pots: { balance: number }[] }, key: string) {
        return round2(this.freeBalance(account) - await this.yields.creditedSince(account.id, MAIN_BUCKET, key));
    }

    async list(workspaceId: string, accountId: string) {
        const account = await this.prisma.account.findFirst({ where: { id: accountId, workspaceId }, select: { id: true } });
        if (!account) throw new NotFoundException(`Account with ID ${accountId} not found`);
        return this.prisma.yieldPot.findMany({ where: { accountId }, orderBy: { createdAt: 'asc' } });
    }

    async create(workspaceId: string, accountId: string, dto: CreatePotDto) {
        const account = await this.yieldingAccount(workspaceId, accountId);
        const when = this.resolveDate(dto.date);
        const initial = round2(dto.initialAmount ?? 0);
        if (initial > 0) {
            const free = await this.freeBalanceOn(account, when.key);
            if (initial > free + 0.005) throw new BadRequestException(`Saldo livre insuficiente em ${formatKey(when.key)} (${brl(free)}).`);
        }

        const pot = await this.prisma.yieldPot.create({
            data: {
                accountId,
                name: dto.name.trim(),
                cdiPercentage: dto.cdiPercentage,
                balance: initial,
                createdAt: when.date,
                ...(initial > 0 ? { movements: { create: { amount: initial, date: when.date } } } : {}),
            },
        });
        return this.afterChange(accountId, pot.id, when);
    }

    /** A new % of CDI applies since the pot was created: its yields are recalculated from that day. */
    async update(workspaceId: string, potId: string, dto: UpdatePotDto) {
        const pot = await this.pot(workspaceId, potId);
        const updated = await this.prisma.yieldPot.update({
            where: { id: potId },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.cdiPercentage !== undefined ? { cdiPercentage: dto.cdiPercentage } : {}),
            },
        });
        if (dto.cdiPercentage !== undefined && dto.cdiPercentage !== pot.cdiPercentage) {
            const createdKey = toDateKey(pot.createdAt);
            return this.afterChange(pot.accountId, potId, { key: createdKey, past: createdKey < toDateKey(new Date()) });
        }
        return updated;
    }

    /** Deleting a pot returns its balance to the account's free balance (the account total is unchanged). */
    async remove(workspaceId: string, potId: string) {
        await this.pot(workspaceId, potId);
        return this.prisma.yieldPot.delete({ where: { id: potId } });
    }

    /** Guardar: free balance -> pot, on `date` (today by default). */
    async deposit(workspaceId: string, potId: string, amount: number, date?: string) {
        const pot = await this.pot(workspaceId, potId);
        const account = await this.yieldingAccount(workspaceId, pot.accountId);
        const when = this.resolveDate(date);
        this.ensureAfterCreation(pot, when.key);

        const value = round2(amount);
        const free = await this.freeBalanceOn(account, when.key);
        if (value > free + 0.005) throw new BadRequestException(`Saldo livre insuficiente em ${formatKey(when.key)} (${brl(free)}).`);

        await this.prisma.$transaction([
            this.prisma.yieldPot.update({ where: { id: potId }, data: { balance: { increment: value } } }),
            this.prisma.potMovement.create({ data: { potId, amount: value, date: when.date } }),
        ]);
        return this.afterChange(pot.accountId, potId, when);
    }

    /** Retirar: pot -> free balance, on `date` (today by default). */
    async withdraw(workspaceId: string, potId: string, amount: number, date?: string) {
        const pot = await this.pot(workspaceId, potId);
        const when = this.resolveDate(date);
        this.ensureAfterCreation(pot, when.key);

        const value = round2(amount);
        const available = await this.potBalanceOn(pot, when.key);
        if (value > available + 0.005) {
            throw new BadRequestException(when.past
                ? `Em ${formatKey(when.key)} o cofrinho tinha ${brl(available)} disponível.`
                : `O cofrinho tem apenas ${brl(available)}.`);
        }

        await this.prisma.$transaction([
            this.prisma.yieldPot.update({ where: { id: potId }, data: { balance: { decrement: value } } }),
            this.prisma.potMovement.create({ data: { potId, amount: -value, date: when.date } }),
        ]);
        return this.afterChange(pot.accountId, potId, when);
    }

    /**
     * Sets the pot balance to what the bank app shows. The difference is recorded today as an adjustment:
     * it changes the pot and the account total, but not the free balance, and the daily yield continues from it.
     */
    async adjust(workspaceId: string, potId: string, targetBalance: number) {
        const pot = await this.pot(workspaceId, potId);
        const delta = round2(round2(targetBalance) - pot.balance);
        if (Math.abs(delta) < 0.005) return this.prisma.yieldPot.findUnique({ where: { id: potId } });

        await this.prisma.$transaction([
            this.prisma.yieldPot.update({ where: { id: potId }, data: { balance: { increment: delta } } }),
            this.prisma.account.update({ where: { id: pot.accountId }, data: { balance: { increment: delta } } }),
            this.prisma.potMovement.create({ data: { potId, amount: delta, kind: 'adjustment', date: new Date() } }),
        ]);
        return this.prisma.yieldPot.findUnique({ where: { id: potId } });
    }

    private ensureAfterCreation(pot: { createdAt: Date }, key: string) {
        const createdKey = toDateKey(pot.createdAt);
        if (key < createdKey) throw new BadRequestException(`O cofrinho foi criado em ${formatKey(createdKey)}: use essa data ou uma posterior.`);
    }

    /**
     * What can be withdrawn on `key`: the pot balance without the yield credited since then, and without
     * money deposited after that day (it wasn't in the pot yet).
     */
    private async potBalanceOn(pot: { id: string; accountId: string; balance: number; movements: { amount: number; date: Date }[] }, key: string) {
        const withoutLaterYield = round2(pot.balance - await this.yields.creditedSince(pot.accountId, pot.id, key));
        const laterMovements = pot.movements.filter(m => toDateKey(m.date) > key).reduce((acc, m) => acc + m.amount, 0);
        return round2(Math.min(withoutLaterYield, withoutLaterYield - laterMovements));
    }

    /** Past-dated changes recalculate the yields from that day; returns the pot with its updated balance. */
    private async afterChange(accountId: string, potId: string, when: { key: string; past: boolean }) {
        if (when.past) await this.yields.recomputeFrom(accountId, when.key);
        return this.prisma.yieldPot.findUnique({ where: { id: potId } });
    }
}

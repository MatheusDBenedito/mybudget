import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransferDto } from './dto/transfer.dto';
import { toDateKey } from './yield/account-yield.calculator';

const round2 = (v: number) => Math.round(v * 100) / 100;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Transfers between the user's own accounts. They only move balance: never income or expense,
 * so cash flow and reports are unaffected. In yielding accounts the money comes from / goes to the
 * free balance (never a pot), and an incoming transfer starts a new IR lot on its date.
 */
@Injectable()
export class TransfersService {
    constructor(private readonly prisma: PrismaService) { }

    list(limit = 30) {
        return this.prisma.accountTransfer.findMany({
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            take: limit,
            include: {
                fromAccount: { select: { id: true, name: true } },
                toAccount: { select: { id: true, name: true } },
            },
        });
    }

    async create(dto: CreateTransferDto) {
        if (dto.fromAccountId === dto.toAccountId) {
            throw new BadRequestException('Escolha contas diferentes para origem e destino.');
        }
        const amount = round2(dto.amount);
        const date = this.resolveDate(dto.date);

        const [from, to] = await Promise.all([this.account(dto.fromAccountId), this.account(dto.toAccountId)]);
        this.ensureAvailable(from, amount, 'origem');

        const [transfer] = await this.prisma.$transaction([
            this.prisma.accountTransfer.create({
                data: {
                    fromAccountId: from.id,
                    toAccountId: to.id,
                    amount,
                    date,
                    description: dto.description?.trim() || null,
                },
            }),
            this.prisma.account.update({ where: { id: from.id }, data: { balance: { decrement: amount } } }),
            this.prisma.account.update({ where: { id: to.id }, data: { balance: { increment: amount } } }),
        ]);
        return transfer;
    }

    /** Undo: the money goes back to the source account. */
    async remove(id: string) {
        const transfer = await this.prisma.accountTransfer.findUnique({ where: { id } });
        if (!transfer) throw new NotFoundException(`Transferência ${id} não encontrada`);

        const to = await this.account(transfer.toAccountId);
        this.ensureAvailable(to, transfer.amount, 'destino');

        await this.prisma.$transaction([
            this.prisma.account.update({ where: { id: transfer.toAccountId }, data: { balance: { decrement: transfer.amount } } }),
            this.prisma.account.update({ where: { id: transfer.fromAccountId }, data: { balance: { increment: transfer.amount } } }),
            this.prisma.accountTransfer.delete({ where: { id } }),
        ]);
        return transfer;
    }

    private async account(id: string) {
        const account = await this.prisma.account.findUnique({ where: { id }, include: { pots: { select: { balance: true } } } });
        if (!account) throw new BadRequestException('Conta informada não encontrada.');
        return account;
    }

    /** Money kept in cofrinhos can't leave the account directly: it must be withdrawn from the pot first. */
    private ensureAvailable(account: { name: string; type: string; balance: number; pots: { balance: number }[] }, amount: number, role: string) {
        if (account.type !== 'YIELDING' || account.pots.length === 0) return;
        const free = round2(account.balance - account.pots.reduce((acc, p) => acc + p.balance, 0));
        if (amount > free + 0.005) {
            throw new BadRequestException(
                `A conta de ${role} (${account.name.trim()}) tem ${brl(free)} fora dos cofrinhos. Retire do cofrinho antes de transferir.`,
            );
        }
    }

    /** Stored at local noon so the calendar day never shifts with the timezone; future dates are not allowed. */
    private resolveDate(input?: string): Date {
        const todayKey = toDateKey(new Date());
        const key = input ? input.slice(0, 10) : todayKey;
        if (key > todayKey) throw new BadRequestException('A data da transferência não pode ser futura.');
        return new Date(`${key}T12:00:00`);
    }
}

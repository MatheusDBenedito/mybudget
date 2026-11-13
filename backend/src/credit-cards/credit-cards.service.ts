import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCreditCardDto } from './dto/create-credit-card.dto';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto';

@Injectable()
export class CreditCardsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(workspaceId: string, createCreditCardDto: CreateCreditCardDto) {
        const account = await this.prisma.account.findFirst({ where: { workspaceId } });

        if (!account) {
            throw new NotFoundException('Por favor, crie uma Conta Corrente antes de adicionar cartões.');
        }

        // The first card becomes the favorite, so the summary always has something to show
        const hasPrimary = await this.prisma.creditCard.findFirst({ where: { workspaceId, isPrimary: true } });

        const holderName = createCreditCardDto.holderName?.trim() || 'Titular';

        return this.prisma.creditCard.create({
            data: {
                workspaceId,
                name: createCreditCardDto.name,
                limit: createCreditCardDto.limit,
                invoiceClosingOffset: createCreditCardDto.invoiceClosingOffset,
                dueDay: createCreditCardDto.dueDay,
                color: createCreditCardDto.color,
                pointsPerDollar: createCreditCardDto.pointsPerDollar,
                loyaltyProgram: createCreditCardDto.loyaltyProgram?.trim() || null,
                isPrimary: !hasPrimary,
                accountId: account.id,
                holders: {
                    create: {
                        name: holderName,
                        isMain: true,
                    },
                },
            },
            include: {
                holders: {
                    orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
                },
            },
        });
    }

    async findAll(workspaceId: string) {
        return this.prisma.creditCard.findMany({
            where: { workspaceId },
            orderBy: [
                { isPrimary: 'desc' },
                { createdAt: 'desc' },
            ],
            include: {
                holders: {
                    orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
                },
            },
        });
    }

    /** Makes this card the only favorite (and therefore the one featured on the summary). */
    async setPrimary(workspaceId: string, id: string) {
        const card = await this.prisma.creditCard.findFirst({ where: { id, workspaceId } });
        if (!card) {
            throw new NotFoundException('Cartão não encontrado.');
        }

        const [, updated] = await this.prisma.$transaction([
            this.prisma.creditCard.updateMany({
                where: { workspaceId, isPrimary: true, id: { not: id } },
                data: { isPrimary: false },
            }),
            this.prisma.creditCard.update({
                where: { id },
                data: { isPrimary: true },
            }),
        ]);
        return updated;
    }

    async update(workspaceId: string, id: string, updateCreditCardDto: UpdateCreditCardDto) {
        const card = await this.prisma.creditCard.findFirst({ where: { id, workspaceId } });
        if (!card) {
            throw new NotFoundException('Cartão não encontrado.');
        }

        return this.prisma.creditCard.update({
            where: { id },
            data: {
                name: updateCreditCardDto.name,
                limit: updateCreditCardDto.limit,
                invoiceClosingOffset: updateCreditCardDto.invoiceClosingOffset,
                dueDay: updateCreditCardDto.dueDay,
                color: updateCreditCardDto.color,
                pointsPerDollar: updateCreditCardDto.pointsPerDollar,
                // undefined keeps the current value; an empty string clears it
                loyaltyProgram: updateCreditCardDto.loyaltyProgram === undefined
                    ? undefined
                    : updateCreditCardDto.loyaltyProgram.trim() || null,
            },
            include: {
                holders: {
                    orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
                },
            },
        });
    }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCreditCardDto } from './dto/create-credit-card.dto';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto';

@Injectable()
export class CreditCardsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createCreditCardDto: CreateCreditCardDto) {
        // Para simplificar no MVP, como o usuário não tem sistema de login ainda,
        // vamos atrelar o cartão à primeira conta bancária existente.
        const account = await this.prisma.account.findFirst();

        if (!account) {
            throw new NotFoundException('Por favor, crie uma Conta Corrente antes de adicionar cartões.');
        }

        return this.prisma.creditCard.create({
            data: {
                name: createCreditCardDto.name,
                limit: createCreditCardDto.limit,
                invoiceClosingOffset: createCreditCardDto.invoiceClosingOffset,
                dueDay: createCreditCardDto.dueDay,
                color: createCreditCardDto.color,
                accountId: account.id,
            },
        });
    }

    async findAll() {
        return this.prisma.creditCard.findMany({
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async update(id: string, updateCreditCardDto: UpdateCreditCardDto) {
        return this.prisma.creditCard.update({
            where: { id },
            data: {
                name: updateCreditCardDto.name,
                limit: updateCreditCardDto.limit,
                invoiceClosingOffset: updateCreditCardDto.invoiceClosingOffset,
                dueDay: updateCreditCardDto.dueDay,
                color: updateCreditCardDto.color,
            },
        });
    }
}

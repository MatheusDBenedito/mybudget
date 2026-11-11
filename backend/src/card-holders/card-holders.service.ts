import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCardHolderDto } from './dto/create-card-holder.dto';
import { UpdateCardHolderDto } from './dto/update-card-holder.dto';

@Injectable()
export class CardHoldersService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(creditCardId: string) {
        await this.ensureCard(creditCardId);

        return this.prisma.cardHolder.findMany({
            where: { creditCardId },
            orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
        });
    }

    async create(creditCardId: string, dto: CreateCardHolderDto) {
        await this.ensureCard(creditCardId);

        const name = dto.name.trim();
        if (!name) {
            throw new BadRequestException('Informe o nome do portador.');
        }

        try {
            return await this.prisma.$transaction(async (tx) => {
                const holderCount = await tx.cardHolder.count({ where: { creditCardId } });
                const isMain = holderCount === 0 ? true : !!dto.isMain;

                if (isMain) {
                    await tx.cardHolder.updateMany({
                        where: { creditCardId, isMain: true },
                        data: { isMain: false },
                    });
                }

                return tx.cardHolder.create({
                    data: {
                        creditCardId,
                        name,
                        last4: dto.last4 || null,
                        isMain,
                    },
                });
            });
        } catch (error) {
            this.rethrowUniqueName(error);
        }
    }

    async update(creditCardId: string, id: string, dto: UpdateCardHolderDto) {
        const holder = await this.findHolder(creditCardId, id);

        if (dto.isMain === false && holder.isMain) {
            throw new BadRequestException(
                'Escolha outro portador como titular antes de remover o titular atual.',
            );
        }

        const name = dto.name === undefined ? undefined : dto.name.trim();
        if (name !== undefined && !name) {
            throw new BadRequestException('Informe o nome do portador.');
        }

        try {
            return await this.prisma.$transaction(async (tx) => {
                if (dto.isMain === true) {
                    await tx.cardHolder.updateMany({
                        where: { creditCardId, isMain: true, id: { not: id } },
                        data: { isMain: false },
                    });
                }

                return tx.cardHolder.update({
                    where: { id },
                    data: {
                        name,
                        last4: dto.last4 === undefined ? undefined : dto.last4 || null,
                        isMain: dto.isMain,
                    },
                });
            });
        } catch (error) {
            this.rethrowUniqueName(error);
        }
    }

    async remove(creditCardId: string, id: string) {
        const holder = await this.findHolder(creditCardId, id);

        const transactionCount = await this.prisma.cardTransaction.count({
            where: { cardHolderId: id },
        });

        if (transactionCount > 0) {
            throw new ConflictException(
                'Este portador possui lançamentos e não pode ser excluído.',
            );
        }

        if (holder.isMain) {
            throw new ConflictException(
                'O titular não pode ser excluído. Defina outro portador como titular primeiro.',
            );
        }

        return this.prisma.cardHolder.delete({ where: { id } });
    }

    private async ensureCard(creditCardId: string) {
        const card = await this.prisma.creditCard.findUnique({
            where: { id: creditCardId },
            select: { id: true },
        });

        if (!card) {
            throw new NotFoundException('Cartão não encontrado.');
        }
    }

    private async findHolder(creditCardId: string, id: string) {
        const holder = await this.prisma.cardHolder.findFirst({
            where: { id, creditCardId },
        });

        if (!holder) {
            throw new NotFoundException('Portador não encontrado neste cartão.');
        }

        return holder;
    }

    private rethrowUniqueName(error: unknown): never {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002'
        ) {
            throw new ConflictException('Já existe um portador com esse nome neste cartão.');
        }

        throw error;
    }
}

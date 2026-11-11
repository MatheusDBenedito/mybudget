import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMilesEntryDto } from './dto/create-miles-entry.dto';
import { UpdateMilesEntryDto } from './dto/update-miles-entry.dto';

const CARD_SELECT = { select: { id: true, name: true, color: true } } as const;

@Injectable()
export class MilesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateMilesEntryDto) {
        const creditCardId = dto.creditCardId || null;
        const origin = dto.origin?.trim() || null;
        if (!creditCardId && !origin) {
            throw new BadRequestException('Informe a origem dos pontos (um cartão ou uma descrição).');
        }
        if (creditCardId) {
            await this.ensureCardExists(creditCardId);
        }

        return this.prisma.milesEntry.create({
            data: {
                program: dto.program.trim(),
                points: dto.points,
                status: dto.status,
                expectedCreditDate: new Date(dto.expectedCreditDate),
                creditCardId,
                origin,
                referenceMonth: dto.referenceMonth,
                referenceYear: dto.referenceYear,
                notes: dto.notes?.trim() || null,
            },
            include: { creditCard: CARD_SELECT },
        });
    }

    findAll() {
        return this.prisma.milesEntry.findMany({
            orderBy: [{ expectedCreditDate: 'asc' }, { createdAt: 'desc' }],
            include: { creditCard: CARD_SELECT },
        });
    }

    async update(id: string, dto: UpdateMilesEntryDto) {
        const existing = await this.prisma.milesEntry.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException(`Lançamento de milhas ${id} não encontrado.`);
        }

        // Validate the origin against the merged state so a partial update cannot leave it empty
        const creditCardId = dto.creditCardId === undefined ? existing.creditCardId : dto.creditCardId || null;
        const origin = dto.origin === undefined ? existing.origin : dto.origin?.trim() || null;
        if (!creditCardId && !origin) {
            throw new BadRequestException('Informe a origem dos pontos (um cartão ou uma descrição).');
        }
        if (dto.creditCardId) {
            await this.ensureCardExists(dto.creditCardId);
        }

        return this.prisma.milesEntry.update({
            where: { id },
            data: {
                program: dto.program?.trim(),
                points: dto.points,
                status: dto.status,
                expectedCreditDate: dto.expectedCreditDate ? new Date(dto.expectedCreditDate) : undefined,
                creditCardId,
                origin,
                referenceMonth: dto.referenceMonth,
                referenceYear: dto.referenceYear,
                notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
            },
            include: { creditCard: CARD_SELECT },
        });
    }

    async remove(id: string) {
        const existing = await this.prisma.milesEntry.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException(`Lançamento de milhas ${id} não encontrado.`);
        }
        return this.prisma.milesEntry.delete({ where: { id } });
    }

    private async ensureCardExists(creditCardId: string) {
        const card = await this.prisma.creditCard.findUnique({ where: { id: creditCardId }, select: { id: true } });
        if (!card) {
            throw new BadRequestException('Cartão de origem não encontrado.');
        }
    }
}

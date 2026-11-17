import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMilesEntryDto } from './dto/create-miles-entry.dto';
import { UpdateMilesEntryDto } from './dto/update-miles-entry.dto';
import { mergeMilesProgramRates, normalizeMilesProgramRates } from './helpers/miles-valuation.helper';

const CARD_SELECT = { select: { id: true, name: true, color: true } } as const;

@Injectable()
export class MilesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(workspaceId: string, dto: CreateMilesEntryDto) {
        const creditCardId = dto.creditCardId || null;
        const origin = dto.origin?.trim() || null;
        if (!creditCardId && !origin) {
            throw new BadRequestException('Informe a origem dos pontos (um cartão ou uma descrição).');
        }
        if (creditCardId) {
            await this.ensureCardExists(workspaceId, creditCardId);
        }

        return this.prisma.milesEntry.create({
            data: {
                workspaceId,
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

    findAll(workspaceId: string) {
        return this.prisma.milesEntry.findMany({
            where: { workspaceId },
            orderBy: [{ expectedCreditDate: 'asc' }, { createdAt: 'desc' }],
            include: { creditCard: CARD_SELECT },
        });
    }

    async update(workspaceId: string, id: string, dto: UpdateMilesEntryDto) {
        const existing = await this.prisma.milesEntry.findFirst({ where: { id, workspaceId } });
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
            await this.ensureCardExists(workspaceId, dto.creditCardId);
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

    async remove(workspaceId: string, id: string) {
        const existing = await this.prisma.milesEntry.findFirst({ where: { id, workspaceId } });
        if (!existing) {
            throw new NotFoundException(`Lançamento de milhas ${id} não encontrado.`);
        }
        return this.prisma.milesEntry.delete({ where: { id } });
    }

    async getValuations(workspaceId: string): Promise<{ rates: Record<string, number> }> {
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { milesProgramRates: true },
        });
        return {
            rates: mergeMilesProgramRates(workspace?.milesProgramRates),
        };
    }

    async updateValuations(workspaceId: string, rates: Record<string, number>): Promise<{ rates: Record<string, number> }> {
        const sanitized = normalizeMilesProgramRates(rates);
        const updated = await this.prisma.workspace.update({
            where: { id: workspaceId },
            data: { milesProgramRates: sanitized },
            select: { milesProgramRates: true },
        });
        return {
            rates: mergeMilesProgramRates(updated.milesProgramRates),
        };
    }

    private async ensureCardExists(workspaceId: string, creditCardId: string) {
        const card = await this.prisma.creditCard.findFirst({ where: { id: creditCardId, workspaceId }, select: { id: true } });
        if (!card) {
            throw new BadRequestException('Cartão de origem não encontrado neste workspace.');
        }
    }
}

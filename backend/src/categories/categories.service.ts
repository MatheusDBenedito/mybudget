import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(workspaceId: string) {
        return this.prisma.category.findMany({
            where: { workspaceId },
            orderBy: { name: 'asc' },
        });
    }

    async create(workspaceId: string, createCategoryDto: CreateCategoryDto) {
        return this.prisma.category.create({
            data: { ...createCategoryDto, workspaceId },
        });
    }

    async update(workspaceId: string, id: string, updateCategoryDto: UpdateCategoryDto) {
        const existing = await this.prisma.category.findFirst({ where: { id, workspaceId } });
        if (!existing) throw new NotFoundException('Categoria não encontrada neste workspace.');
        return this.prisma.category.update({
            where: { id },
            data: updateCategoryDto,
        });
    }

    async remove(workspaceId: string, id: string) {
        const existing = await this.prisma.category.findFirst({ where: { id, workspaceId } });
        if (!existing) throw new NotFoundException('Categoria não encontrada neste workspace.');

        const relatedTransactions = await this.prisma.transaction.count({
            where: { categoryId: id, workspaceId },
        });
        const relatedCardTransactions = await this.prisma.cardTransaction.count({
            where: { categoryId: id, workspaceId },
        });
        const relatedRecurringExpenses = await this.prisma.recurringExpense.count({
            where: { categoryId: id, workspaceId },
        });

        if (relatedTransactions > 0 || relatedCardTransactions > 0 || relatedRecurringExpenses > 0) {
            throw new BadRequestException(
                'Esta categoria não pode ser excluída pois está associada a transações ou despesas recorrentes.',
            );
        }

        return this.prisma.category.delete({ where: { id } });
    }
}

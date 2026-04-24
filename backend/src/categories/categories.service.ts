import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        return this.prisma.category.findMany({
            orderBy: {
                name: 'asc',
            },
        });
    }

    async create(createCategoryDto: CreateCategoryDto) {
        return this.prisma.category.create({
            data: createCategoryDto,
        });
    }

    async update(id: string, updateCategoryDto: UpdateCategoryDto) {
        return this.prisma.category.update({
            where: { id },
            data: updateCategoryDto,
        });
    }

    async remove(id: string) {
        // Checking for related entities to prevent foreign key errors and orphan data
        const relatedTransactions = await this.prisma.transaction.count({ where: { categoryId: id } });
        const relatedCardTransactions = await this.prisma.cardTransaction.count({ where: { categoryId: id } });
        const relatedRecurringExpenses = await this.prisma.recurringExpense.count({ where: { categoryId: id } });

        if (relatedTransactions > 0 || relatedCardTransactions > 0 || relatedRecurringExpenses > 0) {
            throw new BadRequestException('Esta categoria não pode ser excluída pois está associada a transações ou despesas recorrentes.');
        }

        return this.prisma.category.delete({
            where: { id },
        });
    }
}

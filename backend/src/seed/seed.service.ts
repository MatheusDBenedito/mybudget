import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeedService {
    private readonly logger = new Logger(SeedService.name);

    constructor(private readonly prisma: PrismaService) { }

    async executeSeed() {
        this.logger.warn('Seed function triggered! Wipe is starting...');

        // 1. Apagar tudo usando TRANSACTION para evitar dados órfãos se algo falhar
        // Ordem inversa de dependência (Filhos primeiro)
        await this.prisma.$transaction([
            this.prisma.cardTransaction.deleteMany(),
            this.prisma.transaction.deleteMany(),
            this.prisma.recurringExpense.deleteMany(),
            this.prisma.creditCard.deleteMany(),
            this.prisma.category.deleteMany(),
            this.prisma.account.deleteMany(),
        ]);

        this.logger.log('Database wiped successfully.');

        // 2. Criar a Conta Default do usuário
        const account = await this.prisma.account.create({
            data: {
                name: 'Minha Conta Principal',
                balance: 5000, // Saldo inicial para empolgar
            },
        });

        // 3. Criar Categorias Padrões de Múltiplos Tipos
        const incomeCategories = [
            { name: 'Salário', color: '#10B981' },
            { name: 'Rendimentos', color: '#34D399' },
            { name: 'Freelance', color: '#059669' },
        ];

        const expenseCategories = [
            { name: 'Alimentação', color: '#EF4444' },
            { name: 'Transporte', color: '#F59E0B' },
            { name: 'Lazer', color: '#3B82F6' },
            { name: 'Saúde', color: '#EC4899' },
            { name: 'Moradia', color: '#6366F1' },
            { name: 'Educação', color: '#8B5CF6' },
        ];

        await Promise.all([
            ...incomeCategories.map((cat) =>
                this.prisma.category.create({ data: { name: cat.name, color: cat.color } })
            ),
            ...expenseCategories.map((cat) =>
                this.prisma.category.create({ data: { name: cat.name, color: cat.color } })
            ),
        ]);

        this.logger.log('Default Categories seeded.');

        // 4. Criar um Cartão de Crédito Padrão 
        await this.prisma.creditCard.create({
            data: {
                name: 'Nubank Platinum',
                limit: 8000,
                invoiceClosingOffset: 7,
                dueDay: 5,
                accountId: account.id,
            },
        });

        this.logger.log('Default Credit Card seeded.');

        return {
            message: 'Seed executed successfully!',
            status: 'DB_READY',
        };
    }
}

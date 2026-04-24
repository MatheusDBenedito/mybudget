import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCardTransactionDto } from './dto/create-card-transaction.dto';
import { UpdateCardTransactionDto } from './dto/update-card-transaction.dto';
import { calculateInvoiceDate } from '../credit-cards/helpers/invoice-calculator.helper';
import { distributeInstallments } from '../common/helpers/penny-pinching.helper';
import { addMonths } from 'date-fns';
import { randomUUID } from 'crypto';

@Injectable()
export class CardTransactionsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createDto: CreateCardTransactionDto) {
        // 1. Fetch the credit card details to get closingDay and dueDay
        const creditCard = await this.prisma.creditCard.findUnique({
            where: { id: createDto.creditCardId },
        });

        if (!creditCard) {
            throw new NotFoundException(`Credit Card with ID ${createDto.creditCardId} not found`);
        }

        // 2. Compute distributed amounts for each installment to prevent penny dropping
        const installmentsCount = createDto.isFixed ? 1 : (createDto.installments ?? 1);
        const distributedAmounts = distributeInstallments(createDto.amount, installmentsCount);

        // 3. Prepare data array for N flat records
        const transactionRecords = [];
        const basePurchaseDate = new Date(createDto.date);

        // Link all installments together using a unique group UUID
        const installmentGroupId = installmentsCount > 1 ? randomUUID() : null;

        for (let i = 0; i < installmentsCount; i++) {
            // Increment the purchase date virtually by N months 
            // Example: Buying in January in 3x
            // Installment 1 -> Treated as purchased in Jan
            // Installment 2 -> Treated as purchased in Feb
            // Installment 3 -> Treated as purchased in Mar
            const simulatedPurchaseDate = addMonths(basePurchaseDate, i);

            // Compute Invoice reference Date for the simulated date
            const invoiceDate = calculateInvoiceDate(
                simulatedPurchaseDate,
                creditCard.invoiceClosingOffset,
                creditCard.dueDay,
            );

            transactionRecords.push({
                description: installmentsCount > 1 ? `${createDto.description} (${i + 1}/${installmentsCount})` : createDto.description,
                amount: distributedAmounts[i],
                date: basePurchaseDate, // Keep the original true purchase date for logging
                invoiceDate: invoiceDate, // Distribute across future invoices based on simulated month
                installments: installmentsCount,
                creditCardId: createDto.creditCardId,
                categoryId: createDto.categoryId,
                installmentGroupId: installmentGroupId,
                isFixed: createDto.isFixed ?? false,
            });
        }

        // 4. Save to Database exactly as N Flat Records using Prisma Transaction
        const results = await this.prisma.$transaction(
            transactionRecords.map((record) =>
                this.prisma.cardTransaction.create({ data: record }),
            )
        );

        return results;
    }

    /**
     * Imports a transaction detected in a PDF statement.
     *
     * Key difference from `create()`:
     *   The PDF already shows ONE installment amount (e.g. the 4th of 5).
     *   We must create ONLY the remaining installments starting from the current one,
     *   not restart from installment 1.
     *
     * Example: PDF shows "Parcela 4/5, R$ 50"
     *   → Creates installment 4 on the PDF date (current invoice)
     *   → Creates installment 5 on PDF date + 1 month (next invoice)
     *   → Does NOT touch installments 1, 2, 3 (already paid in past invoices)
     */
    async createFromPdfImport(opts: {
        description: string;
        /** Per-installment amount as shown in the PDF */
        amount: number;
        /** Date of the current installment (from the PDF) */
        date: string;
        creditCardId: string;
        categoryId?: string | null;
        /** Which installment is shown in the PDF (e.g. 4 for "Parcela 4/5") */
        installmentsCurrent: number | null;
        /** Total installment count (e.g. 5 for "Parcela 4/5") */
        installmentsTotal: number | null;
    }) {
        const creditCard = await this.prisma.creditCard.findUnique({
            where: { id: opts.creditCardId },
        });
        if (!creditCard) {
            throw new NotFoundException(`Credit Card ${opts.creditCardId} not found`);
        }

        const current = opts.installmentsCurrent ?? 1;
        const total = opts.installmentsTotal ?? 1;
        const remaining = total - current + 1; // How many installments to create (including the current)

        const baseDate = new Date(opts.date);
        const installmentGroupId = remaining > 1 ? randomUUID() : null;

        const records = [];
        for (let offset = 0; offset < remaining; offset++) {
            const installmentNumber = current + offset; // e.g. 4, 5
            const simulatedDate = addMonths(baseDate, offset);
            const invoiceDate = calculateInvoiceDate(
                simulatedDate,
                creditCard.invoiceClosingOffset,
                creditCard.dueDay,
            );

            const label = total > 1 ? `${opts.description} (${installmentNumber}/${total})` : opts.description;

            records.push({
                description: label,
                amount: opts.amount, // PDF already shows per-installment amount — use as-is
                date: baseDate,
                invoiceDate,
                installments: total,
                creditCardId: opts.creditCardId,
                categoryId: opts.categoryId ?? null,
                installmentGroupId,
                isFixed: false,
            });
        }

        return this.prisma.$transaction(
            records.map(r => this.prisma.cardTransaction.create({ data: r }))
        );
    }

    async simulate(createDto: CreateCardTransactionDto) {
        const creditCard = await this.prisma.creditCard.findUnique({
            where: { id: createDto.creditCardId },
        });

        if (!creditCard) {
            throw new NotFoundException(`Credit Card with ID ${createDto.creditCardId} not found`);
        }

        const installmentsCount = createDto.installments ?? 1;
        const distributedAmounts = distributeInstallments(createDto.amount, installmentsCount);

        const basePurchaseDate = new Date(createDto.date);
        const preview = [];

        for (let i = 0; i < installmentsCount; i++) {
            const simulatedPurchaseDate = addMonths(basePurchaseDate, i);
            const invoiceDate = calculateInvoiceDate(
                simulatedPurchaseDate,
                creditCard.invoiceClosingOffset,
                creditCard.dueDay,
            );

            preview.push({
                installmentNumber: i + 1,
                amount: distributedAmounts[i],
                invoiceDate: invoiceDate,
            });
        }

        return {
            totalAmount: createDto.amount,
            installments: installmentsCount,
            lastInvoiceDate: preview[preview.length - 1].invoiceDate,
            preview,
        };
    }

    async findAllByInvoice(creditCardId: string | undefined, month: number, year: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1);

        const transactions = await this.prisma.cardTransaction.findMany({
            where: {
                ...(creditCardId ? { creditCardId } : {}),
                OR: [
                    {
                        // Parcelas normais que caem neste mês
                        isFixed: false,
                        invoiceDate: {
                            gte: startDate,
                            lt: endDate,
                        },
                    },
                    {
                        // Contas fixas cujo primeiro lançamento (invoiceDate original) foi neste mês ou meses anteriores
                        isFixed: true,
                        invoiceDate: {
                            lt: endDate,
                        }
                    }
                ]
            },
            orderBy: { date: 'desc' },
        });

        // Projetar despesas fixas para parecerem lançamentos independentes no mês atual
        const projected = transactions.map(tx => {
            if (tx.isFixed && new Date(tx.invoiceDate) < endDate) {
                const ignoreKey = `${year}_${month}`;
                if (tx.ignoredInvoices && tx.ignoredInvoices.includes(ignoreKey)) {
                    return null; // O usuário editou ou deletou esta projeção especificamente
                }

                // Se a despesa fixa é deste mês ou anterior, criamos um ID virtual
                // concatenando com o Mês/Ano para que o frontend o enxergue como único na lista
                const projectedTx = { ...tx };
                projectedTx.id = `${tx.id}_virtual_${year}_${month}`;

                // Mapeia a data de compra e invoiceDate para o mês atual correspondente
                const originalDate = new Date(tx.date);
                const originalInvoiceDate = new Date(tx.invoiceDate);

                // Diferença original de meses entre Fatura e Compra
                const monthDiff = (originalInvoiceDate.getFullYear() - originalDate.getFullYear()) * 12 + (originalInvoiceDate.getMonth() - originalDate.getMonth());

                projectedTx.invoiceDate = new Date(year, month - 1, originalInvoiceDate.getDate());

                // A nova data de compra acompanha a mesma diferença (para trás) que a original tinha
                projectedTx.date = new Date(year, month - 1 - monthDiff, originalDate.getDate());

                return projectedTx;
            }
            return tx;
        });

        return projected.filter(tx => tx !== null);
    }

    async getInvoiceSummary(month: number, year: number) {
        const transactions = await this.findAllByInvoice(undefined, month, year);
        const totalAmount = transactions.reduce((acc, curr) => acc + curr.amount, 0);
        return { totalAmount };
    }

    async remove(id: string, mode: 'SINGLE' | 'FUTURE' | 'ALL') {
        // Remove qualquer sufixo virtual inserido pelo frontend para despesas fixas
        const realId = id.split('_virtual_')[0];

        const transaction = await this.prisma.cardTransaction.findUnique({
            where: { id: realId },
        });

        if (!transaction) {
            throw new NotFoundException(`Card Transaction with ID ${id} not found`);
        }

        // If it was a single payment (no group loop), just delete it
        if (!transaction.installmentGroupId || mode === 'SINGLE') {
            if (id.includes('_virtual_')) {
                const ignoreKey = id.split('_virtual_')[1];
                const newIgnored = transaction.ignoredInvoices ? `${transaction.ignoredInvoices},${ignoreKey}` : ignoreKey;
                return this.prisma.cardTransaction.update({
                    where: { id: realId },
                    data: { ignoredInvoices: newIgnored }
                });
            }

            if (transaction.isFixed) {
                // Tentativa de deletar a "matriz" original da despesa fixa.
                // Não deletamos o registro para não perder o histórico infinito, apenas ignoramos este mês.
                const baseMonth = transaction.invoiceDate.getMonth() + 1;
                const baseYear = transaction.invoiceDate.getFullYear();
                const ignoreKey = `${baseYear}_${baseMonth}`;

                const newIgnored = transaction.ignoredInvoices ? `${transaction.ignoredInvoices},${ignoreKey}` : ignoreKey;
                return this.prisma.cardTransaction.update({
                    where: { id: realId },
                    data: { ignoredInvoices: newIgnored }
                });
            }

            return this.prisma.cardTransaction.delete({
                where: { id: realId },
            });
        }

        if (mode === 'ALL') {
            return this.prisma.cardTransaction.deleteMany({
                where: {
                    installmentGroupId: transaction.installmentGroupId,
                },
            });
        }

        if (mode === 'FUTURE') {
            // Deleção em cascata pra frente: deleta esta parcela e todas com invoiceDate >= a esta
            // pertencentes ao mesmo grupo de parcelamento (compra original).
            return this.prisma.cardTransaction.deleteMany({
                where: {
                    installmentGroupId: transaction.installmentGroupId,
                    invoiceDate: {
                        gte: transaction.invoiceDate,
                    },
                },
            });
        }

        throw new BadRequestException('Invalid deletion mode.');
    }

    async update(id: string, updateDto: UpdateCardTransactionDto) {
        // Remove qualquer sufixo virtual inserido pelo frontend para despesas fixas
        const realId = id.split('_virtual_')[0];

        const transaction = await this.prisma.cardTransaction.findUnique({
            where: { id: realId },
            include: { creditCard: true },
        });

        if (!transaction) throw new NotFoundException('Transaction not found');

        let invoiceDate = transaction.invoiceDate;

        if (updateDto.date) {
            invoiceDate = calculateInvoiceDate(
                new Date(updateDto.date),
                transaction.creditCard.invoiceClosingOffset,
                transaction.creditCard.dueDay,
            );
        }

        if (id.includes('_virtual_')) {
            const ignoreKey = id.split('_virtual_')[1];

            // Se o usuário DESMARCOU a flag "Conta Fixa", ele quer abrir uma exceção
            // apenas para este mês, não afetando os outros meses.
            if (updateDto.isFixed === false) {
                // 1. Ignorar na original
                const newIgnored = transaction.ignoredInvoices ? `${transaction.ignoredInvoices},${ignoreKey}` : ignoreKey;
                await this.prisma.cardTransaction.update({
                    where: { id: realId },
                    data: { ignoredInvoices: newIgnored }
                });

                // 2. Extrair o Mês e Ano do ignore key "YYYY_MM"
                const [yearStr, monthStr] = ignoreKey.split('_');
                const targetYear = parseInt(yearStr);
                const targetMonth = parseInt(monthStr);

                // Fixar a invoiceDate dessa nova transação no mês da edição
                let newInvoiceDate = updateDto.date
                    ? calculateInvoiceDate(new Date(updateDto.date), transaction.creditCard.invoiceClosingOffset, transaction.creditCard.dueDay)
                    : new Date(targetYear, targetMonth - 1, transaction.invoiceDate.getDate());

                // 3. Criar uma nova transação independente para esse mês apenas
                return this.prisma.cardTransaction.create({
                    data: {
                        description: updateDto.description ?? transaction.description,
                        amount: updateDto.amount ?? transaction.amount,
                        date: updateDto.date ? new Date(updateDto.date) : new Date(targetYear, targetMonth - 1, transaction.date.getDate()),
                        invoiceDate: newInvoiceDate,
                        installments: 1,
                        isFixed: false, // Forçamos para false para ser apenas uma exceção isolada
                        categoryId: updateDto.categoryId ?? transaction.categoryId,
                        creditCardId: updateDto.creditCardId ?? transaction.creditCardId,
                    }
                });
            } else {
                // Se o usuário NÃO desmarcou a flag (continuou como fixa), 
                // ele deseja alterar o VALOR da franquia inteira (Update Global da Série).
                // Atualizamos o registro real!
                return this.prisma.cardTransaction.update({
                    where: { id: realId },
                    data: {
                        description: updateDto.description,
                        amount: updateDto.amount,
                        categoryId: updateDto.categoryId,
                        creditCardId: updateDto.creditCardId,
                        // Não atualizamos as datas base, pois causaria shifts na série
                    },
                });
            }
        }

        if (transaction.isFixed && updateDto.isFixed === false) {
            // O usuário está desmarcando a conta fixa no próprio registro matriz (o primeiro mês).
            // A regra de exceção deve se aplicar também na raiz: Pular este mês na matriz original
            // e criar uma despesa solta substituta para este mês base.

            // 1. O IgnoreKey do mês base é tirado dele mesmo.
            const baseMonth = transaction.invoiceDate.getMonth() + 1; // 1-12
            const baseYear = transaction.invoiceDate.getFullYear();
            const ignoreKey = `${baseYear}_${baseMonth}`;

            const newIgnored = transaction.ignoredInvoices ? `${transaction.ignoredInvoices},${ignoreKey}` : ignoreKey;

            // 2. Atualizamos o original ignorando este mês chave
            await this.prisma.cardTransaction.update({
                where: { id: realId },
                data: { ignoredInvoices: newIgnored }
            });

            // 3. Criamos a despesa solta
            return this.prisma.cardTransaction.create({
                data: {
                    description: updateDto.description ?? transaction.description,
                    amount: updateDto.amount ?? transaction.amount,
                    date: updateDto.date ? new Date(updateDto.date) : transaction.date,
                    invoiceDate: updateDto.date
                        ? calculateInvoiceDate(new Date(updateDto.date), transaction.creditCard.invoiceClosingOffset, transaction.creditCard.dueDay)
                        : transaction.invoiceDate,
                    installments: 1,
                    isFixed: false,
                    categoryId: updateDto.categoryId ?? transaction.categoryId,
                    creditCardId: updateDto.creditCardId ?? transaction.creditCardId,
                }
            });
        }

        // Edição normal (global) ou de contas que não são fixas
        return this.prisma.cardTransaction.update({
            where: { id: realId },
            data: {
                description: updateDto.description,
                amount: updateDto.amount,
                date: updateDto.date ? new Date(updateDto.date) : undefined,
                invoiceDate: invoiceDate,
                categoryId: updateDto.categoryId,
                creditCardId: updateDto.creditCardId,
                isFixed: updateDto.isFixed,
            },
        });
    }
}

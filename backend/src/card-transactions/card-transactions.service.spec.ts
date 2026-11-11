import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CardTransactionsService } from './card-transactions.service';

describe('CardTransactionsService', () => {
    let service: CardTransactionsService;

    const prisma = {
        creditCard: { findUnique: jest.fn() },
        cardHolder: { findFirst: jest.fn() },
        cardTransaction: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    const card = {
        id: 'card-1',
        name: 'C6',
        limit: 2000,
        invoiceClosingOffset: 7,
        dueDay: 10,
        color: null,
        pointsPerDollar: null,
        loyaltyProgram: null,
        isPrimary: true,
        accountId: 'account-1',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        prisma.creditCard.findUnique.mockResolvedValue(card);
        prisma.cardHolder.findFirst.mockResolvedValue({ id: 'holder-main' });
        prisma.cardTransaction.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({ id: `tx-${data.description}`, ...data }),
        );
        prisma.$transaction.mockImplementation((arg: unknown) =>
            Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prisma),
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CardTransactionsService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<CardTransactionsService>(CardTransactionsService);
    });

    it('assigns the main holder when none is selected', async () => {
        await service.create({
            description: 'Compra',
            amount: 100,
            date: '2026-11-11',
            creditCardId: 'card-1',
        });

        expect(prisma.cardHolder.findFirst).toHaveBeenCalledWith({
            where: { creditCardId: 'card-1' },
            orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
            select: { id: true },
        });
        expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ cardHolderId: 'holder-main' }),
        });
    });

    it('assigns an explicit holder that belongs to the card', async () => {
        prisma.cardHolder.findFirst.mockResolvedValue({ id: 'holder-2' });

        await service.create({
            description: 'Compra',
            amount: 100,
            date: '2026-11-11',
            creditCardId: 'card-1',
            cardHolderId: 'holder-2',
        });

        expect(prisma.cardHolder.findFirst).toHaveBeenCalledWith({
            where: { id: 'holder-2', creditCardId: 'card-1' },
            select: { id: true },
        });
        expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ cardHolderId: 'holder-2' }),
        });
    });

    it('rejects a holder from another card', async () => {
        prisma.cardHolder.findFirst.mockResolvedValue(null);

        await expect(service.create({
            description: 'Compra',
            amount: 100,
            date: '2026-11-11',
            creditCardId: 'card-1',
            cardHolderId: 'holder-other',
        })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('keeps the holder when only the amount is edited', async () => {
        prisma.cardTransaction.findUnique.mockResolvedValue({
            id: 'tx-1',
            description: 'Compra',
            amount: 100,
            date: new Date(2026, 10, 11),
            invoiceDate: new Date(2026, 10, 10),
            installments: 1,
            isFixed: false,
            ignoredInvoices: null,
            creditCardId: 'card-1',
            cardHolderId: 'holder-2',
            categoryId: null,
            installmentGroupId: null,
            creditCard: card,
        });
        prisma.cardTransaction.update.mockResolvedValue({ id: 'tx-1' });

        await service.update('tx-1', { amount: 150 });

        expect(prisma.cardTransaction.update).toHaveBeenCalledWith({
            where: { id: 'tx-1' },
            data: expect.objectContaining({
                amount: 150,
                cardHolderId: 'holder-2',
            }),
        });
    });
});

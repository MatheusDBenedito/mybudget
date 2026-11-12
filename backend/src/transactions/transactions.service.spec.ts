import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
    let service: TransactionsService;

    const prisma = {
        transaction: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            delete: jest.fn(),
        },
        account: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TransactionsService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<TransactionsService>(TransactionsService);
    });

    it('projects only the latest active template per fixed series and respects single-month overrides', async () => {
        prisma.transaction.findMany
            // Real transactions in Feb/2027 (none)
            .mockResolvedValueOnce([])
            // Historical fixed transactions ordered desc by date
            .mockResolvedValueOnce([
                {
                    id: 'jan-luz-override',
                    description: 'Luz',
                    amount: 245,
                    type: 'EXPENSE',
                    status: 'PENDING',
                    isFixed: true,
                    fixedUntil: new Date(2027, 0, 31, 23, 59, 59, 999),
                    date: new Date(2027, 0, 15, 12, 0, 0),
                    accountId: 'acc-1',
                    categoryId: 'cat-1',
                    category: null,
                },
                {
                    id: 'dez-luz-base',
                    description: 'Luz',
                    amount: 230,
                    type: 'EXPENSE',
                    status: 'PENDING',
                    isFixed: true,
                    fixedUntil: null,
                    date: new Date(2026, 11, 15, 12, 0, 0),
                    accountId: 'acc-1',
                    categoryId: 'cat-1',
                    category: null,
                },
                {
                    id: 'nov-internet',
                    description: 'Internet',
                    amount: 120,
                    type: 'EXPENSE',
                    status: 'PAID',
                    isFixed: true,
                    fixedUntil: null,
                    date: new Date(2026, 10, 15, 12, 0, 0),
                    accountId: 'acc-1',
                    categoryId: 'cat-1',
                    category: null,
                },
                {
                    id: 'mar-internet',
                    description: 'Internet',
                    amount: 120,
                    type: 'EXPENSE',
                    status: 'PAID',
                    isFixed: true,
                    fixedUntil: null,
                    date: new Date(2026, 2, 15, 12, 0, 0),
                    accountId: 'acc-1',
                    categoryId: 'cat-1',
                    category: null,
                },
            ]);

        const result = await service.findAll(2, 2027);

        expect(result).toHaveLength(2);
        expect(result.find(t => t.description === 'Luz')?.amount).toBe(230);
        expect(result.find(t => t.description === 'Internet')?.amount).toBe(120);
    });

    it('does not duplicate a projected fixed row when the month already has a real fixed entry with a different amount', async () => {
        prisma.transaction.findMany
            .mockResolvedValueOnce([
                {
                    id: 'real-dez-gas',
                    description: 'Gás',
                    amount: 395,
                    type: 'EXPENSE',
                    status: 'PENDING',
                    isFixed: true,
                    fixedUntil: null,
                    date: new Date(2026, 11, 15, 12, 0, 0),
                    accountId: 'acc-1',
                    categoryId: null,
                    category: null,
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: 'nov-gas',
                    description: 'Gás',
                    amount: 350,
                    type: 'EXPENSE',
                    status: 'PAID',
                    isFixed: true,
                    fixedUntil: null,
                    date: new Date(2026, 10, 15, 12, 0, 0),
                    accountId: 'acc-1',
                    categoryId: null,
                    category: null,
                },
            ]);

        const result = await service.findAll(12, 2026);
        expect(result).toHaveLength(1);
        expect(result[0].amount).toBe(395);
    });

    it('creates a single-month override when editing a projected fixed transaction with scope="single"', async () => {
        prisma.transaction.findUnique.mockResolvedValue({
            id: 'dez-luz',
            description: 'Luz',
            amount: 230,
            type: 'EXPENSE',
            status: 'PENDING',
            isFixed: true,
            date: new Date(2026, 11, 15, 12, 0, 0),
            accountId: 'acc-1',
            categoryId: 'cat-1',
        });
        prisma.transaction.create.mockResolvedValue({ id: 'created-override', amount: 266.24 });

        await service.update('projected-dez-luz-2027-1', { amount: 266.24, scope: 'single' });

        expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
        expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                description: 'Luz',
                amount: 266.24,
                status: 'PENDING',
                isFixed: true,
                fixedUntil: new Date(2027, 0, 31, 23, 59, 59, 999),
            }),
        }));
    });

    it('updates account balance difference when editing the amount of a PAID transaction', async () => {
        prisma.transaction.findUnique.mockResolvedValue({
            id: 'tx-1',
            description: 'Luz',
            amount: 230,
            type: 'EXPENSE',
            status: 'PAID',
            isFixed: true,
            date: new Date(2026, 10, 15, 12, 0, 0),
            accountId: 'acc-1',
            categoryId: 'cat-1',
        });
        prisma.transaction.update.mockResolvedValue({ id: 'tx-1', amount: 266.24 });

        await service.update('tx-1', { amount: 266.24, scope: 'single' });

        expect(prisma.account.update).toHaveBeenNthCalledWith(1, {
            where: { id: 'acc-1' },
            data: { balance: { increment: 230 } },
        });
        expect(prisma.account.update).toHaveBeenNthCalledWith(2, {
            where: { id: 'acc-1' },
            data: { balance: { increment: -266.24 } },
        });
    });
});

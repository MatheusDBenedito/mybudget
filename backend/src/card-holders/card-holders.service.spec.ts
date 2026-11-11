import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CardHoldersService } from './card-holders.service';

describe('CardHoldersService', () => {
    let service: CardHoldersService;

    const prisma = {
        creditCard: { findUnique: jest.fn() },
        cardHolder: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            delete: jest.fn(),
        },
        cardTransaction: { count: jest.fn() },
        $transaction: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        prisma.creditCard.findUnique.mockResolvedValue({ id: 'card-1' });
        prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CardHoldersService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<CardHoldersService>(CardHoldersService);
    });

    it('lists holders with the main holder first', async () => {
        prisma.cardHolder.findMany.mockResolvedValue([]);

        await service.findAll('card-1');

        expect(prisma.cardHolder.findMany).toHaveBeenCalledWith({
            where: { creditCardId: 'card-1' },
            orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
        });
    });

    it('creates the first holder as the main one', async () => {
        prisma.cardHolder.count.mockResolvedValue(0);
        prisma.cardHolder.create.mockResolvedValue({ id: 'holder-1', isMain: true });

        await service.create('card-1', { name: '  Matheus  ' });

        expect(prisma.cardHolder.create).toHaveBeenCalledWith({
            data: {
                creditCardId: 'card-1',
                name: 'Matheus',
                last4: null,
                isMain: true,
            },
        });
    });

    it('unsets the previous main holder when creating a new main', async () => {
        prisma.cardHolder.count.mockResolvedValue(2);
        prisma.cardHolder.create.mockResolvedValue({ id: 'holder-2', isMain: true });

        await service.create('card-1', { name: 'Esposa', isMain: true });

        expect(prisma.cardHolder.updateMany).toHaveBeenCalledWith({
            where: { creditCardId: 'card-1', isMain: true },
            data: { isMain: false },
        });
    });

    it('rejects removing the main status directly', async () => {
        prisma.cardHolder.findFirst.mockResolvedValue({
            id: 'holder-1',
            creditCardId: 'card-1',
            name: 'Matheus',
            isMain: true,
        });

        await expect(
            service.update('card-1', 'holder-1', { isMain: false }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks deleting a holder that has transactions', async () => {
        prisma.cardHolder.findFirst.mockResolvedValue({
            id: 'holder-2',
            creditCardId: 'card-1',
            name: 'Adicional',
            isMain: false,
        });
        prisma.cardTransaction.count.mockResolvedValue(3);

        await expect(
            service.remove('card-1', 'holder-2'),
        ).rejects.toBeInstanceOf(ConflictException);
    });

    it('blocks deleting the main holder', async () => {
        prisma.cardHolder.findFirst.mockResolvedValue({
            id: 'holder-1',
            creditCardId: 'card-1',
            name: 'Matheus',
            isMain: true,
        });
        prisma.cardTransaction.count.mockResolvedValue(0);

        await expect(
            service.remove('card-1', 'holder-1'),
        ).rejects.toBeInstanceOf(ConflictException);
    });
});

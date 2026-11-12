import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardLayoutService } from './dashboard-layout.service';

describe('DashboardLayoutService', () => {
    let service: DashboardLayoutService;

    const prisma = {
        dashboardLayout: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
        },
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DashboardLayoutService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<DashboardLayoutService>(DashboardLayoutService);
    });

    it('returns an empty layout when nothing was saved yet', async () => {
        prisma.dashboardLayout.findUnique.mockResolvedValue(null);

        await expect(service.get()).resolves.toEqual({ items: [], updatedAt: null });
    });

    it('returns the stored layout', async () => {
        const updatedAt = new Date();
        const items = [{ id: 'forecast', width: 12 }];
        prisma.dashboardLayout.findUnique.mockResolvedValue({ id: 'default', items, updatedAt });

        await expect(service.get()).resolves.toEqual({ items, updatedAt });
    });

    it('upserts the singleton layout', async () => {
        const updatedAt = new Date();
        const items = [
            { id: 'forecast', width: 67, height: 520 },
            { id: 'bills', width: 33, height: 340 },
        ];
        prisma.dashboardLayout.upsert.mockResolvedValue({ id: 'default', items, updatedAt });

        await expect(service.save(items as never)).resolves.toEqual({ items, updatedAt });
        expect(prisma.dashboardLayout.upsert).toHaveBeenCalledWith({
            where: { id: 'default' },
            create: { id: 'default', items },
            update: { items },
        });
    });
});

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
    DashboardLayoutItem,
} from './dashboard-layout.constants';

const LAYOUT_ID = 'default';

export interface DashboardLayoutResponse {
    items: DashboardLayoutItem[];
    updatedAt: Date | null;
}

@Injectable()
export class DashboardLayoutService {
    constructor(private readonly prisma: PrismaService) { }

    async get(): Promise<DashboardLayoutResponse> {
        const layout = await this.prisma.dashboardLayout.findUnique({
            where: { id: LAYOUT_ID },
        });

        if (!layout) {
            return { items: [], updatedAt: null };
        }

        return {
            items: layout.items as unknown as DashboardLayoutItem[],
            updatedAt: layout.updatedAt,
        };
    }

    async save(items: DashboardLayoutItem[]): Promise<DashboardLayoutResponse> {
        const data = items as unknown as Prisma.InputJsonValue;

        const layout = await this.prisma.dashboardLayout.upsert({
            where: { id: LAYOUT_ID },
            create: { id: LAYOUT_ID, items: data },
            update: { items: data },
        });

        return {
            items: layout.items as unknown as DashboardLayoutItem[],
            updatedAt: layout.updatedAt,
        };
    }
}

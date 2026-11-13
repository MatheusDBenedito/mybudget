import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardLayoutItem } from './dashboard-layout.constants';

export interface DashboardLayoutResponse {
    items: DashboardLayoutItem[];
    updatedAt: Date | null;
}

@Injectable()
export class DashboardLayoutService {
    constructor(private readonly prisma: PrismaService) {}

    async get(workspaceId: string, userId: string): Promise<DashboardLayoutResponse> {
        let layout = await this.prisma.dashboardLayout.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } },
        });

        // Fallback to any workspace layout if this user hasn't customized theirs yet
        if (!layout) {
            layout = await this.prisma.dashboardLayout.findFirst({
                where: { workspaceId },
                orderBy: { updatedAt: 'desc' },
            });
        }

        if (!layout) {
            return { items: [], updatedAt: null };
        }

        return {
            items: layout.items as unknown as DashboardLayoutItem[],
            updatedAt: layout.updatedAt,
        };
    }

    async save(
        workspaceId: string,
        userId: string,
        items: DashboardLayoutItem[],
    ): Promise<DashboardLayoutResponse> {
        const data = items as unknown as Prisma.InputJsonValue;

        const layout = await this.prisma.dashboardLayout.upsert({
            where: { workspaceId_userId: { workspaceId, userId } },
            create: { workspaceId, userId, items: data },
            update: { items: data },
        });

        return {
            items: layout.items as unknown as DashboardLayoutItem[],
            updatedAt: layout.updatedAt,
        };
    }
}

import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import {
    CurrentWorkspace,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    @Get('expenses-by-category')
    @RequirePermissions('view:resumo')
    async getExpensesByCategory(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Query('month') monthString: string,
        @Query('year') yearString: string,
    ) {
        const month = parseInt(monthString, 10);
        const year = parseInt(yearString, 10);

        if (isNaN(month) || isNaN(year)) {
            throw new BadRequestException('Month and year queries are required and must be numbers.');
        }

        return this.reportsService.getExpensesByCategory(ctx.workspaceId, month, year);
    }

    @Get('monthly-evolution')
    @RequirePermissions('view:resumo')
    async getMonthlyEvolution(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.reportsService.getMonthlyEvolution(ctx.workspaceId);
    }
}

import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
    CurrentWorkspace,
    RequireAnyPermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { CashFlowService } from './cash-flow.service';

@Controller('cash-flow')
export class CashFlowController {
    constructor(private readonly cashFlowService: CashFlowService) {}

    /** GET /cash-flow?month=11&year=2026&months=12 — defaults to the next 12 months from today */
    @Get()
    @RequireAnyPermissions('view:fluxo_caixa', 'view:resumo')
    getCashFlow(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Query('month') month?: string,
        @Query('year') year?: string,
        @Query('months') months?: string,
    ) {
        const today = new Date();
        const m = month ? Number(month) : today.getMonth() + 1;
        const y = year ? Number(year) : today.getFullYear();
        const count = months ? Number(months) : 12;

        if (!Number.isInteger(m) || m < 1 || m > 12) throw new BadRequestException('month deve estar entre 1 e 12.');
        if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new BadRequestException('year inválido.');
        if (!Number.isInteger(count) || count < 1 || count > 24) throw new BadRequestException('months deve estar entre 1 e 24.');

        return this.cashFlowService.getCashFlow(ctx.workspaceId, m, y, count, today);
    }
}

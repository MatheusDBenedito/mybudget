import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
} from '@nestjs/common';
import {
    CurrentWorkspace,
    RequireAnyPermissions,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';

@Controller('investments')
export class InvestmentsController {
    constructor(private readonly investmentsService: InvestmentsService) {}

    @Post()
    @RequirePermissions('create:investimentos')
    create(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() createInvestmentDto: CreateInvestmentDto,
    ) {
        return this.investmentsService.create(ctx.workspaceId, createInvestmentDto);
    }

    @Get()
    @RequireAnyPermissions('view:investimentos', 'view:resumo')
    findAll(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.investmentsService.findAll(ctx.workspaceId);
    }

    @Get('dividends')
    @RequirePermissions('view:investimentos')
    findAllDividends(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.investmentsService.findAllDividends(ctx.workspaceId);
    }

    @Get('projections')
    @RequireAnyPermissions('view:investimentos', 'view:resumo')
    getProjections(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Query('month') month?: string,
        @Query('year') year?: string,
        @Query('months') months?: string,
    ) {
        const m = month ? parseInt(month, 10) : undefined;
        const y = year ? parseInt(year, 10) : undefined;
        const count = months ? Math.min(Math.max(parseInt(months, 10) || 12, 1), 24) : 12;
        return this.investmentsService.getProjections(ctx.workspaceId, m, y, count);
    }

    @Post('dividends/sync')
    @RequirePermissions('edit:investimentos')
    syncAllDividends(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.investmentsService.syncAllDividends(ctx.workspaceId, true);
    }

    @Get(':id')
    @RequirePermissions('view:investimentos')
    findOne(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string) {
        return this.investmentsService.findOne(ctx.workspaceId, id);
    }

    @Patch(':id')
    @RequirePermissions('edit:investimentos')
    update(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
        @Body() updateInvestmentDto: UpdateInvestmentDto,
    ) {
        return this.investmentsService.update(ctx.workspaceId, id, updateInvestmentDto);
    }

    @Delete(':id')
    @RequirePermissions('delete:investimentos')
    remove(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string) {
        return this.investmentsService.remove(ctx.workspaceId, id);
    }
}

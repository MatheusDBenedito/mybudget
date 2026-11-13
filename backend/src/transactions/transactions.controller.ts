import { Controller, Get, Post, Body, Patch, Param, Query, Delete } from '@nestjs/common';
import {
    CurrentWorkspace,
    RequireAnyPermissions,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';

@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) {}

    @Post()
    @RequirePermissions('create:despesa')
    create(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() createTransactionDto: CreateTransactionDto,
    ) {
        return this.transactionsService.create(ctx.workspaceId, createTransactionDto);
    }

    @Get()
    @RequireAnyPermissions('view:despesa', 'view:fluxo_caixa', 'view:resumo')
    findAll(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Query('month') month?: string,
        @Query('year') year?: string,
    ) {
        const parsedMonth = month ? parseInt(month, 10) : undefined;
        const parsedYear = year ? parseInt(year, 10) : undefined;
        return this.transactionsService.findAll(ctx.workspaceId, parsedMonth, parsedYear);
    }

    @Patch(':id')
    @RequirePermissions('edit:despesa')
    update(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
        @Body() updateTransactionDto: UpdateTransactionDto,
    ) {
        return this.transactionsService.update(ctx.workspaceId, id, updateTransactionDto);
    }

    @Patch(':id/status')
    @RequirePermissions('edit:despesa')
    updateStatus(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
        @Body() updateTransactionStatusDto: UpdateTransactionStatusDto,
    ) {
        return this.transactionsService.updateStatus(ctx.workspaceId, id, updateTransactionStatusDto);
    }

    /** scope=series removes a fixed lançamento from this month on; default removes only this month. */
    @Delete(':id')
    @RequireAnyPermissions('delete:despesa', 'delete:fluxo_caixa')
    remove(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
        @Query('scope') scope?: string,
    ) {
        return this.transactionsService.remove(
            ctx.workspaceId,
            id,
            scope === 'series' ? 'series' : 'single',
        );
    }
}

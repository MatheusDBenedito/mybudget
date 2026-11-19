import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
    CurrentWorkspace,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import {
    CreateInvestmentGoalDto,
    UpdateInvestmentGoalDto,
} from './dto/investment-goal.dto';
import { InvestmentGoalsService } from './investment-goals.service';

@Controller('investment-goals')
export class InvestmentGoalsController {
    constructor(private readonly goalsService: InvestmentGoalsService) {}

    @Get()
    @RequirePermissions('view:investimentos')
    list(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.goalsService.listWithContext(ctx.workspaceId);
    }

    @Post()
    @RequirePermissions('create:investimentos')
    create(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() dto: CreateInvestmentGoalDto,
    ) {
        return this.goalsService.create(ctx.workspaceId, dto);
    }

    @Patch(':id')
    @RequirePermissions('edit:investimentos')
    update(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
        @Body() dto: UpdateInvestmentGoalDto,
    ) {
        return this.goalsService.update(ctx.workspaceId, id, dto);
    }

    @Delete(':id')
    @RequirePermissions('delete:investimentos')
    remove(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
    ) {
        return this.goalsService.remove(ctx.workspaceId, id);
    }
}

import { Body, Controller, Get, Put } from '@nestjs/common';
import {
    CurrentWorkspace,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { DashboardLayoutService } from './dashboard-layout.service';
import { UpdateDashboardLayoutDto } from './dto/update-dashboard-layout.dto';

@Controller('dashboard-layout')
export class DashboardLayoutController {
    constructor(private readonly dashboardLayoutService: DashboardLayoutService) {}

    @Get()
    @RequirePermissions('view:resumo')
    get(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.dashboardLayoutService.get(ctx.workspaceId, ctx.userId);
    }

    @Put()
    @RequirePermissions('edit:resumo_layout')
    save(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() updateDashboardLayoutDto: UpdateDashboardLayoutDto,
    ) {
        return this.dashboardLayoutService.save(
            ctx.workspaceId,
            ctx.userId,
            updateDashboardLayoutDto.items,
        );
    }
}

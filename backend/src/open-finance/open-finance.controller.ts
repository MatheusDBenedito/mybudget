import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import {
    CurrentWorkspace,
    Public,
    RequireSuperAdmin,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import {
    CreateConnectTokenDto,
    RegisterConnectionDto,
    UpdateAccountMapDto,
} from './dto/open-finance.dto';
import { OpenFinanceService } from './open-finance.service';

@Controller('open-finance')
export class OpenFinanceController {
    constructor(private readonly openFinanceService: OpenFinanceService) {}

    @RequireSuperAdmin()
    @Get('status')
    getStatus(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.openFinanceService.getStatus(ctx.workspaceId);
    }

    @RequireSuperAdmin()
    @Post('connect-token')
    createConnectToken(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() dto: CreateConnectTokenDto,
    ) {
        return this.openFinanceService.createConnectToken(ctx.workspaceId, dto.itemId);
    }

    @RequireSuperAdmin()
    @Get('connections')
    listConnections(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.openFinanceService.listConnections(ctx.workspaceId);
    }

    @RequireSuperAdmin()
    @Post('connections')
    registerConnection(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() dto: RegisterConnectionDto,
    ) {
        return this.openFinanceService.registerConnection(ctx.workspaceId, dto);
    }

    @RequireSuperAdmin()
    @Patch('mappings/:mapId')
    updateMapping(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('mapId') mapId: string,
        @Body() dto: UpdateAccountMapDto,
    ) {
        return this.openFinanceService.updateMapping(ctx.workspaceId, mapId, dto);
    }

    @RequireSuperAdmin()
    @Post('connections/:id/sync')
    syncConnection(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
    ) {
        return this.openFinanceService.syncConnection(ctx.workspaceId, id);
    }

    @RequireSuperAdmin()
    @Delete('connections/:id')
    removeConnection(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
    ) {
        return this.openFinanceService.removeConnection(ctx.workspaceId, id);
    }

    @Public()
    @Post('webhooks/pluggy')
    handlePluggyWebhook(
        @Body() payload: { event?: string; itemId?: string },
        @Headers('x-pluggy-webhook-secret') secret?: string,
    ) {
        return this.openFinanceService.handlePluggyWebhook(payload, secret);
    }
}


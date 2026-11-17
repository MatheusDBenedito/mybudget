import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import {
    CurrentWorkspace,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { MilesService } from './miles.service';
import { CreateMilesEntryDto } from './dto/create-miles-entry.dto';
import { UpdateMilesEntryDto } from './dto/update-miles-entry.dto';
import { UpdateMilesValuationsDto } from './dto/update-miles-valuations.dto';

@Controller('miles')
export class MilesController {
    constructor(private readonly milesService: MilesService) {}

    @Post()
    @RequirePermissions('create:milhas')
    create(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Body() dto: CreateMilesEntryDto) {
        return this.milesService.create(ctx.workspaceId, dto);
    }

    @Get()
    @RequirePermissions('view:milhas')
    findAll(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.milesService.findAll(ctx.workspaceId);
    }

    @Get('valuations')
    @RequirePermissions('view:milhas')
    getValuations(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.milesService.getValuations(ctx.workspaceId);
    }

    @Put('valuations')
    @RequirePermissions('edit:milhas')
    updateValuations(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() dto: UpdateMilesValuationsDto,
    ) {
        return this.milesService.updateValuations(ctx.workspaceId, dto.rates);
    }

    @Patch(':id')
    @RequirePermissions('edit:milhas')
    update(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
        @Body() dto: UpdateMilesEntryDto,
    ) {
        return this.milesService.update(ctx.workspaceId, id, dto);
    }

    @Delete(':id')
    @RequirePermissions('delete:milhas')
    remove(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string) {
        return this.milesService.remove(ctx.workspaceId, id);
    }
}

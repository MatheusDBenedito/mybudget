import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
    CurrentWorkspace,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { MilesService } from './miles.service';
import { CreateMilesEntryDto } from './dto/create-miles-entry.dto';
import { UpdateMilesEntryDto } from './dto/update-miles-entry.dto';

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

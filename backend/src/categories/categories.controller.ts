import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import {
    CurrentWorkspace,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) {}

    @Get()
    @RequirePermissions('view:resumo')
    findAll(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.categoriesService.findAll(ctx.workspaceId);
    }

    @Post()
    @RequirePermissions('create:despesa')
    create(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() createCategoryDto: CreateCategoryDto,
    ) {
        return this.categoriesService.create(ctx.workspaceId, createCategoryDto);
    }

    @Patch(':id')
    @RequirePermissions('edit:despesa')
    update(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
        @Body() updateCategoryDto: UpdateCategoryDto,
    ) {
        return this.categoriesService.update(ctx.workspaceId, id, updateCategoryDto);
    }

    @Delete(':id')
    @RequirePermissions('delete:despesa')
    remove(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string) {
        return this.categoriesService.remove(ctx.workspaceId, id);
    }
}

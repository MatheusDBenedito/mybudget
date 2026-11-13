import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
    CurrentWorkspace,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { CardHoldersService } from './card-holders.service';
import { CreateCardHolderDto } from './dto/create-card-holder.dto';
import { UpdateCardHolderDto } from './dto/update-card-holder.dto';

@Controller('credit-cards/:creditCardId/holders')
export class CardHoldersController {
    constructor(private readonly cardHoldersService: CardHoldersService) {}

    @Get()
    @RequirePermissions('view:cartao')
    findAll(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('creditCardId') creditCardId: string,
    ) {
        return this.cardHoldersService.findAll(ctx.workspaceId, creditCardId);
    }

    @Post()
    @RequirePermissions('create:cartao')
    create(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('creditCardId') creditCardId: string,
        @Body() createCardHolderDto: CreateCardHolderDto,
    ) {
        return this.cardHoldersService.create(ctx.workspaceId, creditCardId, createCardHolderDto);
    }

    @Patch(':id')
    @RequirePermissions('edit:cartao')
    update(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('creditCardId') creditCardId: string,
        @Param('id') id: string,
        @Body() updateCardHolderDto: UpdateCardHolderDto,
    ) {
        return this.cardHoldersService.update(ctx.workspaceId, creditCardId, id, updateCardHolderDto);
    }

    @Delete(':id')
    @RequirePermissions('delete:cartao')
    remove(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('creditCardId') creditCardId: string,
        @Param('id') id: string,
    ) {
        return this.cardHoldersService.remove(ctx.workspaceId, creditCardId, id);
    }
}

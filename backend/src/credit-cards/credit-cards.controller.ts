import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import {
    CurrentWorkspace,
    RequireAnyPermissions,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { CreditCardsService } from './credit-cards.service';
import { CreateCreditCardDto } from './dto/create-credit-card.dto';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto';

@Controller('credit-cards')
export class CreditCardsController {
    constructor(private readonly creditCardsService: CreditCardsService) {}

    @Post()
    @RequirePermissions('create:cartao')
    create(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() createCreditCardDto: CreateCreditCardDto,
    ) {
        return this.creditCardsService.create(ctx.workspaceId, createCreditCardDto);
    }

    @Get()
    @RequireAnyPermissions('view:cartao', 'view:resumo')
    findAll(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.creditCardsService.findAll(ctx.workspaceId);
    }

    @Patch(':id/primary')
    @RequirePermissions('edit:cartao')
    setPrimary(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Param('id') id: string) {
        return this.creditCardsService.setPrimary(ctx.workspaceId, id);
    }

    @Patch(':id')
    @RequirePermissions('edit:cartao')
    update(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
        @Body() updateCreditCardDto: UpdateCreditCardDto,
    ) {
        return this.creditCardsService.update(ctx.workspaceId, id, updateCreditCardDto);
    }
}

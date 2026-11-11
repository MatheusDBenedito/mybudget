import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CardHoldersService } from './card-holders.service';
import { CreateCardHolderDto } from './dto/create-card-holder.dto';
import { UpdateCardHolderDto } from './dto/update-card-holder.dto';

@Controller('credit-cards/:creditCardId/holders')
export class CardHoldersController {
    constructor(private readonly cardHoldersService: CardHoldersService) { }

    @Get()
    findAll(@Param('creditCardId') creditCardId: string) {
        return this.cardHoldersService.findAll(creditCardId);
    }

    @Post()
    create(
        @Param('creditCardId') creditCardId: string,
        @Body() createCardHolderDto: CreateCardHolderDto,
    ) {
        return this.cardHoldersService.create(creditCardId, createCardHolderDto);
    }

    @Patch(':id')
    update(
        @Param('creditCardId') creditCardId: string,
        @Param('id') id: string,
        @Body() updateCardHolderDto: UpdateCardHolderDto,
    ) {
        return this.cardHoldersService.update(creditCardId, id, updateCardHolderDto);
    }

    @Delete(':id')
    remove(
        @Param('creditCardId') creditCardId: string,
        @Param('id') id: string,
    ) {
        return this.cardHoldersService.remove(creditCardId, id);
    }
}

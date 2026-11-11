import { Module } from '@nestjs/common';
import { CardHoldersController } from './card-holders.controller';
import { CardHoldersService } from './card-holders.service';

@Module({
    controllers: [CardHoldersController],
    providers: [CardHoldersService],
})
export class CardHoldersModule { }

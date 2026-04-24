import { Module } from '@nestjs/common';
import { CreditCardsService } from './credit-cards.service';
import { CreditCardsController } from './credit-cards.controller';

import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CreditCardsService],
  controllers: [CreditCardsController]
})
export class CreditCardsModule { }

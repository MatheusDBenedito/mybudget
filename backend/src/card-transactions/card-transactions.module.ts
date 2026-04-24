import { Module } from '@nestjs/common';
import { CardTransactionsService } from './card-transactions.service';
import { CardTransactionsController } from './card-transactions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfParserService } from './pdf-parser.service';

@Module({
  imports: [PrismaModule],
  controllers: [CardTransactionsController],
  providers: [CardTransactionsService, PdfParserService],
})
export class CardTransactionsModule { }


import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CardTransactionsController } from './card-transactions.controller';
import { CardTransactionsService } from './card-transactions.service';
import { PdfParserService } from './pdf-parser.service';

describe('CardTransactionsController', () => {
    let controller: CardTransactionsController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CardTransactionsController],
            providers: [
                { provide: CardTransactionsService, useValue: {} },
                { provide: PdfParserService, useValue: {} },
                { provide: PrismaService, useValue: {} },
            ],
        }).compile();

        controller = module.get<CardTransactionsController>(CardTransactionsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CardTransactionsController } from './card-transactions.controller';

describe('CardTransactionsController', () => {
  let controller: CardTransactionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardTransactionsController],
    }).compile();

    controller = module.get<CardTransactionsController>(CardTransactionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

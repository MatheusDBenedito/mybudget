import { Test, TestingModule } from '@nestjs/testing';
import { CardTransactionsService } from './card-transactions.service';

describe('CardTransactionsService', () => {
  let service: CardTransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CardTransactionsService],
    }).compile();

    service = module.get<CardTransactionsService>(CardTransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

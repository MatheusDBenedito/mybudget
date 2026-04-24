import { PartialType } from '@nestjs/mapped-types';
import { CreateCardTransactionDto } from './create-card-transaction.dto';

export class UpdateCardTransactionDto extends PartialType(CreateCardTransactionDto) { }

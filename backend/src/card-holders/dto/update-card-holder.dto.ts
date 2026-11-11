import { PartialType } from '@nestjs/mapped-types';
import { CreateCardHolderDto } from './create-card-holder.dto';

export class UpdateCardHolderDto extends PartialType(CreateCardHolderDto) { }

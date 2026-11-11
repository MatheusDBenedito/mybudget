import { PartialType } from '@nestjs/mapped-types';
import { CreateMilesEntryDto } from './create-miles-entry.dto';

export class UpdateMilesEntryDto extends PartialType(CreateMilesEntryDto) { }

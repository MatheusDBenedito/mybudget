import { IsObject } from 'class-validator';

export class UpdateMilesValuationsDto {
    @IsObject()
    rates: Record<string, number>;
}

import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MilesStatus } from '@prisma/client';

export class CreateMilesEntryDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(60)
    program: string;

    @IsInt()
    @Min(1)
    points: number;

    @IsEnum(MilesStatus)
    @IsOptional()
    status?: MilesStatus;

    @IsDateString()
    expectedCreditDate: string;

    // Origem: cartão cadastrado ou texto livre (pelo menos um deve ser informado)
    @IsString()
    @IsOptional()
    creditCardId?: string | null;

    @IsString()
    @IsOptional()
    @MaxLength(80)
    origin?: string | null;

    @IsInt()
    @Min(1)
    @Max(12)
    @IsOptional()
    referenceMonth?: number;

    @IsInt()
    @Min(2000)
    @IsOptional()
    referenceYear?: number;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    notes?: string | null;
}

import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsNumber()
    @IsOptional()
    balance?: number;

    // CHECKING = conta corrente (não rende); YIELDING = conta remunerada (% do CDI)
    @IsEnum(AccountType)
    @IsOptional()
    type?: AccountType;

    // Obrigatório para contas remuneradas, ex: 100 = 100% do CDI
    @IsNumber()
    @Min(0.01)
    @Max(500)
    @IsOptional()
    cdiPercentage?: number | null;
}

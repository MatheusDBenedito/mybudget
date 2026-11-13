import { IsBoolean, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsNumber()
    @IsOptional()
    balance?: number;

    @IsString()
    @IsIn(['BRL', 'USD'])
    @IsOptional()
    currency?: 'BRL' | 'USD';

    @IsNumber()
    @Min(0)
    @IsOptional()
    balanceUsd?: number | null;

    @IsNumber()
    @Min(0)
    @IsOptional()
    investedBrl?: number | null;

    @IsNumber()
    @Min(0)
    @IsOptional()
    purchaseExchangeRate?: number | null;

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

    // Se incide IOF sobre os rendimentos nos primeiros 30 dias (padrão Mercado Pago = false/isento)
    @IsBoolean()
    @IsOptional()
    hasIof?: boolean;
}

import { IsString, IsEnum, IsNumber, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { InvestmentType } from '@prisma/client';

export class CreateInvestmentDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(InvestmentType)
    @IsNotEmpty()
    type: InvestmentType;

    @IsNumber()
    investedAmount: number;

    @IsOptional()
    @IsNumber()
    currentValue?: number;

    @IsOptional()
    @IsDateString()
    investmentDate?: string;

    @IsOptional()
    @IsNumber()
    cdiPercentage?: number;

    // Variable income fields
    @IsOptional()
    @IsString()
    sector?: string;

    @IsOptional()
    @IsString()
    tickerCode?: string;

    @IsOptional()
    @IsNumber()
    averagePrice?: number;

    @IsOptional()
    @IsNumber()
    currentPrice?: number;

    @IsOptional()
    @IsNumber()
    quantity?: number;

    // US stocks/ETFs: BRL per USD paid at purchase
    @IsOptional()
    @IsNumber()
    purchaseExchangeRate?: number;
}

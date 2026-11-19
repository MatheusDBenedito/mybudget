import {
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateInvestmentGoalDto {
    @IsString()
    @IsNotEmpty({ message: 'Informe um nome para a meta.' })
    name: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    initialAmount?: number;

    @IsOptional()
    @IsBoolean()
    usePortfolioAsInitial?: boolean;

    @IsNumber()
    @Min(0)
    monthlySalary: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    monthlyExpense?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(60)
    emergencyReserveMonths?: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    savingsRatePct: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(500)
    cdiPercentage?: number;

    @IsOptional()
    @IsNumber()
    @Min(0.1)
    @Max(100)
    cdiAnnualRatePct?: number | null;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(600)
    horizonMonths?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    targetAmount?: number | null;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    startMonth?: number | null;

    @IsOptional()
    @IsInt()
    @Min(2000)
    @Max(2100)
    startYear?: number | null;

    @IsOptional()
    @IsString()
    notes?: string | null;
}

export class UpdateInvestmentGoalDto extends PartialType(CreateInvestmentGoalDto) {}

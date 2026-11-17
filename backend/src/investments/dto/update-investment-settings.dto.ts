import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateInvestmentSettingsDto {
    @IsOptional()
    @IsNumber()
    @Min(0)
    variableIncomeContributedAmount?: number | null;
}

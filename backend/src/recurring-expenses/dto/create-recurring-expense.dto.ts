import { IsNotEmpty, IsNumber, IsString, IsOptional, IsUUID, Min, Max, IsBoolean } from 'class-validator';

export class CreateRecurringExpenseDto {
    @IsString()
    @IsNotEmpty()
    description: string;

    @IsNumber()
    @Min(0.01)
    amount: number;

    @IsNumber()
    @Min(1)
    @Max(31)
    billingDay: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsUUID()
    accountId: string;

    @IsOptional()
    @IsUUID()
    categoryId?: string;
}

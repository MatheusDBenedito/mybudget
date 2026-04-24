import { IsNotEmpty, IsNumber, IsString, IsOptional, IsDateString, IsUUID, Min, IsBoolean } from 'class-validator';

export class CreateCardTransactionDto {
    @IsString()
    @IsNotEmpty()
    description: string;

    @IsNumber()
    @Min(0.01)
    amount: number;

    @IsDateString()
    date: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    installments?: number;

    @IsUUID()
    creditCardId: string;

    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @IsOptional()
    @IsBoolean()
    isFixed?: boolean;
}

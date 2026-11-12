import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional, IsDateString, IsUUID, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { TransactionType, TransactionStatus } from '@prisma/client';

export class CreateTransactionDto {
    @IsString()
    @IsNotEmpty()
    description: string;

    @IsNumber()
    amount: number;

    @IsDateString()
    date: string;

    @IsEnum(TransactionType)
    type: TransactionType;

    @IsOptional()
    @IsEnum(TransactionStatus)
    status?: TransactionStatus;

    @IsOptional()
    @IsBoolean()
    isFixed?: boolean;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(480)
    installments?: number;

    @IsOptional()
    @IsUUID()
    accountId?: string;

    @IsOptional()
    @IsUUID()
    categoryId?: string;
}

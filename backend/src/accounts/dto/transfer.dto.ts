import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateTransferDto {
    @IsString()
    @IsNotEmpty()
    fromAccountId: string;

    @IsString()
    @IsNotEmpty()
    toAccountId: string;

    @IsNumber()
    @Min(0.01)
    amount: number;

    // yyyy-mm-dd; padrão: hoje
    @IsDateString()
    @IsOptional()
    date?: string;

    @IsString()
    @MaxLength(120)
    @IsOptional()
    description?: string;
}

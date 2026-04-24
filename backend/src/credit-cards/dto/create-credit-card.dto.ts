import { IsNotEmpty, IsNumber, IsString, Max, Min, IsOptional } from 'class-validator';

export class CreateCreditCardDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsNumber()
    @Min(0.01)
    limit: number;

    @IsNumber()
    @Min(1)
    @Max(28)
    invoiceClosingOffset: number;

    @IsNumber()
    @Min(1)
    @Max(28)
    dueDay: number;

    @IsString()
    @IsOptional()
    color?: string;
}

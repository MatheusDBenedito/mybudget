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

    // Fator de conversão: pontos gerados por US$ gasto (ex: 2.2)
    @IsNumber()
    @Min(0)
    @Max(100)
    @IsOptional()
    pointsPerDollar?: number;

    // Programa onde os pontos acumulam (ex: Livelo, Esfera)
    @IsString()
    @IsOptional()
    loyaltyProgram?: string;

    // Nome do portador titular criado junto com o cartão
    @IsString()
    @IsOptional()
    holderName?: string;
}

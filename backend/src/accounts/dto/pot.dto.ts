import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePotDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    // ex: 120 = 120% do CDI
    @IsNumber()
    @Min(0.01)
    @Max(500)
    cdiPercentage: number;

    // Valor guardado já na criação (sai do saldo livre da conta)
    @IsNumber()
    @Min(0)
    @IsOptional()
    initialAmount?: number;

    // yyyy-mm-dd: dia em que o cofrinho foi criado (pode ser no passado); padrão: hoje
    @IsDateString()
    @IsOptional()
    date?: string;
}

export class UpdatePotDto {
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    name?: string;

    @IsNumber()
    @Min(0.01)
    @Max(500)
    @IsOptional()
    cdiPercentage?: number;
}

export class FreeBalanceDto {
    // Novo saldo livre (fora dos cofrinhos); 0 zera
    @IsNumber()
    @Min(0)
    balance: number;
}

export class PotAdjustDto {
    // Saldo atual do cofrinho como mostrado no app do banco
    @IsNumber()
    @Min(0)
    balance: number;
}

export class PotAmountDto {
    @IsNumber()
    @Min(0.01)
    amount: number;

    // yyyy-mm-dd: dia em que o dinheiro foi guardado/retirado (pode ser no passado); padrão: hoje
    @IsDateString()
    @IsOptional()
    date?: string;
}

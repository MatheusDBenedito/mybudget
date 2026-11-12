import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { TransactionStatus } from '@prisma/client';

export class UpdateTransactionStatusDto {
    @IsEnum(TransactionStatus)
    @IsNotEmpty()
    status: TransactionStatus;

    // Conta que recebe (receita) ou paga (despesa) quando o lançamento é marcado como PAID.
    // Omitido: usa a conta já vinculada ao lançamento.
    @IsString()
    @IsOptional()
    accountId?: string;

    // Permite ajustar o valor estimado para o valor real no momento do pagamento/recebimento.
    @IsNumber()
    @IsPositive()
    @IsOptional()
    amount?: number;
}

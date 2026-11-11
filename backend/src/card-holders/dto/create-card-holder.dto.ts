import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCardHolderDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(60)
    name: string;

    @IsOptional()
    @Matches(/^\d{4}$/, { message: 'O final do cartão deve ter 4 dígitos.' })
    last4?: string | null;

    @IsOptional()
    @IsBoolean()
    isMain?: boolean;
}

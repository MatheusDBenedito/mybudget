import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateConnectTokenDto {
    @IsOptional()
    @IsString()
    itemId?: string;
}

export class RegisterConnectionDto {
    @IsString()
    @IsNotEmpty()
    itemId: string;

    @IsOptional()
    @IsString()
    institutionName?: string;
}

export class UpdateAccountMapDto {
    @IsOptional()
    @IsString()
    localAccountId?: string | null;

    @IsOptional()
    @IsString()
    localCreditCardId?: string | null;

    @IsOptional()
    @IsBoolean()
    syncEnabled?: boolean;
}


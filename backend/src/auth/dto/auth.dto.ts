import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
    @IsString()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsOptional()
    @IsBoolean()
    rememberMe?: boolean;
}

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
    password: string;

    @IsOptional()
    @IsString()
    workspaceName?: string;
}

export class ForgotPasswordDto {
    @IsEmail({}, { message: 'Informe um e-mail válido.' })
    email: string;
}

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty({ message: 'Token de recuperação obrigatório.' })
    token: string;

    @IsString()
    @MinLength(8, { message: 'A nova senha deve ter pelo menos 8 caracteres.' })
    newPassword: string;
}

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty({ message: 'Informe sua senha atual.' })
    currentPassword: string;

    @IsString()
    @MinLength(8, { message: 'A nova senha deve ter pelo menos 8 caracteres.' })
    newPassword: string;
}


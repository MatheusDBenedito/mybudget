import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWorkspaceDto {
    @IsString()
    @IsNotEmpty()
    name: string;
}

export class SetDefaultWorkspaceDto {
    @IsUUID()
    workspaceId: string;
}

export class CreateInviteDto {
    @IsEmail()
    email: string;

    @IsUUID()
    roleId: string;
}

export class UpdateMemberRoleDto {
    @IsUUID()
    roleId: string;
}

export class CreateAdminPermissionDto {
    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsNotEmpty()
    module: string;

    @IsString()
    @IsNotEmpty()
    action: string;

    @IsString()
    @IsNotEmpty()
    description: string;
}

export class CreateAdminRoleDto {
    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;
}


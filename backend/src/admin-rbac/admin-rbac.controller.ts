import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { RequireSuperAdmin } from '../auth/decorators/permissions.decorator';
import { CreateAdminPermissionDto, CreateAdminRoleDto } from '../workspaces/dto/workspace.dto';
import { AdminRbacService } from './admin-rbac.service';

class SetRolePermissionsDto {
    @IsArray()
    @IsUUID('4', { each: true })
    permissionIds: string[];
}

class CreatePlanDto {
    @IsString()
    code: string;

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsArray()
    @IsString({ each: true })
    allowedModules: string[];
}

class SetPlanModulesDto {
    @IsArray()
    @IsString({ each: true })
    allowedModules: string[];
}

class SetUserPlanDto {
    @IsUUID('4')
    planId: string;
}

@Controller('admin')
@RequireSuperAdmin()
export class AdminRbacController {
    constructor(private readonly adminRbacService: AdminRbacService) { }

    @Get('overview')
    getOverview() {
        return this.adminRbacService.getPlatformOverview();
    }

    @Get('permissions')
    listPermissions() {
        return this.adminRbacService.listPermissions();
    }

    @Post('permissions')
    createPermission(@Body() dto: CreateAdminPermissionDto) {
        return this.adminRbacService.createPermission(dto);
    }

    @Delete('permissions/:id')
    deletePermission(@Param('id') id: string) {
        return this.adminRbacService.deletePermission(id);
    }

    @Get('roles')
    listRoles() {
        return this.adminRbacService.listRoles();
    }

    @Post('roles')
    createRole(@Body() dto: CreateAdminRoleDto) {
        return this.adminRbacService.createRole(dto);
    }

    @Patch('roles/:id/permissions')
    setRolePermissions(@Param('id') id: string, @Body() dto: SetRolePermissionsDto) {
        return this.adminRbacService.setRolePermissions(id, dto.permissionIds);
    }

    @Get('plans')
    listPlans() {
        return this.adminRbacService.listPlans();
    }

    @Post('plans')
    createPlan(@Body() dto: CreatePlanDto) {
        return this.adminRbacService.createPlan(dto);
    }

    @Patch('plans/:id/modules')
    setPlanModules(@Param('id') id: string, @Body() dto: SetPlanModulesDto) {
        return this.adminRbacService.setPlanModules(id, dto.allowedModules);
    }

    @Get('users')
    listUsers() {
        return this.adminRbacService.listUsers();
    }

    @Patch('users/:id/plan')
    setUserPlan(@Param('id') id: string, @Body() dto: SetUserPlanDto) {
        return this.adminRbacService.setUserPlan(id, dto.planId);
    }
}


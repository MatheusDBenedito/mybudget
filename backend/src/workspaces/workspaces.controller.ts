import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
    type AuthUserPayload,
    CurrentUser,
    CurrentWorkspace,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import {
    CreateInviteDto,
    CreateWorkspaceDto,
    SetDefaultWorkspaceDto,
    UpdateMemberRoleDto,
} from './dto/workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
    constructor(private readonly workspacesService: WorkspacesService) {}

    @Get()
    listMine(@CurrentUser() user: AuthUserPayload) {
        return this.workspacesService.listUserWorkspaces(user.userId);
    }

    @Post()
    create(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateWorkspaceDto) {
        return this.workspacesService.createWorkspace(user.userId, dto);
    }

    @Patch('default')
    setDefault(@CurrentUser() user: AuthUserPayload, @Body() dto: SetDefaultWorkspaceDto) {
        return this.workspacesService.setDefaultWorkspace(user.userId, dto.workspaceId);
    }

    @Get('roles')
    listRoles() {
        return this.workspacesService.listAvailableRoles();
    }

    @Get('invites/pending')
    listPendingInvites(@CurrentUser() user: AuthUserPayload) {
        return this.workspacesService.listPendingInvitesForEmail(user.email);
    }

    @Post('invites/:token/accept')
    acceptInvite(@CurrentUser() user: AuthUserPayload, @Param('token') token: string) {
        return this.workspacesService.acceptInvite(user.userId, user.email, token);
    }

    @Get('current/members')
    @RequirePermissions('view:membros')
    listMembers(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.workspacesService.listMembers(ctx.workspaceId);
    }

    @Get('current/invites')
    @RequirePermissions('manage:membros')
    listWorkspaceInvites(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
        return this.workspacesService.listWorkspaceInvites(ctx.workspaceId);
    }

    @Post('current/invites')
    @RequirePermissions('manage:membros')
    createInvite(@CurrentWorkspace() ctx: WorkspaceRequestContext, @Body() dto: CreateInviteDto) {
        return this.workspacesService.createInvite(ctx.workspaceId, ctx.userId, dto);
    }

    @Delete('current/invites/:inviteId')
    @RequirePermissions('manage:membros')
    revokeInvite(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('inviteId') inviteId: string,
    ) {
        return this.workspacesService.revokeInvite(ctx.workspaceId, inviteId);
    }

    @Patch('current/members/:memberId/role')
    @RequirePermissions('manage:membros')
    updateMemberRole(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('memberId') memberId: string,
        @Body() dto: UpdateMemberRoleDto,
    ) {
        return this.workspacesService.updateMemberRole(ctx.workspaceId, ctx.userId, memberId, dto.roleId);
    }

    @Delete('current/members/:memberId')
    @RequirePermissions('manage:membros')
    removeMember(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('memberId') memberId: string,
    ) {
        return this.workspacesService.removeMember(ctx.workspaceId, ctx.userId, memberId);
    }
}

import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { type AuthUserPayload, CurrentUser, Public } from './decorators/permissions.decorator';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('login')
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Public()
    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Get('me')
    me(
        @CurrentUser() user: AuthUserPayload,
        @Headers('x-workspace-id') workspaceId?: string,
    ) {
        return this.authService.getProfile(user.userId, workspaceId);
    }
}

import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
    ChangePasswordDto,
    ForgotPasswordDto,
    LoginDto,
    RegisterDto,
    ResetPasswordDto,
} from './dto/auth.dto';
import { type AuthUserPayload, CurrentUser, Public } from './decorators/permissions.decorator';

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('login')
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Public()
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Public()
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @Public()
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    @Post('change-password')
    changePassword(
        @CurrentUser() user: AuthUserPayload,
        @Body() dto: ChangePasswordDto,
    ) {
        return this.authService.changePassword(user.userId, dto);
    }

    @SkipThrottle()
    @Get('me')
    me(
        @CurrentUser() user: AuthUserPayload,
        @Headers('x-workspace-id') workspaceId?: string,
    ) {
        return this.authService.getProfile(user.userId, workspaceId);
    }
}

import {
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
    ChangePasswordDto,
    ForgotPasswordDto,
    LoginDto,
    RegisterDto,
    ResetPasswordDto,
} from './dto/auth.dto';
import { type AuthUserPayload, CurrentUser, Public } from './decorators/permissions.decorator';
import {
    getRefreshMaxAgeMs,
    parseCookieHeader,
    REFRESH_COOKIE_NAME,
} from './refresh-token.helper';

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    private setRefreshCookie(res: Response, token: string, rememberMe: boolean): void {
        const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
        res.cookie(REFRESH_COOKIE_NAME, token, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            path: '/',
            maxAge: getRefreshMaxAgeMs(rememberMe),
        });
    }

    private clearRefreshCookie(res: Response): void {
        const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
        res.clearCookie(REFRESH_COOKIE_NAME, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            path: '/',
        });
    }

    @Public()
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('login')
    async login(
        @Body() dto: LoginDto,
        @Headers('user-agent') userAgent: string | undefined,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { refreshToken, rememberMe, ...payload } = await this.authService.login(dto, userAgent);
        this.setRefreshCookie(res, refreshToken, rememberMe);
        return payload;
    }

    @Public()
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('register')
    async register(
        @Body() dto: RegisterDto,
        @Headers('user-agent') userAgent: string | undefined,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { refreshToken, rememberMe, ...payload } = await this.authService.register(dto, userAgent);
        this.setRefreshCookie(res, refreshToken, rememberMe);
        return payload;
    }

    @Public()
    @SkipThrottle()
    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refresh(
        @Req() req: Request,
        @Headers('user-agent') userAgent: string | undefined,
        @Headers('x-workspace-id') workspaceId: string | undefined,
        @Res({ passthrough: true }) res: Response,
    ) {
        const rawRefreshToken = parseCookieHeader(req.headers.cookie, REFRESH_COOKIE_NAME);
        try {
            const { refreshToken, rememberMe, ...payload } = await this.authService.refreshSession(
                rawRefreshToken,
                userAgent,
                workspaceId,
            );
            this.setRefreshCookie(res, refreshToken, rememberMe);
            return payload;
        } catch (err) {
            this.clearRefreshCookie(res);
            throw err;
        }
    }

    @Public()
    @SkipThrottle()
    @HttpCode(HttpStatus.OK)
    @Post('logout')
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const rawRefreshToken = parseCookieHeader(req.headers.cookie, REFRESH_COOKIE_NAME);
        const result = await this.authService.logout(rawRefreshToken);
        this.clearRefreshCookie(res);
        return result;
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
    async changePassword(
        @CurrentUser() user: AuthUserPayload,
        @Body() dto: ChangePasswordDto,
        @Headers('user-agent') userAgent: string | undefined,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { refreshToken, rememberMe, ...payload } = await this.authService.changePassword(
            user.userId,
            dto,
            userAgent,
        );
        this.setRefreshCookie(res, refreshToken, rememberMe);
        return payload;
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

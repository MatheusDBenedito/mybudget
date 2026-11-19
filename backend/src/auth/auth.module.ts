import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { WorkspaceRbacGuard } from './guards/workspace-rbac.guard';
import { MailService } from './mail.service';

function resolveJwtSecret(): string {
    const secret = process.env.JWT_SECRET?.trim();
    if (secret && secret.length >= 32) {
        return secret;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'JWT_SECRET ausente ou fraco em produção. Defina uma chave com pelo menos 32 caracteres.',
        );
    }
    return secret || 'myfinance-local-dev-jwt-secret-min-32-chars';
}

@Global()
@Module({
    imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
        JwtModule.registerAsync({
            useFactory: () => ({
                secret: resolveJwtSecret(),
                signOptions: { expiresIn: '7d' },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, MailService, JwtAuthGuard, WorkspaceRbacGuard],
    exports: [AuthService, MailService, JwtModule, JwtAuthGuard, WorkspaceRbacGuard],
})
export class AuthModule {}

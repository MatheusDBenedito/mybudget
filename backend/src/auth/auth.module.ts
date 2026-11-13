import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { WorkspaceRbacGuard } from './guards/workspace-rbac.guard';

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
        JwtModule.registerAsync({
            useFactory: () => ({
                secret: resolveJwtSecret(),
                signOptions: { expiresIn: '7d' },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtAuthGuard, WorkspaceRbacGuard],
    exports: [AuthService, JwtModule, JwtAuthGuard, WorkspaceRbacGuard],
})
export class AuthModule {}

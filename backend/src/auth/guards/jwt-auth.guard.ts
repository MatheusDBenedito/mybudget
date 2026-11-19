import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUserPayload, IS_PUBLIC_KEY } from '../decorators/permissions.decorator';
import { isTokenVersionValid } from '../password-reset.helper';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        const req = context.switchToHttp().getRequest();
        const authHeader = req.headers['authorization'] as string | undefined;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Token de autenticação ausente.');
        }

        const token = authHeader.slice(7).trim();
        if (!token) {
            throw new UnauthorizedException('Token de autenticação inválido.');
        }

        let decoded: { sub: string; email: string; tv?: number };
        try {
            decoded = await this.jwtService.verifyAsync(token);
        } catch {
            throw new UnauthorizedException('Token expirado ou inválido.');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: decoded.sub },
            select: {
                id: true,
                email: true,
                name: true,
                isActive: true,
                isSuperAdmin: true,
                tokenVersion: true,
            },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedException('Usuário inativo ou não encontrado.');
        }

        if (!isTokenVersionValid(user.tokenVersion, decoded.tv)) {
            throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
        }

        req.user = {
            userId: user.id,
            email: user.email,
            name: user.name,
            isSuperAdmin: user.isSuperAdmin,
        } satisfies AuthUserPayload;

        return true;
    }
}


import { createHash, randomBytes } from 'crypto';

export const REFRESH_COOKIE_NAME = 'mf_refresh_token';
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TTL_SHORT_MS = 24 * 60 * 60 * 1000; // 24 hours
export const REFRESH_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken.trim()).digest('hex');
}

export function generateRefreshToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(48).toString('hex');
    return {
        rawToken,
        tokenHash: hashRefreshToken(rawToken),
    };
}

export function getRefreshMaxAgeMs(rememberMe: boolean): number {
    return rememberMe ? REFRESH_TTL_REMEMBER_MS : REFRESH_TTL_SHORT_MS;
}

export function computeRefreshExpiry(rememberMe: boolean, now: Date = new Date()): Date {
    return new Date(now.getTime() + getRefreshMaxAgeMs(rememberMe));
}

export function parseCookieHeader(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(';');
    for (const part of parts) {
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) continue;
        const key = part.slice(0, eqIdx).trim();
        if (key === name) {
            const rawVal = part.slice(eqIdx + 1).trim();
            if (!rawVal) return null;
            try {
                return decodeURIComponent(rawVal);
            } catch {
                return rawVal;
            }
        }
    }
    return null;
}

export type RefreshTokenCheckResult = 'VALID' | 'MISSING' | 'REVOKED_REUSE' | 'EXPIRED';

export function evaluateRefreshTokenStatus(
    record: { revokedAt: Date | null; expiresAt: Date } | null | undefined,
    now: Date = new Date(),
): RefreshTokenCheckResult {
    if (!record) return 'MISSING';
    if (record.revokedAt !== null) return 'REVOKED_REUSE';
    if (record.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
    return 'VALID';
}

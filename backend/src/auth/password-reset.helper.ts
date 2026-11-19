import { createHash, randomBytes } from 'crypto';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RESET_TTL_MINUTES = 30;

export function hashResetToken(rawToken: string): string {
    return createHash('sha256').update(rawToken.trim()).digest('hex');
}

export function generateResetToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString('hex');
    return {
        rawToken,
        tokenHash: hashResetToken(rawToken),
    };
}

export function computeResetExpiry(
    now: Date = new Date(),
    ttlMinutes: number = PASSWORD_RESET_TTL_MINUTES,
): Date {
    return new Date(now.getTime() + ttlMinutes * 60 * 1000);
}

export function isResetTokenValid(
    record: { expiresAt: Date; usedAt: Date | null } | null | undefined,
    now: Date = new Date(),
): boolean {
    if (!record) return false;
    if (record.usedAt !== null) return false;
    return record.expiresAt.getTime() > now.getTime();
}

export function isTokenVersionValid(
    userTokenVersion: number,
    decodedTokenVersion: number | undefined,
): boolean {
    // Tokens issued prior to tokenVersion rollout have no `tv` claim;
    // they stay valid while userTokenVersion === 0, and are invalidated as soon as
    // the user resets or changes their password (incrementing tokenVersion >= 1).
    if (decodedTokenVersion === undefined) {
        return userTokenVersion === 0;
    }
    return decodedTokenVersion === userTokenVersion;
}

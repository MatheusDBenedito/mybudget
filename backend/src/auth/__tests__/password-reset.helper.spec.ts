import {
    computeResetExpiry,
    generateResetToken,
    hashResetToken,
    isResetTokenValid,
    isTokenVersionValid,
} from '../password-reset.helper';

describe('password-reset.helper', () => {
    it('generates cryptographically random tokens and deterministic SHA-256 hashes', () => {
        const a = generateResetToken();
        const b = generateResetToken();

        expect(a.rawToken).toHaveLength(64);
        expect(a.tokenHash).toHaveLength(64);
        expect(a.rawToken).not.toBe(a.tokenHash);
        expect(a.rawToken).not.toBe(b.rawToken);
        expect(hashResetToken(a.rawToken)).toBe(a.tokenHash);
        expect(hashResetToken(`  ${a.rawToken}  `)).toBe(a.tokenHash);
    });

    it('computes expiry and validates unused non-expired tokens only', () => {
        const now = new Date('2026-11-19T12:00:00.000Z');
        const expiresAt = computeResetExpiry(now, 30);
        expect(expiresAt.toISOString()).toBe('2026-11-19T12:30:00.000Z');

        expect(isResetTokenValid({ expiresAt, usedAt: null }, new Date('2026-11-19T12:15:00.000Z'))).toBe(true);
        expect(isResetTokenValid({ expiresAt, usedAt: null }, new Date('2026-11-19T12:30:00.000Z'))).toBe(false);
        expect(isResetTokenValid({ expiresAt, usedAt: new Date('2026-11-19T12:05:00.000Z') }, new Date('2026-11-19T12:15:00.000Z'))).toBe(false);
        expect(isResetTokenValid(null, now)).toBe(false);
    });

    it('validates tokenVersion allowing legacy tokens only while tokenVersion is 0', () => {
        expect(isTokenVersionValid(0, undefined)).toBe(true);
        expect(isTokenVersionValid(0, 0)).toBe(true);
        expect(isTokenVersionValid(1, undefined)).toBe(false);
        expect(isTokenVersionValid(1, 0)).toBe(false);
        expect(isTokenVersionValid(1, 1)).toBe(true);
    });
});

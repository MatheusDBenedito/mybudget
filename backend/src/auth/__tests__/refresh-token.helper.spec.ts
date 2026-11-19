import {
    computeRefreshExpiry,
    evaluateRefreshTokenStatus,
    generateRefreshToken,
    getRefreshMaxAgeMs,
    hashRefreshToken,
    parseCookieHeader,
    REFRESH_TTL_REMEMBER_MS,
    REFRESH_TTL_SHORT_MS,
} from '../refresh-token.helper';

describe('refresh-token.helper', () => {
    it('generates opaque 96-hex-char tokens and deterministic SHA-256 hashes', () => {
        const a = generateRefreshToken();
        const b = generateRefreshToken();
        expect(a.rawToken).toHaveLength(96);
        expect(a.tokenHash).toHaveLength(64);
        expect(a.rawToken).not.toBe(b.rawToken);
        expect(hashRefreshToken(a.rawToken)).toBe(a.tokenHash);
    });

    it('computes 24h vs 30d expiry based on rememberMe', () => {
        const now = new Date('2026-11-19T12:00:00.000Z');
        expect(getRefreshMaxAgeMs(false)).toBe(REFRESH_TTL_SHORT_MS);
        expect(getRefreshMaxAgeMs(true)).toBe(REFRESH_TTL_REMEMBER_MS);
        expect(computeRefreshExpiry(false, now).toISOString()).toBe('2026-11-20T12:00:00.000Z');
        expect(computeRefreshExpiry(true, now).toISOString()).toBe('2026-12-19T12:00:00.000Z');
    });

    it('parses cookies cleanly from Cookie header', () => {
        const header = 'foo=bar; mf_refresh_token=abc123%3D; other=1';
        expect(parseCookieHeader(header, 'mf_refresh_token')).toBe('abc123=');
        expect(parseCookieHeader(header, 'foo')).toBe('bar');
        expect(parseCookieHeader(header, 'missing')).toBeNull();
        expect(parseCookieHeader(undefined, 'mf_refresh_token')).toBeNull();
    });

    it('detects valid, missing, expired, and revoked reuse states', () => {
        const now = new Date('2026-11-19T12:00:00.000Z');
        const future = new Date('2026-11-20T12:00:00.000Z');
        const past = new Date('2026-11-18T12:00:00.000Z');

        expect(evaluateRefreshTokenStatus(null, now)).toBe('MISSING');
        expect(evaluateRefreshTokenStatus({ revokedAt: null, expiresAt: future }, now)).toBe('VALID');
        expect(evaluateRefreshTokenStatus({ revokedAt: null, expiresAt: past }, now)).toBe('EXPIRED');
        expect(evaluateRefreshTokenStatus({ revokedAt: past, expiresAt: future }, now)).toBe('REVOKED_REUSE');
    });
});

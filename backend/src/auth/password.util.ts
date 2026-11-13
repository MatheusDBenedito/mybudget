import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LEN = 64;

export function hashPassword(plain: string): string {
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(plain, salt, KEY_LEN).toString('hex');
    return `${salt}:${derived}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
    const [salt, hex] = stored.split(':');
    if (!salt || !hex) return false;
    const expected = Buffer.from(hex, 'hex');
    const actual = scryptSync(plain, salt, KEY_LEN);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
}


import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hashedPassword = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hashedPassword}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
    const [salt, key] = storedHash.split(':');
    const hashedPassword = scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    return timingSafeEqual(hashedPassword, keyBuffer);
}

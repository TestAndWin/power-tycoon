import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Random game id (16 bytes) and secret token (32 bytes), both base64url (ADR-003). */
export const newGameId = (): string => randomBytes(16).toString('base64url');
export const newToken = (): string => randomBytes(32).toString('base64url');
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Constant-time comparison of a presented token with the stored hash. */
export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Extracts the token from `Authorization: Bearer <token>`. */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(header.trim());
  return m ? m[1]! : null;
}

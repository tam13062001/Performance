import { createHmac, timingSafeEqual } from 'crypto';

// BẮT BUỘC set biến này trong .env ở production — nếu không sẽ dùng giá trị mặc định KHÔNG an toàn
const SECRET = process.env.SHARE_SESSION_SECRET ?? 'dev-only-insecure-secret-change-me';
const DAYS_VALID = 7;

export function signShareSession(slug: string): { token: string; maxAgeSeconds: number } {
  const expiresAt = Date.now() + DAYS_VALID * 24 * 60 * 60 * 1000;
  const payload = `${slug}.${expiresAt}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return { token: `${payload}.${sig}`, maxAgeSeconds: DAYS_VALID * 24 * 60 * 60 };
}

export function verifyShareSession(token: string | undefined, slug: string): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [tokenSlug, expiresAtStr, sig] = parts;
  if (tokenSlug !== slug) return false;
  const expiresAt = Number(expiresAtStr);
  if (!expiresAt || Date.now() > expiresAt) return false;

  const expectedSig = createHmac('sha256', SECRET).update(`${tokenSlug}.${expiresAtStr}`).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(sigBuf, expectedBuf);
}
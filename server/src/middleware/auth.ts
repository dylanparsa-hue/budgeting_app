import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to carry userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// ── Startup validation ───────────────────────────────────────────────────────
// Fail fast if required secrets are missing — never use insecure fallbacks.
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET) {
  console.error('[Auth] FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}

if (!JWT_REFRESH_SECRET) {
  console.error('[Auth] FATAL: JWT_REFRESH_SECRET environment variable is not set.');
  process.exit(1);
}

/**
 * Middleware: verify JWT access token from Authorization header.
 * Sets `req.userId` on success.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET!) as jwt.JwtPayload;
    if (!payload.sub) {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }
    req.userId = payload.sub as string;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Generate a JWT access token (15 min default).
 */
export function generateAccessToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: 'access' },
    JWT_SECRET!,
    { expiresIn: (process.env.JWT_ACCESS_EXPIRY || '15m') as jwt.SignOptions['expiresIn'] },
  );
}

/**
 * Generate a JWT refresh token (7 day default).
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    JWT_REFRESH_SECRET!,
    { expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as jwt.SignOptions['expiresIn'] },
  );
}

/**
 * Verify a refresh token and return the userId.
 * Returns null if the token is invalid or expired.
 */
export function verifyRefreshToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET!) as jwt.JwtPayload;
    if (payload.type !== 'refresh' || !payload.sub) return null;
    return payload.sub as string;
  } catch {
    return null;
  }
}

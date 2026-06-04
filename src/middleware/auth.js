import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { getOrSetCache, invalidateCache } from '../utils/cache.js';
import { getJwtSecret } from '../utils/authConfig.js';

const JWT_SECRET = getJwtSecret();

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getOrSetCache(
      `auth:user:${decoded.id}`,
      () => prisma.user.findUnique({ where: { id: decoded.id } }),
      60_000
    );

    if (!user || !user.active) {
      return res.status(403).json({ error: 'User account is inactive or not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    return res.status(401).json({ error: 'Invalid or expired access token.' });
  }
}

export function invalidateAuthUser(userId) {
  invalidateCache(`auth:user:${userId}`);
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    // ADMIN has bypass access to everything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ error: `Forbidden: Access restricted for ${req.user.role} role.` });
  };
}

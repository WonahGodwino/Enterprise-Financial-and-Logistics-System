import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { hasGlobalSubsidiaryAccess, resolveUserSubsidiaryAccess } from '../utils/subsidiaryScope.js';

export const authenticate = async (req, res, next) => {
  try {
    // Bypass authentication for public auth endpoints (login, refresh, forgot/reset)
    const publicAuthPaths = ['/auth/login', '/auth/refresh-token', '/auth/forgot-password', '/auth/reset-password', '/auth/change-password'];
    if (publicAuthPaths.some(p => req.originalUrl.includes(p))) {
      return next();
    }
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const tokenUserId = decoded.userId || decoded.id;

    if (!tokenUserId) {
      throw new AppError('Invalid token payload', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenUserId },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        subsidiaryId: true,
        subsidiaryAccess: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 401);
    }

    const scopedAccess = await resolveUserSubsidiaryAccess({
      role: user.role,
      userSubsidiaryId: user.subsidiaryId,
      userSubsidiaryAccess: user.subsidiaryAccess,
    });

    req.user = {
      ...user,
      subsidiaryAccess: scopedAccess,
    };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(error);
  }
};

export const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const authorizeSubsidiary = (req, res, next) => {
  const { subsidiaryId } = req.params;
  
  if (req.user.role === 'ADMIN' || hasGlobalSubsidiaryAccess(req.user.role)) {
    return next();
  }

  if (!req.user.subsidiaryAccess.includes(subsidiaryId)) {
    return res.status(403).json({ error: 'Access to this subsidiary denied' });
  }

  next();
};
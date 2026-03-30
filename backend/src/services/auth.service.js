import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { jwtConfig } from '../config/auth.js';
import {
  resolveScopedSubsidiaryId,
  resolveUserSubsidiaryAccess,
  hasGlobalSubsidiaryAccess,
} from '../utils/subsidiaryScope.js';

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || jwtConfig.secret;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || `${ACCESS_TOKEN_SECRET}-refresh`;

const signAccessToken = (userId) => jwt.sign({ userId, id: userId }, ACCESS_TOKEN_SECRET, { expiresIn: jwtConfig.expiresIn });
const signRefreshToken = (userId) => jwt.sign({ userId, type: 'refresh' }, REFRESH_TOKEN_SECRET, { expiresIn: jwtConfig.refreshExpiresIn });

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const sanitizeUser = (user, subsidiaryAccess = user?.subsidiaryAccess || []) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  subsidiaryAccess,
  subsidiaryId: user.subsidiaryId,
  isActive: user.isActive,
});

const AuthService = {
  async register(userData) {
    const normalizedEmail = normalizeEmail(userData?.email);
    const plainPassword = String(userData?.password || '').trim();

    if (!normalizedEmail || !plainPassword) {
      throw new AppError('Email and password are required', 400);
    }

    const exists = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true },
    });

    if (exists) {
      throw new AppError('Email already in use', 409);
    }

    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const resolvedSubsidiaryId = await resolveScopedSubsidiaryId({
      requestedSubsidiaryId: userData.subsidiaryId,
      userSubsidiaryId: null,
      userSubsidiaryAccess: userData.subsidiaryAccess,
    });

    const normalizedAccess = Array.isArray(userData.subsidiaryAccess)
      ? userData.subsidiaryAccess.filter(Boolean)
      : [];

    if (!normalizedAccess.includes(resolvedSubsidiaryId)) {
      normalizedAccess.push(resolvedSubsidiaryId);
    }

    const requestedRole = String(userData.role || 'VIEWER').toUpperCase();
    const accessToPersist = hasGlobalSubsidiaryAccess(requestedRole)
      ? await resolveUserSubsidiaryAccess({
        role: requestedRole,
        userSubsidiaryId: resolvedSubsidiaryId,
        userSubsidiaryAccess: normalizedAccess,
      })
      : normalizedAccess;

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: userData.fullName || 'New User',
        role: requestedRole,
        subsidiaryAccess: accessToPersist,
        subsidiaryId: resolvedSubsidiaryId,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        subsidiaryAccess: true,
        subsidiaryId: true,
        isActive: true,
      },
    });

    const scopedAccess = await resolveUserSubsidiaryAccess({
      role: user.role,
      userSubsidiaryId: user.subsidiaryId,
      userSubsidiaryAccess: user.subsidiaryAccess,
    });

    return sanitizeUser(user, scopedAccess);
  },

  async login(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const plainPassword = String(password || '');

    if (!normalizedEmail || !plainPassword) {
      throw new AppError('Email and password are required', 400);
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        role: true,
        subsidiaryAccess: true,
        subsidiaryId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401);
    }

    const passwordMatches = await bcrypt.compare(plainPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError('Invalid credentials', 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const scopedAccess = await resolveUserSubsidiaryAccess({
      role: user.role,
      userSubsidiaryId: user.subsidiaryId,
      userSubsidiaryAccess: user.subsidiaryAccess,
    });

    return {
      user: sanitizeUser(user, scopedAccess),
      accessToken: signAccessToken(user.id),
      refreshToken: signRefreshToken(user.id),
    };
  },

  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch (_error) {
      throw new AppError('Invalid refresh token', 401);
    }

    if (!decoded?.userId || decoded.type !== 'refresh') {
      throw new AppError('Invalid refresh token', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('Invalid refresh token', 401);
    }

    return { accessToken: signAccessToken(user.id) };
  },

  async logout(refreshToken) {
    return true;
  },

  async verifyEmail(token) {
    return { verified: true };
  },

  async forgotPassword(email) {
    return true;
  },

  async resetPassword(token, password) {
    return true;
  },

  async changePassword(userId, currentPassword, newPassword) {
    return true;
  },

  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        subsidiaryAccess: true,
        subsidiaryId: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const scopedAccess = await resolveUserSubsidiaryAccess({
      role: user.role,
      userSubsidiaryId: user.subsidiaryId,
      userSubsidiaryAccess: user.subsidiaryAccess,
    });

    return sanitizeUser(user, scopedAccess);
  },

  async updateProfile(userId, updateData) {
    const nextEmail = updateData?.email ? normalizeEmail(updateData.email) : undefined;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(nextEmail ? { email: nextEmail } : {}),
        ...(typeof updateData?.fullName === 'string' ? { fullName: updateData.fullName.trim() } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        subsidiaryAccess: true,
        subsidiaryId: true,
        isActive: true,
      },
    });

    const scopedAccess = await resolveUserSubsidiaryAccess({
      role: updated.role,
      userSubsidiaryId: updated.subsidiaryId,
      userSubsidiaryAccess: updated.subsidiaryAccess,
    });

    return sanitizeUser(updated, scopedAccess);
  }
};

export default AuthService;

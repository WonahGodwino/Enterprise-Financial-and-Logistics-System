import prisma from '../config/database.js';
import { AppError } from './AppError.js';

const MAIN_CODE = 'MAIN';
const GLOBAL_SUBSIDIARY_ROLES = new Set(['CEO', 'SUPER_ADMIN']);

const findMainSubsidiary = async () => {
  return prisma.subsidiary.findFirst({
    where: {
      code: { equals: MAIN_CODE, mode: 'insensitive' },
      isActive: true,
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
};

const findFirstActiveSubsidiary = async () => {
  return prisma.subsidiary.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
};

const normalizeInput = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const listActiveSubsidiaryIds = async () => {
  const rows = await prisma.subsidiary.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((row) => row.id).filter(Boolean);
};

export const hasGlobalSubsidiaryAccess = (role) => {
  const normalizedRole = String(role || '').trim().toUpperCase();
  return GLOBAL_SUBSIDIARY_ROLES.has(normalizedRole);
};

export const resolveUserSubsidiaryAccess = async ({
  role,
  userSubsidiaryId,
  userSubsidiaryAccess = [],
}) => {
  if (hasGlobalSubsidiaryAccess(role)) {
    const activeIds = await listActiveSubsidiaryIds();
    if (activeIds.length > 0) return activeIds;
    return [await resolveMainSubsidiaryId()];
  }

  const normalizedAccess = Array.isArray(userSubsidiaryAccess)
    ? userSubsidiaryAccess.map(normalizeInput).filter(Boolean)
    : [];
  const normalizedUserSubsidiaryId = normalizeInput(userSubsidiaryId);

  if (normalizedUserSubsidiaryId && !normalizedAccess.includes(normalizedUserSubsidiaryId)) {
    normalizedAccess.push(normalizedUserSubsidiaryId);
  }

  if (normalizedAccess.length > 0) return normalizedAccess;
  return [await resolveMainSubsidiaryId()];
};

export const resolveMainSubsidiaryId = async () => {
  const main = await findMainSubsidiary();
  if (main?.id) return main.id;

  const fallback = await findFirstActiveSubsidiary();
  if (fallback?.id) return fallback.id;

  throw new AppError('No active subsidiary found. Create a MAIN or active subsidiary first.', 400);
};

export const resolveScopedSubsidiaryId = async ({
  requestedSubsidiaryId,
  userSubsidiaryId,
  userSubsidiaryAccess = [],
}) => {
  const normalizedRequested = normalizeInput(requestedSubsidiaryId);
  const normalizedUserSubsidiaryId = normalizeInput(userSubsidiaryId);
  const normalizedUserAccess = Array.isArray(userSubsidiaryAccess)
    ? userSubsidiaryAccess.map(normalizeInput).filter(Boolean)
    : [];

  if (normalizedRequested) {
    if (normalizedRequested.toUpperCase() === MAIN_CODE) {
      return resolveMainSubsidiaryId();
    }

    const selected = await prisma.subsidiary.findUnique({
      where: { id: normalizedRequested },
      select: { id: true, isActive: true },
    });

    if (!selected || !selected.isActive) {
      throw new AppError('Selected subsidiary is invalid or inactive', 400);
    }

    return selected.id;
  }

  if (normalizedUserSubsidiaryId) return normalizedUserSubsidiaryId;
  if (normalizedUserAccess.length > 0) return normalizedUserAccess[0];

  return resolveMainSubsidiaryId();
};
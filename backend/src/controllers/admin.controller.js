// backend/src/controllers/admin.controller.js
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Services
import AuditService from '../services/audit.service.js';
import EmailService from '../services/email.service.js';
import BackupService from '../services/backup.service.js';
import ApiKeyService from '../services/apiKey.service.js';
import cacheManager from '../middleware/cache.middleware.js';
import {
  resolveScopedSubsidiaryId,
  hasGlobalSubsidiaryAccess,
  resolveUserSubsidiaryAccess,
} from '../utils/subsidiaryScope.js';

// Validators
import { 
  createUserSchema, 
  updateUserSchema, 
  roleSchema 
} from '../validators/admin.validators.js';

const prisma = new PrismaClient();

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const normalizeRole = (value, fallback = 'EMPLOYEE') => {
  return String(value || fallback).trim().toUpperCase();
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeArchivedFlag = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  return Number(value) === 1 ? 1 : 0;
};

const normalizeIdArray = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => normalizeString(item)).filter(Boolean))];
};

const parseOptionalDate = (value) => {
  const normalized = normalizeString(value);
  if (!normalized) return undefined;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const GLOBAL_STAFF_MANAGER_ROLES = new Set(['CEO', 'SUPER_ADMIN']);
const RESTRICTED_FOR_ADMIN_ROLES = new Set(['CEO', 'SUPER_ADMIN']);

const buildRequesterScope = (requestUser) => {
  const primary = normalizeString(requestUser?.subsidiaryId);
  const access = normalizeIdArray(requestUser?.subsidiaryAccess || []);
  if (primary && !access.includes(primary)) {
    access.push(primary);
  }
  return access;
};

const hasAnySubsidiaryOverlap = (targetUser, requesterScope) => {
  const targetPrimary = normalizeString(targetUser?.subsidiaryId);
  const targetAccess = normalizeIdArray(targetUser?.subsidiaryAccess || []);
  if (targetPrimary && !targetAccess.includes(targetPrimary)) {
    targetAccess.push(targetPrimary);
  }
  return targetAccess.some((subsidiaryId) => requesterScope.includes(subsidiaryId));
};

const staffPositionSelect = {
  id: true,
  name: true,
  jobDescription: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  updatedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  subsidiaries: {
    select: {
      subsidiaryId: true,
      subsidiary: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },
    },
  },
  _count: {
    select: {
      users: true,
    },
  },
};

class AdminController {
  constructor() {
    this.initializeServices();
    [
      'getUsers',
      'getUserById',
      'createUser',
      'updateUser',
      'deleteUser',
      'getRoles',
      'createRole',
      'updateRole',
      'deleteRole',
      'getAuditLogs',
      'getTransactionLog',
      'getSystemHealth',
      'getPositions',
      'createPosition',
      'updatePosition',
    ].forEach((methodName) => {
      this[methodName] = this[methodName].bind(this);
    });
  }

  initializeServices() {
    // Ensure services are properly initialized
    this.auditService = AuditService;
    this.emailService = EmailService;
    this.backupService = BackupService;
    this.apiKeyService = ApiKeyService;
  }

  /**
   * ============================================
   * USER MANAGEMENT
   * ============================================
   */

  // Get all users with pagination and filters
  async getUsers(req, res, next) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        role,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      const where = {};
      const requesterRole = normalizeRole(req.user?.role, 'EMPLOYEE');
      const requesterScope = buildRequesterScope(req.user);
      const requesterHasGlobalStaffAccess = GLOBAL_STAFF_MANAGER_ROLES.has(requesterRole);

      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { employeeId: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (role) {
        const requestedRole = normalizeRole(role, 'EMPLOYEE');
        if (!requesterHasGlobalStaffAccess && RESTRICTED_FOR_ADMIN_ROLES.has(requestedRole)) {
          return res.status(403).json({
            success: false,
            message: 'ADMIN cannot view CEO or SUPER_ADMIN users',
          });
        }
        where.role = requestedRole;
      }
      if (status === 'active') where.isActive = true;
      if (status === 'inactive') where.isActive = false;

      if (!requesterHasGlobalStaffAccess) {
        where.role = where.role
          ? where.role
          : { notIn: Array.from(RESTRICTED_FOR_ADMIN_ROLES) };

        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          {
            OR: [
              { subsidiaryId: { in: requesterScope } },
              { subsidiaryAccess: { hasSome: requesterScope } },
            ],
          },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: {
            [sortBy]: sortOrder,
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            phoneNumber: true,
            role: true,
            isActive: true,
            employeeId: true,
            department: true,
            position: true,
            positionId: true,
            positionRecord: {
              select: {
                id: true,
                name: true,
                archived: true,
              },
            },
            subsidiary: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            lastLogin: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                createdExpenses: true,
                createdOperations: true,
                auditLogs: true,
              }
            }
          }
        }),
        prisma.user.count({ where })
      ]);

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'VIEW_USERS',
        resource: 'User',
        details: { filters: { search, role, status, page, limit } },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        data: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get the currently authenticated user's own profile (any role)
  async getMyProfile(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthenticated' });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          employeeId: true,
          department: true,
          position: true,
          positionId: true,
          profileImage: true,
          positionRecord: { select: { id: true, name: true } },
          employmentDate: true,
          address: true,
          emergencyContact: true,
          subsidiary: { select: { id: true, name: true, code: true } },
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          // Assigned vehicle (for drivers)
          assignedVehicles: {
            select: {
              id: true,
              assignedAt: true,
              vehicle: {
                select: {
                  id: true,
                  registrationNumber: true,
                  model: true,
                  assetType: true,
                  status: true,
                },
              },
              subsidiary: { select: { id: true, name: true, code: true } },
            },
          },
          // Pending/recent status requests
          requestedVehicleStatusChanges: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              targetStatus: true,
              reason: true,
              createdAt: true,
              vehicle: { select: { id: true, registrationNumber: true } },
            },
          },
          _count: {
            select: {
              createdOperations: true,
              createdExpenses: true,
            },
          },
        },
      });

      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  // Get single user by ID
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          subsidiaryAccess: true,
          employeeId: true,
          department: true,
          position: true,
          positionId: true,
          positionRecord: {
            select: {
              id: true,
              name: true,
              archived: true,
            },
          },
          employmentDate: true,
          address: true,
          emergencyContact: true,
          subsidiary: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          createdOperations: {
            take: 5,
            orderBy: { operationDate: 'desc' },
            select: {
              id: true,
              operationDate: true,
              income: true,
              distanceCovered: true,
            }
          },
          createdExpenses: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              amount: true,
              description: true,
              expenseCategory: true,
              approvalStatus: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              createdOperations: true,
              createdExpenses: true,
              auditLogs: true
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const requesterRole = normalizeRole(req.user?.role, 'EMPLOYEE');
      if (!GLOBAL_STAFF_MANAGER_ROLES.has(requesterRole)) {
        if (RESTRICTED_FOR_ADMIN_ROLES.has(user.role)) {
          return res.status(403).json({
            success: false,
            message: 'ADMIN cannot view CEO or SUPER_ADMIN users',
          });
        }

        const requesterScope = buildRequesterScope(req.user);
        if (!hasAnySubsidiaryOverlap(user, requesterScope)) {
          return res.status(403).json({
            success: false,
            message: 'Access to this staff record is outside your subsidiary scope',
          });
        }
      }

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'VIEW_USER',
        resource: 'User',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  // Create new user
  async createUser(req, res, next) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const userData = req.body;
      const requesterRole = normalizeRole(req.user?.role, 'EMPLOYEE');
      const requesterScope = buildRequesterScope(req.user);

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

      const requestedRole = normalizeRole(userData.role, 'EMPLOYEE');
      if (!GLOBAL_STAFF_MANAGER_ROLES.has(requesterRole) && RESTRICTED_FOR_ADMIN_ROLES.has(requestedRole)) {
        return res.status(403).json({
          success: false,
          message: 'ADMIN cannot create CEO or SUPER_ADMIN accounts',
        });
      }

      if (!GLOBAL_STAFF_MANAGER_ROLES.has(requesterRole)) {
        const unauthorizedSubsidiaryIds = normalizedAccess.filter((subsidiaryId) => !requesterScope.includes(subsidiaryId));
        if (unauthorizedSubsidiaryIds.length > 0 || !requesterScope.includes(resolvedSubsidiaryId)) {
          return res.status(403).json({
            success: false,
            message: 'ADMIN can only assign staff within their subsidiary scope',
          });
        }
      }

      const accessToPersist = hasGlobalSubsidiaryAccess(requestedRole)
        ? await resolveUserSubsidiaryAccess({
          role: requestedRole,
          userSubsidiaryId: resolvedSubsidiaryId,
          userSubsidiaryAccess: normalizedAccess,
        })
        : normalizedAccess;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const fullName = String(
        userData.fullName || `${userData.firstName || ''} ${userData.lastName || ''}`
      ).trim();

      let resolvedPositionId;
      let resolvedPositionName;
      const requestedPositionId = normalizeString(userData.positionId);
      const requestedPositionName = normalizeString(userData.position);

      if (requestedPositionId) {
        const positionRecord = await prisma.staffPosition.findUnique({
          where: { id: requestedPositionId },
          select: {
            id: true,
            name: true,
            archived: true,
            subsidiaries: {
              select: { subsidiaryId: true },
            },
          },
        });

        if (!positionRecord || positionRecord.archived === 1) {
          return res.status(400).json({
            success: false,
            message: 'Selected position is invalid or inactive',
          });
        }

        if (!positionRecord.subsidiaries.some((item) => item.subsidiaryId === resolvedSubsidiaryId)) {
          return res.status(400).json({
            success: false,
            message: 'Selected position is not available in the chosen subsidiary',
          });
        }

        resolvedPositionId = positionRecord.id;
        resolvedPositionName = positionRecord.name;
      } else if (requestedPositionName) {
        const positionRecord = await prisma.staffPosition.findFirst({
          where: {
            archived: 0,
            name: { equals: requestedPositionName, mode: 'insensitive' },
            subsidiaries: {
              some: { subsidiaryId: resolvedSubsidiaryId },
            },
          },
          select: { id: true, name: true },
        });

        if (!positionRecord) {
          return res.status(400).json({
            success: false,
            message: 'Selected position is not available in the chosen subsidiary',
          });
        }

        resolvedPositionId = positionRecord.id;
        resolvedPositionName = positionRecord.name;
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash: hashedPassword,
          fullName: fullName || 'New User',
          role: requestedRole,
          subsidiaryId: resolvedSubsidiaryId,
          subsidiaryAccess: accessToPersist,
          employeeId: userData.employeeId || undefined,
          department: userData.department || undefined,
          positionId: resolvedPositionId,
          position: resolvedPositionName || undefined,
          employmentDate: parseOptionalDate(userData.employmentDate || userData.hireDate),
          phoneNumber: normalizeString(userData.phoneNumber || userData.phone) || undefined,
          isActive: userData.isActive !== undefined ? Boolean(userData.isActive) : true,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          subsidiaryId: true,
          subsidiaryAccess: true,
          employeeId: true,
          department: true,
          position: true,
          positionId: true,
          positionRecord: {
            select: {
              id: true,
              name: true,
            },
          },
          createdAt: true
        }
      });

      // Send welcome email
      try {
        await this.emailService.sendWelcomeEmail(user.email, {
          name: user.fullName,
          role: user.role,
          loginUrl: `${process.env.FRONTEND_URL}/login`
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the request if email fails
      }

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'CREATE_USER',
        resource: 'User',
        resourceId: user.id,
        details: { email: user.email, role: user.role },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  // Update user
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const requesterRole = normalizeRole(req.user?.role, 'EMPLOYEE');
      const requesterScope = buildRequesterScope(req.user);

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!GLOBAL_STAFF_MANAGER_ROLES.has(requesterRole)) {
        if (RESTRICTED_FOR_ADMIN_ROLES.has(existingUser.role)) {
          return res.status(403).json({
            success: false,
            message: 'ADMIN cannot update CEO or SUPER_ADMIN accounts',
          });
        }

        if (!hasAnySubsidiaryOverlap(existingUser, requesterScope)) {
          return res.status(403).json({
            success: false,
            message: 'Access to this staff record is outside your subsidiary scope',
          });
        }
      }

      const nextRole = normalizeRole(updateData.role, existingUser.role);
      if (!GLOBAL_STAFF_MANAGER_ROLES.has(requesterRole) && RESTRICTED_FOR_ADMIN_ROLES.has(nextRole)) {
        return res.status(403).json({
          success: false,
          message: 'ADMIN cannot assign CEO or SUPER_ADMIN roles',
        });
      }

      const nextSubsidiaryId = (updateData.subsidiaryId !== undefined || updateData.subsidiaryAccess !== undefined || updateData.role !== undefined)
        ? await resolveScopedSubsidiaryId({
          requestedSubsidiaryId: updateData.subsidiaryId || existingUser.subsidiaryId,
          userSubsidiaryId: existingUser.subsidiaryId,
          userSubsidiaryAccess: updateData.subsidiaryAccess || existingUser.subsidiaryAccess,
        })
        : existingUser.subsidiaryId;

      const normalizedAccess = Array.isArray(updateData.subsidiaryAccess)
        ? normalizeIdArray(updateData.subsidiaryAccess)
        : normalizeIdArray(existingUser.subsidiaryAccess);
      if (!normalizedAccess.includes(nextSubsidiaryId)) {
        normalizedAccess.push(nextSubsidiaryId);
      }

      if (!GLOBAL_STAFF_MANAGER_ROLES.has(requesterRole)) {
        const unauthorizedSubsidiaryIds = normalizedAccess.filter((subsidiaryId) => !requesterScope.includes(subsidiaryId));
        if (unauthorizedSubsidiaryIds.length > 0 || !requesterScope.includes(nextSubsidiaryId)) {
          return res.status(403).json({
            success: false,
            message: 'ADMIN can only assign staff within their subsidiary scope',
          });
        }
      }

      const accessToPersist = (updateData.subsidiaryId !== undefined || updateData.subsidiaryAccess !== undefined || updateData.role !== undefined)
        ? (hasGlobalSubsidiaryAccess(nextRole)
          ? await resolveUserSubsidiaryAccess({
            role: nextRole,
            userSubsidiaryId: nextSubsidiaryId,
            userSubsidiaryAccess: normalizedAccess,
          })
          : normalizedAccess)
        : undefined;

      let resolvedPositionId = existingUser.positionId;
      let resolvedPositionName = existingUser.position;

      if (updateData.positionId !== undefined || updateData.position !== undefined || nextSubsidiaryId !== existingUser.subsidiaryId) {
        const requestedPositionId = normalizeString(updateData.positionId);
        const requestedPositionName = normalizeString(updateData.position);

        if (updateData.positionId === null || updateData.position === null || requestedPositionId === '' || requestedPositionName === '') {
          resolvedPositionId = null;
          resolvedPositionName = null;
        } else if (requestedPositionId) {
          const positionRecord = await prisma.staffPosition.findUnique({
            where: { id: requestedPositionId },
            select: {
              id: true,
              name: true,
              archived: true,
              subsidiaries: {
                select: { subsidiaryId: true },
              },
            },
          });

          if (!positionRecord || positionRecord.archived === 1 || !positionRecord.subsidiaries.some((item) => item.subsidiaryId === nextSubsidiaryId)) {
            return res.status(400).json({
              success: false,
              message: 'Selected position is not available in the chosen subsidiary',
            });
          }

          resolvedPositionId = positionRecord.id;
          resolvedPositionName = positionRecord.name;
        } else if (requestedPositionName) {
          const positionRecord = await prisma.staffPosition.findFirst({
            where: {
              archived: 0,
              name: { equals: requestedPositionName, mode: 'insensitive' },
              subsidiaries: {
                some: { subsidiaryId: nextSubsidiaryId },
              },
            },
            select: { id: true, name: true },
          });

          if (!positionRecord) {
            return res.status(400).json({
              success: false,
              message: 'Selected position is not available in the chosen subsidiary',
            });
          }

          resolvedPositionId = positionRecord.id;
          resolvedPositionName = positionRecord.name;
        } else if (existingUser.positionId) {
          const currentPosition = await prisma.staffPosition.findUnique({
            where: { id: existingUser.positionId },
            select: {
              id: true,
              archived: true,
              subsidiaries: {
                select: { subsidiaryId: true },
              },
            },
          });

          if (!currentPosition || currentPosition.archived === 1 || !currentPosition.subsidiaries.some((item) => item.subsidiaryId === nextSubsidiaryId)) {
            resolvedPositionId = null;
            resolvedPositionName = null;
          }
        }
      }

      const sanitizedUpdateData = {};
      if (updateData.email !== undefined) sanitizedUpdateData.email = updateData.email;
      if (updateData.fullName !== undefined || updateData.firstName !== undefined || updateData.lastName !== undefined) {
        const nextFullName = normalizeString(updateData.fullName)
          || `${normalizeString(updateData.firstName) || ''} ${normalizeString(updateData.lastName) || ''}`.trim();
        if (nextFullName) {
          sanitizedUpdateData.fullName = nextFullName;
        }
      }
      if (updateData.password) {
        sanitizedUpdateData.passwordHash = await bcrypt.hash(updateData.password, 10);
      }
      if (updateData.role !== undefined) sanitizedUpdateData.role = nextRole;
      if (updateData.subsidiaryId !== undefined || updateData.subsidiaryAccess !== undefined || updateData.role !== undefined) {
        sanitizedUpdateData.subsidiaryId = nextSubsidiaryId;
        sanitizedUpdateData.subsidiaryAccess = accessToPersist;
      }
      if (updateData.employeeId !== undefined) sanitizedUpdateData.employeeId = normalizeString(updateData.employeeId);
      if (updateData.department !== undefined) sanitizedUpdateData.department = normalizeString(updateData.department);
      if (updateData.phoneNumber !== undefined || updateData.phone !== undefined) {
        sanitizedUpdateData.phoneNumber = normalizeString(updateData.phoneNumber || updateData.phone);
      }
      if (updateData.employmentDate !== undefined || updateData.hireDate !== undefined) {
        sanitizedUpdateData.employmentDate = parseOptionalDate(updateData.employmentDate || updateData.hireDate) || null;
      }
      if (updateData.isActive !== undefined) {
        sanitizedUpdateData.isActive = normalizeBoolean(updateData.isActive, existingUser.isActive);
      }
      if (updateData.positionId !== undefined || updateData.position !== undefined || nextSubsidiaryId !== existingUser.subsidiaryId) {
        sanitizedUpdateData.positionId = resolvedPositionId || null;
        sanitizedUpdateData.position = resolvedPositionName || null;
      }

      // Update user
      const user = await prisma.user.update({
        where: { id },
        data: sanitizedUpdateData,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          employeeId: true,
          department: true,
          position: true,
          positionId: true,
          positionRecord: {
            select: {
              id: true,
              name: true,
            },
          },
          subsidiary: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          updatedAt: true
        }
      });

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'UPDATE_USER',
        resource: 'User',
        resourceId: id,
        details: { updatedFields: Object.keys(sanitizedUpdateData) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  async getPositions(req, res, next) {
    try {
      const requestedSubsidiaryId = normalizeString(req.query.subsidiaryId);
      const includeArchived = normalizeBoolean(req.query.includeArchived, false);
      const accessibleSubsidiaryIds = normalizeIdArray(req.user.subsidiaryAccess);

      if (requestedSubsidiaryId && !hasGlobalSubsidiaryAccess(req.user.role) && !accessibleSubsidiaryIds.includes(requestedSubsidiaryId)) {
        return res.status(403).json({
          success: false,
          message: 'Access to this subsidiary denied',
        });
      }

      const positions = await prisma.staffPosition.findMany({
        where: {
          ...(includeArchived ? {} : { archived: 0 }),
          subsidiaries: {
            some: requestedSubsidiaryId
              ? { subsidiaryId: requestedSubsidiaryId }
              : { subsidiaryId: { in: accessibleSubsidiaryIds } },
          },
        },
        select: staffPositionSelect,
        orderBy: [
          { archived: 'asc' },
          { name: 'asc' },
        ],
      });

      res.status(200).json({
        success: true,
        data: positions,
      });
    } catch (error) {
      next(error);
    }
  }

  async createPosition(req, res, next) {
    try {
      const name = normalizeString(req.body.name);
      const jobDescription = normalizeString(req.body.jobDescription);
      const archived = normalizeArchivedFlag(req.body.archived, 0);
      const requestedSubsidiaryIds = normalizeIdArray(req.body.subsidiaryIds);
      const accessibleSubsidiaryIds = normalizeIdArray(req.user.subsidiaryAccess);

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Position name is required',
        });
      }

      if (requestedSubsidiaryIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one subsidiary is required',
        });
      }

      if (!hasGlobalSubsidiaryAccess(req.user.role)) {
        const unauthorizedSubsidiaryIds = requestedSubsidiaryIds.filter((subsidiaryId) => !accessibleSubsidiaryIds.includes(subsidiaryId));
        if (unauthorizedSubsidiaryIds.length > 0) {
          return res.status(403).json({
            success: false,
            message: 'One or more subsidiaries are outside your access scope',
          });
        }
      }

      const positionRecord = await prisma.$transaction(async (tx) => {
        const existing = await tx.staffPosition.findFirst({
          where: {
            name: { equals: name, mode: 'insensitive' },
          },
          select: {
            id: true,
            jobDescription: true,
          },
        });

        if (existing) {
          await tx.staffPosition.update({
            where: { id: existing.id },
            data: {
              jobDescription: jobDescription || existing.jobDescription,
              archived,
              updatedById: req.user.id,
            },
          });

          const existingMappings = await tx.staffPositionSubsidiary.findMany({
            where: {
              positionId: existing.id,
              subsidiaryId: { in: requestedSubsidiaryIds },
            },
            select: { subsidiaryId: true },
          });
          const existingMappingSet = new Set(existingMappings.map((item) => item.subsidiaryId));
          const mappingsToCreate = requestedSubsidiaryIds
            .filter((subsidiaryId) => !existingMappingSet.has(subsidiaryId))
            .map((subsidiaryId) => ({
              positionId: existing.id,
              subsidiaryId,
            }));

          if (mappingsToCreate.length > 0) {
            await tx.staffPositionSubsidiary.createMany({ data: mappingsToCreate });
          }

          return tx.staffPosition.findUnique({
            where: { id: existing.id },
            select: staffPositionSelect,
          });
        }

        return tx.staffPosition.create({
          data: {
            name,
            jobDescription: jobDescription || undefined,
            archived,
            createdById: req.user.id,
            updatedById: req.user.id,
            subsidiaries: {
              create: requestedSubsidiaryIds.map((subsidiaryId) => ({
                subsidiaryId,
              })),
            },
          },
          select: staffPositionSelect,
        });
      });

      res.status(201).json({
        success: true,
        message: 'Position saved successfully',
        data: positionRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePosition(req, res, next) {
    try {
      const { id } = req.params;
      const name = normalizeString(req.body.name);
      const jobDescription = normalizeString(req.body.jobDescription);
      const archived = req.body.archived !== undefined
        ? normalizeArchivedFlag(req.body.archived, 0)
        : undefined;
      const requestedSubsidiaryIds = req.body.subsidiaryIds !== undefined
        ? normalizeIdArray(req.body.subsidiaryIds)
        : null;
      const accessibleSubsidiaryIds = normalizeIdArray(req.user.subsidiaryAccess);

      const existingPosition = await prisma.staffPosition.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          subsidiaries: {
            select: { subsidiaryId: true },
          },
        },
      });

      if (!existingPosition) {
        return res.status(404).json({
          success: false,
          message: 'Position not found',
        });
      }

      if (requestedSubsidiaryIds && requestedSubsidiaryIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one subsidiary is required',
        });
      }

      if (requestedSubsidiaryIds && !hasGlobalSubsidiaryAccess(req.user.role)) {
        const unauthorizedSubsidiaryIds = requestedSubsidiaryIds.filter((subsidiaryId) => !accessibleSubsidiaryIds.includes(subsidiaryId));
        if (unauthorizedSubsidiaryIds.length > 0) {
          return res.status(403).json({
            success: false,
            message: 'One or more subsidiaries are outside your access scope',
          });
        }
      }

      if (name && name.toLowerCase() !== existingPosition.name.toLowerCase()) {
        const duplicate = await prisma.staffPosition.findFirst({
          where: {
            id: { not: id },
            name: { equals: name, mode: 'insensitive' },
          },
          select: { id: true },
        });

        if (duplicate) {
          return res.status(409).json({
            success: false,
            message: 'A position with this name already exists',
          });
        }
      }

      const positionRecord = await prisma.$transaction(async (tx) => {
        await tx.staffPosition.update({
          where: { id },
          data: {
            ...(name ? { name } : {}),
            ...(jobDescription !== null ? { jobDescription: jobDescription || null } : {}),
            ...(archived !== undefined ? { archived } : {}),
            updatedById: req.user.id,
          },
        });

        if (requestedSubsidiaryIds) {
          const existingIds = existingPosition.subsidiaries.map((item) => item.subsidiaryId);
          const preservedIds = hasGlobalSubsidiaryAccess(req.user.role)
            ? []
            : existingIds.filter((subsidiaryId) => !accessibleSubsidiaryIds.includes(subsidiaryId));
          const nextIds = [...new Set([...preservedIds, ...requestedSubsidiaryIds])];

          await tx.staffPositionSubsidiary.deleteMany({
            where: {
              positionId: id,
              subsidiaryId: { notIn: nextIds },
            },
          });

          const existingMappings = await tx.staffPositionSubsidiary.findMany({
            where: {
              positionId: id,
              subsidiaryId: { in: nextIds },
            },
            select: { subsidiaryId: true },
          });
          const existingMappingSet = new Set(existingMappings.map((item) => item.subsidiaryId));
          const mappingsToCreate = nextIds
            .filter((subsidiaryId) => !existingMappingSet.has(subsidiaryId))
            .map((subsidiaryId) => ({
              positionId: id,
              subsidiaryId,
            }));

          if (mappingsToCreate.length > 0) {
            await tx.staffPositionSubsidiary.createMany({ data: mappingsToCreate });
          }
        }

        return tx.staffPosition.findUnique({
          where: { id },
          select: staffPositionSelect,
        });
      });

      res.status(200).json({
        success: true,
        message: 'Position updated successfully',
        data: positionRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete user (soft delete or permanent)
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const { permanent = false } = req.query;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Prevent deleting yourself
      if (id === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      const requesterRole = normalizeRole(req.user?.role, 'EMPLOYEE');
      if (!GLOBAL_STAFF_MANAGER_ROLES.has(requesterRole)) {
        if (RESTRICTED_FOR_ADMIN_ROLES.has(user.role)) {
          return res.status(403).json({
            success: false,
            message: 'ADMIN cannot delete CEO or SUPER_ADMIN accounts',
          });
        }

        const requesterScope = buildRequesterScope(req.user);
        if (!hasAnySubsidiaryOverlap(user, requesterScope)) {
          return res.status(403).json({
            success: false,
            message: 'Access to this staff record is outside your subsidiary scope',
          });
        }
      }

      if (permanent === 'true') {
        // Permanent delete
        await prisma.user.delete({
          where: { id }
        });
      } else {
        // Soft delete - deactivate user
        await prisma.user.update({
          where: { id },
          data: { 
            isActive: false,
            // Optionally, you could set a deletedAt timestamp
          }
        });
      }

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: permanent === 'true' ? 'DELETE_USER_PERMANENT' : 'DEACTIVATE_USER',
        resource: 'User',
        resourceId: id,
        details: { email: user.email, permanent: permanent === 'true' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        message: permanent === 'true' ? 'User permanently deleted' : 'User deactivated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk user operations
  async bulkUserOperation(req, res, next) {
    try {
      const { operation, userIds, data } = req.body;

      const validOperations = ['activate', 'deactivate', 'changeRole', 'delete'];
      
      if (!validOperations.includes(operation)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid operation'
        });
      }

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required'
        });
      }

      // Prevent self-deletion in bulk operations
      if (operation === 'delete' && userIds.includes(req.user.id)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account in bulk operation'
        });
      }

      let result;
      switch (operation) {
        case 'activate':
          result = await prisma.user.updateMany({
            where: { id: { in: userIds } },
            data: { isActive: true }
          });
          break;
        case 'deactivate':
          result = await prisma.user.updateMany({
            where: { id: { in: userIds } },
            data: { isActive: false }
          });
          break;
        case 'changeRole':
          if (!data?.role) {
            return res.status(400).json({
              success: false,
              message: 'Role is required for changeRole operation'
            });
          }
          result = await prisma.user.updateMany({
            where: { id: { in: userIds } },
            data: { role: data.role }
          });
          break;
        case 'delete':
          result = await prisma.user.deleteMany({
            where: { 
              id: { in: userIds },
              NOT: { id: req.user.id } // Exclude current user
            }
          });
          break;
      }

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: `BULK_${operation.toUpperCase()}`,
        resource: 'User',
        details: { userIds, count: userIds.length, ...data },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        message: `Bulk operation '${operation}' completed successfully`,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ============================================
   * ROLE MANAGEMENT
   * ============================================
   */

  // Get all roles
  async getRoles(req, res, next) {
    try {
      const roles = await prisma.role.findMany({
        include: {
          _count: {
            select: { users: true }
          }
        }
      });

      res.status(200).json({
        success: true,
        data: roles
      });
    } catch (error) {
      next(error);
    }
  }

  // Create new role
  async createRole(req, res, next) {
    try {
      const { name, permissions, description } = req.body;

      // Check if role already exists
      const existingRole = await prisma.role.findUnique({
        where: { name }
      });

      if (existingRole) {
        return res.status(409).json({
          success: false,
          message: 'Role with this name already exists'
        });
      }

      const role = await prisma.role.create({
        data: {
          name,
          permissions: permissions || [],
          description
        }
      });

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'CREATE_ROLE',
        resource: 'Role',
        resourceId: role.id,
        details: { name, permissions },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: role
      });
    } catch (error) {
      next(error);
    }
  }

  // Update role
  async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const role = await prisma.role.update({
        where: { id },
        data: updateData
      });

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'UPDATE_ROLE',
        resource: 'Role',
        resourceId: id,
        details: { updatedFields: Object.keys(updateData) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: role
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete role
  async deleteRole(req, res, next) {
    try {
      const { id } = req.params;

      // Check if role has users
      const userCount = await prisma.user.count({
        where: { roleId: id }
      });

      if (userCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete role with assigned users'
        });
      }

      await prisma.role.delete({
        where: { id }
      });

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'DELETE_ROLE',
        resource: 'Role',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        message: 'Role deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ============================================
   * SYSTEM HEALTH & MONITORING
   * ============================================
   */

  // Get system health
  async getSystemHealth(req, res, next) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: await this.checkDatabaseHealth(),
          api: 'operational',
          cache: await this.checkCacheHealth(),
        },
        metrics: {
          totalUsers: await prisma.user.count(),
          activeUsers: await prisma.user.count({ where: { isActive: true } }),
          totalVehicles: await prisma.vehicle.count(),
          activeVehicles: await prisma.vehicle.count({ where: { status: 'ACTIVE' } }),
          vehiclesInMaintenance: await prisma.vehicle.count({ where: { status: 'MAINTENANCE' } }),
          pendingExpenses: await prisma.expense.count({ where: { status: 'PENDING' } }),
          totalExpenses: await prisma.expense.aggregate({
            _sum: { amount: true }
          }).then(result => result._sum.amount || 0)
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          nodeVersion: process.version,
          platform: process.platform
        },
        environment: process.env.NODE_ENV || 'development'
      };

      // Check storage if configured
      if (process.env.STORAGE_PATH) {
        health.services.storage = await this.checkStorageHealth();
      }

      res.status(200).json({
        success: true,
        data: health
      });
    } catch (error) {
      next(error);
    }
  }

  // Get system metrics
  async getSystemMetrics(req, res, next) {
    try {
      const { period = '24h' } = req.query;

      const metrics = {
        requests: await this.getRequestMetrics(period),
        errors: await this.getErrorMetrics(period),
        performance: await this.getPerformanceMetrics(period),
        users: await this.getUserMetrics(period),
        expenses: await this.getExpenseMetrics(period),
        vehicles: await this.getVehicleMetrics(period),
        timestamp: new Date().toISOString()
      };

      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ============================================
   * AUDIT LOGS
   * ============================================
   */

  // Get audit logs
  async getAuditLogs(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        userId,
        action,
        resource,
        startDate,
        endDate,
        severity
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const where = {};

      if (userId) where.userId = userId;
      if (action) where.action = action;
      if (resource) where.resource = resource;
      if (severity) where.severity = severity;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        }),
        prisma.auditLog.count({ where })
      ]);

      res.status(200).json({
        success: true,
        data: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get audit log summary
  async getAuditSummary(req, res, next) {
    try {
      const { days = 30 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const summary = await prisma.auditLog.groupBy({
        by: ['action', 'severity'],
        where: {
          createdAt: { gte: startDate }
        },
        _count: true
      });

      // Get unique users count
      const uniqueUsers = await prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: startDate }
        },
        _count: {
          userId: true
        }
      });

      res.status(200).json({
        success: true,
        data: {
          summary,
          totalLogs: summary.reduce((acc, curr) => acc + curr._count, 0),
          uniqueUsers: uniqueUsers.length,
          period: `${days} days`
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ============================================
   * BACKUP MANAGEMENT
   * ============================================
   */

  // Get all backups
  async getBackups(req, res, next) {
    try {
      const backups = await this.backupService.listBackups();

      res.status(200).json({
        success: true,
        data: backups
      });
    } catch (error) {
      next(error);
    }
  }

  // Create backup
  async createBackup(req, res, next) {
    try {
      const { type = 'full', description } = req.body;

      const backup = await this.backupService.createBackup({
        type,
        description,
        createdBy: req.user.id
      });

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'CREATE_BACKUP',
        resource: 'Backup',
        resourceId: backup.id,
        details: { type, size: backup.size },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        message: 'Backup created successfully',
        data: backup
      });
    } catch (error) {
      next(error);
    }
  }

  // Restore backup
  async restoreBackup(req, res, next) {
    try {
      const { id } = req.params;

      // Confirm restore with password
      const { confirmPassword } = req.body;
      
      if (!confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Password confirmation required for restore'
        });
      }

      // Verify user password
      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      const isValidPassword = await bcrypt.compare(confirmPassword, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }

      const result = await this.backupService.restoreBackup(id);

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'RESTORE_BACKUP',
        resource: 'Backup',
        resourceId: id,
        details: { success: result.success },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        message: 'Backup restored successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete backup
  async deleteBackup(req, res, next) {
    try {
      const { id } = req.params;

      await this.backupService.deleteBackup(id);

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'DELETE_BACKUP',
        resource: 'Backup',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        message: 'Backup deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Download backup
  async downloadBackup(req, res, next) {
    try {
      const { id } = req.params;

      const backup = await this.backupService.getBackup(id);

      if (!backup) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found'
        });
      }

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'DOWNLOAD_BACKUP',
        resource: 'Backup',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.download(backup.path, backup.filename);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ============================================
   * API KEY MANAGEMENT (SECURE)
   * ============================================
   */

  // Get all API keys (without exposing the actual keys)
  async getApiKeys(req, res, next) {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: { userId: req.user.id },
        select: {
          id: true,
          name: true,
          keyId: true,
          permissions: true,
          lastUsed: true,
          expiresAt: true,
          createdAt: true,
          metadata: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Decrypt metadata for each key
      const decryptedKeys = apiKeys.map(key => {
        try {
          const metadata = this.apiKeyService.decryptKeyData(key.metadata);
          return {
            id: key.id,
            name: key.name,
            keyId: key.keyId,
            permissions: key.permissions,
            lastUsed: key.lastUsed,
            expiresAt: key.expiresAt,
            createdAt: key.createdAt,
            metadata,
            keyPreview: `${metadata.prefix}_${key.keyId.substring(0, 8)}...`
          };
        } catch (error) {
          console.error('Failed to decrypt key metadata:', error);
          return {
            id: key.id,
            name: key.name,
            keyId: key.keyId,
            permissions: key.permissions,
            lastUsed: key.lastUsed,
            expiresAt: key.expiresAt,
            createdAt: key.createdAt,
            keyPreview: '***',
            metadata: null
          };
        }
      });

      res.status(200).json({
        success: true,
        data: decryptedKeys
      });
    } catch (error) {
      next(error);
    }
  }

  // Create API key
  async createApiKey(req, res, next) {
    try {
      const { name, permissions = [], expiresIn = 30 } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Key name is required'
        });
      }

      // Generate secure API key
      const apiKey = this.apiKeyService.generateApiKey();
      
      // Hash for storage (never store raw key!)
      const hashedKey = this.apiKeyService.hashApiKey(apiKey);
      
      // Generate key ID for lookup
      const keyId = this.apiKeyService.generateKeyId(apiKey);
      
      // Extract and encrypt metadata
      const metadata = this.apiKeyService.extractKeyMetadata(apiKey);
      const encryptedMetadata = this.apiKeyService.encryptKeyData({
        ...metadata,
        name,
        permissions,
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
      });

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));

      // Store in database
      const storedKey = await prisma.apiKey.create({
        data: {
          name,
          keyId,
          hashedKey,
          permissions: permissions,
          userId: req.user.id,
          metadata: encryptedMetadata,
          expiresAt,
          lastUsed: null
        },
        select: {
          id: true,
          name: true,
          keyId: true,
          permissions: true,
          expiresAt: true,
          createdAt: true
        }
      });

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'CREATE_API_KEY',
        resource: 'ApiKey',
        resourceId: storedKey.id,
        details: { name, permissions, keyId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Return the raw key ONLY ONCE
      res.status(201).json({
        success: true,
        message: 'API key created successfully',
        data: {
          ...storedKey,
          key: apiKey,
          warning: 'âš ï¸ Save this key now. It will not be shown again!'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Validate API key (used by middleware)
  async validateApiKey(req, res, next) {
    try {
      const providedKey = req.headers['x-api-key'];

      if (!providedKey) {
        return res.status(401).json({
          success: false,
          message: 'API key required'
        });
      }

      // Validate format
      if (!this.apiKeyService.validateApiKeyFormat(providedKey)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API key format'
        });
      }

      // Check expiry based on timestamp in key
      if (this.apiKeyService.isKeyExpired(providedKey)) {
        return res.status(401).json({
          success: false,
          message: 'API key expired'
        });
      }

      // Hash the provided key for lookup
      const hashedKey = this.apiKeyService.hashApiKey(providedKey);

      // Find in database
      const storedKey = await prisma.apiKey.findFirst({
        where: { hashedKey },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
              isActive: true
            }
          }
        }
      });

      if (!storedKey) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API key'
        });
      }

      // Check if user is active
      if (!storedKey.user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'User account is inactive'
        });
      }

      // Check if expired in database
      if (storedKey.expiresAt && new Date(storedKey.expiresAt) < new Date()) {
        return res.status(401).json({
          success: false,
          message: 'API key expired'
        });
      }

      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: storedKey.id },
        data: { lastUsed: new Date() }
      });

      // Attach user to request
      req.user = storedKey.user;
      req.apiKey = {
        id: storedKey.id,
        name: storedKey.name,
        keyId: storedKey.keyId,
        permissions: storedKey.permissions
      };

      next();
    } catch (error) {
      next(error);
    }
  }

  // Revoke API key
  async revokeApiKey(req, res, next) {
    try {
      const { id } = req.params;

      // Get key first for audit
      const key = await prisma.apiKey.findUnique({
        where: { id, userId: req.user.id }
      });

      if (!key) {
        return res.status(404).json({
          success: false,
          message: 'API key not found'
        });
      }

      // Delete or mark as revoked
      await prisma.apiKey.delete({
        where: { id }
      });

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'REVOKE_API_KEY',
        resource: 'ApiKey',
        resourceId: id,
        details: { name: key.name, keyId: key.keyId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        message: 'API key revoked successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Rotate API key
  async rotateApiKey(req, res, next) {
    try {
      const { id } = req.params;

      // Get existing key
      const existingKey = await prisma.apiKey.findUnique({
        where: { id, userId: req.user.id }
      });

      if (!existingKey) {
        return res.status(404).json({
          success: false,
          message: 'API key not found'
        });
      }

      // Generate new key
      const newKey = this.apiKeyService.generateApiKey();
      const newHashedKey = this.apiKeyService.hashApiKey(newKey);
      const newKeyId = this.apiKeyService.generateKeyId(newKey);

      // Generate new encrypted metadata
      const newMetadata = this.apiKeyService.encryptKeyData({
        ...this.apiKeyService.extractKeyMetadata(newKey),
        name: existingKey.name,
        permissions: existingKey.permissions,
        createdBy: req.user.id,
        rotatedFrom: existingKey.keyId,
        rotatedAt: new Date().toISOString()
      });

      // Update database with new key
      await prisma.apiKey.update({
        where: { id },
        data: {
          keyId: newKeyId,
          hashedKey: newHashedKey,
          metadata: newMetadata,
          lastUsed: null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'ROTATE_API_KEY',
        resource: 'ApiKey',
        resourceId: id,
        details: { name: existingKey.name, oldKeyId: existingKey.keyId, newKeyId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        message: 'API key rotated successfully',
        data: {
          id,
          name: existingKey.name,
          keyId: newKeyId,
          newKey,
          warning: 'âš ï¸ Save this new key. The old key is no longer valid!'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ============================================
   * SYSTEM CONFIGURATION
   * ============================================
   */

  // Get system configuration
  async getSystemConfig(req, res, next) {
    try {
      const config = await prisma.systemConfig.findFirst();

      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'System configuration not found'
        });
      }

      // Remove sensitive data
      const safeConfig = {
        ...config,
        // Don't expose sensitive fields
        smtpPassword: undefined,
        apiKeySalt: undefined,
        encryptionKey: undefined
      };

      res.status(200).json({
        success: true,
        data: safeConfig
      });
    } catch (error) {
      next(error);
    }
  }

  // Update system configuration
  async updateSystemConfig(req, res, next) {
    try {
      const configData = req.body;

      // Remove sensitive fields from logs
      const logSafeData = { ...configData };
      delete logSafeData.smtpPassword;
      delete logSafeData.apiKeySalt;
      delete logSafeData.encryptionKey;

      const config = await prisma.systemConfig.upsert({
        where: { id: '1' },
        update: configData,
        create: {
          id: '1',
          ...configData
        }
      });

      // Log audit
      await this.auditService.log({
        userId: req.user.id,
        action: 'UPDATE_SYSTEM_CONFIG',
        resource: 'SystemConfig',
        details: { updatedFields: Object.keys(logSafeData) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Remove sensitive data from response
      const safeConfig = {
        ...config,
        smtpPassword: undefined,
        apiKeySalt: undefined,
        encryptionKey: undefined
      };

      res.status(200).json({
        success: true,
        message: 'System configuration updated successfully',
        data: safeConfig
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ============================================
   * HELPER METHODS
   * ============================================
   */

  async checkDatabaseHealth() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return 'operational';
    } catch (error) {
      console.error('Database health check failed:', error);
      return 'degraded';
    }
  }

  async checkCacheHealth() {
    try {
      const stats = await cacheManager.getStats();
      return {
        status: stats.enabled ? 'operational' : 'degraded',
        enabled: Boolean(stats.enabled),
        totalKeys: Number(stats.totalKeys || 0),
        error: stats.error || null,
      };
    } catch (error) {
      return {
        status: 'degraded',
        enabled: false,
        totalKeys: 0,
        error: error?.message || 'Cache health check failed',
      };
    }
  }

  async checkStorageHealth() {
    try {
      // Implement storage health check
      return 'operational';
    } catch (error) {
      return 'degraded';
    }
  }

  async getRequestMetrics(period) {
    // Calculate time range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setHours(startDate.getHours() - 24);
    }

    // Get request logs from audit trail
    const requestLogs = await prisma.auditLog.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const hoursDiff = (endDate - startDate) / (1000 * 60 * 60);
    const averagePerHour = Math.round(requestLogs / hoursDiff);

    return {
      total: requestLogs,
      average: averagePerHour,
      period
    };
  }

  async getErrorMetrics(period) {
    // Calculate time range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setHours(startDate.getHours() - 24);
    }

    // Get error logs from audit trail
    const errorLogs = await prisma.auditLog.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        severity: 'ERROR'
      }
    });

    const totalLogs = await prisma.auditLog.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const errorRate = totalLogs > 0 ? ((errorLogs / totalLogs) * 100).toFixed(2) : 0;

    return {
      total: errorLogs,
      rate: `${errorRate}%`,
      period
    };
  }

  async getPerformanceMetrics(period) {
    // This would typically come from your APM tool
    // Returning placeholder data
    return {
      averageResponseTime: 245,
      p95ResponseTime: 520,
      p99ResponseTime: 1200,
      period
    };
  }

  async getUserMetrics(period) {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setHours(startDate.getHours() - 24);
    }

    const activeUsers = await prisma.user.count({
      where: {
        lastLogin: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const newUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const totalUsers = await prisma.user.count();

    return {
      active: activeUsers,
      new: newUsers,
      total: totalUsers,
      period
    };
  }

  async getExpenseMetrics(period) {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setHours(startDate.getHours() - 24);
    }

    const expenses = await prisma.expense.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: {
        amount: true
      }
    });

    const pendingExpenses = await prisma.expense.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'PENDING'
      },
      _sum: {
        amount: true
      }
    });

    const approvedExpenses = await prisma.expense.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'APPROVED'
      },
      _sum: {
        amount: true
      }
    });

    return {
      total: expenses._sum.amount || 0,
      pending: pendingExpenses._sum.amount || 0,
      approved: approvedExpenses._sum.amount || 0,
      period
    };
  }

  async getVehicleMetrics(period) {
    const activeVehicles = await prisma.vehicle.count({
      where: { status: 'ACTIVE' }
    });

    const maintenanceVehicles = await prisma.vehicle.count({
      where: { status: 'MAINTENANCE' }
    });

    const outOfServiceVehicles = await prisma.vehicle.count({
      where: { status: 'OUT_OF_SERVICE' }
    });

    const totalVehicles = await prisma.vehicle.count();

    return {
      active: activeVehicles,
      maintenance: maintenanceVehicles,
      outOfService: outOfServiceVehicles,
      idle: totalVehicles - (activeVehicles + maintenanceVehicles + outOfServiceVehicles),
      total: totalVehicles,
      period
    };
  }

  // Comprehensive transaction log - all financial changes with responsible persons
  async getTransactionLog(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        entity,
        action,
        userId,
        search,
        startDate,
        endDate,
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = {
        entity: { not: 'NOTIFICATION' },
      };

      if (entity) where.entity = entity;
      if (action) where.action = action;
      if (userId) where.userId = userId;
      if (search) where.entityId = { contains: search, mode: 'insensitive' };
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      // Parse JSON strings, enrich with secondary persons from metadata
      const parseVal = (v) => {
        if (!v) return null;
        if (typeof v === 'object') return v;
        try { return JSON.parse(v); } catch { return null; }
      };

      const enriched = logs.map((log) => {
        const oldVal = parseVal(log.oldValue);
        const newVal = parseVal(log.newValue);

        // Extract secondary persons embedded in the payload
        const secondaryPersons = {};
        if (newVal) {
          if (newVal.requestedBy) secondaryPersons.requestedBy = newVal.requestedBy;
          if (newVal.approvedBy) secondaryPersons.approvedBy = newVal.approvedBy;
          if (newVal.rejectedBy) secondaryPersons.rejectedBy = newVal.rejectedBy;
          if (newVal.approvedByName) secondaryPersons.approvedByName = newVal.approvedByName;
          if (newVal.rejectedByName) secondaryPersons.rejectedByName = newVal.rejectedByName;
          if (newVal.approvalReason) secondaryPersons.approvalReason = newVal.approvalReason;
          if (newVal.reason) secondaryPersons.reason = newVal.reason;
          if (newVal.comments) secondaryPersons.comments = newVal.comments;
          if (newVal.changes) secondaryPersons.changes = newVal.changes;
          if (newVal.decision) secondaryPersons.decision = newVal.decision;
          if (newVal.requestId) secondaryPersons.requestId = newVal.requestId;
        }

        return {
          id: log.id,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId,
          actor: log.user,
          oldValue: oldVal,
          newValue: newVal,
          meta: secondaryPersons,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt,
        };
      });

      return res.status(200).json({
        success: true,
        data: enriched,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export as singleton
export default new AdminController();

import { ExpenseService } from '../services/expense.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateExpense } from '../validators/expense.validator.js';
import { AppError } from '../utils/AppError.js';
import { invalidateDashboardDrilldownCache } from '../utils/cacheInvalidation.js';
import prisma from '../config/database.js';

const parseAuditJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const parseApprovalProgress = (expense) => {
  const history = Array.isArray(expense?.approvalHistory) ? expense.approvalHistory : [];
  const workflowInit = history.find((entry) => entry?.kind === 'WORKFLOW_INIT') || null;
  const approvalSteps = history.filter((entry) => entry?.kind === 'APPROVAL_STEP' && entry?.status === 'APPROVED');
  const roles = Array.isArray(workflowInit?.roles) && workflowInit.roles.length > 0
    ? workflowInit.roles
    : ['ADMIN', 'SUPER_ADMIN', 'CEO'];

  const approvedStages = Number.isInteger(workflowInit?.currentStage)
    ? workflowInit.currentStage
    : approvalSteps.length;

  const indexKey = String(approvedStages);
  const parallelRolesByStage = workflowInit && typeof workflowInit.parallelRolesByStage === 'object'
    ? workflowInit.parallelRolesByStage
    : {};
  const nextRoles = Array.isArray(parallelRolesByStage[indexKey])
    ? parallelRolesByStage[indexKey]
    : Array.isArray(parallelRolesByStage[approvedStages])
      ? parallelRolesByStage[approvedStages]
      : [roles[approvedStages]].filter(Boolean);

  return {
    roles,
    approvedStages,
    totalStages: roles.length,
    nextRole: nextRoles[0] || null,
    nextRoles,
  };
};

const withApprovalProgress = (expense) => {
  if (!expense) return expense;
  return {
    ...expense,
    approvalProgress: parseApprovalProgress(expense),
  };
};

const hasReceiptRecord = (expense) => Boolean(expense?.receiptUrl || expense?.receiptNumber);

const withReceiptCompliance = (expense) => {
  if (!expense) return expense;

  const completedWithoutReceipt = expense.processStatus === 'COMPLETED' && !hasReceiptRecord(expense);

  return {
    ...expense,
    hasReceiptRecord: hasReceiptRecord(expense),
    completedWithoutReceipt,
  };
};

/**
 * Convert a raw changes object (from an audit log) into a shape safe for
 * prisma.expense.update().  Relation IDs must use { connect } and any fields
 * that don't exist on the Expense model must be stripped out.
 */
const sanitizeExpenseChanges = (changes = {}) => {
  // Fields that are NOT columns on Expense and must be dropped
  const NON_MODEL_FIELDS = new Set(['modificationReason', 'subsidiaryName']);

  const sanitized = {};
  for (const [key, value] of Object.entries(changes)) {
    if (NON_MODEL_FIELDS.has(key)) continue;
    if (key === 'subsidiaryId') {
      sanitized.subsidiary = { connect: { id: value } };
    } else if (key === 'vehicleId') {
      sanitized.vehicle = value ? { connect: { id: value } } : { disconnect: true };
    } else if (key === 'vendorId') {
      sanitized.vendor = value ? { connect: { id: value } } : { disconnect: true };
    } else if (key === 'budgetId') {
      sanitized.budget = value ? { connect: { id: value } } : { disconnect: true };
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const PRIVILEGED_EXPENSE_ROLES = new Set(['ACCOUNTANT', 'CEO', 'SUPER_ADMIN', 'AUDITOR', 'ADMIN']);
const STAFF_SCOPED_ROLES = new Set(['EMPLOYEE', 'SUPERVISOR']);
const EXPENSE_EDIT_PRIVILEGED_ROLES = new Set(['CEO', 'SUPER_ADMIN']);

export class ExpenseController {
  constructor() {
    this.expenseService = new ExpenseService();
  }

  normalizeDateInput = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value instanceof Date) return value;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;

      // Accept YYYY-MM-DD values from forms and convert to DateTime.
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return new Date(`${trimmed}T00:00:00.000Z`);
      }

      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };

  canEditExpense = (expense, user) => {
    if (!expense || !user) return false;
    if (EXPENSE_EDIT_PRIVILEGED_ROLES.has(String(user.role || '').toUpperCase())) return true;
    return expense.createdById === user.id;
  };

  normalizeExpensePayload = (body = {}) => {
    const { requestedDate, ...restBody } = body;

    const toNumber = (value) => {
      if (value === undefined || value === null || value === '') return undefined;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    };

    return {
      ...restBody,
      amount: toNumber(body.amount),
      quantity: toNumber(body.quantity),
      unitPrice: toNumber(body.unitPrice),
      exchangeRate: toNumber(body.exchangeRate),
      taxRate: toNumber(body.taxRate),
      taxAmount: toNumber(body.taxAmount),
      recordedDate: this.normalizeDateInput(body.recordedDate || body.requestedDate),
      expenseDate: this.normalizeDateInput(body.expenseDate),
      dueDate: this.normalizeDateInput(body.dueDate),
      isRecurring: body.isRecurring === 'true' || body.isRecurring === true,
    };
  };

  createExpense = asyncHandler(async (req, res) => {
    const { requestedDate, ...restBody } = req.body || {};

    const toNumber = (value) => {
      if (value === undefined || value === null || value === '') return undefined;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    };

    const payload = {
      ...restBody,
      amount: toNumber(req.body.amount),
      quantity: toNumber(req.body.quantity),
      unitPrice: toNumber(req.body.unitPrice),
      exchangeRate: toNumber(req.body.exchangeRate),
      taxRate: toNumber(req.body.taxRate),
      taxAmount: toNumber(req.body.taxAmount),
      recordedDate: this.normalizeDateInput(req.body.recordedDate || req.body.requestedDate),
      expenseDate: this.normalizeDateInput(req.body.expenseDate),
      dueDate: this.normalizeDateInput(req.body.dueDate),
      isRecurring: req.body.isRecurring === 'true' || req.body.isRecurring === true,
    };

    const receiptFile = req.files?.receipt?.[0];
    const attachmentFiles = req.files?.attachments || [];

    if (receiptFile) {
      payload.receiptUrl = receiptFile.path.replace(/\\/g, '/');
      payload.receiptNumber = payload.receiptNumber || receiptFile.originalname;
    }

    if (attachmentFiles.length > 0) {
      payload.attachments = attachmentFiles.map((file) => ({
        name: file.originalname,
        url: file.path.replace(/\\/g, '/'),
        mimeType: file.mimetype,
        size: file.size,
      }));
    }

    const { error } = validateExpense(payload);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const expense = await this.expenseService.createExpense(payload, req.user.id);
    await invalidateDashboardDrilldownCache();
    
    res.status(201).json({
      success: true,
      data: expense,
      message: 'Expense created successfully'
    });
  });

  getExpenses = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      expenseType,
      expenseCategory,
      paymentStatus,
      approvalStatus,
      vehicleId,
      subsidiaryId,
      vendorId,
      projectId,
      search
    } = req.query;

    const where = {
      isDeleted: false,
      AND: [],
    };

    const currentRole = String(req.user?.role || '').toUpperCase();
    if (STAFF_SCOPED_ROLES.has(currentRole) && !PRIVILEGED_EXPENSE_ROLES.has(currentRole)) {
      where.AND.push({ createdById: req.user.id });
    }

    if (currentRole === 'DRIVER') {
      const assignments = await prisma.vehicleAssignment.findMany({
        where: { staffId: req.user.id },
        select: { vehicleId: true },
      });

      const assignedVehicleIds = [...new Set(assignments.map((row) => row.vehicleId).filter(Boolean))];

      if (assignedVehicleIds.length === 0) {
        where.AND.push({ id: '__no_expense_match__' });
      } else {
        where.AND.push({ vehicleId: { in: assignedVehicleIds } });
      }
    }

    if (currentRole === 'CHIEF_DRIVER') {
      const scopedSubsidiaryIds = [
        req.user?.subsidiaryId,
        ...(Array.isArray(req.user?.subsidiaryAccess) ? req.user.subsidiaryAccess : []),
      ].filter(Boolean);

      const uniqueScopedSubsidiaryIds = [...new Set(scopedSubsidiaryIds)];

      if (uniqueScopedSubsidiaryIds.length === 0) {
        where.AND.push({ id: '__no_expense_match__' });
      } else {
        const [primaryVehicles, linkedVehicles] = await Promise.all([
          prisma.vehicle.findMany({
            where: { subsidiaryId: { in: uniqueScopedSubsidiaryIds } },
            select: { id: true },
          }),
          prisma.vehicleSubsidiary.findMany({
            where: { subsidiaryId: { in: uniqueScopedSubsidiaryIds } },
            select: { vehicleId: true },
          }),
        ]);

        const scopedVehicleIds = [...new Set([
          ...primaryVehicles.map((row) => row.id),
          ...linkedVehicles.map((row) => row.vehicleId),
        ].filter(Boolean))];

        if (scopedVehicleIds.length === 0) {
          where.AND.push({ id: '__no_expense_match__' });
        } else {
          where.AND.push({ vehicleId: { in: scopedVehicleIds } });
        }
      }

      // Chief driver finance view is vehicle-specific; skip non-vehicle expenses.
      where.AND.push({ vehicleId: { not: null } });
    }

    // Date range filter
    if (startDate && endDate) {
      where.AND.push({ expenseDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      } });
    }

    // Other filters
    if (expenseType) where.AND.push({ expenseType });
    if (expenseCategory) where.AND.push({ expenseCategory });
    if (paymentStatus) where.AND.push({ paymentStatus });
    if (approvalStatus) where.AND.push({ approvalStatus });
    if (vehicleId) where.AND.push({ vehicleId });
    if (subsidiaryId) where.AND.push({ subsidiaryId });
    if (vendorId) where.AND.push({ vendorId });
    if (projectId) where.AND.push({ projectId });

    // Search functionality
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
        { receiptNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (where.AND.length === 0) {
      delete where.AND;
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            model: true
          }
        },
        subsidiary: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            fullName: true,
            role: true,
          }
        },
        completedBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: [
        { expenseDate: 'desc' },
        { createdAt: 'desc' },
        { updatedAt: 'desc' },
        { id: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.expense.count({ where });

    res.json({
      success: true,
      data: expenses.map((expense) => withReceiptCompliance(withApprovalProgress(expense))),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  });

  getExpenseById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id, isDeleted: false },
      include: {
        vehicle: true,
        subsidiary: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            fullName: true,
            role: true,
          }
        },
        completedBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }
    const currentRole = String(req.user?.role || '').toUpperCase();

    if (currentRole === 'DRIVER') {
      const assignment = await prisma.vehicleAssignment.findFirst({
        where: {
          staffId: req.user.id,
          vehicleId: expense.vehicleId || '',
        },
        select: { id: true },
      });

      if (!assignment) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this expense',
        });
      }
    }

    if (currentRole === 'CHIEF_DRIVER') {
      const scopedSubsidiaryIds = [
        req.user?.subsidiaryId,
        ...(Array.isArray(req.user?.subsidiaryAccess) ? req.user.subsidiaryAccess : []),
      ].filter(Boolean);

      const uniqueScopedSubsidiaryIds = [...new Set(scopedSubsidiaryIds)];
      const linkedSubsidiaries = expense.vehicleId
        ? await prisma.vehicleSubsidiary.findMany({
            where: { vehicleId: expense.vehicleId },
            select: { subsidiaryId: true },
          })
        : [];
      const vehicleScopedSubsidiaryIds = [
        expense?.vehicle?.subsidiaryId,
        ...linkedSubsidiaries.map((row) => row.subsidiaryId),
      ].filter(Boolean);

      const hasAccess = vehicleScopedSubsidiaryIds.some((sid) => uniqueScopedSubsidiaryIds.includes(sid));

      if (!expense.vehicleId || !hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this expense',
        });
      }
    }

    res.json({
      success: true,
      data: withReceiptCompliance(withApprovalProgress(expense))
    });
  });

  updateExpense = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updatePayload = this.normalizeExpensePayload(req.body);
    const modificationReason = String(req.body.modificationReason || '').trim();
    const receiptFile = req.files?.receipt?.[0];
    const attachmentFiles = req.files?.attachments || [];

    if (receiptFile) {
      updatePayload.receiptUrl = receiptFile.path.replace(/\\/g, '/');
      updatePayload.receiptNumber = updatePayload.receiptNumber || receiptFile.originalname;
    }

    if (attachmentFiles.length > 0) {
      updatePayload.attachments = attachmentFiles.map((file) => ({
        name: file.originalname,
        url: file.path.replace(/\\/g, '/'),
        mimeType: file.mimetype,
        size: file.size,
      }));
    }

    const { error } = validateExpense(updatePayload, true);
    
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const existing = await prisma.expense.findUnique({
      where: { id, isDeleted: false }
    });

    if (!existing) {
      throw new AppError('Expense not found', 404);
    }

    if (!this.canEditExpense(existing, req.user)) {
      throw new AppError('Only the submitting user, CEO, or SUPER_ADMIN can edit this expense', 403);
    }

    // Check if expense can be edited
    if (existing.paymentStatus === 'PAID') {
      throw new AppError('Paid expenses cannot be edited', 400);
    }

    if (existing.approvalStatus === 'APPROVED') {
      if (!modificationReason) {
        throw new AppError('Modification reason is required for approved expenses', 400);
      }

      const requestLog = await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'EXPENSE_MODIFICATION_REQUEST',
          entity: 'EXPENSE',
          entityId: id,
          oldValue: existing,
          newValue: {
            changes: updatePayload,
            modificationReason,
            requestedBy: {
              id: req.user.id,
              role: req.user.role,
              fullName: req.user.fullName,
            },
            requestedAt: new Date().toISOString(),
          },
        }
      });

      await this.expenseService.notificationService.sendExpenseModificationRequest(
        ['CEO', 'SUPER_ADMIN'],
        {
          expenseId: id,
          requestId: requestLog.id,
          requestedBy: req.user.fullName,
          requestedByRole: req.user.role,
          reason: modificationReason,
        }
      );

      return res.status(202).json({
        success: true,
        message: 'Expense modification request submitted for CEO/SUPER_ADMIN approval',
        data: {
          requestId: requestLog.id,
          expenseId: id,
          status: 'PENDING_APPROVAL',
        }
      });
    }

    if (existing.approvalStatus !== 'PENDING') {
      throw new AppError('Only pending expenses can be edited directly', 400);
    }

    const nextSubsidiaryId = updatePayload.subsidiaryId || existing.subsidiaryId;

    if (updatePayload.vehicleId) {
      const selectedVehicle = await prisma.vehicle.findUnique({
        where: { id: updatePayload.vehicleId },
        select: { id: true, subsidiaryId: true },
      });

      if (!selectedVehicle) {
        throw new AppError('Selected vehicle does not exist', 400);
      }

      if (selectedVehicle.subsidiaryId !== nextSubsidiaryId) {
        throw new AppError('Vehicle belongs to a different subsidiary. Select matching subsidiary or vehicle.', 400);
      }
    }

    if (updatePayload.subsidiaryId && !updatePayload.vehicleId && existing.vehicleId) {
      const currentVehicle = await prisma.vehicle.findUnique({
        where: { id: existing.vehicleId },
        select: { id: true, subsidiaryId: true },
      });

      if (currentVehicle && currentVehicle.subsidiaryId !== updatePayload.subsidiaryId) {
        throw new AppError('Cannot change subsidiary while linked vehicle belongs to another subsidiary.', 400);
      }
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...sanitizeExpenseChanges(updatePayload),
        updatedAt: new Date(),
          updatedBy: { connect: { id: req.user.id } }
      },
      include: {
        vehicle: true,
        subsidiary: true,
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'EXPENSE',
        entityId: id,
        oldValue: existing,
        newValue: updated
      }
    });

    await invalidateDashboardDrilldownCache();

    res.json({
      success: true,
      data: updated,
      message: 'Expense updated successfully'
    });
  });

  getPendingModificationRequests = asyncHandler(async (_req, res) => {
    const requests = await prisma.auditLog.findMany({
      where: {
        action: 'EXPENSE_MODIFICATION_REQUEST',
        entity: 'EXPENSE',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const approvals = await prisma.auditLog.findMany({
      where: {
        action: { in: ['EXPENSE_MODIFICATION_APPROVED', 'EXPENSE_MODIFICATION_REJECTED'] },
        entity: 'EXPENSE',
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const resolvedRequestIds = new Set(
      approvals
        .map((item) => parseAuditJson(item.newValue))
        .filter(Boolean)
        .map((meta) => meta.requestId)
        .filter(Boolean)
    );

    const pendingRaw = requests
      .filter((request) => !resolvedRequestIds.has(request.id))
      .map((request) => ({
        ...request,
        oldValue: parseAuditJson(request.oldValue),
        newValue: parseAuditJson(request.newValue),
      }));

    // Collect all unique subsidiary IDs referenced in old/new values
    const subsidiaryIds = new Set();
    for (const item of pendingRaw) {
      if (item.oldValue?.subsidiaryId) subsidiaryIds.add(item.oldValue.subsidiaryId);
      if (item.newValue?.changes?.subsidiaryId) subsidiaryIds.add(item.newValue.changes.subsidiaryId);
    }

    const subsidiaryMap = {};
    if (subsidiaryIds.size > 0) {
      const subs = await prisma.subsidiary.findMany({
        where: { id: { in: Array.from(subsidiaryIds) } },
        select: { id: true, name: true, code: true },
      });
      for (const sub of subs) {
        subsidiaryMap[sub.id] = sub.code
          ? `${sub.name} (${sub.code})`
          : sub.name;
      }
    }

    const pending = pendingRaw.map((item) => {
      // Annotate oldValue with subsidiary name
      const oldSubId = item.oldValue?.subsidiaryId;
      const newSubId = item.newValue?.changes?.subsidiaryId;
      return {
        ...item,
        oldValue: item.oldValue
          ? { ...item.oldValue, subsidiaryName: oldSubId ? (subsidiaryMap[oldSubId] || oldSubId) : null }
          : item.oldValue,
        newValue: item.newValue
          ? {
              ...item.newValue,
              changes: item.newValue.changes
                ? {
                    ...item.newValue.changes,
                    subsidiaryName: newSubId ? (subsidiaryMap[newSubId] || newSubId) : null,
                  }
                : item.newValue.changes,
            }
          : item.newValue,
      };
    });

    res.json({ success: true, data: pending });
  });

  getExpenseModificationHistory = asyncHandler(async (_req, res) => {
    const history = await prisma.auditLog.findMany({
      where: {
        entity: 'EXPENSE',
        action: { in: ['EXPENSE_MODIFICATION_APPROVED', 'EXPENSE_MODIFICATION_REJECTED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json({
      success: true,
      data: history.map((entry) => ({
        ...entry,
        oldValue: parseAuditJson(entry.oldValue),
        newValue: parseAuditJson(entry.newValue),
      })),
    });
  });

  approveExpenseModification = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { decision, approvalReason } = req.body;

    if (!approvalReason || !String(approvalReason).trim()) {
      throw new AppError('Approval or rejection reason is required', 400);
    }

    if (!['APPROVE', 'REJECT'].includes(String(decision || '').toUpperCase())) {
      throw new AppError('Decision must be APPROVE or REJECT', 400);
    }

    const requestLog = await prisma.auditLog.findUnique({ where: { id: requestId } });
    if (!requestLog || requestLog.action !== 'EXPENSE_MODIFICATION_REQUEST' || requestLog.entity !== 'EXPENSE') {
      throw new AppError('Modification request not found', 404);
    }

    const priorDecisions = await prisma.auditLog.findMany({
      where: {
        entity: 'EXPENSE',
        action: { in: ['EXPENSE_MODIFICATION_APPROVED', 'EXPENSE_MODIFICATION_REJECTED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const alreadyResolved = priorDecisions.some((entry) => {
      const meta = parseAuditJson(entry.newValue);
      return meta?.requestId === requestId;
    });

    if (alreadyResolved) {
      throw new AppError('This modification request is already resolved', 400);
    }

    const requestPayload = parseAuditJson(requestLog.newValue) || {};
    const changes = requestPayload.changes || {};
    const expense = await prisma.expense.findUnique({ where: { id: requestLog.entityId, isDeleted: false } });

    if (!expense) {
      throw new AppError('Expense record not found', 404);
    }

    if (String(decision).toUpperCase() === 'APPROVE') {
      const nextSubsidiaryId = changes.subsidiaryId || expense.subsidiaryId;

      if (changes.vehicleId) {
        const selectedVehicle = await prisma.vehicle.findUnique({
          where: { id: changes.vehicleId },
          select: { id: true, subsidiaryId: true },
        });

        if (!selectedVehicle) {
          throw new AppError('Selected vehicle does not exist', 400);
        }

        if (selectedVehicle.subsidiaryId !== nextSubsidiaryId) {
          throw new AppError('Vehicle belongs to a different subsidiary. Select matching subsidiary or vehicle.', 400);
        }
      }

      await prisma.expense.update({
        where: { id: requestLog.entityId },
        data: {
          ...sanitizeExpenseChanges(changes),
          updatedBy: { connect: { id: requestPayload.requestedBy?.id || req.user.id } },
          updatedAt: new Date(),
        },
      });
    }

    const action = String(decision).toUpperCase() === 'APPROVE'
      ? 'EXPENSE_MODIFICATION_APPROVED'
      : 'EXPENSE_MODIFICATION_REJECTED';

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action,
        entity: 'EXPENSE',
        entityId: requestLog.entityId,
        oldValue: requestLog.oldValue,
        newValue: {
          requestId,
          decision: String(decision).toUpperCase(),
          approvalReason: String(approvalReason).trim(),
          approvedBy: {
            id: req.user.id,
            fullName: req.user.fullName,
            role: req.user.role,
          },
          approvedAt: new Date().toISOString(),
        },
      }
    });

    if (requestLog.userId) {
      const isApproved = String(decision).toUpperCase() === 'APPROVE';
      const item = changes.description || changes.details || changes.expenseCategory || expense.description || expense.expenseCategory || 'your expense';
      const amountFormatted = changes.amount != null
        ? `NGN ${Number(changes.amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : expense?.amount != null
          ? `NGN ${Number(expense.amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : null;
      const actorName = req.user.fullName || 'An approver';
      const decisionMessage = isApproved
        ? `Your modification request for "${item}"${amountFormatted ? ` (${amountFormatted})` : ''} has been approved by ${actorName}.${approvalReason ? ` Note: ${approvalReason}` : ''}`
        : `Your modification request for "${item}"${amountFormatted ? ` (${amountFormatted})` : ''} has been rejected by ${actorName}. Reason: ${approvalReason}`;

      await this.expenseService.notificationService.sendExpenseUpdate(requestLog.userId, {
        title: isApproved ? 'Modification Approved' : 'Modification Rejected',
        message: decisionMessage,
        type: isApproved ? 'EXPENSE_MODIFICATION_APPROVED' : 'EXPENSE_MODIFICATION_REJECTED',
        category: 'expense',
        expenseId: requestLog.entityId,
        item,
        reason: String(approvalReason).trim(),
        approvedBy: actorName,
      });
    }

    await invalidateDashboardDrilldownCache();

    res.json({
      success: true,
      message: `Expense modification request ${String(decision).toUpperCase() === 'APPROVE' ? 'approved' : 'rejected'}`,
    });
  });

  deleteExpense = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { permanent } = req.query;

    await this.expenseService.deleteExpense(id, req.user.id, permanent === 'true');
    await invalidateDashboardDrilldownCache();

    res.json({
      success: true,
      message: permanent === 'true' ? 'Expense permanently deleted' : 'Expense moved to trash'
    });
  });

  approveExpense = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comments } = req.body;

    const expense = await this.expenseService.approveExpense(id, req.user.id, comments);
    await invalidateDashboardDrilldownCache();

    res.json({
      success: true,
      data: expense,
      message: 'Expense approved successfully'
    });
  });

  rejectExpense = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new AppError('Rejection reason is required', 400);
    }

    const expense = await this.expenseService.rejectExpense(id, req.user.id, reason);
    await invalidateDashboardDrilldownCache();

    res.json({
      success: true,
      data: expense,
      message: 'Expense rejected'
    });
  });

  completeExpense = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const receiptFile = req.files?.receipt?.[0];
    const attachmentFiles = req.files?.attachments || [];

    const payload = {
      notes: req.body.notes || undefined,
    };

    if (receiptFile) {
      payload.receiptUrl = receiptFile.path.replace(/\\/g, '/');
      payload.receiptNumber = req.body.receiptNumber || receiptFile.originalname;
    }

    if (attachmentFiles.length > 0) {
      payload.attachments = attachmentFiles.map((file) => ({
        name: file.originalname,
        url: file.path.replace(/\\/g, '/'),
        mimeType: file.mimetype,
        size: file.size,
      }));
    }

    const completed = await this.expenseService.completeExpense(id, req.user.id, payload);
    await invalidateDashboardDrilldownCache();

    const completionMessage =
      completed?.processStatus === 'IN_PROGRESS' && !completed?.receiptUrl
        ? 'Expense proceeded successfully. Awaiting receipt upload.'
        : 'Expense completed successfully';

    res.json({
      success: true,
      data: completed,
      message: completionMessage
    });
  });

  uploadCompletedExpenseReceipt = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const receiptFile = req.files?.receipt?.[0];

    if (!receiptFile) {
      throw new AppError('Receipt file is required', 400);
    }

    const payload = {
      receiptUrl: receiptFile.path.replace(/\\/g, '/'),
      receiptNumber: req.body.receiptNumber || receiptFile.originalname,
    };

    const updated = await this.expenseService.uploadReceiptForCompletedExpense(id, req.user.id, payload);
    await invalidateDashboardDrilldownCache();

    res.json({
      success: true,
      data: updated,
      message: 'Receipt uploaded successfully',
    });
  });

  getPendingApprovals = asyncHandler(async (req, res) => {
    const expenses = await this.expenseService.expenseRepository.getPendingApprovals(req.user.id);
    const role = String(req.user?.role || '').toUpperCase();
    const filtered = expenses.filter((expense) => {
      const progress = parseApprovalProgress(expense);
      const nextRoles = Array.isArray(progress.nextRoles)
        ? progress.nextRoles.map((item) => String(item || '').toUpperCase()).filter(Boolean)
        : [String(progress.nextRole || '').toUpperCase()].filter(Boolean);
      return nextRoles.includes(role);
    });

    res.json({
      success: true,
      data: filtered.map(withApprovalProgress)
    });
  });

  markAsPaid = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const paymentData = req.body;

    const expense = await prisma.expense.findUnique({
      where: { id, isDeleted: false }
    });

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    if (expense.paymentStatus === 'PAID') {
      throw new AppError('Expense already marked as paid', 400);
    }

    const updated = await this.expenseService.expenseRepository.markAsPaid(id, paymentData);

    // Create payment record
    await prisma.payment.create({
      data: {
        paymentNumber: `PAY-EXP-${Date.now()}`,
        paymentType: 'REIMBURSEMENT',
        paymentMethod: paymentData.paymentMethod,
        amount: expense.amount,
        paymentDate: paymentData.paymentDate || new Date(),
        expenseId: id,
        reference: paymentData.paymentReference,
        receivedById: req.user.id,
        notes: `Payment for expense: ${expense.description || expense.id}`
      }
    });

    await invalidateDashboardDrilldownCache();

    res.json({
      success: true,
      data: updated,
      message: 'Expense marked as paid'
    });
  });

  getExpenseAnalytics = asyncHandler(async (req, res) => {
    const {
      startDate,
      endDate,
      subsidiaryId,
      vehicleId,
      groupBy = 'category'
    } = req.query;

    const analytics = await this.expenseService.getExpenseReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      subsidiaryId,
      vehicleId,
      groupBy
    });

    res.json({
      success: true,
      data: analytics
    });
  });

  getExpenseStats = asyncHandler(async (req, res) => {
    const { subsidiaryId, period } = req.query;

    const stats = await this.expenseService.getExpenseStats({
      subsidiaryId,
      period
    });

    res.json({
      success: true,
      data: stats
    });
  });

  getMonthlyComparison = asyncHandler(async (req, res) => {
    const { year = new Date().getFullYear() } = req.query;

    const comparison = await this.expenseService.getMonthlyComparison(parseInt(year));

    res.json({
      success: true,
      data: comparison
    });
  });

  bulkCreateExpenses = asyncHandler(async (req, res) => {
    const { expenses } = req.body;

    if (!Array.isArray(expenses) || expenses.length === 0) {
      throw new AppError('Please provide an array of expenses', 400);
    }

    const results = await this.expenseService.bulkCreateExpenses(expenses, req.user.id);
    await invalidateDashboardDrilldownCache();

    res.status(201).json({
      success: true,
      data: results,
      message: `Successfully created ${results.successful.length} expenses, ${results.failed.length} failed`
    });
  });

  getExpenseCategories = asyncHandler(async (req, res) => {
    // Return all expense categories grouped by type
    const categories = {
      OPERATIONAL: [
        'FUEL', 'MAINTENANCE', 'REPAIRS', 'TYRES', 'INSURANCE', 
        'ROAD_TOLLS', 'PARKING', 'DRIVER_ALLOWANCE', 'VEHICLE_REGISTRATION',
        'VEHICLE_INSPECTION', 'OIL_CHANGE', 'BRAKE_PADS', 'BATTERY',
        'LIGHTS', 'WIPERS', 'CAR_WASH', 'DETAILING'
      ],
      ADMINISTRATIVE: [
        'SALARIES', 'WAGES', 'BONUSES', 'COMMISSIONS', 'STAFF_BENEFITS',
        'PENSION', 'TRAINING', 'RECRUITMENT', 'RENT', 'UTILITIES',
        'ELECTRICITY', 'WATER', 'INTERNET', 'TELEPHONE', 'OFFICE_SUPPLIES',
        'STATIONERY', 'PRINTING', 'POSTAGE', 'COURIER', 'LEGAL_FEES',
        'ACCOUNTING_FEES', 'CONSULTING_FEES', 'AUDIT_FEES', 'BANK_CHARGES',
        'INTEREST', 'INSURANCE_ADMIN', 'SECURITY', 'CLEANING', 'WASTE_DISPOSAL'
      ],
      MARKETING: [
        'ADVERTISING', 'DIGITAL_MARKETING', 'SOCIAL_MEDIA_ADS', 'PRINT_ADS',
        'BILLBOARDS', 'RADIO_ADS', 'TV_ADS', 'PROMOTIONS', 'DISCOUNTS',
        'WEBSITE', 'SEO', 'CONTENT_CREATION', 'BRANDING', 'EVENT_SPONSORSHIP',
        'TRADE_SHOWS', 'MARKETING_MATERIALS', 'BROCHURES', 'FLYERS', 'BUSINESS_CARDS'
      ],
      CAPITAL: [
        'VEHICLE_PURCHASE', 'VEHICLE_IMPORT', 'VEHICLE_CUSTOMS', 'EQUIPMENT',
        'MACHINERY', 'TOOLS', 'FURNITURE', 'OFFICE_EQUIPMENT', 'COMPUTER',
        'LAPTOP', 'PRINTER', 'SCANNER', 'SOFTWARE', 'LICENSE', 'SUBSCRIPTION',
        'RENOVATION', 'CONSTRUCTION', 'BUILDING', 'LAND'
      ],
      SECURITY_SERVICES: [
        'UNIFORMS', 'SECURITY_GEAR', 'GUARD_EQUIPMENT', 'CCTV_CAMERAS',
        'CCTV_INSTALLATION', 'CCTV_MAINTENANCE', 'ALARM_SYSTEMS',
        'ACCESS_CONTROL', 'SMART_HOME_DEVICES', 'SECURITY_CONSULTING',
        'RISK_ASSESSMENT', 'SECURITY_AUDIT', 'GUARD_TRAINING',
        'SECURITY_LICENSES', 'SECURITY_PERMITS', 'PATROL_VEHICLES',
        'COMMUNICATION_EQUIPMENT', 'RADIOS', 'BODY_CAMERAS'
      ],
      CONSTRUCTION: [
        'CONSTRUCTION_MATERIALS', 'CEMENT', 'SAND', 'GRAVEL', 'GRANITE',
        'BLOCKS', 'BRICKS', 'TIMBER', 'STEEL', 'REINFORCEMENT', 'NAILS',
        'SCREWS', 'PAINT', 'TILES', 'ROOFING', 'PLUMBING_MATERIALS',
        'ELECTRICAL_MATERIALS', 'WIRES', 'CONDUITS', 'FITTINGS', 'FIXTURES',
        'DOORS', 'WINDOWS', 'HARDWARE', 'TOOLS_CONSTRUCTION', 'EQUIPMENT_RENTAL',
        'CRANE', 'EXCAVATOR', 'CONCRETE_MIXER', 'GENERATOR', 'SUBCONTRACTORS',
        'LABOR', 'SKILLED_LABOR', 'UNSKILLED_LABOR', 'PERMITS', 'BUILDING_PERMITS',
        'ENVIRONMENTAL_PERMITS', 'SAFETY_GEAR', 'HELMETS', 'BOOTS', 'VESTS',
        'GLOVES', 'SITE_SECURITY', 'SITE_CLEANUP', 'WASTE_REMOVAL'
      ],
      TRAVEL: [
        'LOCAL_TRAVEL', 'INTERNATIONAL_TRAVEL', 'AIRFARE', 'HOTEL', 'MEALS',
        'TRANSPORTATION', 'TAXI', 'RENTAL_CAR', 'FUEL_TRAVEL', 'PARKING_TRAVEL',
        'TOLLS_TRAVEL', 'VISA', 'PASSPORT'
      ],
      MISCELLANEOUS: [
        'DONATIONS', 'CHARITY', 'GIFTS', 'ENTERTAINMENT', 'CLIENT_ENTERTAINMENT',
        'STAFF_ENTERTAINMENT', 'TEAM_BUILDING', 'STAFF_PARTY', 'SUBSISTENCE',
        'PETTY_CASH', 'CONTINGENCY', 'MISCELLANEOUS', 'OTHER'
      ]
    };

    res.json({
      success: true,
      data: categories
    });
  });

  restoreExpense = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id }
    });

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    if (!expense.isDeleted) {
      throw new AppError('Expense is not deleted', 400);
    }

    const restored = await this.expenseService.expenseRepository.restore(id);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'RESTORE',
        entity: 'EXPENSE',
        entityId: id,
        newValue: restored
      }
    });

    await invalidateDashboardDrilldownCache();

    res.json({
      success: true,
      data: restored,
      message: 'Expense restored successfully'
    });
  });

  getTrashedExpenses = asyncHandler(async (req, res) => {
    const expenses = await prisma.expense.findMany({
      where: { isDeleted: true },
      include: {
        vehicle: {
          select: {
            registrationNumber: true,
            model: true
          }
        },
        subsidiary: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        deletedAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: expenses
    });
  });
}

export default ExpenseController;
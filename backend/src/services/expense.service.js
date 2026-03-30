import { ExpenseRepository } from '../repositories/expense.repository.js';
import { AuditService } from './audit.service.js';
import { NotificationService } from './notification.service.js';
import { BudgetService } from './budget.service.js';
import { TransactionLedgerService } from './transactionLedger.service.js';
import { AppError } from '../utils/AppError.js';
import prisma from '../config/database.js';
import { resolveScopedSubsidiaryId } from '../utils/subsidiaryScope.js';

const EXPENSE_CATEGORIES_BY_TYPE = {
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
  OTHER: ['OTHER']
};

const VEHICLE_RELATED_EXPENSE_CATEGORIES = new Set([
  'FUEL',
  'MAINTENANCE',
  'REPAIRS',
  'TYRES',
  'INSURANCE',
  'ROAD_TOLLS',
  'PARKING',
  'DRIVER_ALLOWANCE',
  'VEHICLE_REGISTRATION',
  'VEHICLE_INSPECTION',
  'OIL_CHANGE',
  'BRAKE_PADS',
  'BATTERY',
  'LIGHTS',
  'WIPERS',
  'CAR_WASH',
  'DETAILING',
  'VEHICLE_PURCHASE',
  'VEHICLE_IMPORT',
  'VEHICLE_CUSTOMS',
  'PATROL_VEHICLES',
]);

const STRICT_VEHICLE_REQUEST_ROLES = new Set(['DRIVER', 'CHIEF_DRIVER', 'CEO', 'SUPER_ADMIN']);
const EXECUTIVE_STAGE_ROLES = ['SUPER_ADMIN', 'CEO'];

export class ExpenseService {
  constructor() {
    this.expenseRepository = new ExpenseRepository();
    this.auditService = new AuditService();
    this.notificationService = new NotificationService();
    this.budgetService = new BudgetService();
    this.transactionLedgerService = new TransactionLedgerService();
  }

  normalizeRole(role) {
    return String(role || '').trim().toUpperCase();
  }

  formatRoleLabel(role) {
    const normalized = this.normalizeRole(role);
    if (!normalized) return 'Approver';
    const labels = {
      DRIVER: 'Driver',
      CHIEF_DRIVER: 'Chief Driver',
      ADMIN: 'Admin',
      SUPER_ADMIN: 'Super Admin',
      CEO: 'CEO',
    };
    return labels[normalized] || normalized.replace(/_/g, ' ');
  }

  formatStageRolesLabel(roles = []) {
    const uniqueRoles = [...new Set((Array.isArray(roles) ? roles : []).map((role) => this.normalizeRole(role)).filter(Boolean))];
    if (uniqueRoles.length === 0) return 'Approver';
    return uniqueRoles.map((role) => this.formatRoleLabel(role)).join(' / ');
  }

  buildStageAlertTemplate(nextRole, { requestedByName, item, amountFormatted }) {
    const role = this.normalizeRole(nextRole);
    const requester = requestedByName || 'A user';

    if (role === 'CHIEF_DRIVER') {
      return {
        title: 'Chief Driver Review Required',
        message: `${requester} submitted ${item} (${amountFormatted}). Please review and approve/reject as Chief Driver.`,
      };
    }

    if (role === 'ADMIN') {
      return {
        title: 'Admin Approval Required',
        message: `${requester} submitted ${item} (${amountFormatted}). This is now at Admin approval stage.`,
      };
    }

    if (role === 'SUPER_ADMIN') {
      return {
        title: 'Super Admin Approval Required',
        message: `${requester} submitted ${item} (${amountFormatted}). Admin stage is complete; Super Admin approval is required.`,
      };
    }

    if (role === 'CEO') {
      return {
        title: 'CEO Final Approval Required',
        message: `${requester} submitted ${item} (${amountFormatted}). Final CEO approval is required.`,
      };
    }

    return {
      title: 'Expense Approval Required',
      message: `${requester} submitted ${item} (${amountFormatted}). Pending ${this.formatRoleLabel(role)} review.`,
    };
  }

  getUserScopedSubsidiaryIds(actor) {
    return [...new Set([
      actor?.subsidiaryId,
      ...(Array.isArray(actor?.subsidiaryAccess) ? actor.subsidiaryAccess : []),
    ].filter(Boolean))];
  }

  getVehicleScopedSubsidiaryIds(vehicle) {
    return [...new Set([
      vehicle?.subsidiaryId,
      ...(Array.isArray(vehicle?.vehicleSubsidiaries)
        ? vehicle.vehicleSubsidiaries.map((row) => row.subsidiaryId)
        : []),
    ].filter(Boolean))];
  }

  buildInitialWorkflow({ requesterRole, chiefRecipientIds = [], expenseCategory }) {
    const normalizedRole = this.normalizeRole(requesterRole);

    // ADMIN submissions: only SUPER_ADMIN and CEO at shared stage (either one approves)
    if (normalizedRole === 'ADMIN') {
      // Keep a single stage and use parallelRolesByStage so either SUPER_ADMIN or CEO can finalize.
      return ['CEO'];
    }

    // Driver submissions end at SUPER_ADMIN (no CEO required)
    if (normalizedRole === 'DRIVER' && chiefRecipientIds.length > 0) {
      return ['CHIEF_DRIVER', 'ADMIN', 'SUPER_ADMIN'];
    }

    // All other roles stay with full chain
    const base = ['ADMIN', 'SUPER_ADMIN', 'CEO'];
    return base;
  }

  buildParallelRolesByStage({ requesterRole, expenseCategory }) {
    // ADMIN submissions always have shared SUPER_ADMIN/CEO approval stage
    if (this.normalizeRole(requesterRole) === 'ADMIN') {
      return { 0: EXECUTIVE_STAGE_ROLES };
    }
    return {};
  }

  getStageRoles({ roles = [], stageIndex = 0, workflowInit = null }) {
    const indexKey = String(stageIndex);
    const parallelRolesByStage = workflowInit && typeof workflowInit.parallelRolesByStage === 'object'
      ? workflowInit.parallelRolesByStage
      : {};

    const parallelRoles = Array.isArray(parallelRolesByStage[indexKey])
      ? parallelRolesByStage[indexKey]
      : Array.isArray(parallelRolesByStage[stageIndex])
        ? parallelRolesByStage[stageIndex]
        : null;

    if (parallelRoles && parallelRoles.length > 0) {
      return [...new Set(parallelRoles.map((role) => this.normalizeRole(role)).filter(Boolean))];
    }

    const stageRole = roles[stageIndex];
    return stageRole ? [this.normalizeRole(stageRole)] : [];
  }

  parseWorkflowState(expense) {
    const history = Array.isArray(expense?.approvalHistory) ? expense.approvalHistory : [];
    const workflowInit = history.find((entry) => entry?.kind === 'WORKFLOW_INIT') || null;
    const steps = history.filter((entry) => entry?.kind === 'APPROVAL_STEP');

    const roles = Array.isArray(workflowInit?.roles) && workflowInit.roles.length > 0
      ? workflowInit.roles
      : ['ADMIN', 'SUPER_ADMIN', 'CEO'];
    const currentStage = Number.isInteger(workflowInit?.currentStage)
      ? workflowInit.currentStage
      : steps.length;

    const nextRoles = this.getStageRoles({ roles, stageIndex: currentStage, workflowInit });

    return {
      history,
      workflowInit,
      roles,
      steps,
      currentStage,
      nextRole: nextRoles[0] || null,
      nextRoles,
    };
  }

  async resolveRoleRecipients(role, { expense, workflowInit }) {
    const normalizedRole = this.normalizeRole(role);

    if (normalizedRole === 'CHIEF_DRIVER') {
      const ids = Array.isArray(workflowInit?.chiefRecipientIds) ? workflowInit.chiefRecipientIds.filter(Boolean) : [];
      return [...new Set(ids)];
    }

    const where = {
      isActive: true,
      role: normalizedRole,
    };

    if (normalizedRole === 'ADMIN' && expense?.subsidiaryId) {
      where.OR = [
        { subsidiaryId: expense.subsidiaryId },
        { subsidiaryAccess: { has: expense.subsidiaryId } },
      ];
    }

    const users = await prisma.user.findMany({ where, select: { id: true } });
    return users.map((user) => user.id);
  }

  async notifyApprovalStage({ expense, workflowInit, requestedByName, nextRole, nextRoles }) {
    const stageRoles = [...new Set((Array.isArray(nextRoles) && nextRoles.length > 0 ? nextRoles : [nextRole]).map((role) => this.normalizeRole(role)).filter(Boolean))];
    if (stageRoles.length === 0) return;

    const recipientGroups = await Promise.all(
      stageRoles.map((role) => this.resolveRoleRecipients(role, { expense, workflowInit }))
    );
    const recipientIds = [...new Set(recipientGroups.flat().filter(Boolean))];
    if (recipientIds.length === 0) return;

    const item = expense.description || expense.details || expense.expenseCategory || 'an expense request';
    const amountFormatted = `NGN ${Number(expense.amount || 0).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    const template = stageRoles.length > 1
      ? {
          title: `${this.formatStageRolesLabel(stageRoles)} Approval Required`,
          message: `${requestedByName || 'A user'} submitted ${item} (${amountFormatted}). This stage requires ${this.formatStageRolesLabel(stageRoles)} approval.`,
        }
      : this.buildStageAlertTemplate(stageRoles[0], {
          requestedByName,
          item,
          amountFormatted,
        });

    await Promise.all(recipientIds.map((userId) =>
      this.notificationService.sendExpenseUpdate(userId, {
        title: template.title,
        message: template.message,
        type: 'EXPENSE_APPROVAL_REQUIRED',
        category: 'expense',
        expenseId: expense.id,
        amount: expense.amount,
        item,
        requestedBy: requestedByName || null,
      })
    ));
  }

  async notifyInvolvedAdminsForDriverFlow({
    expense,
    workflowInit,
    title,
    message,
    type,
    requestedBy,
    approvedBy,
    rejectedBy,
    reason,
  }) {
    const initiatedByRole = this.normalizeRole(workflowInit?.initiatedByRole);
    if (initiatedByRole !== 'DRIVER') return;

    const adminRecipientIds = await this.resolveRoleRecipients('ADMIN', { expense, workflowInit });
    if (adminRecipientIds.length === 0) return;

    const item = expense.description || expense.details || expense.expenseCategory || 'expense request';

    await Promise.all(adminRecipientIds.map((userId) =>
      this.notificationService.sendExpenseUpdate(userId, {
        title,
        message,
        type,
        category: 'expense',
        expenseId: expense.id,
        amount: expense.amount,
        item,
        requestedBy: requestedBy || null,
        approvedBy: approvedBy || null,
        rejectedBy: rejectedBy || null,
        reason: reason || null,
      })
    ));
  }

  async createExpense(data, userId) {
    try {
      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          subsidiaryId: true,
          subsidiaryAccess: true,
          fullName: true,
          email: true,
        },
      });

      if (!actor) {
        throw new AppError('User not found', 404);
      }

      const actorRole = this.normalizeRole(actor.role);
      const actorScopedSubsidiaryIds = this.getUserScopedSubsidiaryIds(actor);
      const normalizedExpenseCategory = this.normalizeRole(data.expenseCategory);

      if (STRICT_VEHICLE_REQUEST_ROLES.has(actorRole)) {
        if (!VEHICLE_RELATED_EXPENSE_CATEGORIES.has(normalizedExpenseCategory)) {
          throw new AppError('Driver, Chief Driver, CEO and Super Admin can only submit car-related expenses', 400);
        }
        if (!data.vehicleId) {
          throw new AppError('Vehicle is required for car-related expense requests by this role', 400);
        }
      }

      let resolvedSubsidiaryId = await resolveScopedSubsidiaryId({
        requestedSubsidiaryId: data.subsidiaryId,
        userSubsidiaryId: actor.subsidiaryId,
        userSubsidiaryAccess: actor.subsidiaryAccess,
      });

      let chiefRecipientIds = [];

      if (data.vehicleId) {
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: data.vehicleId },
          select: {
            id: true,
            subsidiaryId: true,
          },
        });

        if (!vehicle) {
          throw new AppError('Selected vehicle does not exist', 400);
        }

        const vehicleLinks = await prisma.vehicleSubsidiary.findMany({
          where: { vehicleId: data.vehicleId },
          select: { subsidiaryId: true },
        });
        const vehicleScopedSubsidiaryIds = [...new Set([
          vehicle.subsidiaryId,
          ...vehicleLinks.map((row) => row.subsidiaryId),
        ].filter(Boolean))];

        if (actorRole === 'DRIVER') {
          const assignment = await prisma.vehicleAssignment.findFirst({
            where: {
              staffId: userId,
              vehicleId: data.vehicleId,
            },
            select: { id: true },
          });

          if (!assignment) {
            throw new AppError('Driver can only request expenses for assigned vehicles', 403);
          }

          let chiefCandidates = [];
          if (vehicleScopedSubsidiaryIds.length > 0) {
            chiefCandidates = await prisma.user.findMany({
              where: {
                isActive: true,
                role: 'CHIEF_DRIVER',
                OR: [
                  { subsidiaryId: { in: vehicleScopedSubsidiaryIds } },
                  { subsidiaryAccess: { hasSome: vehicleScopedSubsidiaryIds } },
                ],
              },
              select: { id: true },
            });
          }

          if (chiefCandidates.length > 0) {
            chiefRecipientIds = chiefCandidates.map((row) => row.id);
          } else if (actor.subsidiaryId) {
            const fallbackChiefs = await prisma.user.findMany({
              where: {
                isActive: true,
                role: 'CHIEF_DRIVER',
                OR: [
                  { subsidiaryId: actor.subsidiaryId },
                  { subsidiaryAccess: { has: actor.subsidiaryId } },
                ],
              },
              select: { id: true },
            });
            chiefRecipientIds = fallbackChiefs.map((row) => row.id);
          }
        }

        if (actorRole === 'CHIEF_DRIVER') {
          if (vehicleScopedSubsidiaryIds.length === 0) {
            throw new AppError('Selected vehicle does not have a valid subsidiary scope', 400);
          }

          const canAccessVehicleScope = vehicleScopedSubsidiaryIds.some((sid) => actorScopedSubsidiaryIds.includes(sid));
          if (!canAccessVehicleScope) {
            throw new AppError('Chief driver can only request expenses for vehicles in assigned subsidiaries', 403);
          }
        }

        if (vehicleScopedSubsidiaryIds.length > 0 && !vehicleScopedSubsidiaryIds.includes(resolvedSubsidiaryId)) {
          throw new AppError('Vehicle belongs to a different subsidiary. Select matching subsidiary or vehicle.', 400);
        }

        resolvedSubsidiaryId = resolvedSubsidiaryId || vehicle.subsidiaryId;
      }

      if ((actorRole === 'DRIVER' || actorRole === 'CHIEF_DRIVER') && !data.vehicleId) {
        throw new AppError('Vehicle is required for driver and chief driver expense requests', 400);
      }

      const workflowRoles = this.buildInitialWorkflow({
        requesterRole: actorRole,
        chiefRecipientIds,
        expenseCategory: normalizedExpenseCategory,
      });
      const parallelRolesByStage = this.buildParallelRolesByStage({
        requesterRole: actorRole,
        expenseCategory: normalizedExpenseCategory,
      });

      const initialApprovalHistory = [
        {
          kind: 'WORKFLOW_INIT',
          roles: workflowRoles,
          currentStage: 0,
          initiatedByRole: actorRole,
          chiefRecipientIds,
          parallelRolesByStage,
          createdAt: new Date().toISOString(),
        },
      ];

      const scopedData = {
        ...data,
        subsidiaryId: resolvedSubsidiaryId,
        approvalHistory: initialApprovalHistory,
        approvalLevel: 0,
        approvalStatus: 'PENDING',
        processStatus: 'PENDING',
      };

      // Validate expense data
      await this.validateExpense(scopedData);

      // Check budget if applicable
      if (scopedData.budgetId) {
        await this.budgetService.checkBudgetAvailability(scopedData.budgetId, scopedData.amount);
      }

      // Create expense
      const expense = await this.expenseRepository.createExpense({
        ...scopedData,
        createdById: userId
      });

      await this.transactionLedgerService.recordExpense(
        expense,
        userId,
        'Expense recorded'
      );

      // Update budget spent amount
      if (scopedData.budgetId) {
        await this.budgetService.updateSpentAmount(scopedData.budgetId, scopedData.amount);
      }

      // Check for budget alerts
      if (scopedData.budgetId) {
        await this.budgetService.checkBudgetAlert(scopedData.budgetId);
      }

      // Handle recurring expense setup
      if (data.isRecurring) {
        await this.setupRecurringExpense(expense);
      }

      // Audit log
      await this.auditService.log({
        userId,
        action: 'CREATE',
        entity: 'EXPENSE',
        entityId: expense.id,
        newValue: expense
      });

      // Send notifications for high-value expenses
      if (scopedData.amount > 1000000) { // ₦1,000,000 threshold
        await this.notificationService.sendHighValueAlert(expense);
      }

      const largeWithoutReceiptThreshold = Number(process.env.LARGE_EXPENSE_NO_RECEIPT_THRESHOLD || 1000000);
      const hasReceipt = Boolean(expense.receiptUrl || (Array.isArray(expense.attachments) && expense.attachments.length > 0));

      if (!hasReceipt && expense.amount >= largeWithoutReceiptThreshold) {
        await this.notificationService.sendLargeExpenseWithoutReceiptAlert(
          expense,
          actor ? { id: actor.id, fullName: actor.fullName, email: actor.email } : { id: userId }
        );
      }

      const firstStageRoles = this.getStageRoles({
        roles: workflowRoles,
        stageIndex: 0,
        workflowInit: initialApprovalHistory[0],
      });
      const firstRole = firstStageRoles[0] || 'ADMIN';
      await this.notifyApprovalStage({
        expense,
        workflowInit: initialApprovalHistory[0],
        requestedByName: actor.fullName || actor.email || 'A user',
        nextRoles: firstStageRoles,
      });

      await this.notificationService.sendExpenseUpdate(userId, {
        title: 'Expense Request Submitted',
        message: `${this.formatRoleLabel(actorRole)} request submitted successfully. Current stage: ${this.formatRoleLabel(firstRole)} approval.`,
        type: 'EXPENSE_REQUEST_SUBMITTED',
        category: 'expense',
        expenseId: expense.id,
        amount: expense.amount,
        item: expense.description || expense.details || expense.expenseCategory || 'expense',
      });

      await this.notifyInvolvedAdminsForDriverFlow({
        expense,
        workflowInit: initialApprovalHistory[0],
        title: 'Driver Expense Request Submitted',
        message: `Driver ${actor.fullName || actor.email || 'Unknown driver'} submitted an expense request in your subsidiary scope. Current stage: ${this.formatRoleLabel(firstRole)} approval.`,
        type: 'DRIVER_EXPENSE_REQUEST_SUBMITTED',
        requestedBy: actor.fullName || actor.email || 'Unknown driver',
      });

      return expense;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('[ExpenseService.createExpense] Unexpected error:', error);
      throw new AppError('Failed to create expense', 500, error);
    }
  }

  async validateExpense(data) {
    const expenseType = String(data.expenseType || '').toUpperCase();
    const expenseCategory = String(data.expenseCategory || '').toUpperCase();

    // Required fields
    if (!data.amount || data.amount <= 0) {
      throw new AppError('Valid amount is required', 400);
    }

    if (!data.expenseDate) {
      throw new AppError('Expense date is required', 400);
    }

    if (!expenseType) {
      throw new AppError('Expense type is required', 400);
    }

    if (!expenseCategory) {
      throw new AppError('Expense category is required', 400);
    }

    const allowedCategories = EXPENSE_CATEGORIES_BY_TYPE[expenseType] || [];
    if (allowedCategories.length > 0 && !allowedCategories.includes(expenseCategory)) {
      throw new AppError(
        `Expense category ${expenseCategory} is not valid for type ${expenseType}`,
        400
      );
    }

    // For fuel expenses, a linked vehicle is required.
    if (expenseCategory === 'FUEL' && !data.vehicleId) {
      throw new AppError('Vehicle selection is required for fuel expenses', 400);
    }

    // Validate date not in future
    if (new Date(data.expenseDate) > new Date()) {
      throw new AppError('Expense date cannot be in the future', 400);
    }

    // Check for duplicate receipt
    if (data.receiptNumber) {
      const existing = await this.expenseRepository.findMany({
        receiptNumber: data.receiptNumber
      });
      if (existing.length > 0) {
        throw new AppError('Receipt number already exists', 400);
      }
    }

    // Validate quantity and unit price if provided
    if (data.quantity && data.unitPrice) {
      const calculatedAmount = data.quantity * data.unitPrice;
      if (Math.abs(calculatedAmount - data.amount) > 0.01) {
        throw new AppError('Amount does not match quantity × unit price', 400);
      }
    }

    // Validate tax calculation if tax rate provided
    if (data.taxRate && data.taxAmount) {
      const calculatedTax = data.amount * (data.taxRate / 100);
      if (Math.abs(calculatedTax - data.taxAmount) > 0.01) {
        throw new AppError('Tax amount does not match tax rate', 400);
      }
    }

    // Check for unreasonable amounts by category
    const categoryLimits = {
      FUEL: 50000,
      MAINTENANCE: 200000,
      REPAIRS: 300000,
      SALARIES: 1000000,
      VEHICLE_PURCHASE: 20000000
    };

    if (categoryLimits[data.expenseCategory] && 
        data.amount > categoryLimits[data.expenseCategory]) {
      // Flag for review instead of blocking
      data.needsReview = true;
      data.approvalLevel = 1; // Requires approval
    }
  }

  async setupRecurringExpense(expense) {
    // Calculate next due date
    const nextDueDate = this.expenseRepository.calculateNextDueDate(
      expense.expenseDate,
      expense.recurrencePattern
    );

    await this.expenseRepository.update(expense.id, {
      nextDueDate
    });

    // Schedule job for recurring expense
    await this.scheduleRecurringExpenseJob(expense);
  }

  async scheduleRecurringExpenseJob(expense) {
    // This would integrate with your job scheduler (Bull, Agenda, etc.)
    // For now, just log it
    console.log(`Scheduled recurring expense: ${expense.id}`);
  }

  async processRecurringExpenses() {
    const recurringExpenses = await this.expenseRepository.getRecurringExpenses();

    for (const expense of recurringExpenses) {
      await this.expenseRepository.createRecurringInstance(expense);
    }
  }

  async approveExpense(id, approverId, comments) {
    const expense = await this.expenseRepository.findById(id);
    
    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    if (expense.approvalStatus !== 'PENDING') {
      throw new AppError('Expense already processed', 400);
    }

    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: { id: true, role: true, fullName: true },
    });
    if (!approver) {
      throw new AppError('Approver not found', 404);
    }

    const { history, workflowInit, roles, currentStage, nextRole, nextRoles } = this.parseWorkflowState(expense);
    const approverRole = this.normalizeRole(approver.role);
    const expectedRole = this.normalizeRole(nextRole);
    const allowedRolesForStage = nextRoles.length > 0
      ? nextRoles
      : [expectedRole].filter(Boolean);

    if (allowedRolesForStage.length === 0 || !allowedRolesForStage.includes(approverRole)) {
      throw new AppError(`Expense is currently awaiting ${this.formatStageRolesLabel(allowedRolesForStage)} approval`, 403);
    }

    const nextStageIndex = currentStage + 1;
    const isFinalStage = nextStageIndex >= roles.length;

    const updatedHistory = history
      .filter((entry) => entry?.kind !== 'WORKFLOW_INIT')
      .concat([
        {
          kind: 'APPROVAL_STEP',
          level: nextStageIndex,
          approverId,
          role: approverRole,
          date: new Date().toISOString(),
          comments: comments || null,
          status: 'APPROVED',
        },
      ]);

    const updatedWorkflowInit = {
      ...(workflowInit || { kind: 'WORKFLOW_INIT', roles }),
      kind: 'WORKFLOW_INIT',
      roles,
      currentStage: nextStageIndex,
      lastUpdatedAt: new Date().toISOString(),
    };

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        approvalLevel: nextStageIndex,
        approvalStatus: isFinalStage ? 'APPROVED' : 'PENDING',
        processStatus: isFinalStage ? 'IN_PROGRESS' : 'PENDING',
        approvalHistory: [updatedWorkflowInit, ...updatedHistory],
        approvedById: isFinalStage ? approverId : null,
        approvedAt: isFinalStage ? new Date() : null,
      },
      include: {
        vehicle: true,
        subsidiary: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    await this.transactionLedgerService.recordExpenseLifecycle(
      updated,
      approverId,
      updated.processStatus || (isFinalStage ? 'IN_PROGRESS' : 'PENDING'),
      isFinalStage ? 'Expense fully approved and moved to in-progress' : 'Expense approval stage completed'
    );

    // Notify creator
    await this.auditService.log({
      userId: approverId,
      action: 'APPROVE',
      entity: 'EXPENSE',
      entityId: id,
      oldValue: { approvalStatus: expense.approvalStatus },
      newValue: { approvalStatus: updated.approvalStatus, comments: comments || null, approvalLevel: nextStageIndex },
    });

    const item = expense.description || expense.details || expense.expenseCategory || 'your expense';
    const amountFormatted = `NGN ${Number(expense.amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const currentStageRoleLabel = this.formatStageRolesLabel(allowedRolesForStage);
    const nextStageRoles = this.getStageRoles({ roles, stageIndex: nextStageIndex, workflowInit: updatedWorkflowInit });
    const nextStageRoleLabel = this.formatStageRolesLabel(nextStageRoles);
    await this.notificationService.sendExpenseUpdate(expense.createdById, {
      title: isFinalStage ? 'Expense Approved' : 'Expense Approval Progress',
      message: isFinalStage
        ? `Your expense request of ${amountFormatted} for "${item}" has been fully approved at ${currentStageRoleLabel} stage${approver?.fullName ? ` by ${approver.fullName}` : ''}.${comments ? ` Note: ${comments}` : ''}`
        : `Your expense request of ${amountFormatted} for "${item}" was approved at ${currentStageRoleLabel} stage${approver?.fullName ? ` by ${approver.fullName}` : ''}. Next stage: ${nextStageRoleLabel}.${comments ? ` Note: ${comments}` : ''}`,
      type: isFinalStage ? 'EXPENSE_APPROVED' : 'EXPENSE_APPROVAL_PROGRESS',
      category: 'expense',
      expenseId: id,
      amount: expense.amount,
      item,
      approvedBy: approver?.fullName || null,
    });

    await this.notifyInvolvedAdminsForDriverFlow({
      expense: updated,
      workflowInit: updatedWorkflowInit,
      title: isFinalStage ? 'Driver Expense Request Fully Approved' : 'Driver Expense Request Stage Updated',
      message: isFinalStage
        ? `Driver expense request has completed all approvals at ${currentStageRoleLabel} stage and is ready for execution.`
        : `Driver expense request approved at ${currentStageRoleLabel} stage. Next stage: ${nextStageRoleLabel}.`,
      type: isFinalStage ? 'DRIVER_EXPENSE_REQUEST_APPROVED' : 'DRIVER_EXPENSE_REQUEST_PROGRESS',
      requestedBy: expense.createdBy?.fullName || expense.createdBy?.email || null,
      approvedBy: approver?.fullName || null,
      reason: comments || null,
    });

    if (!isFinalStage) {
      const upcomingRoles = this.getStageRoles({ roles, stageIndex: nextStageIndex, workflowInit: updatedWorkflowInit });
      await this.notifyApprovalStage({
        expense: updated,
        workflowInit: updatedWorkflowInit,
        requestedByName: expense.createdBy?.fullName || expense.createdBy?.email || 'A user',
        nextRoles: upcomingRoles,
      });
    } else {
      const adminRecipients = await this.resolveRoleRecipients('ADMIN', { expense: updated, workflowInit: updatedWorkflowInit });
      if (adminRecipients.length > 0) {
        await Promise.all(adminRecipients.map((userId) =>
          this.notificationService.sendExpenseUpdate(userId, {
            title: 'Expense Ready For Execution',
            message: `Expense ${item} (${amountFormatted}) has completed all approvals and is ready for execution.`,
            type: 'EXPENSE_READY_FOR_EXECUTION',
            category: 'expense',
            expenseId: id,
            amount: expense.amount,
            item,
          })
        ));
      }
    }

    // Update budget committed amount
    if (expense.budgetId) {
      await this.budgetService.updateCommittedAmount(expense.budgetId, expense.amount);
    }

    return updated;
  }

  async rejectExpense(id, approverId, reason) {
    const expense = await this.expenseRepository.findById(id);
    
    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    if (expense.approvalStatus !== 'PENDING') {
      throw new AppError('Expense already processed', 400);
    }

    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: { id: true, role: true, fullName: true },
    });
    if (!approver) {
      throw new AppError('Approver not found', 404);
    }

    const { history, workflowInit, roles, currentStage, nextRole, nextRoles } = this.parseWorkflowState(expense);
    const approverRole = this.normalizeRole(approver.role);
    const expectedRole = this.normalizeRole(nextRole);
    const allowedRolesForStage = nextRoles.length > 0
      ? nextRoles
      : [expectedRole].filter(Boolean);
    if (allowedRolesForStage.length === 0 || !allowedRolesForStage.includes(approverRole)) {
      throw new AppError(`Expense is currently awaiting ${this.formatStageRolesLabel(allowedRolesForStage)} approval`, 403);
    }

    const rejectionStep = {
      kind: 'APPROVAL_STEP',
      level: currentStage + 1,
      approverId,
      role: approverRole,
      date: new Date().toISOString(),
      reason,
      status: 'REJECTED',
    };

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        processStatus: 'PENDING',
        rejectionReason: reason,
        approvalHistory: [
          {
            ...(workflowInit || { kind: 'WORKFLOW_INIT', roles }),
            kind: 'WORKFLOW_INIT',
            roles,
            currentStage,
            lastUpdatedAt: new Date().toISOString(),
          },
          ...history.filter((entry) => entry?.kind !== 'WORKFLOW_INIT'),
          rejectionStep,
        ],
      },
    });

    await this.auditService.log({
      userId: approverId,
      action: 'REJECT',
      entity: 'EXPENSE',
      entityId: id,
      oldValue: { approvalStatus: expense.approvalStatus },
      newValue: { approvalStatus: 'REJECTED', reason: reason || null },
    });

    // Notify creator
    const rejItem = expense.description || expense.details || expense.expenseCategory || 'your expense';
    const rejAmountFormatted = `NGN ${Number(expense.amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    await this.notificationService.sendExpenseUpdate(expense.createdById, {
      title: 'Expense Rejected',
      message: `Your expense request of ${rejAmountFormatted} for "${rejItem}" was rejected at ${this.formatStageRolesLabel(allowedRolesForStage)} stage${approver?.fullName ? ` by ${approver.fullName}` : ''}. Reason: ${reason}`,
      type: 'EXPENSE_REJECTED',
      category: 'expense',
      expenseId: id,
      item: rejItem,
      reason,
      rejectedBy: approver?.fullName || null,
    });

    await this.notifyInvolvedAdminsForDriverFlow({
      expense: {
        ...expense,
        ...updated,
      },
      workflowInit: {
        ...(workflowInit || { initiatedByRole: null }),
      },
      title: 'Driver Expense Request Rejected',
      message: `Driver expense request was rejected at ${this.formatStageRolesLabel(allowedRolesForStage)} stage${approver?.fullName ? ` by ${approver.fullName}` : ''}.`,
      type: 'DRIVER_EXPENSE_REQUEST_REJECTED',
      requestedBy: expense.createdBy?.fullName || expense.createdBy?.email || null,
      rejectedBy: approver?.fullName || null,
      reason,
    });

    return updated;
  }

  async completeExpense(id, completerId, data = {}) {
    const expense = await this.expenseRepository.findById(id);

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    if (expense.approvalStatus !== 'APPROVED') {
      throw new AppError('Expense must be approved before completion', 400);
    }

    if (expense.processStatus === 'COMPLETED') {
      throw new AppError('Expense is already completed', 400);
    }

    const { workflowInit } = this.parseWorkflowState(expense);
    const initiatedByRole = this.normalizeRole(workflowInit?.initiatedByRole);
    const isDriverVehicleFlow = initiatedByRole === 'DRIVER' && Boolean(expense?.vehicleId);

    let updated;

    if (isDriverVehicleFlow) {
      if (expense.completedById) {
        throw new AppError('Expense has already been proceeded and is awaiting receipt upload', 400);
      }

      if (data?.receiptUrl) {
        throw new AppError('Proceed first, then upload receipt to finalize completion', 400);
      }

      updated = await prisma.expense.update({
        where: { id },
        data: {
          processStatus: 'IN_PROGRESS',
          completedById: completerId,
          completedAt: new Date(),
          notes: data.notes ?? expense.notes,
        },
        include: {
          vehicle: true,
          subsidiary: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });
    } else {
      updated = await this.expenseRepository.completeExpense(id, completerId, data);
    }

    await this.auditService.log({
      userId: completerId,
      action: 'COMPLETE',
      entity: 'EXPENSE',
      entityId: id,
      oldValue: expense,
      newValue: updated,
    });

    await this.transactionLedgerService.recordExpenseLifecycle(
      updated,
      completerId,
      isDriverVehicleFlow ? 'IN_PROGRESS' : 'COMPLETED',
      isDriverVehicleFlow ? 'Expense proceeded and awaiting receipt upload' : 'Expense completed'
    );

    const hasReceiptAfterCompletion = Boolean(updated?.receiptUrl || updated?.receiptNumber);
    if (!hasReceiptAfterCompletion && !isDriverVehicleFlow) {
      const completedBy = await prisma.user.findUnique({
        where: { id: completerId },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      });

      await this.notificationService.sendExpenseCompletedWithoutReceiptAlert({
        expense: {
          ...updated,
          createdById: expense.createdById,
        },
        completedBy,
      });
    }

    return updated;
  }

  collectExpenseParticipantIds(expense = {}, extraIds = []) {
    const history = Array.isArray(expense?.approvalHistory) ? expense.approvalHistory : [];
    const stepApproverIds = history
      .filter((entry) => entry?.kind === 'APPROVAL_STEP')
      .map((entry) => entry?.approverId || entry?.userId)
      .filter(Boolean);

    return [...new Set([
      expense?.createdById,
      expense?.approvedById,
      expense?.completedById,
      ...stepApproverIds,
      ...(Array.isArray(extraIds) ? extraIds : []),
    ].filter(Boolean))];
  }

  async uploadReceiptForCompletedExpense(id, uploaderId, data = {}) {
    const expense = await prisma.expense.findUnique({
      where: { id, isDeleted: false },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        completedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    const { workflowInit } = this.parseWorkflowState(expense);
    const initiatedByRole = this.normalizeRole(workflowInit?.initiatedByRole);
    const isDriverVehicleFlow = initiatedByRole === 'DRIVER' && Boolean(expense?.vehicleId);

    if (isDriverVehicleFlow) {
      if (expense.processStatus !== 'IN_PROGRESS' || !expense.completedById) {
        throw new AppError('Proceed the expense first before uploading receipt', 400);
      }
    } else if (expense.processStatus !== 'COMPLETED') {
      throw new AppError('Receipt can only be uploaded after expense completion', 400);
    }

    if (!data?.receiptUrl) {
      throw new AppError('Receipt file is required', 400);
    }

    if (expense.receiptUrl) {
      throw new AppError('Receipt already exists for this expense', 400);
    }

    const uploader = await prisma.user.findUnique({
      where: { id: uploaderId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
    });

    if (!uploader) {
      throw new AppError('Uploader not found', 404);
    }

    const privilegedRoles = new Set(['CHIEF_DRIVER', 'ADMIN', 'CEO', 'SUPER_ADMIN']);
    const participantIds = this.collectExpenseParticipantIds(expense);
    const isParticipant = participantIds.includes(uploaderId);
    const isPrivileged = privilegedRoles.has(this.normalizeRole(uploader.role));

    if (!isParticipant && !isPrivileged) {
      throw new AppError('Not authorised to upload receipt for this completed expense', 403);
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        receiptUrl: data.receiptUrl,
        receiptNumber: data.receiptNumber || expense.receiptNumber,
        processStatus: isDriverVehicleFlow ? 'COMPLETED' : expense.processStatus,
        completedById: expense.completedById || uploaderId,
        completedAt: expense.completedAt || new Date(),
        updatedById: uploaderId,
        updatedAt: new Date(),
      },
      include: {
        vehicle: true,
        subsidiary: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        completedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    await this.auditService.log({
      userId: uploaderId,
      action: 'UPLOAD_RECEIPT_POST_COMPLETION',
      entity: 'EXPENSE',
      entityId: id,
      oldValue: {
        receiptUrl: expense.receiptUrl,
        receiptNumber: expense.receiptNumber,
      },
      newValue: {
        receiptUrl: updated.receiptUrl,
        receiptNumber: updated.receiptNumber,
      },
    });

    const participantsToNotify = this.collectExpenseParticipantIds(updated, [uploaderId]);
    const actorName = uploader.fullName || uploader.email || 'A user';
    const item = updated.description || updated.details || updated.expenseCategory || 'expense';
    const amountLabel = `NGN ${Number(updated.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    await Promise.all(participantsToNotify.map((userId) =>
      this.notificationService.sendExpenseUpdate(userId, {
        title: 'Expense Receipt Uploaded',
        message: `${actorName} uploaded receipt for completed expense ${item} (${amountLabel}).`,
        type: 'EXPENSE_RECEIPT_UPLOADED',
        category: 'expense',
        expenseId: updated.id,
        amount: updated.amount,
        item,
        requestedBy: updated.createdBy?.fullName || null,
        approvedBy: updated.approvedBy?.fullName || null,
        completedBy: updated.completedBy?.fullName || null,
      })
    ));

    return updated;
  }

  async getExpenseReport(filters = {}) {
    const { startDate, endDate, format = 'summary' } = filters;

    const analytics = await this.expenseRepository.getExpenseAnalytics(filters);

    if (format === 'detailed') {
      const expenses = await this.expenseRepository.findByDateRange(
        startDate || new Date(new Date().setMonth(new Date().getMonth() - 1)),
        endDate || new Date(),
        { isDeleted: false }
      );

      return {
        ...analytics,
        details: expenses
      };
    }

    return analytics;
  }

  async getExpensesByCategory(category, filters = {}) {
    const { startDate, endDate } = filters;

    return this.expenseRepository.findMany({
      expenseCategory: category,
      expenseDate: {
        gte: startDate || new Date(new Date().setMonth(new Date().getMonth() - 1)),
        lte: endDate || new Date()
      },
      isDeleted: false
    }, {
      vehicle: true,
      subsidiary: true,
      approvedBy: {
        select: {
          fullName: true
        }
      }
    });
  }

  async getMonthlyComparison(year) {
    const currentYear = await this.expenseRepository.getMonthlySummary({ year });
    const previousYear = await this.expenseRepository.getMonthlySummary({ year: year - 1 });

    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    
    return months.map(month => {
      const current = currentYear.find(m => m.month === month) || { total_amount: 0 };
      const previous = previousYear.find(m => m.month === month) || { total_amount: 0 };
      
      return {
        month,
        currentYear: current.total_amount,
        previousYear: previous.total_amount,
        change: previous.total_amount ? 
          ((current.total_amount - previous.total_amount) / previous.total_amount * 100).toFixed(2) : 100
      };
    });
  }

  async deleteExpense(id, userId, permanent = false) {
    const expense = await this.expenseRepository.findById(id);

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    // Check if expense is paid
    if (expense.paymentStatus === 'PAID') {
      throw new AppError('Cannot delete paid expense. Create a reversal instead.', 400);
    }

    if (permanent) {
      // Permanent delete
      await this.expenseRepository.delete(id);
    } else {
      // Soft delete
      await this.expenseRepository.softDelete(id, userId);
    }

    await this.transactionLedgerService.recordReversal({
      amount: expense.amount,
      currency: expense.currency || 'NGN',
      exchangeRate: expense.exchangeRate || 1,
      transactionDate: new Date(),
      sourceType: 'EXPENSE',
      sourceId: expense.id,
      description: permanent
        ? 'Expense permanently deleted (ledger reversal entry)'
        : 'Expense soft deleted (ledger reversal entry)',
      metadata: {
        expenseType: expense.expenseType,
        expenseCategory: expense.expenseCategory,
      },
      recordedById: userId,
      expenseId: expense.id,
      subsidiaryId: expense.subsidiaryId || null,
    });

    // Update budget
    if (expense.budgetId) {
      await this.budgetService.reverseSpentAmount(expense.budgetId, expense.amount);
    }

    // Audit log
    await this.auditService.log({
      userId,
      action: permanent ? 'DELETE' : 'SOFT_DELETE',
      entity: 'EXPENSE',
      entityId: id,
      oldValue: expense
    });
  }

  async bulkCreateExpenses(expenses, userId) {
    const results = {
      successful: [],
      failed: []
    };

    for (const expense of expenses) {
      try {
        const created = await this.createExpense(expense, userId);
        results.successful.push(created);
      } catch (error) {
        results.failed.push({
          expense,
          error: error.message
        });
      }
    }

    return results;
  }

  async getExpenseStats(filters = {}) {
    const { subsidiaryId, period = 'month' } = filters;

    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'quarter':
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const where = {
      expenseDate: {
        gte: startDate
      },
      isDeleted: false
    };

    if (subsidiaryId) where.subsidiaryId = subsidiaryId;

    const stats = await this.model.aggregate({
      where,
      _sum: {
        amount: true
      },
      _count: true,
      _avg: {
        amount: true
      }
    });

    const byDay = await this.model.groupBy({
      by: ['expenseDate'],
      where,
      _sum: {
        amount: true
      },
      orderBy: {
        expenseDate: 'asc'
      }
    });

    return {
      totalAmount: stats._sum.amount || 0,
      totalCount: stats._count,
      averageAmount: stats._avg.amount || 0,
      dailyAverage: (stats._sum.amount || 0) / (byDay.length || 1),
      byDay
    };
  }
}
import { IncomeService } from '../services/income.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateIncome } from '../validators/income.validator.js';
import prisma from '../config/database.js';
import { generateInvoicePdfBuffer } from '../utils/invoicePdf.js';
import { invalidateDashboardDrilldownCache } from '../utils/cacheInvalidation.js';

const parseAuditJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

export class IncomeController {
  constructor() {
    this.incomeService = new IncomeService();
  }

  ensureVehicleMatchesSubsidiary = async ({ vehicleId, subsidiaryId }) => {
    if (!vehicleId) return;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, subsidiaryId: true },
    });

    if (!vehicle) {
      throw new Error('Selected vehicle does not exist');
    }

    if (subsidiaryId && vehicle.subsidiaryId !== subsidiaryId) {
      throw new Error('Vehicle belongs to a different subsidiary. Select matching subsidiary or vehicle.');
    }
  };

  normalizeDateInput = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value instanceof Date) return value;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return new Date(`${trimmed}T00:00:00.000Z`);
      }

      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };

  toNumber = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  normalizeIncomeItems = (items) => {
    if (!Array.isArray(items)) return undefined;

    return items
      .map((item) => {
        if (!item || typeof item !== 'object') return null;

        const quantity = this.toNumber(item.quantity);
        const unitPrice = this.toNumber(item.unitPrice);
        const amount = this.toNumber(item.amount);
        const taxAmount = this.toNumber(item.taxAmount);
        const discountAmount = this.toNumber(item.discountAmount);
        const paidAmount = this.toNumber(item.paidAmount);

        return {
          serviceType: item.serviceType ? String(item.serviceType).trim() : undefined,
          serviceDescription: item.serviceDescription ? String(item.serviceDescription).trim() : undefined,
          quantity,
          unitPrice,
          amount: amount ?? ((quantity !== undefined && unitPrice !== undefined) ? quantity * unitPrice : undefined),
          taxAmount: taxAmount ?? 0,
          discountAmount: discountAmount ?? 0,
          paidAmount: paidAmount ?? 0,
          notes: item.notes ? String(item.notes).trim() : undefined,
        };
      })
      .filter((item) => item && (item.serviceDescription || item.amount !== undefined));
  };

  recordIncome = asyncHandler(async (req, res) => {
    const payload = {
      ...req.body,
      amount: this.toNumber(req.body.amount),
      taxAmount: this.toNumber(req.body.taxAmount),
      discountAmount: this.toNumber(req.body.discountAmount),
      paidAmount: this.toNumber(req.body.paidAmount),
      exchangeRate: this.toNumber(req.body.exchangeRate),
      quantity: this.toNumber(req.body.quantity),
      unitPrice: this.toNumber(req.body.unitPrice),
      incomeItems: this.normalizeIncomeItems(req.body.incomeItems),
      incomeDate: this.normalizeDateInput(req.body.incomeDate),
      dueDate: this.normalizeDateInput(req.body.dueDate),
      paidDate: this.normalizeDateInput(req.body.paidDate),
    };

    const { error } = validateIncome(payload);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const income = await this.incomeService.recordIncome(payload, req.user.id);
    await invalidateDashboardDrilldownCache();
    
    res.status(201).json({
      success: true,
      data: income
    });
  });

  getIncomes = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      customerId,
      vehicleId,
      subsidiaryId,
      paymentStatus,
      incomeType
    } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.incomeDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    if (customerId) where.customerId = customerId;
    if (vehicleId) where.vehicleId = vehicleId;
    if (subsidiaryId) where.subsidiaryId = subsidiaryId;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (incomeType) where.incomeType = incomeType;

    const incomes = await this.incomeService.incomeRepository.findMany(
      where,
      {
        customer: true,
        vehicle: true,
        subsidiary: true,
        createdBy: {
          select: {
            id: true,
            fullName: true
          }
        }
      },
      { incomeDate: 'desc' },
      (page - 1) * limit,
      parseInt(limit)
    );

    const total = await this.incomeService.incomeRepository.count(where);

    res.json({
      success: true,
      data: incomes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  });

  getIncomeById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const income = await this.incomeService.incomeRepository.findById(id, {
      customer: true,
      vehicle: true,
      subsidiary: true,
      invoice: true,
      createdBy: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    });

    if (!income) {
      return res.status(404).json({ error: 'Income record not found' });
    }

    res.json({
      success: true,
      data: income
    });
  });

  getIncomeInvoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    const income = await this.incomeService.incomeRepository.findById(id, {
      customer: true,
      subsidiary: true,
      invoice: {
        include: {
          customer: true,
          subsidiary: true,
          items: true,
          revisionHistory: {
            orderBy: { createdAt: 'desc' },
            include: {
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
                  role: true,
                },
              },
              approvedBy: {
                select: {
                  id: true,
                  fullName: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    });

    if (!income) {
      return res.status(404).json({ error: 'Income record not found' });
    }

    let invoice = income.invoice;
    if (!invoice) {
      invoice = await this.incomeService.ensureInvoiceForIncome(income, req.user.id, {
        changeType: 'MANUAL_UPDATE',
        reason: 'Invoice generated from on-demand invoice retrieval',
      });
    }

    if (invoice && (!invoice.items || !invoice.customer)) {
      invoice = await prisma.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          customer: true,
          subsidiary: true,
          items: true,
          revisionHistory: {
            orderBy: { createdAt: 'desc' },
            include: {
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
                  role: true,
                },
              },
              approvedBy: {
                select: {
                  id: true,
                  fullName: true,
                  role: true,
                },
              },
            },
          },
        },
      });
    }

    if (!invoice) {
      return res.status(400).json({
        error: 'Invoice cannot be generated for this income. Ensure customer and subsidiary are provided.',
      });
    }

    if (String(format).toLowerCase() === 'pdf') {
      const pdfBuffer = await generateInvoicePdfBuffer(invoice);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoiceNumber}.pdf`);
      return res.send(pdfBuffer);
    }

    return res.json({
      success: true,
      data: {
        invoice,
        printable: {
          invoiceNumber: invoice.invoiceNumber,
          version: invoice.version,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          customer: invoice.customer,
          items: invoice.items,
          subtotal: invoice.subtotal,
          taxAmount: invoice.taxAmount,
          discountAmount: invoice.discountAmount,
          totalAmount: invoice.totalAmount,
          amountPaid: invoice.amountPaid,
          balanceDue: invoice.balanceDue,
          status: invoice.status,
        },
      },
    });
  });

  updateIncome = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { modificationReason, ...requestedChanges } = req.body;
    const normalizedChanges = {
      ...requestedChanges,
      ...(Object.prototype.hasOwnProperty.call(requestedChanges, 'amount') ? { amount: this.toNumber(requestedChanges.amount) } : {}),
      ...(Object.prototype.hasOwnProperty.call(requestedChanges, 'taxAmount') ? { taxAmount: this.toNumber(requestedChanges.taxAmount) } : {}),
      ...(Object.prototype.hasOwnProperty.call(requestedChanges, 'discountAmount') ? { discountAmount: this.toNumber(requestedChanges.discountAmount) } : {}),
      ...(Object.prototype.hasOwnProperty.call(requestedChanges, 'paidAmount') ? { paidAmount: this.toNumber(requestedChanges.paidAmount) } : {}),
      ...(Object.prototype.hasOwnProperty.call(requestedChanges, 'exchangeRate') ? { exchangeRate: this.toNumber(requestedChanges.exchangeRate) } : {}),
      ...(Object.prototype.hasOwnProperty.call(requestedChanges, 'quantity') ? { quantity: this.toNumber(requestedChanges.quantity) } : {}),
      ...(Object.prototype.hasOwnProperty.call(requestedChanges, 'unitPrice') ? { unitPrice: this.toNumber(requestedChanges.unitPrice) } : {}),
      ...(Object.prototype.hasOwnProperty.call(requestedChanges, 'incomeItems') ? { incomeItems: this.normalizeIncomeItems(requestedChanges.incomeItems) } : {}),
      ...(Object.prototype.hasOwnProperty.call(requestedChanges, 'incomeDate') ? { incomeDate: this.normalizeDateInput(requestedChanges.incomeDate) } : {}),
      ...(Object.prototype.hasOwnProperty.call(requestedChanges, 'dueDate') ? { dueDate: this.normalizeDateInput(requestedChanges.dueDate) } : {}),
      ...(Object.prototype.hasOwnProperty.call(requestedChanges, 'paidDate') ? { paidDate: this.normalizeDateInput(requestedChanges.paidDate) } : {}),
    };

    if (!modificationReason || !String(modificationReason).trim()) {
      return res.status(400).json({
        error: 'Modification reason is required. State reason before requesting update.'
      });
    }

    const { error } = validateIncome(normalizedChanges, true);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existing = await this.incomeService.incomeRepository.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Income record not found' });
    }

    const nextSubsidiaryId = normalizedChanges.subsidiaryId || existing.subsidiaryId;
    const nextVehicleId = normalizedChanges.vehicleId || existing.vehicleId;

    try {
      await this.ensureVehicleMatchesSubsidiary({
        vehicleId: nextVehicleId,
        subsidiaryId: nextSubsidiaryId,
      });
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const requestLog = await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'INCOME_MODIFICATION_REQUEST',
        entity: 'INCOME',
        entityId: id,
        oldValue: existing,
        newValue: {
          changes: normalizedChanges,
          modificationReason: String(modificationReason).trim(),
          requestedBy: {
            id: req.user.id,
            role: req.user.role,
            fullName: req.user.fullName,
          },
          requestedAt: new Date().toISOString(),
        },
      }
    });

    await this.incomeService.notificationService.sendIncomeModificationRequest(
      ['CEO', 'ACCOUNTANT'],
      {
        incomeId: id,
        requestId: requestLog.id,
        requestedBy: req.user.fullName,
        requestedByRole: req.user.role,
        reason: String(modificationReason).trim(),
      }
    );

    res.status(202).json({
      success: true,
      message: 'Modification request submitted for CEO/ACCOUNTANT approval',
      data: {
        requestId: requestLog.id,
        incomeId: id,
        status: 'PENDING_APPROVAL',
      }
    });
  });

  getPendingModificationRequests = asyncHandler(async (req, res) => {
    const requests = await prisma.auditLog.findMany({
      where: {
        action: 'INCOME_MODIFICATION_REQUEST',
        entity: 'INCOME',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const approvals = await prisma.auditLog.findMany({
      where: {
        action: { in: ['INCOME_MODIFICATION_APPROVED', 'INCOME_MODIFICATION_REJECTED'] },
        entity: 'INCOME',
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

    const pending = requests
      .filter((request) => !resolvedRequestIds.has(request.id))
      .map((request) => ({
        ...request,
        oldValue: parseAuditJson(request.oldValue),
        newValue: parseAuditJson(request.newValue),
      }));

    res.json({
      success: true,
      data: pending,
    });
  });

  getIncomeModificationHistory = asyncHandler(async (req, res) => {
    const history = await prisma.auditLog.findMany({
      where: {
        entity: 'INCOME',
        action: { in: ['INCOME_MODIFICATION_APPROVED', 'INCOME_MODIFICATION_REJECTED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const normalized = history.map((entry) => ({
      ...entry,
      oldValue: parseAuditJson(entry.oldValue),
      newValue: parseAuditJson(entry.newValue),
    }));

    res.json({
      success: true,
      data: normalized,
    });
  });

  getMyModificationRequests = asyncHandler(async (req, res) => {
    const requests = await prisma.auditLog.findMany({
      where: {
        action: 'INCOME_MODIFICATION_REQUEST',
        entity: 'INCOME',
        userId: req.user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const approvals = await prisma.auditLog.findMany({
      where: {
        action: { in: ['INCOME_MODIFICATION_APPROVED', 'INCOME_MODIFICATION_REJECTED'] },
        entity: 'INCOME',
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const resolutionByRequestId = new Map();
    approvals.forEach((entry) => {
      const meta = parseAuditJson(entry.newValue) || {};
      if (meta.requestId && !resolutionByRequestId.has(meta.requestId)) {
        resolutionByRequestId.set(meta.requestId, {
          action: entry.action,
          createdAt: entry.createdAt,
          meta,
        });
      }
    });

    const result = requests.map((request) => {
      const payload = parseAuditJson(request.newValue) || {};
      const resolution = resolutionByRequestId.get(request.id);

      let status = 'PENDING_APPROVAL';
      let decidedBy = null;
      let decisionReason = null;
      let decidedAt = null;

      if (resolution) {
        status = resolution.action === 'INCOME_MODIFICATION_APPROVED' ? 'APPROVED' : 'REJECTED';
        decidedBy = resolution.meta.approvedBy || resolution.meta.rejectedBy || null;
        decisionReason = resolution.meta.approvalReason || null;
        decidedAt = resolution.meta.approvedAt || resolution.meta.rejectedAt || resolution.createdAt;
      }

      return {
        id: request.id,
        incomeId: request.entityId,
        requestedAt: request.createdAt,
        requestedBy: payload.requestedBy || null,
        modificationReason: payload.modificationReason || null,
        requestedChanges: payload.changes || {},
        status,
        decidedBy,
        decisionReason,
        decidedAt,
      };
    });

    res.json({
      success: true,
      data: result,
    });
  });

  approveIncomeModification = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { decision = 'APPROVE', approvalReason } = req.body;

    const requestLog = await prisma.auditLog.findUnique({ where: { id: requestId } });
    if (!requestLog || requestLog.action !== 'INCOME_MODIFICATION_REQUEST') {
      return res.status(404).json({ error: 'Modification request not found' });
    }

    const existingResolutions = await prisma.auditLog.findMany({
      where: {
        entity: 'INCOME',
        action: { in: ['INCOME_MODIFICATION_APPROVED', 'INCOME_MODIFICATION_REJECTED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const alreadyResolved = existingResolutions.some((entry) => {
      const resolutionMeta = parseAuditJson(entry.newValue);
      return resolutionMeta?.requestId === requestId;
    });

    if (alreadyResolved) {
      return res.status(400).json({ error: 'This modification request is already resolved' });
    }

    const requestPayload = parseAuditJson(requestLog.newValue) || {};
    const changes = requestPayload.changes || {};

    if (String(decision).toUpperCase() !== 'APPROVE') {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'INCOME_MODIFICATION_REJECTED',
          entity: 'INCOME',
          entityId: requestLog.entityId,
          oldValue: requestPayload,
          newValue: {
            requestId,
            decision: 'REJECT',
            approvalReason: approvalReason || null,
            rejectedBy: {
              id: req.user.id,
              role: req.user.role,
              fullName: req.user.fullName,
            },
            rejectedAt: new Date().toISOString(),
          },
        }
      });

      return res.json({
        success: true,
        message: 'Income modification request rejected',
      });
    }

    const income = await this.incomeService.incomeRepository.findById(requestLog.entityId);
    if (!income) {
      return res.status(404).json({ error: 'Income record not found for this request' });
    }

    const nextSubsidiaryId = changes.subsidiaryId || income.subsidiaryId;
    const nextVehicleId = changes.vehicleId || income.vehicleId;

    try {
      await this.ensureVehicleMatchesSubsidiary({
        vehicleId: nextVehicleId,
        subsidiaryId: nextSubsidiaryId,
      });
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const auditNote = `[Modified ${new Date().toISOString()} by ${req.user.fullName} (${req.user.role}) | reason: ${approvalReason || requestPayload.modificationReason || 'N/A'}]`;

    const mergedIncomeState = { ...income, ...changes };
    const derivedTotals = this.incomeService.deriveIncomeTotals(mergedIncomeState);
    const nextAmount = derivedTotals.amount;
    const nextTaxAmount = Object.prototype.hasOwnProperty.call(changes, 'taxAmount') ? changes.taxAmount : income.taxAmount;
    const nextDiscountAmount = Object.prototype.hasOwnProperty.call(changes, 'discountAmount') ? changes.discountAmount : income.discountAmount;
    const nextNetAmount = (nextAmount || 0) - (nextTaxAmount || 0) - (nextDiscountAmount || 0);

    const appliedChanges = {
      ...changes,
      amount: nextAmount,
      serviceDescription: derivedTotals.serviceDescription,
      serviceType: derivedTotals.serviceType,
      quantity: derivedTotals.quantity,
      unitPrice: derivedTotals.unitPrice,
      incomeItems: derivedTotals.normalizedItems,
      netAmount: nextNetAmount,
    };

    const updated = await this.incomeService.incomeRepository.update(requestLog.entityId, {
      ...appliedChanges,
      notes: income.notes ? `${income.notes}\n${auditNote}` : auditNote,
      updatedAt: new Date(),
    });

    const invoice = await this.incomeService.ensureInvoiceForIncome(updated, req.user.id, {
      changeType: 'APPROVED_MODIFICATION',
      reason: approvalReason || requestPayload.modificationReason || 'Income modification approved',
      requestId,
      approvedById: req.user.id,
    });

    await this.incomeService.transactionLedgerService.recordIncome(
      updated,
      req.user.id,
      'Income modification approved and posted'
    );

    if (changes.customerId && changes.customerId !== income.customerId) {
      if (income.customerId) {
        await this.incomeService.updateCustomerTotals(income.customerId);
      }
      await this.incomeService.updateCustomerTotals(changes.customerId);
    } else if (updated.customerId) {
      await this.incomeService.updateCustomerTotals(updated.customerId);
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'INCOME_MODIFICATION_APPROVED',
        entity: 'INCOME',
        entityId: requestLog.entityId,
        oldValue: income,
        newValue: {
          requestId,
          decision: 'APPROVE',
          approvedBy: {
            id: req.user.id,
            role: req.user.role,
            fullName: req.user.fullName,
          },
          approvalReason: approvalReason || null,
          appliedChanges,
          approvedAt: new Date().toISOString(),
        },
      },
    });

    await invalidateDashboardDrilldownCache();

    res.json({
      success: true,
      message: 'Income modification approved and applied',
      data: {
        ...updated,
        invoice,
      },
    });
  });

  deleteIncome = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const income = await this.incomeService.incomeRepository.findById(id);
    if (!income) {
      return res.status(404).json({ error: 'Income record not found' });
    }

    // Check if payment is processed
    if (income.paymentStatus === 'PAID') {
      return res.status(400).json({ 
        error: 'Cannot delete paid income record. Create a reversal instead.' 
      });
    }

    await this.incomeService.incomeRepository.delete(id);

    // Update customer totals
    if (income.customerId) {
      await this.incomeService.updateCustomerTotals(income.customerId);
    }

    await invalidateDashboardDrilldownCache();

    res.json({
      success: true,
      message: 'Income record deleted successfully'
    });
  });

  getIncomeAnalytics = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'month' } = req.query;

    const analytics = await this.incomeService.getIncomeAnalytics({
      startDate: startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate: endDate ? new Date(endDate) : new Date(),
      groupBy
    });

    res.json({
      success: true,
      data: analytics
    });
  });

  markAsPaid = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { paymentMethod, paymentReference, notes } = req.body;

    const income = await this.incomeService.incomeRepository.findById(id);
    if (!income) {
      return res.status(404).json({ error: 'Income record not found' });
    }

    if (income.paymentStatus === 'PAID') {
      return res.status(400).json({ error: 'Income already marked as paid' });
    }

    // Update income
    const updated = await this.incomeService.incomeRepository.update(id, {
      paymentStatus: 'PAID',
      paidDate: new Date(),
      paymentMethod,
      paymentReference,
      notes: notes ? `${income.notes || ''}\nPayment: ${notes}` : income.notes
    });

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        paymentNumber: `PAY-${Date.now()}`,
        paymentType: 'INVOICE_PAYMENT',
        paymentMethod,
        amount: income.netAmount,
        paymentDate: new Date(),
        customerId: income.customerId,
        incomeRecordId: id,
        invoiceId: income.invoiceId,
        reference: paymentReference,
        receivedById: req.user.id,
        notes
      }
    });

    await this.incomeService.transactionLedgerService.recordPayment(
      payment,
      req.user.id,
      'CREDIT',
      'Payment received for invoice/income'
    );

    // Update invoice if exists
    if (income.invoiceId) {
      await prisma.invoice.update({
        where: { id: income.invoiceId },
        data: {
          status: 'PAID',
          paidDate: new Date(),
          amountPaid: income.netAmount,
          balanceDue: 0
        }
      });
    }

    // Update customer totals
    if (income.customerId) {
      await this.incomeService.updateCustomerTotals(income.customerId);
    }

    await invalidateDashboardDrilldownCache();

    res.json({
      success: true,
      data: updated
    });
  });

  getOutstandingInvoices = asyncHandler(async (req, res) => {
    const outstanding = await this.incomeService.incomeRepository.getOutstandingInvoices();

    res.json({
      success: true,
      data: outstanding
    });
  });
}
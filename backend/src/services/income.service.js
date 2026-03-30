import { IncomeRepository } from '../repositories/income.repository.js';
import { CustomerRepository } from '../repositories/customer.repository.js';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { AuditService } from './audit.service.js';
import { NotificationService } from './notification.service.js';
import { TransactionLedgerService } from './transactionLedger.service.js';
import { AppError } from '../utils/AppError.js';
import { generateInvoiceNumber } from '../utils/generators.js';
import prisma from '../config/database.js';
import { resolveScopedSubsidiaryId } from '../utils/subsidiaryScope.js';

export class IncomeService {
  constructor() {
    this.incomeRepository = new IncomeRepository();
    this.customerRepository = new CustomerRepository();
    this.invoiceRepository = new InvoiceRepository();
    this.auditService = new AuditService();
    this.notificationService = new NotificationService();
    this.transactionLedgerService = new TransactionLedgerService();
  }

  /**
   * Derive per-item paymentStatus from the rule:
   *   cost = quantity * unitPrice
   *   if paidAmount === 0                    → PENDING
   *   if cost + taxAmount === paidAmount + discountAmount → PAID
   *   otherwise                              → PARTIALLY_PAID
   */
  deriveItemPaymentStatus({ cost, taxAmount = 0, paidAmount = 0, discountAmount = 0 }) {
    if (paidAmount === 0) return 'PENDING';
    const due = cost + taxAmount;
    const settled = paidAmount + discountAmount;
    // use a small epsilon to absorb floating-point drift
    if (Math.abs(due - settled) < 0.005) return 'PAID';
    return 'PARTIALLY_PAID';
  }

  normalizeIncomeItems(items = []) {
    if (!Array.isArray(items)) return [];

    return items
      .map((item) => {
        if (!item || typeof item !== 'object') return null;

        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const cost = Number.isFinite(quantity) && Number.isFinite(unitPrice)
          ? quantity * unitPrice
          : Number(item.amount);

        if (!item.serviceDescription || !Number.isFinite(cost) || cost <= 0) {
          return null;
        }

        const taxAmount = Math.max(0, Number(item.taxAmount) || 0);
        const discountAmount = Math.max(0, Number(item.discountAmount) || 0);
        const paidAmount = Math.max(0, Number(item.paidAmount) || 0);
        const paymentStatus = this.deriveItemPaymentStatus({ cost, taxAmount, paidAmount, discountAmount });

        return {
          serviceType: item.serviceType ? String(item.serviceType).trim() : undefined,
          serviceDescription: String(item.serviceDescription).trim(),
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : cost,
          amount: cost,
          taxAmount,
          discountAmount,
          paidAmount,
          paymentStatus,
          notes: item.notes ? String(item.notes).trim() : undefined,
        };
      })
      .filter(Boolean);
  }

  /**
   * Derive overall paymentStatus from aggregated totals across all items:
   *   totalCost + totalTax === totalPaid + totalDiscount → PAID
   *   totalPaid === 0                                    → PENDING
   *   otherwise                                         → PARTIALLY_PAID
   */
  deriveOverallPaymentStatus({ totalCost, totalTax = 0, totalPaid = 0, totalDiscount = 0 }) {
    if (totalPaid === 0) return 'PENDING';
    const due = totalCost + totalTax;
    const settled = totalPaid + totalDiscount;
    if (Math.abs(due - settled) < 0.005) return 'PAID';
    return 'PARTIALLY_PAID';
  }

  deriveIncomeTotals(input = {}) {
    const items = this.normalizeIncomeItems(input.incomeItems);
    if (!items.length) {
      // single-line entry – derive paymentStatus from top-level fields
      const cost = Number(input.amount) || 0;
      const taxAmount = Number(input.taxAmount) || 0;
      const discountAmount = Number(input.discountAmount) || 0;
      const paidAmount = Number(input.paidAmount) || 0;
      const paymentStatus = input.paymentStatus ||
        this.deriveOverallPaymentStatus({ totalCost: cost, totalTax: taxAmount, totalPaid: paidAmount, totalDiscount: discountAmount });

      return {
        normalizedItems: undefined,
        amount: cost || input.amount,
        paidAmount,
        paymentStatus,
        serviceDescription: input.serviceDescription,
        serviceType: input.serviceType,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
      };
    }

    const totalCost = items.reduce((s, i) => s + i.amount, 0);
    const totalTax = items.reduce((s, i) => s + i.taxAmount, 0);
    const totalDiscount = items.reduce((s, i) => s + i.discountAmount, 0);
    const totalPaid = items.reduce((s, i) => s + i.paidAmount, 0);
    const quantity = items.reduce((s, i) => s + i.quantity, 0);
    const unitPrice = quantity > 0 ? totalCost / quantity : totalCost;
    const paymentStatus = this.deriveOverallPaymentStatus({ totalCost, totalTax, totalPaid, totalDiscount });

    return {
      normalizedItems: items,
      amount: totalCost,
      taxAmount: totalTax,
      discountAmount: totalDiscount,
      paidAmount: totalPaid,
      paymentStatus,
      serviceDescription: input.serviceDescription || items.map((i) => i.serviceDescription).join('; '),
      serviceType: input.serviceType || (items.length === 1 ? items[0].serviceType : 'MULTI_ITEM'),
      quantity,
      unitPrice,
    };
  }

  async recordIncome(data, userId) {
    try {
      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          subsidiaryId: true,
          subsidiaryAccess: true,
        },
      });

      if (!actor) {
        throw new AppError('User not found', 404);
      }

      let resolvedSubsidiaryId = await resolveScopedSubsidiaryId({
        requestedSubsidiaryId: data.subsidiaryId,
        userSubsidiaryId: actor.subsidiaryId,
        userSubsidiaryAccess: actor.subsidiaryAccess,
      });

      if (data.vehicleId) {
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: data.vehicleId },
          select: { id: true, subsidiaryId: true },
        });

        if (!vehicle) {
          throw new AppError('Selected vehicle does not exist', 400);
        }

        if (vehicle.subsidiaryId && resolvedSubsidiaryId !== vehicle.subsidiaryId) {
          throw new AppError('Vehicle belongs to a different subsidiary. Select matching subsidiary or vehicle.', 400);
        }

        resolvedSubsidiaryId = vehicle.subsidiaryId;
      }

      const scopedData = {
        ...data,
        subsidiaryId: resolvedSubsidiaryId,
      };

      const derivedTotals = this.deriveIncomeTotals(scopedData);
      const normalizedScopedData = {
        ...scopedData,
        amount: derivedTotals.amount,
        taxAmount: derivedTotals.taxAmount ?? scopedData.taxAmount,
        discountAmount: derivedTotals.discountAmount ?? scopedData.discountAmount,
        paidAmount: derivedTotals.paidAmount,
        paymentStatus: derivedTotals.paymentStatus,
        serviceDescription: derivedTotals.serviceDescription,
        serviceType: derivedTotals.serviceType,
        quantity: derivedTotals.quantity,
        unitPrice: derivedTotals.unitPrice,
        incomeItems: derivedTotals.normalizedItems,
      };

      // Validate income data
      await this.validateIncome(normalizedScopedData);

      // Create income record
      const income = await this.incomeRepository.createIncome({
        ...normalizedScopedData,
        createdById: userId
      });

      // Keep invoice synchronized with every income creation.
      const invoice = await this.ensureInvoiceForIncome(income, userId, {
        changeType: 'INITIAL_GENERATION',
        reason: 'Auto-generated when income was recorded',
      });

      // Update customer totals
      if (normalizedScopedData.customerId) {
        await this.updateCustomerTotals(normalizedScopedData.customerId);
      }

      await this.transactionLedgerService.recordIncome(income, userId);

      // Audit log
      await this.auditService.log({
        userId,
        action: 'CREATE',
        entity: 'INCOME',
        entityId: income.id,
        newValue: income
      });

      // Send notification if needed
      if (normalizedScopedData.amount > 1000000) { // Large transaction
        await this.notificationService.sendAlert({
          type: 'LARGE_TRANSACTION',
          message: `Large income recorded: ₦${normalizedScopedData.amount.toLocaleString()}`,
          data: income
        });
      }

      return this.incomeRepository.findById(income.id, {
        customer: true,
        vehicle: true,
        subsidiary: true,
        invoice: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      });
    } catch (error) {
      throw new AppError('Failed to record income', 500, error);
    }
  }

  calculateDueDate(incomeDate) {
    const base = new Date(incomeDate);
    const dueDate = new Date(base);
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
  }

  buildInvoicePayload(income, userId) {
    const totalAmount = income.netAmount || income.amount || 0;
    const isPaid = income.paymentStatus === 'PAID';
    const normalizedItems = this.normalizeIncomeItems(income.incomeItems);

    const invoiceItems = normalizedItems.length
      ? normalizedItems.map((item) => ({
        description: item.serviceDescription,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount || 0,
        taxAmount: item.taxAmount || 0,
        totalPrice: item.amount + (item.taxAmount || 0) - (item.discountAmount || 0),
      }))
      : [{
        description: income.serviceDescription || `${income.incomeType} - ${income.serviceType || 'GENERAL'}`,
        quantity: income.quantity || 1,
        unitPrice: income.unitPrice || income.amount,
        discountAmount: income.discountAmount || 0,
        taxAmount: income.taxAmount || 0,
        totalPrice: totalAmount,
      }];

    const totalTax = normalizedItems.length
      ? normalizedItems.reduce((s, i) => s + (i.taxAmount || 0), 0)
      : (income.taxAmount || 0);
    const totalDiscount = normalizedItems.length
      ? normalizedItems.reduce((s, i) => s + (i.discountAmount || 0), 0)
      : (income.discountAmount || 0);
    const totalPaid = normalizedItems.length
      ? normalizedItems.reduce((s, i) => s + (i.paidAmount || 0), 0)
      : (income.paidAmount || (isPaid ? totalAmount : 0));
    const invoiceTotalAmount = income.amount + totalTax - totalDiscount;
    const balanceDue = Math.max(0, invoiceTotalAmount - totalPaid);

    return {
      invoiceType: 'STANDARD',
      status: isPaid ? 'PAID' : 'SENT',
      issueDate: income.incomeDate,
      dueDate: income.dueDate || this.calculateDueDate(income.incomeDate),
      subtotal: income.amount,
      taxAmount: totalTax,
      taxRate: income.amount ? (totalTax / income.amount) * 100 : 0,
      discountAmount: totalDiscount,
      totalAmount: invoiceTotalAmount,
      amountPaid: totalPaid,
      balanceDue,
      customerId: income.customerId,
      subsidiaryId: income.subsidiaryId,
      createdById: userId,
      notes: income.notes || null,
      items: {
        create: invoiceItems,
      },
    };
  }

  async ensureInvoiceForIncome(income, userId, options = {}) {
    if (!income?.customerId || !income?.subsidiaryId || !income?.amount) {
      return null;
    }

    const changeType = options.changeType || 'REGENERATED_FROM_INCOME';
    const reason = options.reason || 'Invoice synchronized from income record';

    if (!income.invoiceId) {
      const invoiceNumber = await generateInvoiceNumber();
      const invoiceData = {
        invoiceNumber,
        ...this.buildInvoicePayload(income, userId),
      };

      const createdInvoice = await this.invoiceRepository.create(invoiceData);

      await this.incomeRepository.update(income.id, {
        invoiceId: createdInvoice.id,
      });

      await prisma.invoiceRevision.create({
        data: {
          invoiceId: createdInvoice.id,
          incomeRecordId: income.id,
          previousVersion: 0,
          nextVersion: 1,
          changeType,
          reason,
          requestId: options.requestId || null,
          snapshot: createdInvoice,
          approvedById: options.approvedById || null,
          createdById: userId,
        },
      }).catch(() => null);

      await this.transactionLedgerService.recordInvoice(
        createdInvoice,
        userId,
        'INVOICE_ISSUED',
        reason
      );

      return createdInvoice;
    }

    const existingInvoice = await this.invoiceRepository.findById(income.invoiceId, {
      items: true,
    });

    if (!existingInvoice) {
      return null;
    }

    const nextVersion = (existingInvoice.version || 1) + 1;
    const payload = this.buildInvoicePayload(income, userId);

    await prisma.invoiceRevision.create({
      data: {
        invoiceId: existingInvoice.id,
        incomeRecordId: income.id,
        previousVersion: existingInvoice.version || 1,
        nextVersion,
        changeType,
        reason,
        requestId: options.requestId || null,
        snapshot: existingInvoice,
        approvedById: options.approvedById || null,
        createdById: userId,
      },
    }).catch(() => null);

    const updatedInvoice = await prisma.invoice.update({
      where: { id: existingInvoice.id },
      data: {
        invoiceType: payload.invoiceType,
        status: payload.status,
        issueDate: payload.issueDate,
        dueDate: payload.dueDate,
        subtotal: payload.subtotal,
        taxAmount: payload.taxAmount,
        taxRate: payload.taxRate,
        discountAmount: payload.discountAmount,
        totalAmount: payload.totalAmount,
        amountPaid: payload.amountPaid,
        balanceDue: payload.balanceDue,
        notes: payload.notes,
        version: nextVersion,
        customerId: payload.customerId,
        subsidiaryId: payload.subsidiaryId,
        items: {
          deleteMany: {},
          create: payload.items.create,
        },
      },
      include: {
        customer: true,
        subsidiary: true,
        items: true,
      },
    });

    await this.transactionLedgerService.recordInvoice(
      updatedInvoice,
      userId,
      'INVOICE_REVISED',
      reason
    );

    return updatedInvoice;
  }

  async updateCustomerTotals(customerId) {
    const incomes = await this.incomeRepository.findMany({
      customerId
    });

    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalPaid = incomes.reduce((sum, i) => 
      sum + (i.paymentStatus === 'PAID' ? i.amount : 0), 0);
    const outstandingBalance = incomes.reduce((sum, i) => 
      sum + (i.paymentStatus !== 'PAID' ? i.amount : 0), 0);

    await this.customerRepository.update(customerId, {
      totalIncome,
      totalPaid,
      outstandingBalance,
      lastTransactionAt: new Date()
    });
  }

  async getIncomeAnalytics(filters = {}) {
    const { startDate, endDate, groupBy = 'month' } = filters;

    // Get summary
    const summary = await this.incomeRepository.getIncomeSummary(filters);

    // Get by customer
    const byCustomer = await this.incomeRepository.getIncomeByCustomer(filters);

    // Get by type
    const byType = await this.getIncomeByType(filters);

    // Get trends
    const trends = await this.incomeRepository.getMonthlyTrends(
      new Date().getFullYear()
    );

    // Calculate metrics
    const totalIncome = summary.reduce((sum, s) => sum + s.total_amount, 0);
    const averageTransaction = totalIncome / (summary.length || 1);
    const paidAmount = summary
      .filter(s => s.paymentStatus === 'PAID')
      .reduce((sum, s) => sum + s.total_amount, 0);
    const outstandingAmount = totalIncome - paidAmount;
    const collectionRate = totalIncome > 0 ? (paidAmount / totalIncome * 100) : 0;

    return {
      metrics: {
        totalIncome,
        averageTransaction,
        paidAmount,
        outstandingAmount,
        collectionRate: collectionRate.toFixed(2)
      },
      summary,
      byCustomer,
      byType,
      trends
    };
  }

  async getIncomeByType(filters = {}) {
    const { startDate, endDate } = filters;

    const result = await prisma.$queryRaw`
      SELECT 
        "incomeType",
        COUNT(*) as count,
        SUM(amount) as total,
        AVG(amount) as average,
        SUM(CASE WHEN "paymentStatus" = 'PAID' THEN amount ELSE 0 END) as collected
      FROM "IncomeRecord"
      WHERE "incomeDate" BETWEEN ${startDate} AND ${endDate}
      GROUP BY "incomeType"
      ORDER BY total DESC
    `;

    return result;
  }

  async validateIncome(data) {
    // Required fields
    if (!data.amount || data.amount <= 0) {
      throw new AppError('Valid amount is required', 400);
    }

    if (!data.incomeDate) {
      throw new AppError('Income date is required', 400);
    }

    // Validate customer exists if provided
    if (data.customerId) {
      const customer = await this.customerRepository.findById(data.customerId);
      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      // Check credit limit
      if (customer.creditLimit > 0) {
        const outstanding = customer.outstandingBalance || 0;
        if (outstanding + data.amount > customer.creditLimit) {
          throw new AppError('Amount exceeds customer credit limit', 400);
        }
      }
    }

    // Validate date not in future
    if (new Date(data.incomeDate) > new Date()) {
      throw new AppError('Income date cannot be in the future', 400);
    }
  }
}
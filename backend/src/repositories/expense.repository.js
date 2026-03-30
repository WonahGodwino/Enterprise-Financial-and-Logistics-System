import prisma from '../config/database.js';
import { BaseRepository } from './base.repository.js';

export class ExpenseRepository extends BaseRepository {
  constructor() {
    super(prisma.expense);
  }

  async createExpense(data) {
    const {
      createdById,
      vehicleId,
      subsidiaryId,
      ...expenseData
    } = data;

    // Calculate totals if unit price and quantity provided
    if (expenseData.unitPrice && expenseData.quantity && !expenseData.amount) {
      expenseData.amount = expenseData.unitPrice * expenseData.quantity;
    }

    // Handle recurring expenses
    if (expenseData.isRecurring && expenseData.recurrencePattern) {
      expenseData.nextDueDate = this.calculateNextDueDate(expenseData.expenseDate, expenseData.recurrencePattern);
    }

    return this.model.create({
      data: {
        ...expenseData,
        createdBy: {
          connect: { id: createdById }
        },
        vehicle: vehicleId ? {
          connect: { id: vehicleId }
        } : undefined,
        subsidiary: subsidiaryId ? {
          connect: { id: subsidiaryId }
        } : undefined
      },
      include: {
        vehicle: true,
        subsidiary: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });
  }

  calculateNextDueDate(startDate, pattern) {
    const date = new Date(startDate);
    switch (pattern) {
      case 'DAILY':
        date.setDate(date.getDate() + 1);
        break;
      case 'WEEKLY':
        date.setDate(date.getDate() + 7);
        break;
      case 'BIWEEKLY':
        date.setDate(date.getDate() + 14);
        break;
      case 'MONTHLY':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'QUARTERLY':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'ANNUALLY':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date;
  }

  async findByDateRange(startDate, endDate, options = {}) {
    const where = {
      expenseDate: {
        gte: startDate,
        lte: endDate
      },
      isDeleted: false,
      ...options
    };

    return this.model.findMany({
      where,
      include: {
        vehicle: true,
        subsidiary: true,
        approvedBy: {
          select: {
            id: true,
            fullName: true
          }
        },
        createdBy: {
          select: {
            id: true,
            fullName: true
          }
        }
      },
      orderBy: {
        expenseDate: 'desc'
      }
    });
  }

  async getExpenseSummary(filters = {}) {
    const {
      startDate,
      endDate,
      subsidiaryId,
      vehicleId,
      expenseType,
      expenseCategory,
      groupBy = 'category'
    } = filters;

    let groupByField;
    switch (groupBy) {
      case 'category':
        groupByField = 'expenseCategory';
        break;
      case 'type':
        groupByField = 'expenseType';
        break;
      case 'month':
        return this.getMonthlySummary(filters);
      case 'vehicle':
        groupByField = 'vehicleId';
        break;
      case 'subsidiary':
        groupByField = 'subsidiaryId';
        break;
      default:
        groupByField = 'expenseCategory';
    }

    const where = {
      expenseDate: {
        gte: startDate || new Date(new Date().setMonth(new Date().getMonth() - 1)),
        lte: endDate || new Date()
      },
      isDeleted: false
    };

    if (subsidiaryId) where.subsidiaryId = subsidiaryId;
    if (vehicleId) where.vehicleId = vehicleId;
    if (expenseType) where.expenseType = expenseType;
    if (expenseCategory) where.expenseCategory = expenseCategory;

    const result = await this.model.groupBy({
      by: [groupByField],
      where,
      _sum: {
        amount: true,
        taxAmount: true
      },
      _count: true,
      _avg: {
        amount: true
      }
    });

    return result.map(item => ({
      group: item[groupByField],
      totalAmount: item._sum.amount || 0,
      totalTax: item._sum.taxAmount || 0,
      count: item._count,
      averageAmount: item._avg.amount || 0
    }));
  }

  async getMonthlySummary(filters = {}) {
    const { year = new Date().getFullYear(), subsidiaryId, vehicleId } = filters;

    const result = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "expenseDate") as month,
        "expenseCategory",
        "expenseType",
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        SUM("taxAmount") as total_tax,
        AVG(amount) as average_amount
      FROM "Expense"
      WHERE EXTRACT(YEAR FROM "expenseDate") = ${year}
        AND "isDeleted" = false
        ${subsidiaryId ? prisma.$raw`AND "subsidiaryId" = ${subsidiaryId}` : prisma.empty}
        ${vehicleId ? prisma.$raw`AND "vehicleId" = ${vehicleId}` : prisma.empty}
      GROUP BY month, "expenseCategory", "expenseType"
      ORDER BY month, "expenseCategory"
    `;

    return result;
  }

  async getPendingApprovals(approverId, options = {}) {
    const where = {
      approvalStatus: 'PENDING',
      isDeleted: false,
      ...options
    };

    // Add approver-specific logic based on approval level
    if (approverId) {
      // This would need to be customized based on your approval workflow
    }

    return this.model.findMany({
      where,
      include: {
        vehicle: true,
        subsidiary: true,
        createdBy: {
          select: {
            id: true,
            fullName: true
          }
        }
      },
      orderBy: {
        expenseDate: 'asc'
      }
    });
  }

  async approveExpense(id, approverId, comments = '') {
    const expense = await this.model.findUnique({
      where: { id }
    });

    if (!expense) {
      throw new Error('Expense not found');
    }

    // Get current approval history or initialize
    const approvalHistory = expense.approvalHistory || [];
    
    // Add this approval step
    approvalHistory.push({
      level: expense.approvalLevel + 1,
      approverId,
      date: new Date(),
      comments,
      status: 'APPROVED'
    });

    // Update expense
    return this.model.update({
      where: { id },
      data: {
        approvalLevel: expense.approvalLevel + 1,
        approvalStatus: 'APPROVED',
        processStatus: 'IN_PROGRESS',
        approvalHistory,
        approvedById: approverId,
        approvedAt: new Date()
      }
    });
  }

  async completeExpense(id, completedById, data = {}) {
    const expense = await this.model.findUnique({ where: { id } });
    if (!expense) {
      throw new Error('Expense not found');
    }

    return this.model.update({
      where: { id },
      data: {
        processStatus: 'COMPLETED',
        completedById,
        completedAt: new Date(),
        receiptUrl: data.receiptUrl ?? expense.receiptUrl,
        receiptNumber: data.receiptNumber ?? expense.receiptNumber,
        attachments: data.attachments ?? expense.attachments,
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
  }

  async rejectExpense(id, approverId, reason) {
    const expense = await this.model.findUnique({
      where: { id }
    });

    const approvalHistory = expense.approvalHistory || [];
    approvalHistory.push({
      level: expense.approvalLevel + 1,
      approverId,
      date: new Date(),
      reason,
      status: 'REJECTED'
    });

    return this.model.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        rejectionReason: reason,
        approvalHistory
      }
    });
  }

  async getRecurringExpenses() {
    const today = new Date();
    
    return this.model.findMany({
      where: {
        isRecurring: true,
        isDeleted: false,
        OR: [
          { nextDueDate: { lte: today } },
          { nextDueDate: null }
        ],
        recurrenceCount: {
          gt: 0
        }
      },
      include: {
        vehicle: true,
        subsidiary: true
      }
    });
  }

  async createRecurringInstance(parentExpense) {
    const newExpense = {
      ...parentExpense,
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      parentExpenseId: parentExpense.id,
      expenseDate: parentExpense.nextDueDate || new Date(),
      approvalStatus: 'PENDING',
      paymentStatus: 'UNPAID',
      isRecurring: false, // Individual instances are not recurring
      recurrenceCount: parentExpense.recurrenceCount ? parentExpense.recurrenceCount - 1 : 0
    };

    // Update next due date on parent
    if (parentExpense.recurrenceCount) {
      await this.model.update({
        where: { id: parentExpense.id },
        data: {
          recurrenceCount: parentExpense.recurrenceCount - 1,
          nextDueDate: this.calculateNextDueDate(
            parentExpense.nextDueDate || new Date(),
            parentExpense.recurrencePattern
          )
        }
      });
    }

    return this.createExpense(newExpense);
  }

  async getExpenseAnalytics(filters = {}) {
    const { startDate, endDate, subsidiaryId } = filters;

    // Get summary by category
    const byCategory = await this.getExpenseSummary(filters);

    // Get trends
    const trends = await this.getMonthlySummary(filters);

    // Get top vendors
    const topVendors = await prisma.$queryRaw`
      SELECT 
        "vendorName",
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM "Expense"
      WHERE "expenseDate" BETWEEN ${startDate || new Date(new Date().setMonth(new Date().getMonth() - 1))} 
        AND ${endDate || new Date()}
        AND "vendorName" IS NOT NULL
        AND "isDeleted" = false
      GROUP BY "vendorName"
      ORDER BY total_amount DESC
      LIMIT 10
    `;

    // Calculate totals
    const totals = await this.model.aggregate({
      where: {
        expenseDate: {
          gte: startDate || new Date(new Date().setMonth(new Date().getMonth() - 1)),
          lte: endDate || new Date()
        },
        isDeleted: false
      },
      _sum: {
        amount: true,
        taxAmount: true
      },
      _count: true,
      _avg: {
        amount: true
      }
    });

    // Get payment status breakdown
    const byStatus = await this.model.groupBy({
      by: ['paymentStatus'],
      where: {
        expenseDate: {
          gte: startDate || new Date(new Date().setMonth(new Date().getMonth() - 1)),
          lte: endDate || new Date()
        },
        isDeleted: false
      },
      _sum: {
        amount: true
      },
      _count: true
    });

    return {
      summary: {
        totalAmount: totals._sum.amount || 0,
        totalTax: totals._sum.taxAmount || 0,
        totalCount: totals._count,
        averageAmount: totals._avg.amount || 0
      },
      byCategory,
      byStatus,
      trends,
      topVendors
    };
  }

  async markAsPaid(id, paymentData) {
    return this.model.update({
      where: { id },
      data: {
        paymentStatus: 'PAID',
        paymentMethod: paymentData.paymentMethod,
        paymentReference: paymentData.paymentReference,
        paymentDate: paymentData.paymentDate || new Date(),
        bankAccount: paymentData.bankAccount,
        chequeNumber: paymentData.chequeNumber
      }
    });
  }

  async softDelete(id, userId) {
    return this.model.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: userId
      }
    });
  }

  async restore(id) {
    return this.model.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedById: null
      }
    });
  }
}
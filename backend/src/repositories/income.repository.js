import prisma from '../config/database.js';
import { BaseRepository } from './base.repository.js';

export class IncomeRepository extends BaseRepository {
  constructor() {
    super(prisma.incomeRecord);
  }

  async createIncome(data) {
    const normalizedAmount = Number(data.amount) || 0;
    const normalizedTax = Number(data.taxAmount) || 0;
    const normalizedDiscount = Number(data.discountAmount) || 0;
    const normalizedPaid = Math.max(0, Number(data.paidAmount) || 0);
    const netAmount = normalizedAmount - normalizedTax - normalizedDiscount;

    // Build an explicit payload containing only fields that exist on the
    // IncomeRecord schema. Never spread raw service data — the service may
    // include computed runtime keys (e.g. exchangeRate: undefined) that
    // cause Prisma "Unknown argument" errors.
    const payload = {
      incomeType: data.incomeType,
      category: data.category,
      amount: normalizedAmount,
      taxAmount: normalizedTax,
      discountAmount: normalizedDiscount,
      paidAmount: normalizedPaid,
      netAmount,
      incomeItems: data.incomeItems ?? undefined,
      currency: data.currency || 'NGN',
      exchangeRate: data.exchangeRate != null ? Number(data.exchangeRate) : undefined,
      incomeDate: data.incomeDate,
      dueDate: data.dueDate ?? undefined,
      paidDate: data.paidDate ?? undefined,
      serviceType: data.serviceType ?? undefined,
      serviceDescription: data.serviceDescription ?? undefined,
      quantity: data.quantity != null ? Number(data.quantity) : undefined,
      unitPrice: data.unitPrice != null ? Number(data.unitPrice) : undefined,
      paymentStatus: data.paymentStatus || 'PENDING',
      paymentMethod: data.paymentMethod ?? undefined,
      paymentReference: data.paymentReference ?? undefined,
      notes: data.notes ?? undefined,
      attachments: data.attachments ?? undefined,
      customerId: data.customerId ?? undefined,
      vehicleId: data.vehicleId ?? undefined,
      subsidiaryId: data.subsidiaryId,
      createdById: data.createdById,
    };

    return this.model.create({
      data: payload,
      include: {
        customer: true,
        vehicle: true,
        subsidiary: true
      }
    });
  }

  async findByDateRange(startDate, endDate, options = {}) {
    return this.model.findMany({
      where: {
        incomeDate: {
          gte: startDate,
          lte: endDate
        },
        ...options
      },
      include: {
        customer: true,
        vehicle: true,
        subsidiary: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: {
        incomeDate: 'desc'
      }
    });
  }

  async getIncomeSummary(filters = {}) {
    const { startDate, endDate, subsidiaryId, customerId, groupBy = 'day' } = filters;

    let groupByClause;
    switch (groupBy) {
      case 'day':
        groupByClause = 'DATE(i."incomeDate")';
        break;
      case 'week':
        groupByClause = 'DATE_TRUNC(\'week\', i."incomeDate")';
        break;
      case 'month':
        groupByClause = 'DATE_TRUNC(\'month\', i."incomeDate")';
        break;
      case 'quarter':
        groupByClause = 'DATE_TRUNC(\'quarter\', i."incomeDate")';
        break;
      case 'year':
        groupByClause = 'DATE_TRUNC(\'year\', i."incomeDate")';
        break;
      default:
        groupByClause = 'DATE(i."incomeDate")';
    }

    const whereConditions = [];
    if (startDate) whereConditions.push(`i."incomeDate" >= '${startDate}'`);
    if (endDate) whereConditions.push(`i."incomeDate" <= '${endDate}'`);
    if (subsidiaryId) whereConditions.push(`i."subsidiaryId" = '${subsidiaryId}'`);
    if (customerId) whereConditions.push(`i."customerId" = '${customerId}'`);

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const result = await prisma.$queryRawUnsafe(`
      SELECT 
        ${groupByClause} as period,
        i."incomeType",
        i."paymentStatus",
        COUNT(*) as transaction_count,
        SUM(i.amount) as total_amount,
        SUM(i."taxAmount") as total_tax,
        SUM(i."discountAmount") as total_discount,
        SUM(i."netAmount") as net_amount,
        AVG(i.amount) as avg_amount
      FROM "IncomeRecord" i
      ${whereClause}
      GROUP BY period, i."incomeType", i."paymentStatus"
      ORDER BY period DESC
    `);

    return result;
  }

  async getIncomeByCustomer(filters = {}) {
    const { startDate, endDate, subsidiaryId } = filters;

    const where = {};
    if (startDate && endDate) {
      where.incomeDate = {
        gte: startDate,
        lte: endDate
      };
    }
    if (subsidiaryId) where.subsidiaryId = subsidiaryId;

    const incomes = await this.model.findMany({
      where,
      include: {
        customer: true
      },
      orderBy: {
        incomeDate: 'desc'
      }
    });

    // Group by customer
    const customerMap = new Map();
    
    incomes.forEach(income => {
      if (!income.customer) return;
      
      const customerId = income.customer.id;
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customer: income.customer,
          totalIncome: 0,
          transactions: [],
          byType: {},
          byMonth: {}
        });
      }
      
      const record = customerMap.get(customerId);
      record.totalIncome += income.amount;
      record.transactions.push(income);
      
      // Group by type
      record.byType[income.incomeType] = (record.byType[income.incomeType] || 0) + income.amount;
      
      // Group by month
      const month = income.incomeDate.toISOString().slice(0, 7);
      record.byMonth[month] = (record.byMonth[month] || 0) + income.amount;
    });

    return Array.from(customerMap.values()).sort((a, b) => b.totalIncome - a.totalIncome);
  }

  async getMonthlyTrends(year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const result = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "incomeDate") as month,
        "incomeType",
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM "IncomeRecord"
      WHERE "incomeDate" BETWEEN ${startDate} AND ${endDate}
      GROUP BY month, "incomeType"
      ORDER BY month, "incomeType"
    `;

    return result;
  }

  async getOutstandingInvoices() {
    return this.model.findMany({
      where: {
        paymentStatus: {
          in: ['PENDING', 'PARTIALLY_PAID']
        },
        dueDate: {
          lt: new Date()
        }
      },
      include: {
        customer: true,
        subsidiary: true
      },
      orderBy: {
        dueDate: 'asc'
      }
    });
  }
}
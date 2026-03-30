import prisma from '../config/database.js';
import { BaseRepository } from './base.repository.js';

export class CustomerRepository extends BaseRepository {
  constructor() {
    super(prisma.customer);
  }

  async findByEmail(email) {
    return this.model.findUnique({
      where: { email },
      include: {
        incomeRecords: {
          take: 10,
          orderBy: { incomeDate: 'desc' }
        }
      }
    });
  }

  async findActiveCustomers() {
    return this.model.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { companyName: 'asc' }
    });
  }

  async getCustomerSummary(customerId) {
    const customer = await this.model.findUnique({
      where: { id: customerId },
      include: {
        incomeRecords: {
          orderBy: { incomeDate: 'desc' },
          take: 50
        },
        invoices: {
          where: {
            status: { not: 'PAID' }
          }
        }
      }
    });

    if (!customer) return null;

    const totalIncome = customer.incomeRecords.reduce((sum, i) => sum + i.amount, 0);
    const totalPaid = customer.incomeRecords.reduce((sum, i) => 
      sum + (i.paymentStatus === 'PAID' ? i.amount : 0), 0);
    const outstandingInvoices = customer.invoices.reduce((sum, i) => sum + i.balanceDue, 0);

    return {
      ...customer,
      summary: {
        totalIncome,
        totalPaid,
        outstandingBalance: outstandingInvoices,
        averageTransactionValue: totalIncome / (customer.incomeRecords.length || 1),
        transactionCount: customer.incomeRecords.length,
        lastTransaction: customer.incomeRecords[0]?.incomeDate
      }
    };
  }

  async getCustomersWithIncome(filters = {}) {
    const { startDate, endDate, subsidiaryId, minIncome } = filters;

    const where = {};
    if (startDate && endDate) {
      where.incomeRecords = {
        some: {
          incomeDate: {
            gte: startDate,
            lte: endDate
          }
        }
      };
    }

    const customers = await this.model.findMany({
      where,
      include: {
        incomeRecords: {
          where: {
            incomeDate: {
              gte: startDate || new Date(0),
              lte: endDate || new Date()
            }
          }
        }
      }
    });

    return customers
      .map(customer => ({
        ...customer,
        totalIncome: customer.incomeRecords.reduce((sum, i) => sum + i.amount, 0)
      }))
      .filter(c => !minIncome || c.totalIncome >= minIncome)
      .sort((a, b) => b.totalIncome - a.totalIncome);
  }

  async getIncomeByCustomer(filters = {}) {
    const { startDate, endDate, subsidiaryId } = filters;

    const result = await prisma.$queryRaw`
      SELECT 
        c.id,
        COALESCE(c."companyName", CONCAT(c."firstName", ' ', c."lastName")) as customer_name,
        c."customerType",
        COUNT(i.id) as transaction_count,
        SUM(i.amount) as total_income,
        AVG(i.amount) as avg_transaction_value,
        MAX(i."incomeDate") as last_transaction_date,
        SUM(CASE WHEN i."paymentStatus" = 'PAID' THEN i.amount ELSE 0 END) as total_paid,
        SUM(CASE WHEN i."paymentStatus" != 'PAID' THEN i.amount ELSE 0 END) as outstanding
      FROM "Customer" c
      LEFT JOIN "IncomeRecord" i ON c.id = i."customerId"
      WHERE i."incomeDate" BETWEEN ${startDate} AND ${endDate}
      GROUP BY c.id, c."companyName", c."firstName", c."lastName", c."customerType"
      HAVING COUNT(i.id) > 0
      ORDER BY total_income DESC
    `;

    return result;
  }

  async getCustomersWithoutIncome(filters = {}) {
    const { startDate, endDate } = filters;

    const customers = await this.model.findMany({
      where: {
        incomeRecords: {
          none: {
            incomeDate: {
              gte: startDate || new Date(0),
              lte: endDate || new Date()
            }
          }
        },
        status: 'ACTIVE'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return customers;
  }

  async getTopCustomers(limit = 10, period = 'month') {
    const dateFilter = period === 'month' 
      ? new Date(new Date().setMonth(new Date().getMonth() - 1))
      : new Date(new Date().setFullYear(new Date().getFullYear() - 1));

    const result = await prisma.$queryRaw`
      SELECT 
        c.id,
        COALESCE(c."companyName", CONCAT(c."firstName", ' ', c."lastName")) as customer_name,
        SUM(i.amount) as total_income,
        COUNT(i.id) as transaction_count
      FROM "Customer" c
      JOIN "IncomeRecord" i ON c.id = i."customerId"
      WHERE i."incomeDate" >= ${dateFilter}
      GROUP BY c.id, c."companyName", c."firstName", c."lastName"
      ORDER BY total_income DESC
      LIMIT ${limit}
    `;

    return result;
  }
}
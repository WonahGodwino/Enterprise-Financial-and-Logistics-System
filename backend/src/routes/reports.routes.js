import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generatePDF, generateExcel, generateCSV } from '../utils/reportGenerators.js';
import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize(['ADMIN', 'CEO', 'ACCOUNTANT']));

/**
 * GET /api/reports/financial-summary
 * Generate comprehensive financial report
 */
router.get('/financial-summary', asyncHandler(async (req, res) => {
  const { startDate, endDate, format = 'json' } = req.query;

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  // Get all financial data
  const [revenue, expenses, bySubsidiary, byCategory] = await Promise.all([
    prisma.incomeRecord.findMany({
      where: { incomeDate: { gte: start, lte: end } },
      include: { customer: true, subsidiary: true },
      orderBy: { incomeDate: 'desc' }
    }),
    prisma.expense.findMany({
      where: { 
        expenseDate: { gte: start, lte: end },
        isDeleted: false 
      },
      include: { vehicle: true, subsidiary: true },
      orderBy: { expenseDate: 'desc' }
    }),
    prisma.incomeRecord.groupBy({
      by: ['subsidiaryId'],
      where: { incomeDate: { gte: start, lte: end } },
      _sum: { amount: true }
    }),
    prisma.expense.groupBy({
      by: ['expenseCategory'],
      where: { 
        expenseDate: { gte: start, lte: end },
        isDeleted: false 
      },
      _sum: { amount: true }
    })
  ]);

  const reportData = {
    period: { start, end },
    summary: {
      totalRevenue: revenue.reduce((sum, r) => sum + r.amount, 0),
      totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
      netProfit: revenue.reduce((sum, r) => sum + r.amount, 0) - expenses.reduce((sum, e) => sum + e.amount, 0),
      transactionCount: revenue.length,
      expenseCount: expenses.length
    },
    bySubsidiary,
    byCategory,
    details: { revenue, expenses }
  };

  // Handle different formats
  switch (format) {
    case 'pdf':
      const pdfBuffer = await generatePDF('financial-summary', reportData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=financial-summary-${start.toISOString().slice(0,10)}.pdf`);
      res.send(pdfBuffer);
      break;
    case 'excel':
      const excelBuffer = await generateExcel('financial-summary', reportData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=financial-summary-${start.toISOString().slice(0,10)}.xlsx`);
      res.send(excelBuffer);
      break;
    case 'csv':
      const csvData = await generateCSV('financial-summary', reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=financial-summary-${start.toISOString().slice(0,10)}.csv`);
      res.send(csvData);
      break;
    default:
      res.json({ success: true, data: reportData });
  }
}));

/**
 * GET /api/reports/customer-statement/:customerId
 * Generate customer statement with all transactions
 */
router.get('/customer-statement/:customerId', asyncHandler(async (req, res) => {
  const { customerId } = req.params;
  const { startDate, endDate, format = 'json' } = req.query;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      incomeRecords: {
        where: {
          incomeDate: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined
          }
        },
        orderBy: { incomeDate: 'asc' }
      },
      invoices: {
        where: {
          issueDate: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined
          }
        },
        orderBy: { issueDate: 'asc' }
      },
      payments: {
        where: {
          paymentDate: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined
          }
        },
        orderBy: { paymentDate: 'asc' }
      }
    }
  });

  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  // Calculate running balance
  let balance = 0;
  const transactions = [];

  // Add invoices (positive amounts)
  customer.invoices.forEach(inv => {
    balance += inv.totalAmount;
    transactions.push({
      date: inv.issueDate,
      type: 'INVOICE',
      reference: inv.invoiceNumber,
      description: `Invoice - ${inv.notes || ''}`,
      debit: inv.totalAmount,
      credit: 0,
      balance
    });
  });

  // Add payments (negative amounts)
  customer.payments.forEach(pay => {
    balance -= pay.amount;
    transactions.push({
      date: pay.paymentDate,
      type: 'PAYMENT',
      reference: pay.reference || pay.paymentNumber,
      description: `Payment - ${pay.paymentMethod}`,
      debit: 0,
      credit: pay.amount,
      balance
    });
  });

  // Sort by date
  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  const statement = {
    customer: {
      id: customer.id,
      name: customer.companyName || `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      phone: customer.phone,
      address: customer.address
    },
    period: {
      startDate: startDate ? new Date(startDate) : customer.createdAt,
      endDate: endDate ? new Date(endDate) : new Date()
    },
    summary: {
      openingBalance: 0,
      totalInvoiced: customer.invoices.reduce((sum, i) => sum + i.totalAmount, 0),
      totalPaid: customer.payments.reduce((sum, p) => sum + p.amount, 0),
      closingBalance: balance,
      outstandingInvoices: customer.invoices.filter(i => i.status !== 'PAID').length
    },
    transactions
  };

  // Handle different formats
  switch (format) {
    case 'pdf':
      const pdfBuffer = await generatePDF('customer-statement', statement);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=customer-statement-${customer.id}.pdf`);
      res.send(pdfBuffer);
      break;
    default:
      res.json({ success: true, data: statement });
  }
}));

/**
 * GET /api/reports/vehicle-performance/:vehicleId
 * Generate vehicle performance report
 */
router.get('/vehicle-performance/:vehicleId', asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;
  const { startDate, endDate } = req.query;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      dailyOperations: {
        where: {
          operationDate: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined
          }
        },
        orderBy: { operationDate: 'asc' }
      },
      expenses: {
        where: {
          expenseDate: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined
          },
          isDeleted: false
        },
        orderBy: { expenseDate: 'asc' }
      }
    }
  });

  if (!vehicle) {
    throw new AppError('Vehicle not found', 404);
  }

  const totalIncome = vehicle.dailyOperations.reduce((sum, op) => sum + op.income, 0);
  const totalExpenses = vehicle.expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalDistance = vehicle.dailyOperations.reduce((sum, op) => sum + op.distanceCovered, 0);
  const operatingDays = vehicle.dailyOperations.length;

  const report = {
    vehicle: {
      id: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      model: vehicle.model,
      status: vehicle.status
    },
    period: {
      startDate: startDate ? new Date(startDate) : vehicle.createdAt,
      endDate: endDate ? new Date(endDate) : new Date()
    },
    summary: {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      profitMargin: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(2) : 0,
      totalDistance,
      operatingDays,
      averageDailyIncome: operatingDays > 0 ? totalIncome / operatingDays : 0,
      averageDailyDistance: operatingDays > 0 ? totalDistance / operatingDays : 0,
      costPerKilometer: totalDistance > 0 ? totalExpenses / totalDistance : 0,
      revenuePerKilometer: totalDistance > 0 ? totalIncome / totalDistance : 0
    },
    operations: vehicle.dailyOperations,
    expenses: vehicle.expenses
  };

  res.json({ success: true, data: report });
}));

/**
 * GET /api/reports/tax-summary
 * Generate tax summary report
 */
router.get('/tax-summary', authorize(['ADMIN', 'ACCOUNTANT']), asyncHandler(async (req, res) => {
  const { year } = req.query;
  const taxYear = year || new Date().getFullYear();

  const startDate = new Date(taxYear, 0, 1);
  const endDate = new Date(taxYear, 11, 31);

  const [income, expenses, byMonth] = await Promise.all([
    prisma.incomeRecord.aggregate({
      where: { incomeDate: { gte: startDate, lte: endDate } },
      _sum: { amount: true, taxAmount: true, netAmount: true }
    }),
    prisma.expense.aggregate({
      where: {
        expenseDate: { gte: startDate, lte: endDate },
        isDeleted: false,
        taxDeductible: true
      },
      _sum: { amount: true, taxAmount: true }
    }),
    prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "incomeDate") as month,
        SUM(amount) as gross_income,
        SUM("taxAmount") as tax_collected,
        SUM("netAmount") as net_income
      FROM "IncomeRecord"
      WHERE EXTRACT(YEAR FROM "incomeDate") = ${parseInt(taxYear)}
      GROUP BY month
      ORDER BY month
    `
  ]);

  const taxSummary = {
    taxYear,
    summary: {
      grossIncome: income._sum.amount || 0,
      taxCollected: income._sum.taxAmount || 0,
      netIncome: income._sum.netAmount || 0,
      deductibleExpenses: expenses._sum.amount || 0,
      inputTax: expenses._sum.taxAmount || 0,
      taxableIncome: (income._sum.amount || 0) - (expenses._sum.amount || 0),
      netTaxLiability: (income._sum.taxAmount || 0) - (expenses._sum.taxAmount || 0)
    },
    monthly: byMonth
  };

  res.json({ success: true, data: taxSummary });
}));

export default router;
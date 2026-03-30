import prisma from '../config/database.js';

const PRIVILEGED_LEDGER_ROLES = new Set(['ACCOUNTANT', 'CEO', 'SUPER_ADMIN', 'AUDITOR', 'ADMIN']);
const STAFF_SCOPED_ROLES = new Set(['EMPLOYEE', 'SUPERVISOR']);

const toMapArray = (obj) => Object.entries(obj).map(([label, value]) => ({
  label,
  value,
}));

const buildDateRange = (startDate, endDate) => {
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();
  return { start, end };
};

const generateReportData = async (params) => {
  const {
    reportType = 'expense',
    startDate,
    endDate,
    customerId,
    staffId,
    incomeCategory,
    expenseCategory,
  } = params;

  const { start, end } = buildDateRange(startDate, endDate);

  const incomeWhere = {
    incomeDate: { gte: start, lte: end },
    ...(customerId ? { customerId } : {}),
    ...(staffId ? { createdById: staffId } : {}),
    ...(incomeCategory ? { category: incomeCategory } : {}),
  };

  const expenseWhere = {
    expenseDate: { gte: start, lte: end },
    isDeleted: false,
    ...(staffId ? { createdById: staffId } : {}),
    ...(expenseCategory ? { expenseCategory } : {}),
  };

  const [incomes, expenses] = await Promise.all([
    prisma.incomeRecord.findMany({
      where: incomeWhere,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { incomeDate: 'desc' },
    }),
    prisma.expense.findMany({
      where: expenseWhere,
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { expenseDate: 'desc' },
    }),
  ]);

  const incomeCategoryMap = {};
  const expenseCategoryMap = {};
  const incomeCustomerMap = {};
  const expenseCustomerMap = {};
  const incomeStaffMap = {};
  const expenseStaffMap = {};

  incomes.forEach((item) => {
    const incomeValue = Number(item.amount) || 0;
    const categoryLabel = item.category || 'UNSPECIFIED';
    incomeCategoryMap[categoryLabel] = (incomeCategoryMap[categoryLabel] || 0) + incomeValue;

    const customerName = item.customer
      ? (item.customer.companyName || `${item.customer.firstName || ''} ${item.customer.lastName || ''}`.trim() || 'Unknown Customer')
      : 'No Customer';
    incomeCustomerMap[customerName] = (incomeCustomerMap[customerName] || 0) + incomeValue;

    const staffName = item.createdBy?.fullName || item.createdBy?.email || 'Unknown Staff';
    incomeStaffMap[staffName] = (incomeStaffMap[staffName] || 0) + incomeValue;
  });

  expenses.forEach((item) => {
    const expenseValue = Number(item.amount) || 0;
    const categoryLabel = item.expenseCategory || 'UNSPECIFIED';
    expenseCategoryMap[categoryLabel] = (expenseCategoryMap[categoryLabel] || 0) + expenseValue;

    const inferredCustomer =
      item.customerName ||
      item.projectName ||
      item.vendorName ||
      item.costCenter ||
      item.branch ||
      'Unassigned';
    expenseCustomerMap[inferredCustomer] = (expenseCustomerMap[inferredCustomer] || 0) + expenseValue;

    const staffName = item.createdBy?.fullName || item.createdBy?.email || 'Unknown Staff';
    expenseStaffMap[staffName] = (expenseStaffMap[staffName] || 0) + expenseValue;
  });

  const totalIncome = incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return {
    reportType,
    period: { startDate: start, endDate: end },
    summary: {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      incomeCount: incomes.length,
      expenseCount: expenses.length,
    },
    incomeByCategory: toMapArray(incomeCategoryMap),
    expenseByCategory: toMapArray(expenseCategoryMap),
    incomeByCustomer: toMapArray(incomeCustomerMap),
    expenseByCustomer: toMapArray(expenseCustomerMap),
    incomeByStaff: toMapArray(incomeStaffMap),
    expenseByStaff: toMapArray(expenseStaffMap),
    notes: [
      'Expense by customer is inferred from customer-like fields such as project/vendor/branch until direct customer linkage is fully standardized.',
    ],
    records: {
      incomes,
      expenses,
    },
  };
};

class ReportController {
  async generateReport(req, res, next) {
    try {
      const data = await generateReportData(req.query);
      res.status(200).json({ success: true, message: 'Report generated successfully', data });
    } catch (err) {
      next(err);
    }
  }

  async exportReport(req, res, next) {
    try {
      const { format } = req.params;
      const data = await generateReportData(req.query);
      const fileBase = `${data.reportType}-report-${new Date().toISOString().slice(0, 10)}`;

      if (format === 'csv') {
        const lines = [
          'section,label,value',
          ...data.incomeByCategory.map((row) => `incomeByCategory,${row.label},${row.value}`),
          ...data.expenseByCategory.map((row) => `expenseByCategory,${row.label},${row.value}`),
          ...data.incomeByCustomer.map((row) => `incomeByCustomer,${row.label},${row.value}`),
          ...data.incomeByStaff.map((row) => `incomeByStaff,${row.label},${row.value}`),
          ...data.expenseByStaff.map((row) => `expenseByStaff,${row.label},${row.value}`),
        ];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${fileBase}.csv`);
        return res.status(200).send(lines.join('\n'));
      }

      if (format === 'excel') {
        // Fallback export for now: JSON content with .xlsx extension keeps download flow functional.
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${fileBase}.xlsx`);
        return res.status(200).send(JSON.stringify(data, null, 2));
      }

      if (format === 'pdf') {
        // Fallback export for now: plain text summary with .pdf extension keeps download flow functional.
        const summary = [
          `Report: ${data.reportType}`,
          `Period: ${new Date(data.period.startDate).toISOString().slice(0, 10)} to ${new Date(data.period.endDate).toISOString().slice(0, 10)}`,
          `Total Income: ${data.summary.totalIncome}`,
          `Total Expenses: ${data.summary.totalExpenses}`,
          `Net Profit: ${data.summary.netProfit}`,
          '',
          'No PDF renderer configured in this controller yet.',
        ].join('\n');
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=${fileBase}.pdf`);
        return res.status(200).send(summary);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${fileBase}.json`);
      return res.status(200).send(JSON.stringify(data, null, 2));
    } catch (err) {
      next(err);
    }
  }

  async getTransactionLedger(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        sourceType,
        transactionType,
        customerId,
        subsidiaryId,
      } = req.query;

      const where = {};
      const currentRole = String(req.user?.role || '').toUpperCase();

      if (STAFF_SCOPED_ROLES.has(currentRole) && !PRIVILEGED_LEDGER_ROLES.has(currentRole)) {
        where.recordedById = req.user.id;
      }

      if (startDate || endDate) {
        where.transactionDate = {};
        if (startDate) where.transactionDate.gte = new Date(startDate);
        if (endDate) where.transactionDate.lte = new Date(endDate);
      }
      if (sourceType) where.sourceType = sourceType;
      if (transactionType) where.transactionType = transactionType;
      if (customerId) where.customerId = customerId;
      if (subsidiaryId) where.subsidiaryId = subsidiaryId;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const [transactions, total] = await Promise.all([
        prisma.financeTransaction.findMany({
          where,
          include: {
            customer: {
              select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
            },
            subsidiary: {
              select: { id: true, name: true, code: true },
            },
            recordedBy: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
          orderBy: { transactionDate: 'desc' },
          skip,
          take,
        }),
        prisma.financeTransaction.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: transactions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getScheduledReports(req, res, next) {
    try {
      res.status(200).json({ success: true, data: [] });
    } catch (err) {
      next(err);
    }
  }

  async scheduleReport(req, res, next) {
    try {
      res.status(201).json({ success: true, message: 'Report scheduled (placeholder)' });
    } catch (err) {
      next(err);
    }
  }
}

export default ReportController;

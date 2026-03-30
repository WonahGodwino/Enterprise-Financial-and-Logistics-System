import prisma from '../config/database.js';

class DashboardService {
  constructor() {}

  buildChartLabelFromCustomer(customer) {
    if (!customer) {
      return 'Unknown Customer';
    }

    return customer.companyName || [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Unknown Customer';
  }

  rangeForBucketLabel(bucket, label) {
    if (!label) {
      return null;
    }

    if (bucket === 'day') {
      const dayStart = new Date(`${label}T00:00:00.000Z`);
      if (Number.isNaN(dayStart.getTime())) {
        return null;
      }

      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      return { gte: dayStart, lt: dayEnd };
    }

    if (bucket === 'month') {
      const [yearPart, monthPart] = String(label).split('-');
      const year = Number(yearPart);
      const month = Number(monthPart);

      if (!year || !month || month < 1 || month > 12) {
        return null;
      }

      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month, 1));
      return { gte: monthStart, lt: monthEnd };
    }

    if (bucket === 'year') {
      const year = Number(label);
      if (!year) {
        return null;
      }

      const yearStart = new Date(Date.UTC(year, 0, 1));
      const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
      return { gte: yearStart, lt: yearEnd };
    }

    return null;
  }

  aggregateRows(items, keyResolver, valueResolver) {
    const grouped = new Map();

    for (const item of items) {
      const key = keyResolver(item) || 'Unspecified';
      const value = Number(valueResolver(item) || 0);
      grouped.set(key, (grouped.get(key) || 0) + value);
    }

    return Array.from(grouped.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  getRangeFromPeriod(period = 'monthly') {
    const now = new Date();
    const normalized = String(period || 'monthly').toLowerCase();

    if (normalized === 'daily') {
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end: now, bucket: 'day' };
    }

    if (normalized === 'yearly') {
      const start = new Date(now.getFullYear() - 4, 0, 1);
      return { start, end: now, bucket: 'year' };
    }

    // monthly default: last 12 months
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return { start, end: now, bucket: 'month' };
  }

  bucketLabel(dateValue, bucket) {
    const date = new Date(dateValue);
    if (bucket === 'day') {
      return date.toISOString().slice(0, 10);
    }
    if (bucket === 'year') {
      return String(date.getFullYear());
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  ensureSortedLabels(mapObj) {
    return Object.keys(mapObj).sort((a, b) => a.localeCompare(b));
  }

  buildBucketLabels(start, end, bucket) {
    const labels = [];

    if (bucket === 'day') {
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);

      while (cursor <= end) {
        labels.push(this.bucketLabel(cursor, bucket));
        cursor.setDate(cursor.getDate() + 1);
      }

      return labels;
    }

    if (bucket === 'month') {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMarker = new Date(end.getFullYear(), end.getMonth(), 1);

      while (cursor <= endMarker) {
        labels.push(this.bucketLabel(cursor, bucket));
        cursor.setMonth(cursor.getMonth() + 1);
      }

      return labels;
    }

    if (bucket === 'year') {
      for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
        labels.push(String(year));
      }
    }

    return labels;
  }

  async getExecutiveDashboard(filters = {}) {
    return { summary: {}, alerts: [] };
  }

  async getOperationsDashboard(filters = {}) {
    return { operations: [] };
  }

  async getFinancialDashboard(period = 'month') {
    return { revenue: 0, expenses: 0 };
  }

  async getFleetDashboard(filters = {}) {
    return { fleet: [] };
  }

  async getDriverDashboard(driverId) {
    return { driverId, metrics: {} };
  }

  async getMaintenanceDashboard() {
    return { maintenance: [] };
  }

  async getAIInsightsDashboard() {
    return { insights: [] };
  }

  async getRealTimeMetrics() {
    return { online: 0, offline: 0 };
  }

  async getKPISummary(period = 'month') {
    const { start, end } = this.getRangeFromPeriod(period);

    const [incomeAgg, expenseAgg, topCustomerRows, topExpenseRows] = await Promise.all([
      prisma.incomeRecord.aggregate({
        where: { incomeDate: { gte: start, lte: end } },
        _sum: { netAmount: true, amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: {
          expenseDate: { gte: start, lte: end },
          isDeleted: false,
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.incomeRecord.groupBy({
        by: ['customerId'],
        where: { incomeDate: { gte: start, lte: end } },
        _sum: { netAmount: true, amount: true },
        orderBy: { _sum: { netAmount: 'desc' } },
        take: 5,
      }),
      prisma.expense.groupBy({
        by: ['expenseCategory'],
        where: {
          expenseDate: { gte: start, lte: end },
          isDeleted: false,
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
    ]);

    const customerIds = topCustomerRows
      .map((row) => row.customerId)
      .filter(Boolean);

    const customers = customerIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, companyName: true, firstName: true, lastName: true },
        })
      : [];

    const customerMap = new Map(customers.map((c) => [
      c.id,
      c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown Customer',
    ]));

    const totalIncome = incomeAgg._sum.netAmount || incomeAgg._sum.amount || 0;
    const totalExpense = expenseAgg._sum.amount || 0;

    return {
      period,
      currency: 'NGN',
      totals: {
        income: totalIncome,
        expenses: totalExpense,
        net: totalIncome - totalExpense,
      },
      counts: {
        incomeEntries: incomeAgg._count || 0,
        expenseEntries: expenseAgg._count || 0,
      },
      topCustomers: topCustomerRows.map((row) => ({
        customerId: row.customerId,
        customerName: customerMap.get(row.customerId) || 'Unknown Customer',
        total: row._sum.netAmount || row._sum.amount || 0,
      })),
      topExpenseCategories: topExpenseRows.map((row) => ({
        category: row.expenseCategory,
        total: row._sum.amount || 0,
      })),
    };
  }

  async getChartData(metric, period = 'month') {
    const selectedMetric = metric || 'income-expense-trend';
    const { start, end, bucket } = this.getRangeFromPeriod(period);

    if (selectedMetric === 'expenses-by-category') {
      const rows = await prisma.expense.groupBy({
        by: ['expenseCategory'],
        where: {
          expenseDate: { gte: start, lte: end },
          isDeleted: false,
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
      });

      return {
        metric: selectedMetric,
        period,
        labels: rows.map((r) => r.expenseCategory),
        datasets: [
          {
            label: 'Expenses by Category',
            data: rows.map((r) => r._sum.amount || 0),
          },
        ],
        currency: 'NGN',
      };
    }

    if (selectedMetric === 'income-by-customer') {
      const rows = await prisma.incomeRecord.groupBy({
        by: ['customerId'],
        where: { incomeDate: { gte: start, lte: end } },
        _sum: { netAmount: true, amount: true },
        orderBy: { _sum: { netAmount: 'desc' } },
        take: 12,
      });

      const customerIds = rows.map((row) => row.customerId).filter(Boolean);
      const customers = customerIds.length > 0
        ? await prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, companyName: true, firstName: true, lastName: true },
          })
        : [];

      const customerMap = new Map(customers.map((c) => [
        c.id,
        c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown Customer',
      ]));

      return {
        metric: selectedMetric,
        period,
        labels: rows.map((r) => customerMap.get(r.customerId) || 'Unknown Customer'),
        meta: {
          customerIds: rows.map((r) => r.customerId || null),
        },
        datasets: [
          {
            label: 'Income by Customer',
            data: rows.map((r) => r._sum.netAmount || r._sum.amount || 0),
          },
        ],
        currency: 'NGN',
      };
    }

    const [incomeRows, expenseRows] = await Promise.all([
      prisma.incomeRecord.findMany({
        where: { incomeDate: { gte: start, lte: end } },
        select: { incomeDate: true, amount: true, netAmount: true },
      }),
      prisma.expense.findMany({
        where: {
          expenseDate: { gte: start, lte: end },
          isDeleted: false,
        },
        select: { expenseDate: true, amount: true },
      }),
    ]);

    const incomeByBucket = {};
    const expenseByBucket = {};

    for (const income of incomeRows) {
      const label = this.bucketLabel(income.incomeDate, bucket);
      incomeByBucket[label] = (incomeByBucket[label] || 0) + (income.netAmount || income.amount || 0);
    }

    for (const expense of expenseRows) {
      const label = this.bucketLabel(expense.expenseDate, bucket);
      expenseByBucket[label] = (expenseByBucket[label] || 0) + (expense.amount || 0);
    }

    const labels = this.buildBucketLabels(start, end, bucket);

    return {
      metric: selectedMetric,
      period,
      labels,
      datasets: [
        {
          label: 'Income',
          data: labels.map((label) => incomeByBucket[label] || 0),
        },
        {
          label: 'Expenses',
          data: labels.map((label) => expenseByBucket[label] || 0),
        },
      ],
      currency: 'NGN',
    };
  }

  async getDrilldownData({ metric, period = 'monthly', label, series, entityId }) {
    const selectedMetric = metric || 'income-expense-trend';
    const selectedSeries = String(series || '').toLowerCase();
    const { start, end, bucket } = this.getRangeFromPeriod(period);

    if (selectedMetric === 'income-by-customer') {
      let customerId = entityId || null;

      if (!customerId && label) {
        const candidates = await prisma.customer.findMany({
          where: {
            OR: [
              { companyName: label },
              { firstName: label },
              { lastName: label },
            ],
          },
          select: { id: true, companyName: true, firstName: true, lastName: true },
          take: 20,
        });

        const exactMatch = candidates.find((candidate) => this.buildChartLabelFromCustomer(candidate) === label);
        customerId = exactMatch?.id || candidates[0]?.id || null;
      }

      if (!customerId) {
        return {
          title: `Income Sources: ${label || 'Customer'}`,
          metricLabel: 'Income',
          dimensionLabel: 'Source / Patronage',
          rows: [],
        };
      }

      const rows = await prisma.incomeRecord.findMany({
        where: {
          incomeDate: { gte: start, lte: end },
          customerId,
        },
        select: {
          serviceType: true,
          category: true,
          incomeType: true,
          amount: true,
          netAmount: true,
        },
      });

      return {
        title: `Income Sources: ${label || 'Customer'}`,
        metricLabel: 'Income',
        dimensionLabel: 'Source / Patronage',
        rows: this.aggregateRows(
          rows,
          (row) => row.serviceType || row.category || row.incomeType,
          (row) => row.netAmount || row.amount || 0
        ),
      };
    }

    if (selectedMetric === 'expenses-by-category') {
      const rows = await prisma.expense.findMany({
        where: {
          expenseDate: { gte: start, lte: end },
          isDeleted: false,
          ...(label ? { expenseCategory: label } : {}),
        },
        select: {
          expenseSubCategory: true,
          expenseType: true,
          vendorName: true,
          amount: true,
        },
      });

      return {
        title: `Expense Drivers: ${label || 'Category'}`,
        metricLabel: 'Expenses',
        dimensionLabel: 'Source / Driver',
        rows: this.aggregateRows(
          rows,
          (row) => row.expenseSubCategory || row.vendorName || row.expenseType,
          (row) => row.amount || 0
        ),
      };
    }

    const selectedRange = this.rangeForBucketLabel(bucket, label) || { gte: start, lte: end };

    if (selectedSeries === 'expenses') {
      const rows = await prisma.expense.findMany({
        where: {
          expenseDate: selectedRange,
          isDeleted: false,
        },
        select: {
          expenseSubCategory: true,
          expenseCategory: true,
          expenseType: true,
          amount: true,
        },
      });

      return {
        title: `Expenses Breakdown: ${label || period}`,
        metricLabel: 'Expenses',
        dimensionLabel: 'Component',
        rows: this.aggregateRows(
          rows,
          (row) => row.expenseSubCategory || row.expenseCategory || row.expenseType,
          (row) => row.amount || 0
        ),
      };
    }

    const rows = await prisma.incomeRecord.findMany({
      where: {
        incomeDate: selectedRange,
      },
      select: {
        serviceType: true,
        category: true,
        incomeType: true,
        amount: true,
        netAmount: true,
      },
    });

    return {
      title: `Income Breakdown: ${label || period}`,
      metricLabel: 'Income',
      dimensionLabel: 'Component',
      rows: this.aggregateRows(
        rows,
        (row) => row.serviceType || row.category || row.incomeType,
        (row) => row.netAmount || row.amount || 0
      ),
    };
  }

  async getUserAlerts(userId) {
    return [];
  }

  async dismissAlert(alertId) {
    return true;
  }

  async getForecastData(metric, horizon = 30) {
    return { metric, forecast: [] };
  }

  async getAnomalies(startDate, endDate) {
    return [];
  }
}

export default new DashboardService();

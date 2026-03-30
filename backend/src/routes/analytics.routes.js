import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { exportToExcel, exportToPDF } from '../utils/exportUtils.js';
import { cacheMiddleware } from '../middleware/cache.middleware.js';

const router = express.Router();

// All analytics routes require authentication and admin/CEO access
router.use(authenticate);
router.use(authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']));

// ============================================
// DASHBOARD ANALYTICS
// ============================================

/**
 * GET /api/analytics/dashboard/kpi
 * Get main KPIs for dashboard
 */
router.get('/dashboard/kpi', cacheMiddleware(300), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();
  const previousStart = new Date(start);
  previousStart.setMonth(previousStart.getMonth() - 1);
  const previousEnd = new Date(end);
  previousEnd.setMonth(previousEnd.getMonth() - 1);

  // Current period data
  const [currentRevenue, currentExpenses, activeVehicles, activeCustomers] = await Promise.all([
    prisma.incomeRecord.aggregate({
      where: { incomeDate: { gte: start, lte: end } },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: { 
        expenseDate: { gte: start, lte: end },
        isDeleted: false
      },
      _sum: { amount: true }
    }),
    prisma.vehicle.count({ where: { status: 'ACTIVE' } }),
    prisma.customer.count({ where: { status: 'ACTIVE' } })
  ]);

  // Previous period data for comparison
  const [previousRevenue, previousExpenses] = await Promise.all([
    prisma.incomeRecord.aggregate({
      where: { incomeDate: { gte: previousStart, lte: previousEnd } },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: { 
        expenseDate: { gte: previousStart, lte: previousEnd },
        isDeleted: false
      },
      _sum: { amount: true }
    })
  ]);

  const revenue = currentRevenue._sum.amount || 0;
  const expenses = currentExpenses._sum.amount || 0;
  const profit = revenue - expenses;
  
  const prevRevenue = previousRevenue._sum.amount || 0;
  const prevExpenses = previousExpenses._sum.amount || 0;
  const prevProfit = prevRevenue - prevExpenses;

  res.json({
    success: true,
    data: {
      revenue: {
        current: revenue,
        previous: prevRevenue,
        growth: prevRevenue ? ((revenue - prevRevenue) / prevRevenue * 100).toFixed(2) : 0
      },
      expenses: {
        current: expenses,
        previous: prevExpenses,
        growth: prevExpenses ? ((expenses - prevExpenses) / prevExpenses * 100).toFixed(2) : 0
      },
      profit: {
        current: profit,
        previous: prevProfit,
        growth: prevProfit ? ((profit - prevProfit) / prevProfit * 100).toFixed(2) : 0,
        margin: revenue ? (profit / revenue * 100).toFixed(2) : 0
      },
      operational: {
        activeVehicles,
        activeCustomers,
        vehiclesInMaintenance: await prisma.vehicle.count({ where: { status: 'MAINTENANCE' } }),
        pendingInvoices: await prisma.invoice.count({ where: { status: 'PENDING' } }),
        overdueInvoices: await prisma.invoice.count({ 
          where: { 
            status: 'OVERDUE',
            dueDate: { lt: new Date() }
          } 
        })
      }
    }
  });
}));

/**
 * GET /api/analytics/dashboard/charts
 * Get all chart data for dashboard
 */
router.get('/dashboard/charts', cacheMiddleware(300), asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  const [
    revenueBySubsidiary,
    expenseByCategory,
    monthlyTrends,
    customerAcquisition,
    vehicleUtilization,
    topCustomers,
    topVendors,
    cashFlow
  ] = await Promise.all([
    getRevenueBySubsidiary(year),
    getExpenseByCategory(year),
    getMonthlyTrends(year),
    getCustomerAcquisition(year),
    getVehicleUtilization(year),
    getTopCustomers(5),
    getTopVendors(5),
    getCashFlow(year)
  ]);

  res.json({
    success: true,
    data: {
      revenueBySubsidiary,
      expenseByCategory,
      monthlyTrends,
      customerAcquisition,
      vehicleUtilization,
      topCustomers,
      topVendors,
      cashFlow
    }
  });
}));

// ============================================
// REVENUE ANALYTICS
// ============================================

/**
 * GET /api/analytics/revenue/summary
 * Get revenue summary with filters
 */
router.get('/revenue/summary', asyncHandler(async (req, res) => {
  const { startDate, endDate, subsidiaryId, customerId, vehicleId, groupBy = 'day' } = req.query;

  const where = {
    incomeDate: {
      gte: startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
      lte: endDate ? new Date(endDate) : new Date()
    }
  };

  if (subsidiaryId) where.subsidiaryId = subsidiaryId;
  if (customerId) where.customerId = customerId;
  if (vehicleId) where.vehicleId = vehicleId;

  const [totalRevenue, byType, byPaymentStatus, bySubsidiary, trends] = await Promise.all([
    prisma.incomeRecord.aggregate({
      where,
      _sum: { amount: true, taxAmount: true, discountAmount: true, netAmount: true },
      _count: true,
      _avg: { amount: true }
    }),
    prisma.incomeRecord.groupBy({
      by: ['incomeType'],
      where,
      _sum: { amount: true, netAmount: true },
      _count: true
    }),
    prisma.incomeRecord.groupBy({
      by: ['paymentStatus'],
      where,
      _sum: { amount: true },
      _count: true
    }),
    prisma.incomeRecord.groupBy({
      by: ['subsidiaryId'],
      where,
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } }
    }),
    getRevenueTrends(where, groupBy)
  ]);

  // Get subsidiary names
  const subsidiaries = await prisma.subsidiary.findMany({
    where: { id: { in: bySubsidiary.map(s => s.subsidiaryId).filter(Boolean) } }
  });

  const subsidiaryMap = Object.fromEntries(subsidiaries.map(s => [s.id, s.name]));

  res.json({
    success: true,
    data: {
      summary: {
        totalAmount: totalRevenue._sum.amount || 0,
        netAmount: totalRevenue._sum.netAmount || 0,
        taxAmount: totalRevenue._sum.taxAmount || 0,
        discountAmount: totalRevenue._sum.discountAmount || 0,
        transactionCount: totalRevenue._count,
        averageAmount: totalRevenue._avg.amount || 0
      },
      byType,
      byPaymentStatus,
      bySubsidiary: bySubsidiary.map(s => ({
        subsidiaryId: s.subsidiaryId,
        subsidiaryName: subsidiaryMap[s.subsidiaryId] || 'Unknown',
        amount: s._sum.amount || 0,
        count: s._count
      })),
      trends
    }
  });
}));

/**
 * GET /api/analytics/revenue/by-customer
 * Get revenue breakdown by customer
 */
router.get('/revenue/by-customer', asyncHandler(async (req, res) => {
  const { startDate, endDate, limit = 20 } = req.query;

  const where = {
    incomeDate: {
      gte: startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
      lte: endDate ? new Date(endDate) : new Date()
    }
  };

  const customerRevenue = await prisma.incomeRecord.groupBy({
    by: ['customerId'],
    where: {
      ...where,
      customerId: { not: null }
    },
    _sum: { amount: true, netAmount: true },
    _count: true,
    orderBy: { _sum: { amount: 'desc' } },
    take: parseInt(limit)
  });

  // Get customer details
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerRevenue.map(c => c.customerId).filter(Boolean) } },
    select: {
      id: true,
      customerType: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true
    }
  });

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  const result = customerRevenue.map(c => ({
    customer: customerMap[c.customerId] || null,
    totalRevenue: c._sum.amount || 0,
    netRevenue: c._sum.netAmount || 0,
    transactionCount: c._count
  }));

  // Get customers without revenue
  const customersWithoutRevenue = await prisma.customer.count({
    where: {
      id: { notIn: customerRevenue.map(c => c.customerId).filter(Boolean) },
      status: 'ACTIVE'
    }
  });

  res.json({
    success: true,
    data: {
      customers: result,
      summary: {
        totalCustomers: result.length,
        customersWithoutRevenue,
        averageRevenuePerCustomer: result.length ? 
          result.reduce((sum, c) => sum + c.totalRevenue, 0) / result.length : 0
      }
    }
  });
}));

// ============================================
// EXPENSE ANALYTICS
// ============================================

/**
 * GET /api/analytics/expenses/summary
 * Get expense summary with advanced filters
 */
router.get('/expenses/summary', asyncHandler(async (req, res) => {
  const { 
    startDate, 
    endDate, 
    subsidiaryId, 
    vehicleId,
    expenseType,
    expenseCategory,
    vendorId,
    projectId,
    groupBy = 'category',
    includeTax = true 
  } = req.query;

  const where = {
    expenseDate: {
      gte: startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
      lte: endDate ? new Date(endDate) : new Date()
    },
    isDeleted: false
  };

  if (subsidiaryId) where.subsidiaryId = subsidiaryId;
  if (vehicleId) where.vehicleId = vehicleId;
  if (expenseType) where.expenseType = expenseType;
  if (expenseCategory) where.expenseCategory = expenseCategory;
  if (vendorId) where.vendorId = vendorId;
  if (projectId) where.projectId = projectId;

  // Get totals
  const [totalExpenses, byCategory, byPaymentStatus, byApprovalStatus, bySubsidiary, trends] = await Promise.all([
    prisma.expense.aggregate({
      where,
      _sum: { 
        amount: true, 
        taxAmount: true,
        ...(includeTax ? {} : { amount: true })
      },
      _count: true,
      _avg: { amount: true }
    }),
    prisma.expense.groupBy({
      by: ['expenseCategory'],
      where,
      _sum: { amount: true, taxAmount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } }
    }),
    prisma.expense.groupBy({
      by: ['paymentStatus'],
      where,
      _sum: { amount: true },
      _count: true
    }),
    prisma.expense.groupBy({
      by: ['approvalStatus'],
      where,
      _sum: { amount: true },
      _count: true
    }),
    prisma.expense.groupBy({
      by: ['subsidiaryId'],
      where,
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } }
    }),
    getExpenseTrends(where, groupBy)
  ]);

  // Get subsidiary names
  const subsidiaries = await prisma.subsidiary.findMany({
    where: { id: { in: bySubsidiary.map(s => s.subsidiaryId).filter(Boolean) } }
  });
  const subsidiaryMap = Object.fromEntries(subsidiaries.map(s => [s.id, s.name]));

  // Get expense category definitions for grouping
  const expenseCategories = getExpenseCategoryDefinitions();

  // Group by main category
  const byMainCategory = byCategory.reduce((acc, item) => {
    const mainCategory = expenseCategories.mainCategories.find(
      mc => mc.categories.includes(item.expenseCategory)
    )?.name || 'OTHER';
    
    if (!acc[mainCategory]) {
      acc[mainCategory] = {
        mainCategory,
        total: 0,
        count: 0,
        categories: []
      };
    }
    acc[mainCategory].total += item._sum.amount || 0;
    acc[mainCategory].count += item._count;
    acc[mainCategory].categories.push({
      category: item.expenseCategory,
      amount: item._sum.amount || 0,
      count: item._count,
      taxAmount: item._sum.taxAmount || 0
    });
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      summary: {
        totalAmount: totalExpenses._sum.amount || 0,
        taxAmount: totalExpenses._sum.taxAmount || 0,
        netAmount: (totalExpenses._sum.amount || 0) - (totalExpenses._sum.taxAmount || 0),
        transactionCount: totalExpenses._count,
        averageAmount: totalExpenses._avg.amount || 0
      },
      byMainCategory: Object.values(byMainCategory),
      byDetailedCategory: byCategory,
      byPaymentStatus,
      byApprovalStatus,
      bySubsidiary: bySubsidiary.map(s => ({
        subsidiaryId: s.subsidiaryId,
        subsidiaryName: subsidiaryMap[s.subsidiaryId] || 'Unknown',
        amount: s._sum.amount || 0,
        count: s._count
      })),
      trends
    }
  });
}));

/**
 * GET /api/analytics/expenses/by-vendor
 * Get expense breakdown by vendor
 */
router.get('/expenses/by-vendor', asyncHandler(async (req, res) => {
  const { startDate, endDate, limit = 20 } = req.query;

  const where = {
    expenseDate: {
      gte: startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
      lte: endDate ? new Date(endDate) : new Date()
    },
    isDeleted: false,
    vendorName: { not: null }
  };

  const vendorExpenses = await prisma.expense.groupBy({
    by: ['vendorName', 'vendorId'],
    where,
    _sum: { amount: true, taxAmount: true },
    _count: true,
    _avg: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: parseInt(limit)
  });

  // Get top vendors by category
  const vendorCategories = await prisma.$queryRaw`
    SELECT 
      "vendorName",
      "expenseCategory",
      SUM(amount) as total
    FROM "Expense"
    WHERE "expenseDate" BETWEEN ${where.expenseDate.gte} AND ${where.expenseDate.lte}
      AND "vendorName" IS NOT NULL
      AND "isDeleted" = false
    GROUP BY "vendorName", "expenseCategory"
    ORDER BY total DESC
  `;

  res.json({
    success: true,
    data: {
      vendors: vendorExpenses.map(v => ({
        name: v.vendorName,
        id: v.vendorId,
        totalAmount: v._sum.amount || 0,
        taxAmount: v._sum.taxAmount || 0,
        transactionCount: v._count,
        averageAmount: v._avg.amount || 0
      })),
      vendorCategories
    }
  });
}));

/**
 * GET /api/analytics/expenses/budget-vs-actual
 * Compare budget vs actual expenses
 */
router.get('/expenses/budget-vs-actual', asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear(), subsidiaryId } = req.query;

  // Get budgets for the year
  const budgets = await prisma.budget.findMany({
    where: {
      fiscalYear: parseInt(year),
      ...(subsidiaryId && { subsidiaryId })
    }
  });

  // Get actual expenses grouped by month and category
  const actualExpenses = await prisma.$queryRaw`
    SELECT 
      EXTRACT(MONTH FROM "expenseDate") as month,
      "expenseCategory",
      SUM(amount) as actual
    FROM "Expense"
    WHERE EXTRACT(YEAR FROM "expenseDate") = ${parseInt(year)}
      AND "isDeleted" = false
      ${subsidiaryId ? prisma.$raw`AND "subsidiaryId" = ${subsidiaryId}` : prisma.empty}
    GROUP BY month, "expenseCategory"
  `;

  // Group budgets by month and category
  const budgetMap = {};
  budgets.forEach(budget => {
    const months = getMonthsInPeriod(budget.period, budget.startDate, budget.endDate);
    months.forEach(month => {
      if (!budgetMap[month]) budgetMap[month] = {};
      budgetMap[month][budget.expenseCategory] = (budgetMap[month][budget.expenseCategory] || 0) + 
        (budget.allocatedAmount / months.length);
    });
  });

  // Combine budget and actual
  const comparison = [];
  for (let month = 1; month <= 12; month++) {
    const monthData = {
      month,
      categories: []
    };

    // Get all categories with either budget or actual
    const categories = new Set([
      ...Object.keys(budgetMap[month] || {}),
      ...actualExpenses.filter(a => a.month === month).map(a => a.expenseCategory)
    ]);

    categories.forEach(category => {
      monthData.categories.push({
        category,
        budget: budgetMap[month]?.[category] || 0,
        actual: actualExpenses.find(a => a.month === month && a.expenseCategory === category)?.actual || 0
      });
    });

    comparison.push(monthData);
  }

  res.json({
    success: true,
    data: comparison
  });
}));

// ============================================
// CUSTOMER ANALYTICS
// ============================================

/**
 * GET /api/analytics/customers/lifetime-value
 * Calculate customer lifetime value
 */
router.get('/customers/lifetime-value', asyncHandler(async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { status: 'ACTIVE' },
    include: {
      incomeRecords: {
        select: { amount: true, createdAt: true }
      }
    }
  });

  const now = new Date();
  const ltvData = customers.map(customer => {
    const totalRevenue = customer.incomeRecords.reduce((sum, i) => sum + i.amount, 0);
    const firstPurchase = customer.incomeRecords.length > 0 
      ? new Date(Math.min(...customer.incomeRecords.map(i => i.createdAt)))
      : null;
    const lastPurchase = customer.incomeRecords.length > 0
      ? new Date(Math.max(...customer.incomeRecords.map(i => i.createdAt)))
      : null;
    
    const customerLifetime = firstPurchase 
      ? Math.ceil((lastPurchase - firstPurchase) / (1000 * 60 * 60 * 24)) 
      : 0;
    
    const averageOrderValue = customer.incomeRecords.length > 0
      ? totalRevenue / customer.incomeRecords.length
      : 0;

    const purchaseFrequency = customerLifetime > 30
      ? customer.incomeRecords.length / (customerLifetime / 30) // per month
      : customer.incomeRecords.length;

    return {
      customerId: customer.id,
      customerName: customer.companyName || `${customer.firstName} ${customer.lastName}`,
      customerType: customer.customerType,
      totalRevenue,
      averageOrderValue,
      purchaseFrequency,
      customerLifetime,
      lifetimeValue: averageOrderValue * purchaseFrequency * (customerLifetime / 30 || 1),
      firstPurchase,
      lastPurchase,
      transactionCount: customer.incomeRecords.length
    };
  });

  // Sort by LTV
  ltvData.sort((a, b) => b.lifetimeValue - a.lifetimeValue);

  res.json({
    success: true,
    data: {
      customers: ltvData,
      summary: {
        averageLTV: ltvData.reduce((sum, c) => sum + c.lifetimeValue, 0) / ltvData.length || 0,
        topCustomerLTV: ltvData[0]?.lifetimeValue || 0,
        totalCustomers: ltvData.length
      }
    }
  });
}));

/**
 * GET /api/analytics/customers/retention
 * Get customer retention metrics
 */
router.get('/customers/retention', asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  // Get all customers acquired in each month
  const acquisitions = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('month', "createdAt") as cohort_month,
      COUNT(*) as customers
    FROM "Customer"
    WHERE EXTRACT(YEAR FROM "createdAt") = ${parseInt(year)}
    GROUP BY cohort_month
    ORDER BY cohort_month
  `;

  // Get repeat purchases by cohort
  const retention = [];
  
  for (let i = 0; i < acquisitions.length; i++) {
    const cohort = acquisitions[i];
    const cohortData = {
      month: cohort.cohort_month,
      acquired: parseInt(cohort.customers),
      months: []
    };

    // Track retention for 12 months
    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(cohort.cohort_month);
      monthDate.setMonth(monthDate.getMonth() + m);

      const activeCustomers = await prisma.incomeRecord.groupBy({
        by: ['customerId'],
        where: {
          customer: {
            createdAt: { gte: cohort.cohort_month }
          },
          incomeDate: {
            gte: monthDate,
            lt: new Date(monthDate.setMonth(monthDate.getMonth() + 1))
          }
        },
        _count: true
      });

      cohortData.months.push({
        month: m,
        activeCount: activeCustomers.length,
        retentionRate: cohort.customers > 0 ? (activeCustomers.length / cohort.customers * 100).toFixed(2) : 0
      });
    }

    retention.push(cohortData);
  }

  res.json({
    success: true,
    data: retention
  });
}));

// ============================================
// VEHICLE ANALYTICS
// ============================================

/**
 * GET /api/analytics/vehicles/performance
 * Get vehicle performance metrics
 */
router.get('/vehicles/performance', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const where = {
    operationDate: {
      gte: startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
      lte: endDate ? new Date(endDate) : new Date()
    }
  };

  const vehicles = await prisma.vehicle.findMany({
    where: { status: 'ACTIVE' },
    include: {
      dailyOperations: {
        where,
        orderBy: { operationDate: 'asc' }
      },
      expenses: {
        where: {
          expenseDate: where.operationDate,
          expenseCategory: { in: ['FUEL', 'MAINTENANCE', 'REPAIRS'] }
        }
      }
    }
  });

  const performance = vehicles.map(vehicle => {
    const totalIncome = vehicle.dailyOperations.reduce((sum, op) => sum + op.income, 0);
    const totalDistance = vehicle.dailyOperations.reduce((sum, op) => sum + op.distanceCovered, 0);
    const totalExpenses = vehicle.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const operatingDays = vehicle.dailyOperations.length;

    return {
      vehicleId: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      model: vehicle.model,
      metrics: {
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        totalDistance,
        operatingDays,
        averageDailyIncome: operatingDays > 0 ? totalIncome / operatingDays : 0,
        averageDailyDistance: operatingDays > 0 ? totalDistance / operatingDays : 0,
        costPerKilometer: totalDistance > 0 ? totalExpenses / totalDistance : 0,
        revenuePerKilometer: totalDistance > 0 ? totalIncome / totalDistance : 0,
        profitMargin: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(2) : 0
      }
    };
  });

  performance.sort((a, b) => b.metrics.netProfit - a.metrics.netProfit);

  res.json({
    success: true,
    data: {
      vehicles: performance,
      summary: {
        totalVehicles: performance.length,
        totalIncome: performance.reduce((sum, v) => sum + v.metrics.totalIncome, 0),
        totalExpenses: performance.reduce((sum, v) => sum + v.metrics.totalExpenses, 0),
        totalProfit: performance.reduce((sum, v) => sum + v.metrics.netProfit, 0),
        averageProfitMargin: performance.reduce((sum, v) => sum + parseFloat(v.metrics.profitMargin), 0) / performance.length || 0
      }
    }
  });
}));

/**
 * GET /api/analytics/vehicles/maintenance
 * Get vehicle maintenance analytics
 */
router.get('/vehicles/maintenance', asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  const maintenanceExpenses = await prisma.expense.findMany({
    where: {
      expenseCategory: { in: ['MAINTENANCE', 'REPAIRS', 'TYRES', 'OIL_CHANGE', 'BRAKE_PADS', 'BATTERY'] },
      expenseDate: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31)
      },
      isDeleted: false
    },
    include: {
      vehicle: {
        select: {
          id: true,
          registrationNumber: true,
          model: true
        }
      }
    },
    orderBy: { amount: 'desc' }
  });

  // Group by vehicle
  const byVehicle = {};
  maintenanceExpenses.forEach(expense => {
    if (!expense.vehicle) return;
    const vehicleId = expense.vehicle.id;
    if (!byVehicle[vehicleId]) {
      byVehicle[vehicleId] = {
        vehicle: expense.vehicle,
        totalMaintenance: 0,
        count: 0,
        byType: {}
      };
    }
    byVehicle[vehicleId].totalMaintenance += expense.amount;
    byVehicle[vehicleId].count++;
    byVehicle[vehicleId].byType[expense.expenseCategory] = 
      (byVehicle[vehicleId].byType[expense.expenseCategory] || 0) + expense.amount;
  });

  // Get vehicle mileage
  const vehicleMileage = await prisma.$queryRaw`
    SELECT 
      v.id,
      MAX(d."closeOdometer") - MIN(d."openOdometer") as total_distance
    FROM "Vehicle" v
    JOIN "DailyOperation" d ON v.id = d."vehicleId"
    WHERE d."operationDate" BETWEEN ${new Date(year, 0, 1)} AND ${new Date(year, 11, 31)}
    GROUP BY v.id
  `;

  const mileageMap = Object.fromEntries(
    vehicleMileage.map(vm => [vm.id, parseInt(vm.total_distance) || 0])
  );

  const maintenanceCostPerKm = Object.values(byVehicle).map(v => ({
    ...v,
    totalDistance: mileageMap[v.vehicle.id] || 0,
    costPerKm: mileageMap[v.vehicle.id] > 0 
      ? v.totalMaintenance / mileageMap[v.vehicle.id] 
      : 0
  }));

  res.json({
    success: true,
    data: {
      byVehicle: maintenanceCostPerKm,
      totalMaintenance: maintenanceExpenses.reduce((sum, e) => sum + e.amount, 0),
      averagePerVehicle: Object.keys(byVehicle).length > 0
        ? maintenanceExpenses.reduce((sum, e) => sum + e.amount, 0) / Object.keys(byVehicle).length
        : 0,
      mostCommonIssues: await getMostCommonIssues(year)
    }
  });
}));

// ============================================
// PROFIT ANALYTICS
// ============================================

/**
 * GET /api/analytics/profit/summary
 * Get comprehensive profit analysis
 */
router.get('/profit/summary', asyncHandler(async (req, res) => {
  const { startDate, endDate, subsidiaryId, groupBy = 'month' } = req.query;

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  const where = {
    incomeDate: { gte: start, lte: end }
  };
  if (subsidiaryId) where.subsidiaryId = subsidiaryId;

  const [revenue, expenses, bySubsidiary, byVehicle, trends] = await Promise.all([
    prisma.incomeRecord.aggregate({
      where,
      _sum: { amount: true, netAmount: true }
    }),
    prisma.expense.aggregate({
      where: {
        expenseDate: { gte: start, lte: end },
        isDeleted: false,
        ...(subsidiaryId && { subsidiaryId })
      },
      _sum: { amount: true }
    }),
    getProfitBySubsidiary(start, end),
    getProfitByVehicle(start, end),
    getProfitTrends(start, end, groupBy)
  ]);

  const totalRevenue = revenue._sum.amount || 0;
  const totalExpenses = expenses._sum.amount || 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(2) : 0;

  res.json({
    success: true,
    data: {
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
        revenueAfterTax: revenue._sum.netAmount || 0,
        taxAmount: (revenue._sum.amount || 0) - (revenue._sum.netAmount || 0)
      },
      bySubsidiary,
      byVehicle,
      trends
    }
  });
}));

/**
 * GET /api/analytics/profit/contribution-margin
 * Get contribution margin by product/service
 */
router.get('/profit/contribution-margin', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  // Get revenue by income type
  const revenueByType = await prisma.incomeRecord.groupBy({
    by: ['incomeType', 'category'],
    where: { incomeDate: { gte: start, lte: end } },
    _sum: { amount: true }
  });

  // Get variable costs by category
  const variableCosts = await prisma.expense.groupBy({
    by: ['expenseCategory'],
    where: {
      expenseDate: { gte: start, lte: end },
      isDeleted: false,
      expenseCategory: {
        in: ['FUEL', 'MAINTENANCE', 'REPAIRS', 'DRIVER_ALLOWANCE', 'COMMISSIONS']
      }
    },
    _sum: { amount: true }
  });

  const totalVariableCosts = variableCosts.reduce((sum, c) => sum + (c._sum.amount || 0), 0);
  const totalRevenue = revenueByType.reduce((sum, r) => sum + (r._sum.amount || 0), 0);
  const contributionMargin = totalRevenue - totalVariableCosts;
  const contributionMarginRatio = totalRevenue > 0 ? (contributionMargin / totalRevenue * 100).toFixed(2) : 0;

  res.json({
    success: true,
    data: {
      summary: {
        totalRevenue,
        totalVariableCosts,
        contributionMargin,
        contributionMarginRatio
      },
      byRevenueType: revenueByType.map(r => ({
        type: r.incomeType,
        category: r.category,
        revenue: r._sum.amount || 0
      })),
      byCostType: variableCosts.map(c => ({
        category: c.expenseCategory,
        amount: c._sum.amount || 0
      }))
    }
  });
}));

// ============================================
// EMPLOYEE/PROJECT ANALYTICS
// ============================================

/**
 * GET /api/analytics/employees/performance
 * Get employee performance metrics (for construction/security staff)
 */
router.get('/employees/performance', authorize(['ADMIN', 'CEO', 'MANAGER']), asyncHandler(async (req, res) => {
  const { startDate, endDate, subsidiaryId } = req.query;

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  // This would need an Employee model, but for now using User
  const employees = await prisma.user.findMany({
    where: {
      role: { in: ['MANAGER', 'VIEWER'] },
      isActive: true
    },
    include: {
      createdIncome: {
        where: { incomeDate: { gte: start, lte: end } }
      },
      approvedExpenses: {
        where: { expenseDate: { gte: start, lte: end } }
      }
    }
  });

  const performance = employees.map(emp => ({
    employeeId: emp.id,
    name: emp.fullName,
    role: emp.role,
    metrics: {
      revenueGenerated: emp.createdIncome.reduce((sum, i) => sum + i.amount, 0),
      expensesApproved: emp.approvedExpenses.reduce((sum, e) => sum + e.amount, 0),
      transactionsCount: emp.createdIncome.length,
      approvalsCount: emp.approvedExpenses.length
    }
  }));

  res.json({
    success: true,
    data: performance.sort((a, b) => b.metrics.revenueGenerated - a.metrics.revenueGenerated)
  });
}));

// ============================================
// FORECASTING & PREDICTIONS
// ============================================

/**
 * GET /api/analytics/forecast/revenue
 * Get revenue forecast based on historical data
 */
router.get('/forecast/revenue', authorize(['ADMIN', 'CEO']), asyncHandler(async (req, res) => {
  const { months = 3 } = req.query;

  // Get last 12 months of data
  const historicalData = await getMonthlyRevenue(12);

  // Simple linear regression for forecasting
  const forecast = calculateRevenueForecast(historicalData, parseInt(months));

  res.json({
    success: true,
    data: {
      historical: historicalData,
      forecast,
      confidence: calculateForecastConfidence(historicalData)
    }
  });
}));

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getRevenueBySubsidiary(year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  const revenue = await prisma.incomeRecord.groupBy({
    by: ['subsidiaryId'],
    where: { incomeDate: { gte: startDate, lte: endDate } },
    _sum: { amount: true }
  });

  const subsidiaries = await prisma.subsidiary.findMany();

  return revenue.map(r => ({
    subsidiaryId: r.subsidiaryId,
    subsidiaryName: subsidiaries.find(s => s.id === r.subsidiaryId)?.name || 'Unknown',
    amount: r._sum.amount || 0
  }));
}

async function getExpenseByCategory(year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  const expenses = await prisma.expense.groupBy({
    by: ['expenseCategory'],
    where: {
      expenseDate: { gte: startDate, lte: endDate },
      isDeleted: false
    },
    _sum: { amount: true }
  });

  const categories = getExpenseCategoryDefinitions();

  // Group by main category
  const result = {};
  expenses.forEach(e => {
    const mainCategory = categories.mainCategories.find(
      mc => mc.categories.includes(e.expenseCategory)
    )?.name || 'OTHER';
    
    if (!result[mainCategory]) {
      result[mainCategory] = {
        mainCategory,
        total: 0,
        subCategories: []
      };
    }
    result[mainCategory].total += e._sum.amount || 0;
    result[mainCategory].subCategories.push({
      category: e.expenseCategory,
      amount: e._sum.amount || 0
    });
  });

  return Object.values(result);
}

async function getMonthlyTrends(year) {
  const monthlyData = [];

  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [revenue, expenses] = await Promise.all([
      prisma.incomeRecord.aggregate({
        where: { incomeDate: { gte: startDate, lte: endDate } },
        _sum: { amount: true }
      }),
      prisma.expense.aggregate({
        where: {
          expenseDate: { gte: startDate, lte: endDate },
          isDeleted: false
        },
        _sum: { amount: true }
      })
    ]);

    const totalRevenue = revenue._sum.amount || 0;
    const totalExpenses = expenses._sum.amount || 0;

    monthlyData.push({
      month,
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit: totalRevenue - totalExpenses,
      margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(2) : 0
    });
  }

  return monthlyData;
}

async function getCustomerAcquisition(year) {
  const monthlyAcquisition = [];

  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [newCustomers, activeCustomers] = await Promise.all([
      prisma.customer.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      prisma.customer.count({
        where: {
          createdAt: { lte: endDate },
          status: 'ACTIVE'
        }
      })
    ]);

    monthlyAcquisition.push({
      month,
      newCustomers,
      totalCustomers: activeCustomers
    });
  }

  return monthlyAcquisition;
}

async function getVehicleUtilization(year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  const vehicles = await prisma.vehicle.findMany({
    where: { status: 'ACTIVE' },
    include: {
      dailyOperations: {
        where: { operationDate: { gte: startDate, lte: endDate } }
      }
    }
  });

  const totalDays = 365; // Approximate

  return vehicles.map(v => ({
    vehicleId: v.id,
    registrationNumber: v.registrationNumber,
    operatingDays: v.dailyOperations.length,
    utilizationRate: (v.dailyOperations.length / totalDays * 100).toFixed(2),
    totalDistance: v.dailyOperations.reduce((sum, op) => sum + op.distanceCovered, 0)
  }));
}

async function getTopCustomers(limit) {
  const customers = await prisma.customer.findMany({
    where: { status: 'ACTIVE' },
    include: {
      incomeRecords: {
        select: { amount: true }
      }
    },
    take: limit
  });

  return customers.map(c => ({
    id: c.id,
    name: c.companyName || `${c.firstName} ${c.lastName}`,
    totalRevenue: c.incomeRecords.reduce((sum, i) => sum + i.amount, 0),
    transactionCount: c.incomeRecords.length
  })).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

async function getTopVendors(limit) {
  const vendors = await prisma.expense.groupBy({
    by: ['vendorName'],
    where: {
      vendorName: { not: null },
      isDeleted: false
    },
    _sum: { amount: true },
    _count: true,
    orderBy: { _sum: { amount: 'desc' } },
    take: limit
  });

  return vendors.map(v => ({
    name: v.vendorName,
    totalSpent: v._sum.amount || 0,
    transactionCount: v._count
  }));
}

async function getCashFlow(year) {
  const monthlyCashFlow = [];

  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [inflow, outflow] = await Promise.all([
      prisma.incomeRecord.aggregate({
        where: { incomeDate: { gte: startDate, lte: endDate } },
        _sum: { amount: true }
      }),
      prisma.expense.aggregate({
        where: {
          expenseDate: { gte: startDate, lte: endDate },
          isDeleted: false
        },
        _sum: { amount: true }
      })
    ]);

    monthlyCashFlow.push({
      month,
      inflow: inflow._sum.amount || 0,
      outflow: outflow._sum.amount || 0,
      net: (inflow._sum.amount || 0) - (outflow._sum.amount || 0)
    });
  }

  return monthlyCashFlow;
}

async function getRevenueTrends(where, groupBy) {
  let groupByClause;
  switch (groupBy) {
    case 'day':
      groupByClause = 'DATE("incomeDate")';
      break;
    case 'week':
      groupByClause = 'DATE_TRUNC(\'week\', "incomeDate")';
      break;
    case 'month':
      groupByClause = 'DATE_TRUNC(\'month\', "incomeDate")';
      break;
    case 'quarter':
      groupByClause = 'DATE_TRUNC(\'quarter\', "incomeDate")';
      break;
    default:
      groupByClause = 'DATE("incomeDate")';
  }

  const trends = await prisma.$queryRawUnsafe(`
    SELECT 
      ${groupByClause} as period,
      COUNT(*) as transaction_count,
      SUM(amount) as total_amount,
      SUM("netAmount") as net_amount,
      AVG(amount) as avg_amount
    FROM "IncomeRecord"
    WHERE "incomeDate" BETWEEN $1 AND $2
    GROUP BY period
    ORDER BY period
  `, where.incomeDate.gte, where.incomeDate.lte);

  return trends;
}

async function getExpenseTrends(where, groupBy) {
  let groupByClause;
  switch (groupBy) {
    case 'day':
      groupByClause = 'DATE("expenseDate")';
      break;
    case 'week':
      groupByClause = 'DATE_TRUNC(\'week\', "expenseDate")';
      break;
    case 'month':
      groupByClause = 'DATE_TRUNC(\'month\', "expenseDate")';
      break;
    case 'quarter':
      groupByClause = 'DATE_TRUNC(\'quarter\', "expenseDate")';
      break;
    default:
      groupByClause = 'DATE("expenseDate")';
  }

  const trends = await prisma.$queryRawUnsafe(`
    SELECT 
      ${groupByClause} as period,
      COUNT(*) as transaction_count,
      SUM(amount) as total_amount,
      SUM("taxAmount") as tax_amount,
      AVG(amount) as avg_amount
    FROM "Expense"
    WHERE "expenseDate" BETWEEN $1 AND $2
      AND "isDeleted" = false
    GROUP BY period
    ORDER BY period
  `, where.expenseDate.gte, where.expenseDate.lte);

  return trends;
}

async function getProfitBySubsidiary(startDate, endDate) {
  const subsidiaries = await prisma.subsidiary.findMany();

  const profits = await Promise.all(
    subsidiaries.map(async sub => {
      const [revenue, expenses] = await Promise.all([
        prisma.incomeRecord.aggregate({
          where: {
            subsidiaryId: sub.id,
            incomeDate: { gte: startDate, lte: endDate }
          },
          _sum: { amount: true }
        }),
        prisma.expense.aggregate({
          where: {
            subsidiaryId: sub.id,
            expenseDate: { gte: startDate, lte: endDate },
            isDeleted: false
          },
          _sum: { amount: true }
        })
      ]);

      const totalRevenue = revenue._sum.amount || 0;
      const totalExpenses = expenses._sum.amount || 0;

      return {
        subsidiaryId: sub.id,
        subsidiaryName: sub.name,
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
        margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(2) : 0
      };
    })
  );

  return profits.sort((a, b) => b.profit - a.profit);
}

async function getProfitByVehicle(startDate, endDate) {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: 'ACTIVE' }
  });

  const profits = await Promise.all(
    vehicles.map(async vehicle => {
      const [revenue, expenses] = await Promise.all([
        prisma.incomeRecord.aggregate({
          where: {
            vehicleId: vehicle.id,
            incomeDate: { gte: startDate, lte: endDate }
          },
          _sum: { amount: true }
        }),
        prisma.expense.aggregate({
          where: {
            vehicleId: vehicle.id,
            expenseDate: { gte: startDate, lte: endDate },
            isDeleted: false
          },
          _sum: { amount: true }
        })
      ]);

      const totalRevenue = revenue._sum.amount || 0;
      const totalExpenses = expenses._sum.amount || 0;

      return {
        vehicleId: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        model: vehicle.model,
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
        margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(2) : 0
      };
    })
  );

  return profits.sort((a, b) => b.profit - a.profit);
}

async function getProfitTrends(startDate, endDate, groupBy) {
  const monthlyProfits = [];

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    let nextDate;
    switch (groupBy) {
      case 'day':
        nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'week':
        nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'month':
        nextDate = new Date(currentDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      default:
        nextDate = new Date(currentDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
    }

    const [revenue, expenses] = await Promise.all([
      prisma.incomeRecord.aggregate({
        where: {
          incomeDate: { gte: currentDate, lt: nextDate }
        },
        _sum: { amount: true }
      }),
      prisma.expense.aggregate({
        where: {
          expenseDate: { gte: currentDate, lt: nextDate },
          isDeleted: false
        },
        _sum: { amount: true }
      })
    ]);

    const totalRevenue = revenue._sum.amount || 0;
    const totalExpenses = expenses._sum.amount || 0;

    monthlyProfits.push({
      period: currentDate.toISOString(),
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit: totalRevenue - totalExpenses
    });

    currentDate = nextDate;
  }

  return monthlyProfits;
}

async function getMonthlyRevenue(months) {
  const monthlyData = [];
  const now = new Date();

  for (let i = months; i > 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const revenue = await prisma.incomeRecord.aggregate({
      where: { incomeDate: { gte: startDate, lte: endDate } },
      _sum: { amount: true }
    });

    monthlyData.push({
      month: startDate.toISOString().slice(0, 7),
      revenue: revenue._sum.amount || 0
    });
  }

  return monthlyData;
}

function calculateRevenueForecast(historicalData, months) {
  // Simple linear regression
  const n = historicalData.length;
  const x = Array.from({ length: n }, (_, i) => i + 1);
  const y = historicalData.map(d => d.revenue);

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const forecast = [];
  for (let i = 1; i <= months; i++) {
    const nextMonth = n + i;
    forecast.push({
      month: `Month ${nextMonth}`,
      forecasted: Math.max(0, slope * nextMonth + intercept)
    });
  }

  return forecast;
}

function calculateForecastConfidence(historicalData) {
  // Simple confidence calculation based on variance
  if (historicalData.length < 2) return 50;

  const revenues = historicalData.map(d => d.revenue);
  const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  const variance = revenues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / revenues.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean; // Coefficient of variation

  // Lower CV means higher confidence
  const confidence = Math.max(0, Math.min(100, 100 - cv * 100));
  return Math.round(confidence);
}

function getExpenseCategoryDefinitions() {
  return {
    mainCategories: [
      { name: 'OPERATIONAL', categories: ['FUEL', 'MAINTENANCE', 'REPAIRS', 'TYRES', 'INSURANCE', 'ROAD_TOLLS', 'PARKING', 'DRIVER_ALLOWANCE'] },
      { name: 'ADMINISTRATIVE', categories: ['SALARIES', 'RENT', 'UTILITIES', 'OFFICE_SUPPLIES', 'COMMUNICATION', 'INTERNET', 'LEGAL', 'ACCOUNTING'] },
      { name: 'MARKETING', categories: ['ADVERTISING', 'PROMOTIONS', 'WEBSITE', 'SOCIAL_MEDIA'] },
      { name: 'CAPITAL', categories: ['VEHICLE_PURCHASE', 'EQUIPMENT', 'FURNITURE', 'COMPUTER', 'SOFTWARE'] },
      { name: 'SECURITY', categories: ['UNIFORMS', 'EQUIPMENT_MAINTENANCE', 'TRAINING', 'LICENSES', 'CCTV_CAMERAS', 'SECURITY_GEAR'] },
      { name: 'CONSTRUCTION', categories: ['MATERIALS', 'EQUIPMENT_RENTAL', 'SUBCONTRACTORS', 'PERMITS', 'SAFETY_GEAR'] }
    ],
    allCategories: [
      'FUEL', 'MAINTENANCE', 'REPAIRS', 'TYRES', 'INSURANCE', 'ROAD_TOLLS', 'PARKING', 'DRIVER_ALLOWANCE',
      'SALARIES', 'RENT', 'UTILITIES', 'OFFICE_SUPPLIES', 'COMMUNICATION', 'INTERNET', 'LEGAL', 'ACCOUNTING',
      'ADVERTISING', 'PROMOTIONS', 'WEBSITE', 'SOCIAL_MEDIA',
      'VEHICLE_PURCHASE', 'EQUIPMENT', 'FURNITURE', 'COMPUTER', 'SOFTWARE',
      'UNIFORMS', 'EQUIPMENT_MAINTENANCE', 'TRAINING', 'LICENSES', 'CCTV_CAMERAS', 'SECURITY_GEAR',
      'MATERIALS', 'EQUIPMENT_RENTAL', 'SUBCONTRACTORS', 'PERMITS', 'SAFETY_GEAR'
    ]
  };
}

async function getMostCommonIssues(year) {
  const issues = await prisma.expense.groupBy({
    by: ['expenseCategory', 'description'],
    where: {
      expenseCategory: { in: ['MAINTENANCE', 'REPAIRS'] },
      expenseDate: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31)
      },
      isDeleted: false
    },
    _count: true,
    _sum: { amount: true },
    orderBy: { _count: 'desc' },
    take: 10
  });

  return issues.map(i => ({
    issue: i.description || i.expenseCategory,
    category: i.expenseCategory,
    count: i._count,
    totalCost: i._sum.amount || 0
  }));
}

function getMonthsInPeriod(period, startDate, endDate) {
  const months = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  while (start <= end) {
    months.push(start.getMonth() + 1);
    start.setMonth(start.getMonth() + 1);
  }

  return months;
}

export default router;
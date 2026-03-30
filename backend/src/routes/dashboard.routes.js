import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../config/database.js';
import { cacheMiddleware } from '../middleware/cache.middleware.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/dashboard/executive
 * Executive dashboard with high-level KPIs (for CEO)
 */
router.get('/executive', authorize(['ADMIN', 'CEO']), cacheMiddleware(300), asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    monthlyRevenue,
    yearlyRevenue,
    monthlyExpenses,
    yearlyExpenses,
    activeVehicles,
    activeCustomers,
    pendingInvoices,
    revenueBySubsidiary
  ] = await Promise.all([
    prisma.incomeRecord.aggregate({
      where: { incomeDate: { gte: startOfMonth } },
      _sum: { amount: true }
    }),
    prisma.incomeRecord.aggregate({
      where: { incomeDate: { gte: startOfYear } },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: {
        expenseDate: { gte: startOfMonth },
        isDeleted: false
      },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: {
        expenseDate: { gte: startOfYear },
        isDeleted: false
      },
      _sum: { amount: true }
    }),
    prisma.vehicle.count({ where: { status: 'ACTIVE' } }),
    prisma.customer.count({ where: { status: 'ACTIVE' } }),
    prisma.invoice.count({ where: { status: 'PENDING' } }),
    prisma.incomeRecord.groupBy({
      by: ['subsidiaryId'],
      where: { incomeDate: { gte: startOfMonth } },
      _sum: { amount: true }
    })
  ]);

  res.json({
    success: true,
    data: {
      financial: {
        monthlyRevenue: monthlyRevenue._sum.amount || 0,
        yearlyRevenue: yearlyRevenue._sum.amount || 0,
        monthlyExpenses: monthlyExpenses._sum.amount || 0,
        yearlyExpenses: yearlyExpenses._sum.amount || 0,
        monthlyProfit: (monthlyRevenue._sum.amount || 0) - (monthlyExpenses._sum.amount || 0),
        yearlyProfit: (yearlyRevenue._sum.amount || 0) - (yearlyExpenses._sum.amount || 0)
      },
      operational: {
        activeVehicles,
        activeCustomers,
        pendingInvoices
      },
      bySubsidiary: revenueBySubsidiary
    }
  });
}));

/**
 * GET /api/dashboard/manager
 * Manager dashboard (for department/subsidiary managers)
 */
router.get('/manager', authorize(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const user = req.user;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // If user has specific subsidiary access
  const subsidiaryFilter = user.subsidiaryAccess?.length > 0
    ? { subsidiaryId: { in: user.subsidiaryAccess } }
    : {};

  const [teamMembers, recentOperations, pendingApprovals] = await Promise.all([
    prisma.user.count({
      where: {
        subsidiaryAccess: { hasSome: user.subsidiaryAccess },
        isActive: true
      }
    }),
    prisma.dailyOperation.findMany({
      where: {
        ...subsidiaryFilter,
        operationDate: { gte: startOfMonth }
      },
      include: { vehicle: true },
      orderBy: { operationDate: 'desc' },
      take: 10
    }),
    prisma.expense.count({
      where: {
        ...subsidiaryFilter,
        approvalStatus: 'PENDING'
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      teamMembers,
      pendingApprovals,
      recentOperations
    }
  });
}));

export default router;
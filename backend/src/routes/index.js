import express from 'express';
import authRoutes from './auth.routes.js';
import customerRoutes from './customer.routes.js';
import incomeRoutes from './income.routes.js';
import expenseRoutes from './expense.routes.js';
import vehicleRoutes from './vehicle.routes.js';
import subsidiaryRoutes from './subsidiary.routes.js';
import reportRoutes from './report.routes.js';
import adminRoutes from './admin.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/income', incomeRoutes);
router.use('/expenses', expenseRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/subsidiaries', subsidiaryRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
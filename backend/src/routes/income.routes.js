import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { IncomeController } from '../controllers/income.controller.js';

const router = express.Router();
const incomeController = new IncomeController();

// All routes require authentication
router.use(authenticate);

// Income CRUD
router.post('/', authorize(['ADMIN', 'MANAGER', 'ACCOUNTANT']), incomeController.recordIncome);
router.get('/', incomeController.getIncomes);
router.get('/analytics', authorize(['ADMIN', 'CEO', 'ACCOUNTANT']), incomeController.getIncomeAnalytics);
router.get('/outstanding', authorize(['ADMIN', 'CEO', 'ACCOUNTANT']), incomeController.getOutstandingInvoices);
router.get('/:id', incomeController.getIncomeById);
router.get('/:id/invoice', authorize(['ADMIN', 'CEO', 'ACCOUNTANT', 'MANAGER']), incomeController.getIncomeInvoice);
router.put('/:id', authorize(['ADMIN', 'MANAGER', 'ACCOUNTANT']), incomeController.updateIncome);
router.delete('/:id', authorize(['ADMIN']), incomeController.deleteIncome);
router.post('/:id/mark-paid', authorize(['ADMIN', 'ACCOUNTANT']), incomeController.markAsPaid);

export default router;
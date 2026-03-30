import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { ExpenseController } from '../controllers/expense.controller.js';
import { upload } from '../middleware/upload.middleware.js';

const router = express.Router();
const expenseController = new ExpenseController();

// All routes require authentication
router.use(authenticate);

// Public expense routes (authenticated users)
router.get('/', expenseController.getExpenses);
router.get('/categories', expenseController.getExpenseCategories);
router.get('/analytics', authorize(['ADMIN', 'CEO', 'ACCOUNTANT', 'SUPER_ADMIN']), expenseController.getExpenseAnalytics);
router.get('/stats', authorize(['ADMIN', 'CEO', 'ACCOUNTANT', 'SUPER_ADMIN']), expenseController.getExpenseStats);
router.get('/monthly-comparison', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), expenseController.getMonthlyComparison);
router.get('/pending-approvals', authorize(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'SUPER_ADMIN']), expenseController.getPendingApprovals);
router.get('/trash', authorize(['ADMIN', 'SUPER_ADMIN']), expenseController.getTrashedExpenses);
router.get('/:id', expenseController.getExpenseById);

// Expense creation and modification
router.post('/', 
  authorize(['ADMIN', 'MANAGER', 'ACCOUNTANT']), 
  upload.fields([
    { name: 'receipt', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
  ]), 
  expenseController.createExpense
);

router.post('/bulk', 
  authorize(['ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN']), 
  expenseController.bulkCreateExpenses
);

router.put('/:id', 
  authorize(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN']), 
  upload.fields([
    { name: 'receipt', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
  ]),
  expenseController.updateExpense
);

router.get('/modifications/pending',
  authorize(['CEO', 'SUPER_ADMIN']),
  expenseController.getPendingModificationRequests
);

router.get('/modifications/history',
  authorize(['CEO', 'SUPER_ADMIN']),
  expenseController.getExpenseModificationHistory
);

router.post('/modifications/:requestId/approve',
  authorize(['CEO', 'SUPER_ADMIN']),
  expenseController.approveExpenseModification
);

// Approval routes
router.put('/:id/approve', 
  authorize(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN']), 
  expenseController.approveExpense
);

router.put('/:id/reject', 
  authorize(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN']), 
  expenseController.rejectExpense
);

router.put('/:id/complete',
  authorize(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN']),
  upload.fields([
    { name: 'receipt', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
  ]),
  expenseController.completeExpense
);

// Payment routes
router.put('/:id/mark-paid', 
  authorize(['ADMIN', 'ACCOUNTANT']), 
  expenseController.markAsPaid
);

// Delete/Restore routes
router.delete('/:id', 
  authorize(['ADMIN', 'SUPER_ADMIN']), 
  expenseController.deleteExpense
);

router.put('/:id/restore', 
  authorize(['ADMIN', 'SUPER_ADMIN']), 
  expenseController.restoreExpense
);

export default router;
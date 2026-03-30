import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { CustomerController } from '../controllers/customer.controller.js';

const router = express.Router();
const customerController = new CustomerController();

// All routes require authentication
router.use(authenticate);

// Customer CRUD
router.post('/', authorize(['ADMIN', 'MANAGER']), customerController.createCustomer);
router.get('/', customerController.getAllCustomers);
router.get('/report', authorize(['ADMIN', 'CEO', 'ACCOUNTANT']), customerController.getCustomerReport);
router.get('/with-income', authorize(['ADMIN', 'CEO', 'ACCOUNTANT']), customerController.getCustomersWithIncome);
router.get('/without-income', authorize(['ADMIN', 'CEO', 'ACCOUNTANT']), customerController.getCustomersWithoutIncome);
router.get('/top', authorize(['ADMIN', 'CEO']), customerController.getTopCustomers);
router.get('/:id', customerController.getCustomer);
router.put('/:id', authorize(['ADMIN', 'MANAGER']), customerController.updateCustomer);
router.delete('/:id', authorize(['ADMIN']), customerController.deleteCustomer);

export default router;
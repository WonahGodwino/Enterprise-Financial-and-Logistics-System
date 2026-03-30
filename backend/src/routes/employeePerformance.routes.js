import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { EmployeePerformanceController } from '../controllers/employeePerformance.controller.js';
import multer from 'multer';

const router = express.Router();
const controller = new EmployeePerformanceController();

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/temp/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// All routes require authentication
router.use(authenticate);

// ============================================
// EMPLOYEE ROUTES
// ============================================

/**
 * POST /api/performance/reports/upload
 * Upload weekly report (employees)
 */
router.post(
  '/reports/upload',
  upload.single('report'),
  controller.uploadWeeklyReport
);

/**
 * GET /api/performance/employee/:userId
 * Get employee performance dashboard
 */
router.get(
  '/employee/:userId',
  controller.getEmployeeDashboard
);

/**
 * GET /api/performance/employee/:userId/reports
 * Get employee's weekly reports
 */
router.get(
  '/employee/:userId/reports',
  controller.getEmployeeReports
);

// ============================================
// MANAGER ROUTES
// ============================================

/**
 * GET /api/performance/manager/dashboard
 * Get manager dashboard with team performance
 */
router.get(
  '/manager/dashboard',
  authorize(['MANAGER', 'ADMIN', 'CEO']),
  controller.getManagerDashboard
);

/**
 * PUT /api/performance/reports/:reportId/review
 * Review weekly report (managers)
 */
router.put(
  '/reports/:reportId/review',
  authorize(['MANAGER', 'ADMIN', 'CEO']),
  controller.reviewWeeklyReport
);

/**
 * POST /api/performance/job-description/:userId
 * Upload job description for employee
 */
router.post(
  '/job-description/:userId',
  authorize(['ADMIN', 'CEO', 'MANAGER']),
  controller.uploadJobDescription
);

// ============================================
// ADMIN/CEO ROUTES
// ============================================

/**
 * GET /api/performance/organization
 * Get organization-wide performance stats
 */
router.get(
  '/organization',
  authorize(['ADMIN', 'CEO']),
  controller.getOrganizationPerformance
);

/**
 * GET /api/performance/reports/:reportId/download
 * Download original report file
 */
router.get(
  '/reports/:reportId/download',
  controller.downloadReport
);

export default router;
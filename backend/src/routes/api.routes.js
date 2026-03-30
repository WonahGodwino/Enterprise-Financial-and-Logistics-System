import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { apiLimiter } from '../middleware/rateLimiter.middleware.js';
import { upload } from '../middleware/upload.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import cacheManager, { cacheMiddleware } from '../middleware/cache.middleware.js';
import prisma from '../config/database.js';

// Import controllers
import AuthControllerModule from '../controllers/auth.controller.js';
import ExpenseControllerModule from '../controllers/expense.controller.js';
import OperationControllerModule from '../controllers/operation.controller.js';
import ProfitControllerModule from '../controllers/profit.controller.js';
import ReportControllerModule from '../controllers/report.controller.js';
import DashboardControllerModule from '../controllers/dashboard.controller.js';
import AdminControllerModule from '../controllers/admin.controller.js';
import { IncomeController } from '../controllers/income.controller.js';
import { CustomerController } from '../controllers/customer.controller.js';

const router = express.Router();

// Initialize controllers (support default export as class or instance)
const authController = (typeof AuthControllerModule === 'function') ? new AuthControllerModule() : AuthControllerModule;
const expenseController = (typeof ExpenseControllerModule === 'function') ? new ExpenseControllerModule() : ExpenseControllerModule;
const operationController = (typeof OperationControllerModule === 'function') ? new OperationControllerModule() : OperationControllerModule;
const profitController = (typeof ProfitControllerModule === 'function') ? new ProfitControllerModule() : ProfitControllerModule;
const reportController = (typeof ReportControllerModule === 'function') ? new ReportControllerModule() : ReportControllerModule;
const dashboardController = (typeof DashboardControllerModule === 'function') ? new DashboardControllerModule() : DashboardControllerModule;
const adminController = (typeof AdminControllerModule === 'function') ? new AdminControllerModule() : AdminControllerModule;
const incomeController = new IncomeController();
const customerController = new CustomerController();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../../');
const logoDirectory = path.join(backendRoot, 'uploads', 'images');
const logoExtensions = ['.png', '.jpg', '.jpeg', '.webp'];

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
};

const resolveMainLogoFilePath = () => {
  for (const ext of logoExtensions) {
    const candidate = path.join(logoDirectory, `logo${ext}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const buildMainLogoUrl = (req) => {
  const logoPath = resolveMainLogoFilePath();
  if (!logoPath) return null;

  let stamp = Date.now();
  try {
    stamp = Math.floor(fs.statSync(logoPath).mtimeMs);
  } catch (_error) {
    stamp = Date.now();
  }

  return `${req.baseUrl}/subsidiaries/main/logo?v=${stamp}`;
};

const persistMainCompanyLogo = (file) => {
  if (!file) return null;

  fs.mkdirSync(logoDirectory, { recursive: true });

  const extFromOriginal = path.extname(file.originalname || '').toLowerCase();
  const extFromMime = file.mimetype === 'image/png'
    ? '.png'
    : file.mimetype === 'image/jpeg'
      ? '.jpg'
      : file.mimetype === 'image/webp'
        ? '.webp'
        : '.png';

  const extension = logoExtensions.includes(extFromOriginal) ? extFromOriginal : extFromMime;
  const targetPath = path.join(logoDirectory, `logo${extension}`);

  logoExtensions.forEach((candidateExt) => {
    const candidatePath = path.join(logoDirectory, `logo${candidateExt}`);
    if (candidatePath !== targetPath && fs.existsSync(candidatePath)) {
      fs.unlinkSync(candidatePath);
    }
  });

  const sourcePath = path.isAbsolute(file.path) ? file.path : path.resolve(file.path);
  fs.copyFileSync(sourcePath, targetPath);

  if (sourcePath !== targetPath && fs.existsSync(sourcePath)) {
    fs.unlinkSync(sourcePath);
  }

  return targetPath;
};

const resolveMainLocation = async (excludeId = null) => {
  const mainByCode = await prisma.subsidiary.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      code: { equals: 'MAIN', mode: 'insensitive' },
    },
    select: {
      country: true,
      state: true,
      city: true,
      postalCode: true,
      address: true,
    },
  });

  if (mainByCode) return mainByCode;

  return prisma.subsidiary.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      isActive: true,
      OR: [
        { address: { not: null } },
        { city: { not: null } },
        { state: { not: null } },
        { postalCode: { not: null } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      country: true,
      state: true,
      city: true,
      postalCode: true,
      address: true,
    },
  });
};

const isMainSubsidiaryCode = (code) => String(code || '').trim().toUpperCase() === 'MAIN';

const parseAuditJson = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
};

// Public routes
router.post('/auth/login', apiLimiter, authController.login);
router.post('/auth/refresh-token', authController.refreshToken);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);
router.post('/auth/change-password', authController.changePassword);

// Protected routes
router.use(authenticate);

router.post('/auth/logout', authController.logout);

// Protected auth routes (Admin, CEO, HR)
router.get('/auth/profile', authorize(['ADMIN', 'CEO', 'HR']), authController.getProfile);
router.put('/auth/profile', authorize(['ADMIN', 'CEO', 'HR']), authController.updateProfile);

// Notification routes
router.get('/notifications', asyncHandler(async (req, res) => {
  const rows = await prisma.auditLog.findMany({
    where: {
      userId: req.user.id,
      entity: 'NOTIFICATION',
      action: 'NOTIFICATION',
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const data = rows.map((row) => {
    const payload = parseAuditJson(row.newValue);
    return {
      id: row.id,
      title: payload.title || 'Notification',
      message: payload.message || 'You have a new update.',
      type: payload.type || 'INFO',
      category: payload.category || 'system',
      read: Boolean(payload.read),
      data: payload.data || null,
      createdAt: row.createdAt,
    };
  });

  res.status(200).json({
    success: true,
    data,
  });
}));

router.patch('/notifications/:id/read', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const row = await prisma.auditLog.findFirst({
    where: {
      id,
      userId: req.user.id,
      entity: 'NOTIFICATION',
      action: 'NOTIFICATION',
    },
  });

  if (!row) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }

  const payload = parseAuditJson(row.newValue);
  payload.read = true;
  payload.readAt = new Date().toISOString();

  await prisma.auditLog.update({
    where: { id },
    data: { newValue: payload },
  });

  res.status(200).json({ success: true, message: 'Notification marked as read' });
}));

router.patch('/notifications/read-all', asyncHandler(async (req, res) => {
  const rows = await prisma.auditLog.findMany({
    where: {
      userId: req.user.id,
      entity: 'NOTIFICATION',
      action: 'NOTIFICATION',
    },
    select: { id: true, newValue: true },
    take: 200,
  });

  await Promise.all(rows.map((row) => {
    const payload = parseAuditJson(row.newValue);
    if (payload.read) return Promise.resolve();
    return prisma.auditLog.update({
      where: { id: row.id },
      data: {
        newValue: {
          ...payload,
          read: true,
          readAt: new Date().toISOString(),
        },
      },
    });
  }));

  res.status(200).json({ success: true, message: 'All notifications marked as read' });
}));

router.delete('/notifications/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const row = await prisma.auditLog.findFirst({
    where: {
      id,
      userId: req.user.id,
      entity: 'NOTIFICATION',
      action: 'NOTIFICATION',
    },
    select: { id: true },
  });

  if (!row) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }

  await prisma.auditLog.delete({ where: { id } });
  res.status(200).json({ success: true, message: 'Notification deleted' });
}));

router.delete('/notifications/read', asyncHandler(async (req, res) => {
  const rows = await prisma.auditLog.findMany({
    where: {
      userId: req.user.id,
      entity: 'NOTIFICATION',
      action: 'NOTIFICATION',
    },
    select: { id: true, newValue: true },
    take: 500,
  });

  const readIds = rows
    .filter((row) => Boolean(parseAuditJson(row.newValue).read))
    .map((row) => row.id);

  if (readIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { id: { in: readIds } } });
  }

  res.status(200).json({ success: true, message: 'Read notifications cleared' });
}));

// Subsidiaries routes
router.get('/subsidiaries', authorize(['DRIVER', 'CHIEF_DRIVER', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN']), asyncHandler(async (req, res) => {
  const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
  const currentRole = String(req.user?.role || '').toUpperCase();

  const where = includeInactive ? {} : { isActive: true };
  if (currentRole === 'CHIEF_DRIVER' || currentRole === 'DRIVER') {
    const scopedIds = [
      req.user?.subsidiaryId,
      ...(Array.isArray(req.user?.subsidiaryAccess) ? req.user.subsidiaryAccess : []),
    ].filter(Boolean);

    const uniqueScopedIds = [...new Set(scopedIds)];
    where.id = uniqueScopedIds.length > 0 ? { in: uniqueScopedIds } : '__no_subsidiary_match__';
  }

  const subsidiaries = await prisma.subsidiary.findMany({
    where,
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      country: true,
      state: true,
      city: true,
      postalCode: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      sameAsMainLocation: true,
      isActive: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  const mainLogoUrl = buildMainLogoUrl(req);

  const data = subsidiaries.map((subsidiary) => ({
    ...subsidiary,
    status: subsidiary.isActive ? 'active' : 'inactive',
    logoUrl: String(subsidiary.code || '').toUpperCase() === 'MAIN' ? mainLogoUrl : null,
  }));

  res.status(200).json({
    success: true,
    data,
  });
}));

router.get('/subsidiaries/main/logo', authorize(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN']), asyncHandler(async (req, res) => {
  const logoPath = resolveMainLogoFilePath();
  if (!logoPath) {
    return res.status(404).json({
      success: false,
      message: 'Main company logo not found',
    });
  }

  return res.sendFile(logoPath);
}));

router.post('/subsidiaries', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), upload.single('logo'), asyncHandler(async (req, res) => {
  const {
    name,
    code,
    description,
    status,
    isActive,
    country,
    state,
    city,
    address,
    postalCode,
    phone,
    email,
    website,
    sameAsMainLocation,
  } = req.body || {};

  const trimmedName = String(name || '').trim();
  const normalizedCode = String(code || '').trim().toUpperCase();

  if (!trimmedName || !normalizedCode) {
    return res.status(400).json({
      success: false,
      message: 'Name and code are required',
    });
  }

  const existing = await prisma.subsidiary.findFirst({
    where: {
      OR: [
        { name: { equals: trimmedName, mode: 'insensitive' } },
        { code: { equals: normalizedCode, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'A subsidiary with the same name or code already exists',
    });
  }

  const trimmedDescription = String(description || '').trim();
  const useMainLocation = parseBoolean(sameAsMainLocation, false);
  const isMainCode = isMainSubsidiaryCode(normalizedCode);
  let nextSameAsMainLocation = useMainLocation;

  if (req.file && !isMainCode) {
    return res.status(400).json({
      success: false,
      message: 'Logo upload is only supported for Main Company registration.',
    });
  }

  let trimmedCountry = String(country || '').trim() || 'Nigeria';
  let trimmedState = String(state || '').trim() || null;
  let trimmedCity = String(city || '').trim() || null;
  let trimmedPostalCode = String(postalCode || '').trim() || null;
  let trimmedAddress = String(address || '').trim() || null;
  const trimmedPhone = String(phone || '').trim() || null;
  const trimmedEmail = String(email || '').trim() || null;
  const trimmedWebsite = String(website || '').trim() || null;

  if (useMainLocation) {
    const mainLocation = await resolveMainLocation();

    if (!mainLocation) {
      if (isMainCode) {
        // First MAIN setup cannot copy from itself; keep submitted location values.
        nextSameAsMainLocation = false;
      } else {
        return res.status(400).json({
          success: false,
          message: 'No main location found yet. Create/update the main subsidiary location first.',
        });
      }
    } else {
      trimmedCountry = String(mainLocation.country || 'Nigeria').trim();
      trimmedState = mainLocation.state || null;
      trimmedCity = mainLocation.city || null;
      trimmedPostalCode = mainLocation.postalCode || null;
      trimmedAddress = mainLocation.address || null;
    }
  }

  const activeFromStatus = String(status || '').toLowerCase() !== 'inactive';
  const hasExplicitActive = !(isActive === undefined || isActive === null || isActive === '');
  const nextIsActive = hasExplicitActive ? parseBoolean(isActive, activeFromStatus) : activeFromStatus;

  const subsidiary = await prisma.subsidiary.create({
    data: {
      name: trimmedName,
      code: normalizedCode,
      isActive: nextIsActive,
      description: trimmedDescription || null,
      country: trimmedCountry,
      state: trimmedState,
      city: trimmedCity,
      postalCode: trimmedPostalCode,
      address: trimmedAddress,
      phone: trimmedPhone,
      email: trimmedEmail,
      website: trimmedWebsite,
      sameAsMainLocation: nextSameAsMainLocation,
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
      description: true,
      country: true,
      state: true,
      city: true,
      postalCode: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      sameAsMainLocation: true,
      createdAt: true,
    },
  });

  if (isMainCode && req.file) {
    persistMainCompanyLogo(req.file);
  }

  const mainLogoUrl = isMainCode ? buildMainLogoUrl(req) : null;

  res.status(201).json({
    success: true,
    message: 'Subsidiary created successfully',
    data: {
      ...subsidiary,
      logoUrl: mainLogoUrl,
    },
  });
}));

router.put('/subsidiaries/:id', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), upload.single('logo'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    code,
    description,
    status,
    isActive,
    country,
    state,
    city,
    address,
    postalCode,
    phone,
    email,
    website,
    sameAsMainLocation,
  } = req.body || {};

  const existingById = await prisma.subsidiary.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingById) {
    return res.status(404).json({
      success: false,
      message: 'Subsidiary not found',
    });
  }

  const trimmedName = String(name || '').trim();
  const normalizedCode = String(code || '').trim().toUpperCase();

  if (!trimmedName || !normalizedCode) {
    return res.status(400).json({
      success: false,
      message: 'Name and code are required',
    });
  }

  const duplicate = await prisma.subsidiary.findFirst({
    where: {
      id: { not: id },
      OR: [
        { name: { equals: trimmedName, mode: 'insensitive' } },
        { code: { equals: normalizedCode, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  if (duplicate) {
    return res.status(409).json({
      success: false,
      message: 'A subsidiary with the same name or code already exists',
    });
  }

  const trimmedDescription = String(description || '').trim();
  const useMainLocation = parseBoolean(sameAsMainLocation, false);
  const isMainCode = isMainSubsidiaryCode(normalizedCode);
  let nextSameAsMainLocation = useMainLocation;

  if (req.file && !isMainCode) {
    return res.status(400).json({
      success: false,
      message: 'Logo upload is only supported for Main Company registration.',
    });
  }

  let trimmedCountry = String(country || '').trim() || 'Nigeria';
  let trimmedState = String(state || '').trim() || null;
  let trimmedCity = String(city || '').trim() || null;
  let trimmedPostalCode = String(postalCode || '').trim() || null;
  let trimmedAddress = String(address || '').trim() || null;
  const trimmedPhone = String(phone || '').trim() || null;
  const trimmedEmail = String(email || '').trim() || null;
  const trimmedWebsite = String(website || '').trim() || null;

  if (useMainLocation) {
    const mainLocation = await resolveMainLocation(id);

    if (!mainLocation) {
      if (isMainCode) {
        // MAIN record should hold source location instead of referencing another row.
        nextSameAsMainLocation = false;
      } else {
        return res.status(400).json({
          success: false,
          message: 'No main location found yet. Create/update the main subsidiary location first.',
        });
      }
    } else {
      trimmedCountry = String(mainLocation.country || 'Nigeria').trim();
      trimmedState = mainLocation.state || null;
      trimmedCity = mainLocation.city || null;
      trimmedPostalCode = mainLocation.postalCode || null;
      trimmedAddress = mainLocation.address || null;
    }
  }

  const activeFromStatus = String(status || '').toLowerCase() !== 'inactive';
  const hasExplicitActive = !(isActive === undefined || isActive === null || isActive === '');
  const nextIsActive = hasExplicitActive ? parseBoolean(isActive, activeFromStatus) : activeFromStatus;

  const updatedSubsidiary = await prisma.subsidiary.update({
    where: { id },
    data: {
      name: trimmedName,
      code: normalizedCode,
      isActive: nextIsActive,
      description: trimmedDescription || null,
      country: trimmedCountry,
      state: trimmedState,
      city: trimmedCity,
      postalCode: trimmedPostalCode,
      address: trimmedAddress,
      phone: trimmedPhone,
      email: trimmedEmail,
      website: trimmedWebsite,
      sameAsMainLocation: nextSameAsMainLocation,
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
      description: true,
      country: true,
      state: true,
      city: true,
      postalCode: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      sameAsMainLocation: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (isMainCode && req.file) {
    persistMainCompanyLogo(req.file);
  }

  const mainLogoUrl = isMainCode ? buildMainLogoUrl(req) : null;

  res.status(200).json({
    success: true,
    message: 'Subsidiary updated successfully',
    data: {
      ...updatedSubsidiary,
      status: updatedSubsidiary.isActive ? 'active' : 'inactive',
      logoUrl: mainLogoUrl,
    },
  });
}));

// Cache health route
router.get('/cache/health', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), asyncHandler(async (req, res) => {
  const stats = await cacheManager.getStats();
  res.status(200).json({
    success: true,
    data: {
      enabled: stats.enabled,
      totalKeys: stats.totalKeys,
      hasError: Boolean(stats.error),
      error: stats.error || null,
    },
  });
}));

// Dashboard routes
router.get('/dashboard/kpi', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), dashboardController.getKPISummary);
router.get('/dashboard/charts', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), dashboardController.getChartData);
router.get('/dashboard/drilldown', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), cacheMiddleware(60, { tags: ['dashboard:drilldown'] }), dashboardController.getDrilldownData);
router.get('/dashboard/alerts', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), dashboardController.getAlerts);

// Expense routes — specific paths must come before parameterised /:id routes
router.get('/expenses', expenseController.getExpenses);
router.get('/expenses/categories', expenseController.getExpenseCategories);
router.get('/expenses/analytics', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), expenseController.getExpenseAnalytics);
router.get('/expenses/stats', authorize(['ADMIN', 'CEO', 'ACCOUNTANT', 'SUPER_ADMIN']), expenseController.getExpenseStats);
router.get('/expenses/monthly-comparison', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), expenseController.getMonthlyComparison);
router.get('/expenses/pending-approvals', authorize(['CHIEF_DRIVER', 'ADMIN', 'CEO', 'SUPER_ADMIN']), expenseController.getPendingApprovals);
router.get('/expenses/trash', authorize(['ADMIN', 'SUPER_ADMIN']), expenseController.getTrashedExpenses);
router.get('/expenses/modifications/pending', authorize(['CEO', 'SUPER_ADMIN']), expenseController.getPendingModificationRequests);
router.get('/expenses/modifications/history', authorize(['CEO', 'SUPER_ADMIN']), expenseController.getExpenseModificationHistory);
router.get('/expenses/:id', expenseController.getExpenseById);
router.post(
  '/expenses',
  authorize(['DRIVER', 'CHIEF_DRIVER', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN', 'AUDITOR', 'EMPLOYEE', 'SUPERVISOR']),
  upload.fields([
    { name: 'receipt', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
  ]),
  expenseController.createExpense
);
router.post('/expenses/modifications/:requestId/approve', authorize(['CEO', 'SUPER_ADMIN']), expenseController.approveExpenseModification);
router.put(
  '/expenses/:id',
  authorize(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN']),
  upload.fields([
    { name: 'receipt', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
  ]),
  expenseController.updateExpense
);
router.put('/expenses/:id/approve', authorize(['CHIEF_DRIVER', 'ADMIN', 'CEO', 'SUPER_ADMIN']), expenseController.approveExpense);
router.put('/expenses/:id/reject', authorize(['CHIEF_DRIVER', 'ADMIN', 'CEO', 'SUPER_ADMIN']), expenseController.rejectExpense);
router.put(
  '/expenses/:id/complete',
  authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']),
  upload.fields([
    { name: 'receipt', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
  ]),
  expenseController.completeExpense
);
router.put(
  '/expenses/:id/upload-receipt',
  authorize(['CHIEF_DRIVER', 'ADMIN', 'CEO', 'SUPER_ADMIN']),
  upload.fields([
    { name: 'receipt', maxCount: 1 },
  ]),
  expenseController.uploadCompletedExpenseReceipt
);
router.delete('/expenses/:id', authorize(['CEO', 'SUPER_ADMIN']), expenseController.deleteExpense);

// Operation routes
router.get('/operations', operationController.getOperations);
router.post('/operations', operationController.createOperation);
router.put('/operations/:id', operationController.updateOperation);
router.get('/operations/vehicle/:vehicleId', operationController.getVehicleOperations);
router.get('/vehicles/assignable-staff', authorize(['CEO', 'SUPER_ADMIN']), operationController.getAssignableStaff);
router.post('/vehicles/:vehicleId/assign', authorize(['CEO', 'SUPER_ADMIN']), operationController.assignVehicle);
router.delete('/vehicles/:vehicleId/assign', authorize(['CEO', 'SUPER_ADMIN']), operationController.deassignVehicle);
router.post('/vehicles/logs', authorize(['DRIVER', 'CHIEF_DRIVER']), operationController.createVehicleLog);
router.get('/vehicles/logs/mine', authorize(['DRIVER', 'CHIEF_DRIVER']), operationController.getMyVehicleLogs);
router.patch('/vehicles/:id/status', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), operationController.updateVehicleStatus);
router.get('/vehicles/status-requests', authorize(['DRIVER', 'CHIEF_DRIVER', 'ADMIN', 'CEO', 'SUPER_ADMIN']), operationController.getVehicleStatusRequests);
router.post('/vehicles/:vehicleId/status-request', authorize(['DRIVER', 'CHIEF_DRIVER', 'CEO', 'SUPER_ADMIN']), operationController.requestVehicleStatusChange);
router.post('/vehicles/status-requests/:requestId/chief-review', authorize(['CHIEF_DRIVER']), operationController.chiefReviewStatusRequest);
router.post('/vehicles/status-requests/:requestId/executive-review', authorize(['CEO', 'SUPER_ADMIN']), operationController.executiveReviewStatusRequest);
router.get('/vehicles/:vehicleId/detail', authorize(['DRIVER', 'CHIEF_DRIVER', 'ADMIN', 'MANAGER', 'CEO', 'SUPER_ADMIN']), operationController.getVehicleDetail);
router.get('/vehicles/:vehicleId/logs', authorize(['DRIVER', 'CHIEF_DRIVER', 'ADMIN', 'MANAGER', 'CEO', 'SUPER_ADMIN']), operationController.getVehicleLogs);
router.post('/vehicles', authorize(['CHIEF_DRIVER']), operationController.createVehicle);
router.get('/vehicles', authorize(['DRIVER', 'CHIEF_DRIVER', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN']), operationController.getVehicles);
router.get('/operations/analytics', authorize(['ADMIN', 'CEO','SUPER_ADMIN']), operationController.getAnalytics);

// Income routes
router.post('/income', authorize(['ADMIN', 'CEO', 'ACCOUNTANT','SUPER_ADMIN']), incomeController.recordIncome);
router.get('/income', authorize(['ADMIN', 'CEO', 'ACCOUNTANT','SUPER_ADMIN']), incomeController.getIncomes);
router.get('/income/analytics', authorize(['ADMIN', 'CEO', 'ACCOUNTANT','SUPER_ADMIN']), incomeController.getIncomeAnalytics);
router.get('/income/outstanding', authorize(['ADMIN', 'CEO', 'ACCOUNTANT','SUPER_ADMIN']), incomeController.getOutstandingInvoices);
router.get('/income/modifications/mine', authorize(['ADMIN', 'MANAGER', 'CEO', 'ACCOUNTANT','SUPER_ADMIN']), incomeController.getMyModificationRequests);
router.get('/income/modifications/pending', authorize(['CEO', 'ACCOUNTANT','SUPER_ADMIN']), incomeController.getPendingModificationRequests);
router.get('/income/modifications/history', authorize(['CEO', 'ACCOUNTANT','SUPER_ADMIN']), incomeController.getIncomeModificationHistory);
router.post('/income/modifications/:requestId/approve', authorize(['CEO', 'ACCOUNTANT', 'SUPER_ADMIN']), incomeController.approveIncomeModification);
router.get('/income/:id', authorize(['ADMIN', 'CEO', 'ACCOUNTANT', 'SUPER_ADMIN']), incomeController.getIncomeById);
router.get('/income/:id/invoice', authorize(['ADMIN', 'CEO', 'ACCOUNTANT', 'MANAGER', 'SUPER_ADMIN']), incomeController.getIncomeInvoice);
router.put('/income/:id', authorize(['ADMIN', 'MANAGER', 'CEO', 'ACCOUNTANT', 'SUPER_ADMIN']), incomeController.updateIncome);
router.post('/income/:id/mark-paid', authorize(['ADMIN', 'CEO', 'ACCOUNTANT','SUPER_ADMIN']), incomeController.markAsPaid);
router.delete('/income/:id', authorize(['ADMIN','CEO','SUPER_ADMIN']), incomeController.deleteIncome);

// Customer routes (for income source selection and finance reporting)
router.post('/customers', authorize(['ADMIN', 'CEO', 'ACCOUNTANT','SUPER_ADMIN']), customerController.createCustomer);
router.get('/customers', authorize(['ADMIN', 'CEO', 'ACCOUNTANT','SUPER_ADMIN']), customerController.getAllCustomers);
router.put('/customers/:id', authorize(['ADMIN', 'CEO', 'ACCOUNTANT','SUPER_ADMIN']), customerController.updateCustomer);
router.delete('/customers/:id', authorize(['ADMIN', 'CEO', 'ACCOUNTANT','SUPER_ADMIN']), customerController.deleteCustomer);

// Profit routes
router.get('/profit/monthly/:year/:month', profitController.calculateMonthlyProfit);
router.get('/profit/analytics/:year', profitController.getProfitAnalytics);
router.get('/profit/distributions', profitController.getDistributions);
router.post('/profit/distributions/:distributionId/process', 
  authorize(['ADMIN', 'ACCOUNTANT','CEO','SUPER_ADMIN']), 
  profitController.processDistribution
);

// Report routes
router.get('/reports/generate', reportController.generateReport);
router.get('/reports/export/:format', reportController.exportReport);
router.get('/reports/transactions', authorize(['ADMIN', 'CEO', 'ACCOUNTANT', 'SUPER_ADMIN', 'AUDITOR', 'EMPLOYEE', 'SUPERVISOR']), reportController.getTransactionLedger);
router.get('/reports/scheduled', reportController.getScheduledReports);
router.post('/reports/schedule', reportController.scheduleReport);

// Admin only routes
router.get('/users/me', adminController.getMyProfile);
router.get('/admin/users', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), adminController.getUsers);
router.get('/admin/users/:id', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), adminController.getUserById);
router.post('/admin/users', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), adminController.createUser);
router.put('/admin/users/:id', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), adminController.updateUser);
router.delete('/admin/users/:id', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), adminController.deleteUser);
router.get('/admin/positions', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), adminController.getPositions);
router.post('/admin/positions', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), adminController.createPosition);
router.put('/admin/positions/:id', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN']), adminController.updatePosition);
router.get('/admin/audit-logs', authorize(['ADMIN']), adminController.getAuditLogs);
router.get('/admin/transaction-log', authorize(['ADMIN', 'CEO', 'SUPER_ADMIN', 'AUDITOR', 'ACCOUNTANT']), adminController.getTransactionLog);
router.get('/admin/system-health', authorize(['ADMIN','SUPER_ADMIN', 'CEO']), adminController.getSystemHealth);

export default router;
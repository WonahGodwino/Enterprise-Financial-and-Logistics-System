import { CustomerService } from '../services/customer.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateCustomer } from '../validators/customer.validator.js';

export class CustomerController {
  constructor() {
    this.customerService = new CustomerService();
  }

  createCustomer = asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    delete payload.code;

    const { error } = validateCustomer(payload);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const customer = await this.customerService.createCustomer(payload, req.user);
    
    res.status(201).json({
      success: true,
      data: customer
    });
  });

  updateCustomer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payload = { ...req.body };
    delete payload.code;

    const { error } = validateCustomer(payload, true);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const customer = await this.customerService.updateCustomer(id, payload, req.user);
    
    res.json({
      success: true,
      data: customer
    });
  });

  getCustomer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const customer = await this.customerService.getCustomerDashboard(id);
    
    // Also fetch assigned staff info
    const fullCustomer = await this.customerService.customerRepository.findById(id, {
      assignedStaff: {
        select: { id: true, fullName: true, role: true },
      },
      createdBy: {
        select: { id: true, fullName: true },
      },
    });
    
    res.json({
      success: true,
      data: {
        ...customer,
        assignedStaff: fullCustomer?.assignedStaff || null,
        createdBy: fullCustomer?.createdBy || null,
      }
    });
  });

  getAllCustomers = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      search,
      subsidiaryId,
    } = req.query;

    const where = {};

    // Role-based scoping: CEO and SUPER_ADMIN see all customers; staff see only their assigned customers
    const PRIVILEGED_ROLES = new Set(['CEO', 'SUPER_ADMIN']);
    if (!PRIVILEGED_ROLES.has(String(req.user?.role || '').toUpperCase())) {
      where.assignedStaffId = req.user.id;
    }

    if (type) where.customerType = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (subsidiaryId) {
      const subsidiaryScope = {
        OR: [
          { subsidiaryId },
          {
            customerSubsidiaries: {
              some: { subsidiaryId },
            },
          },
        ],
      };

      if (where.OR) {
        where.AND = [{ OR: where.OR }, subsidiaryScope];
        delete where.OR;
      } else {
        where.AND = [subsidiaryScope];
      }
    }

    const customers = await this.customerService.customerRepository.findMany(
      where,
      {
        subsidiary: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        customerSubsidiaries: {
          include: {
            subsidiary: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        assignedStaff: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        incomeRecords: {
          take: 5,
          orderBy: { incomeDate: 'desc' }
        }
      },
      { createdAt: 'desc' },
      (page - 1) * limit,
      parseInt(limit)
    );

    const total = await this.customerService.customerRepository.count(where);

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  });

  getCustomerReport = asyncHandler(async (req, res) => {
    const { startDate, endDate, includeInactive } = req.query;

    const report = await this.customerService.getCustomersReport({
      startDate: startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate: endDate ? new Date(endDate) : new Date(),
      includeInactive: includeInactive === 'true'
    });

    res.json({
      success: true,
      data: report
    });
  });

  getCustomersWithIncome = asyncHandler(async (req, res) => {
    const { startDate, endDate, minIncome } = req.query;

    const customers = await this.customerService.customerRepository.getCustomersWithIncome({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      minIncome: minIncome ? parseFloat(minIncome) : undefined
    });

    res.json({
      success: true,
      data: customers
    });
  });

  getCustomersWithoutIncome = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const customers = await this.customerService.customerRepository.getCustomersWithoutIncome({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    res.json({
      success: true,
      data: customers
    });
  });

  getTopCustomers = asyncHandler(async (req, res) => {
    const { limit = 10, period = 'month' } = req.query;

    const customers = await this.customerService.customerRepository.getTopCustomers(
      parseInt(limit),
      period
    );

    res.json({
      success: true,
      data: customers
    });
  });

  deleteCustomer = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await this.customerService.customerRepository.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    await this.customerService.updateCustomer(id, { status: 'INACTIVE' }, req.user);

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  });

  /**
   * Transfer a customer from one staff to another.
   * Only CEO and SUPER_ADMIN can transfer customers.
   */
  transferCustomer = asyncHandler(async (req, res) => {
    const { customerId, toStaffId, reason, notes } = req.body;

    if (!customerId || !toStaffId) {
      return res.status(400).json({
        success: false,
        message: 'customerId and toStaffId are required'
      });
    }

    const result = await this.customerService.transferCustomer(
      customerId,
      toStaffId,
      req.user,
      { reason, notes }
    );

    res.json({
      success: true,
      message: 'Customer transferred successfully',
      data: result
    });
  });

  /**
   * Get customer transfer history.
   * CEO/SUPER_ADMIN see all transfers; staff see transfers involving their customers.
   */
  getTransferHistory = asyncHandler(async (req, res) => {
    const { customerId } = req.query;

    const history = await this.customerService.getTransferHistory(
      customerId || null,
      req.user
    );

    res.json({
      success: true,
      data: history
    });
  });

  /**
   * Get indebted customers report.
   * CEO/SUPER_ADMIN see all indebted customers; staff see only their own assigned customers.
   */
  getIndebtedCustomersReport = asyncHandler(async (req, res) => {
    const { minBalance, subsidiaryId } = req.query;

    const report = await this.customerService.getIndebtedCustomersReport(
      req.user,
      minBalance ? parseFloat(minBalance) : 0,
      subsidiaryId || null
    );

    res.json({
      success: true,
      data: report
    });
  });
}
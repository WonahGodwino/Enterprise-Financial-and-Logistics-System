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
    
    res.json({
      success: true,
      data: customer
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
}
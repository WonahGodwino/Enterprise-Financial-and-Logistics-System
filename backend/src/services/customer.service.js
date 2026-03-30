import { CustomerRepository } from '../repositories/customer.repository.js';
import { IncomeRepository } from '../repositories/income.repository.js';
import { AuditService } from './audit.service.js';
import { NotificationService } from './notification.service.js';
import { AppError } from '../utils/AppError.js';
import { resolveScopedSubsidiaryId } from '../utils/subsidiaryScope.js';
import prisma from '../config/database.js';

export class CustomerService {
  constructor() {
    this.customerRepository = new CustomerRepository();
    this.incomeRepository = new IncomeRepository();
    this.auditService = new AuditService();
    this.notificationService = new NotificationService();
  }

  async resolveRequestedSubsidiaryIds(data, user) {
    const requested = Array.isArray(data?.subsidiaryIds) && data.subsidiaryIds.length > 0
      ? data.subsidiaryIds
      : [data?.subsidiaryId].filter(Boolean);

    if (requested.length === 0) {
      throw new AppError('At least one subsidiary is required for customer registration', 400);
    }

    const resolved = await Promise.all(requested.map((requestedSubsidiaryId) => resolveScopedSubsidiaryId({
      requestedSubsidiaryId,
      userSubsidiaryId: user?.subsidiaryId,
      userSubsidiaryAccess: user?.subsidiaryAccess,
    })));

    return [...new Set(resolved.filter(Boolean))];
  }

  async createCustomer(data, user) {
    try {
      // Validate customer data
      await this.validateCustomer(data);

      const resolvedSubsidiaryIds = await this.resolveRequestedSubsidiaryIds(data, user);
      const primarySubsidiaryId = resolvedSubsidiaryIds[0];

      // Prisma Customer model has no `code` field. Keep create payload schema-safe.
      const createPayload = {
        customerType: data.customerType,
        companyName: data.companyName,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        alternativePhone: data.alternativePhone,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        taxId: data.taxId,
        registrationNumber: data.registrationNumber,
        contactPerson: data.contactPerson,
        contactPosition: data.contactPosition,
        notes: data.notes,
        status: data.status,
        creditLimit: data.creditLimit,
        paymentTerms: data.paymentTerms,
        subsidiaryId: primarySubsidiaryId,
        createdById: user.id,
      };

      // Create customer
      const customer = await this.customerRepository.create(createPayload);

      await prisma.customerSubsidiary.createMany({
        data: resolvedSubsidiaryIds.map((subsidiaryId) => ({
          customerId: customer.id,
          subsidiaryId,
        })),
        skipDuplicates: true,
      });

      // Audit log
      await this.auditService.log({
        userId: user.id,
        action: 'CREATE',
        entity: 'CUSTOMER',
        entityId: customer.id,
        newValue: customer
      });

      return customer;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create customer', 500, error);
    }
  }

  async updateCustomer(id, data, user) {
    const existing = await this.customerRepository.findById(id);
    
    if (!existing) {
      throw new AppError('Customer not found', 404);
    }

    const { subsidiaryIds: _subsidiaryIds, ...restData } = data;
    const updatePayload = {
      ...restData,
      updatedById: user.id,
      updatedAt: new Date()
    };

    const hasSubsidiaryUpdate = Object.prototype.hasOwnProperty.call(data, 'subsidiaryId')
      || Object.prototype.hasOwnProperty.call(data, 'subsidiaryIds');

    if (hasSubsidiaryUpdate) {
      const resolvedSubsidiaryIds = await this.resolveRequestedSubsidiaryIds(data, user);
      updatePayload.subsidiaryId = resolvedSubsidiaryIds[0];

      await prisma.customerSubsidiary.deleteMany({ where: { customerId: id } });
      await prisma.customerSubsidiary.createMany({
        data: resolvedSubsidiaryIds.map((subsidiaryId) => ({
          customerId: id,
          subsidiaryId,
        })),
        skipDuplicates: true,
      });
    }

    const updated = await this.customerRepository.update(id, updatePayload);

    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      entity: 'CUSTOMER',
      entityId: id,
      oldValue: existing,
      newValue: updated
    });

    return updated;
  }

  async getCustomerDashboard(customerId) {
    const customer = await this.customerRepository.getCustomerSummary(customerId);
    
    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Get recent transactions
    const recentTransactions = await this.incomeRepository.findMany({
      customerId
    }, {
      take: 10,
      orderBy: { incomeDate: 'desc' }
    });

    // Get payment history
    const payments = await prisma.payment.findMany({
      where: { customerId },
      orderBy: { paymentDate: 'desc' },
      take: 20
    });

    // Get aging analysis
    const aging = await this.getAgingAnalysis(customerId);

    return {
      ...customer,
      recentTransactions,
      payments,
      aging
    };
  }

  async getAgingAnalysis(customerId) {
    const now = new Date();
    
    const invoices = await prisma.invoice.findMany({
      where: {
        customerId,
        status: {
          notIn: ['PAID', 'CANCELLED']
        }
      }
    });

    const aging = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0
    };

    invoices.forEach(invoice => {
      const daysDiff = Math.floor((now - invoice.dueDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 0) {
        aging.current += invoice.balanceDue;
      } else if (daysDiff <= 30) {
        aging.days1to30 += invoice.balanceDue;
      } else if (daysDiff <= 60) {
        aging.days31to60 += invoice.balanceDue;
      } else if (daysDiff <= 90) {
        aging.days61to90 += invoice.balanceDue;
      } else {
        aging.over90 += invoice.balanceDue;
      }
    });

    return aging;
  }

  async getCustomersReport(filters = {}) {
    const { startDate, endDate, includeInactive = false } = filters;

    // Get customers with income
    const customersWithIncome = await this.customerRepository.getCustomersWithIncome({
      startDate,
      endDate
    });

    // Get customers without income
    const customersWithoutIncome = await this.customerRepository.getCustomersWithoutIncome({
      startDate,
      endDate
    });

    // Calculate totals
    const totalCustomers = customersWithIncome.length + customersWithoutIncome.length;
    const totalRevenue = customersWithIncome.reduce((sum, c) => sum + c.totalIncome, 0);
    const averageRevenue = totalRevenue / (customersWithIncome.length || 1);

    // Get top customers
    const topCustomers = await this.customerRepository.getTopCustomers(10);

    return {
      summary: {
        totalCustomers,
        activeCustomers: customersWithIncome.length,
        inactiveCustomers: customersWithoutIncome.length,
        totalRevenue,
        averageRevenue,
        revenueGeneratingCustomers: customersWithIncome.length
      },
      customersWithIncome: customersWithIncome.slice(0, 50),
      customersWithoutIncome: customersWithoutIncome.slice(0, 50),
      topCustomers,
      period: {
        startDate,
        endDate
      }
    };
  }

  async validateCustomer(data) {
    // Required fields based on type
    if (data.customerType === 'ORGANIZATION') {
      if (!data.companyName) {
        throw new AppError('Company name is required for organizations', 400);
      }
    } else {
      if (!data.firstName || !data.lastName) {
        throw new AppError('First name and last name are required for individuals', 400);
      }
    }

    // Validate email format
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new AppError('Invalid email format', 400);
      }
    }

    // Check for duplicate email
    if (data.email) {
      const existing = await this.customerRepository.findByEmail(data.email);
      if (existing) {
        throw new AppError('Email already exists', 400);
      }
    }

    // Validate phone
    if (data.phone) {
      const phoneRegex = /^[0-9+\-\s]{10,15}$/;
      if (!phoneRegex.test(data.phone)) {
        throw new AppError('Invalid phone number format', 400);
      }
    }
  }
}
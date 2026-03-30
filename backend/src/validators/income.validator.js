import Joi from 'joi';

export const validateIncome = (data, isUpdate = false) => {
  const incomeItemSchema = Joi.object({
    serviceType: Joi.string().max(200).optional(),
    serviceDescription: Joi.string().max(1000).required(),
    quantity: Joi.number().positive().required(),
    unitPrice: Joi.number().positive().required(),
    // cost = quantity * unitPrice (computed, but may be sent explicitly)
    amount: Joi.number().positive().optional(),
    taxAmount: Joi.number().min(0).default(0),
    discountAmount: Joi.number().min(0).default(0),
    paidAmount: Joi.number().min(0).default(0),
    // paymentStatus per item is derived server-side; client may omit
    paymentStatus: Joi.string().valid('PENDING', 'PARTIALLY_PAID', 'PAID').optional(),
    notes: Joi.string().max(500).optional(),
  });

  const schema = Joi.object({
    incomeType: Joi.string().valid(
      'SERVICE', 'PRODUCT', 'RENTAL', 'INSTALLATION', 
      'MAINTENANCE', 'CONSULTING', 'OTHER'
    ).optional(),
    category: Joi.string().valid(
      'CAR_HIRE', 'CAR_SALES', 'CAR_MAINTENANCE',
      'SECURITY_GUARD', 'CCTV_INSTALLATION', 'SMART_HOME', 'SECURITY_CONSULTING',
      'GENERAL_CONTRACT', 'RENOVATION', 'CONSTRUCTION_MATERIALS', 'PROJECT_MANAGEMENT',
      'OTHER'
    ).optional(),
    amount: Joi.number().positive().optional(),
    taxAmount: Joi.number().min(0).optional(),
    discountAmount: Joi.number().min(0).optional(),
    currency: Joi.string().length(3).default('NGN'),
    exchangeRate: Joi.number().positive().optional(),
    incomeDate: Joi.date().max('now').optional(),
    dueDate: Joi.date().min(Joi.ref('incomeDate')).optional(),
    paidDate: Joi.date().optional(),
    
    customerId: Joi.string().optional(),
    vehicleId: Joi.string().optional(),
    subsidiaryId: Joi.string().optional(),
    
    serviceType: Joi.string().max(200).optional(),
    serviceDescription: Joi.string().max(1000).optional(),
    quantity: Joi.number().positive().optional(),
    unitPrice: Joi.number().positive().optional(),
    paidAmount: Joi.number().min(0).optional(),
    incomeItems: Joi.array().items(incomeItemSchema).optional(),
    
    // overall paymentStatus is derived server-side from totals; client may omit
    paymentStatus: Joi.string().valid('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE').optional(),
    paymentMethod: Joi.string().valid(
      'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_CARD', 
      'DEBIT_CARD', 'POS', 'USSD', 'MOBILE_MONEY', 'CRYPTO', 'OTHER'
    ).optional(),
    paymentReference: Joi.string().max(200).optional(),
    
    notes: Joi.string().max(1000).optional()
  });

  if (isUpdate) {
    return schema.min(1).validate(data);
  }

  return schema.keys({
    incomeType: Joi.string().valid(
      'SERVICE', 'PRODUCT', 'RENTAL', 'INSTALLATION', 
      'MAINTENANCE', 'CONSULTING', 'OTHER'
    ).required(),
    category: Joi.string().valid(
      'CAR_HIRE', 'CAR_SALES', 'CAR_MAINTENANCE',
      'SECURITY_GUARD', 'CCTV_INSTALLATION', 'SMART_HOME', 'SECURITY_CONSULTING',
      'GENERAL_CONTRACT', 'RENOVATION', 'CONSTRUCTION_MATERIALS', 'PROJECT_MANAGEMENT',
      'OTHER'
    ).required(),
    incomeDate: Joi.date().max('now').required(),
    customerId: Joi.when('category', {
      is: Joi.valid('CAR_HIRE', 'CAR_SALES', 'CAR_MAINTENANCE'),
      then: Joi.string().optional(),
      otherwise: Joi.string().required(),
    }),
  }).or('amount', 'incomeItems').validate(data);
};
import Joi from 'joi';

export const validateCustomer = (data, isUpdate = false) => {
  const schema = Joi.object({
    customerType: Joi.string().valid('INDIVIDUAL', 'ORGANIZATION').required(),
    companyName: Joi.when('customerType', {
      is: 'ORGANIZATION',
      then: Joi.string().required().max(200),
      otherwise: Joi.string().optional()
    }),
    firstName: Joi.when('customerType', {
      is: 'INDIVIDUAL',
      then: Joi.string().required().max(100),
      otherwise: Joi.string().optional()
    }),
    lastName: Joi.when('customerType', {
      is: 'INDIVIDUAL',
      then: Joi.string().required().max(100),
      otherwise: Joi.string().optional()
    }),
    email: Joi.string().email().max(200).optional(),
    phone: Joi.string().pattern(/^[0-9+\-\s]{10,15}$/).optional(),
    alternativePhone: Joi.string().pattern(/^[0-9+\-\s]{10,15}$/).optional(),
    address: Joi.string().max(500).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    country: Joi.string().max(100).default('Nigeria'),
    taxId: Joi.string().max(50).optional(),
    registrationNumber: Joi.string().max(50).optional(),
    contactPerson: Joi.string().max(200).optional(),
    contactPosition: Joi.string().max(100).optional(),
    notes: Joi.string().max(1000).optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLACKLISTED', 'PROSPECT').optional(),
    creditLimit: Joi.number().min(0).optional(),
    paymentTerms: Joi.string().max(100).optional(),
    subsidiaryId: Joi.string().optional(),
    subsidiaryIds: Joi.array().items(Joi.string()).min(1).optional()
  });

  if (isUpdate) {
    return schema.min(1).validate(data);
  }

  return schema.validate(data);
};
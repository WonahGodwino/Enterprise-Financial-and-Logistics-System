import Joi from 'joi';

export const validateExpense = (data, isUpdate = false) => {
  const schema = Joi.object({
    vehicleId: Joi.string().optional(),
    expenseType: Joi.string().required(),
    expenseCategory: Joi.string().required(),
    expenseSubCategory: Joi.string().optional(),
    amount: Joi.number().positive().required(),
    quantity: Joi.number().positive().optional(),
    unitPrice: Joi.number().positive().optional(),
    currency: Joi.string().length(3).optional(),
    exchangeRate: Joi.number().positive().optional(),
    taxRate: Joi.number().min(0).optional(),
    taxAmount: Joi.number().min(0).optional(),
    details: Joi.string().max(500).optional(),
    description: Joi.string().max(500).optional(),
    expenseDate: Joi.date().max('now').required(),
    recordedDate: Joi.date().optional(),
    dueDate: Joi.date().optional(),
    subsidiaryId: Joi.string().optional(),
    vendorId: Joi.string().optional(),
    vendorName: Joi.string().max(200).optional(),
    receiptUrl: Joi.string().optional(),
    receiptNumber: Joi.string().max(100).optional(),
    attachments: Joi.any().optional(),
    reference: Joi.string().max(200).optional(),
    notes: Joi.string().max(1000).optional(),
    paymentStatus: Joi.string().optional(),
    paymentMethod: Joi.string().optional(),
    isRecurring: Joi.boolean().optional(),
    recurrencePattern: Joi.string().optional(),
    modificationReason: Joi.string().max(500).optional(),
  });

  if (isUpdate) {
    return schema.min(1).validate(data);
  }

  return schema.validate(data);
};

export const validateExpenseApproval = (data) => {
  const schema = Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED').required(),
    comments: Joi.string().max(500).optional(),
  });

  return schema.validate(data);
};
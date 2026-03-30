import Joi from 'joi';

export const validateDailyOperation = (data) => {
  const schema = Joi.object({
    vehicleId: Joi.string().uuid().required(),
    operationDate: Joi.date().max('now').required(),
    openOdometer: Joi.number().integer().min(0).required(),
    closeOdometer: Joi.number().integer().min(Joi.ref('openOdometer')).required(),
    income: Joi.number().positive().required(),
    clientName: Joi.string().max(200).optional(),
    jobDescription: Joi.string().max(500).optional(),
  });

  return schema.validate(data);
};
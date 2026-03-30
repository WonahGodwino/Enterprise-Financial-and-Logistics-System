import { body } from 'express-validator';

export const createUserSchema = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').optional().isString(),
  body('lastName').optional().isString()
];

export const updateUserSchema = [
  body('email').optional().isEmail(),
  body('password').optional().isLength({ min: 6 })
];

export const roleSchema = [
  body('name').notEmpty().withMessage('Role name is required')
];

export default { createUserSchema, updateUserSchema, roleSchema };

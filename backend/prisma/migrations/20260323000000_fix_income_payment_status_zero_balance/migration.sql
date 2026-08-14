-- Data correction: mark fully-settled income records as PAID.
-- A record is fully settled when (amount + taxAmount) equals
-- (paidAmount + discountAmount), matching the application's payment-status
-- derivation rule. Records with an outstanding balance are left untouched.
UPDATE "IncomeRecord"
SET "paymentStatus" = 'PAID',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "paymentStatus" IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE', 'UNPAID')
  AND COALESCE("paidAmount", 0) > 0
  AND ABS((COALESCE("amount", 0) + COALESCE("taxAmount", 0))
          - (COALESCE("paidAmount", 0) + COALESCE("discountAmount", 0))) < 0.005;

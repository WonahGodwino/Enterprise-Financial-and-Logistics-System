-- Add JSON line items to support multi-service/product income entries
ALTER TABLE "IncomeRecord"
ADD COLUMN IF NOT EXISTS "incomeItems" JSONB;

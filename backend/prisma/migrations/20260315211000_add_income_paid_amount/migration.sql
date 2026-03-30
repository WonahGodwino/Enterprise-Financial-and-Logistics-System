-- Add paidAmount to track total paid across all items for an income record
ALTER TABLE "IncomeRecord"
ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

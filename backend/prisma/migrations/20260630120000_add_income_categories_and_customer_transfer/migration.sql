-- Add new values to IncomeCategory enum (PostgreSQL 9.6+)
ALTER TYPE "IncomeCategory" ADD VALUE IF NOT EXISTS 'TRAINING';
ALTER TYPE "IncomeCategory" ADD VALUE IF NOT EXISTS 'BOUNCER';
ALTER TYPE "IncomeCategory" ADD VALUE IF NOT EXISTS 'ARMED_ESCORT';
ALTER TYPE "IncomeCategory" ADD VALUE IF NOT EXISTS 'FLIGHT_BOOKING';
ALTER TYPE "IncomeCategory" ADD VALUE IF NOT EXISTS 'HOTEL_RESERVATION';
ALTER TYPE "IncomeCategory" ADD VALUE IF NOT EXISTS 'VISA_SUPPORT';
ALTER TYPE "IncomeCategory" ADD VALUE IF NOT EXISTS 'TOURS';

-- Add assignedStaffId column to Customer table
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "assignedStaffId" TEXT;

-- Create CustomerTransfer table
CREATE TABLE IF NOT EXISTS "CustomerTransfer" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fromStaffId" TEXT,
    "toStaffId" TEXT NOT NULL,
    "transferredById" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerTransfer_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints (safe re-run with DO blocks)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CustomerTransfer_customerId_fkey') THEN
        ALTER TABLE "CustomerTransfer" ADD CONSTRAINT "CustomerTransfer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CustomerTransfer_fromStaffId_fkey') THEN
        ALTER TABLE "CustomerTransfer" ADD CONSTRAINT "CustomerTransfer_fromStaffId_fkey" FOREIGN KEY ("fromStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CustomerTransfer_toStaffId_fkey') THEN
        ALTER TABLE "CustomerTransfer" ADD CONSTRAINT "CustomerTransfer_toStaffId_fkey" FOREIGN KEY ("toStaffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CustomerTransfer_transferredById_fkey') THEN
        ALTER TABLE "CustomerTransfer" ADD CONSTRAINT "CustomerTransfer_transferredById_fkey" FOREIGN KEY ("transferredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Customer_assignedStaffId_fkey') THEN
        ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Create indexes (safe re-run)
CREATE INDEX IF NOT EXISTS "CustomerTransfer_customerId_idx" ON "CustomerTransfer"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerTransfer_fromStaffId_idx" ON "CustomerTransfer"("fromStaffId");
CREATE INDEX IF NOT EXISTS "CustomerTransfer_toStaffId_idx" ON "CustomerTransfer"("toStaffId");
CREATE INDEX IF NOT EXISTS "CustomerTransfer_transferredById_idx" ON "CustomerTransfer"("transferredById");
CREATE INDEX IF NOT EXISTS "CustomerTransfer_createdAt_idx" ON "CustomerTransfer"("createdAt");
CREATE INDEX IF NOT EXISTS "Customer_assignedStaffId_idx" ON "Customer"("assignedStaffId");

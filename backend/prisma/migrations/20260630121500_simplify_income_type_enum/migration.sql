-- Simplify IncomeType enum to: SALES, SERVICES, OTHERS
-- Step 1: Create new enum type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncomeType_new') THEN
        CREATE TYPE "IncomeType_new" AS ENUM ('SALES', 'SERVICES', 'OTHERS');
    END IF;
END $$;

-- Step 2: Add temporary column
ALTER TABLE "IncomeRecord" ADD COLUMN IF NOT EXISTS "incomeType_temp" TEXT;

-- Step 3: Map old values to new values
UPDATE "IncomeRecord"
SET "incomeType_temp" = CASE
    WHEN "incomeType" = 'SERVICE' THEN 'SERVICES'
    WHEN "incomeType" = 'PRODUCT' THEN 'SALES'
    WHEN "incomeType" = 'RENTAL' THEN 'SALES'
    WHEN "incomeType" = 'INSTALLATION' THEN 'SERVICES'
    WHEN "incomeType" = 'MAINTENANCE' THEN 'SERVICES'
    WHEN "incomeType" = 'CONSULTING' THEN 'SERVICES'
    WHEN "incomeType" = 'COMMISSION' THEN 'SERVICES'
    WHEN "incomeType" = 'ROYALTY' THEN 'SALES'
    WHEN "incomeType" = 'INTEREST' THEN 'OTHERS'
    WHEN "incomeType" = 'DIVIDEND' THEN 'OTHERS'
    WHEN "incomeType" = 'GRANT' THEN 'OTHERS'
    WHEN "incomeType" = 'DONATION' THEN 'OTHERS'
    WHEN "incomeType" = 'OTHER' THEN 'OTHERS'
    ELSE 'OTHERS'
END;

-- Step 4: Drop old column and rename
ALTER TABLE "IncomeRecord" DROP COLUMN IF EXISTS "incomeType";
ALTER TABLE "IncomeRecord" RENAME COLUMN "incomeType_temp" TO "incomeType";

-- Step 5: Cast column to new enum type
ALTER TABLE "IncomeRecord"
  ALTER COLUMN "incomeType" TYPE "IncomeType_new" USING "incomeType"::"IncomeType_new";

-- Step 6: Drop old enum type
DROP TYPE IF EXISTS "IncomeType";

-- Step 7: Rename new type to original name
ALTER TYPE "IncomeType_new" RENAME TO "IncomeType";

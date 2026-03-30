ALTER TABLE "Customer"
ADD COLUMN "subsidiaryId" TEXT;

WITH latest_income_scope AS (
  SELECT DISTINCT ON (i."customerId")
    i."customerId" AS customer_id,
    i."subsidiaryId" AS subsidiary_id
  FROM "IncomeRecord" i
  WHERE i."customerId" IS NOT NULL
    AND i."subsidiaryId" IS NOT NULL
  ORDER BY i."customerId", i."incomeDate" DESC NULLS LAST, i."createdAt" DESC NULLS LAST
)
UPDATE "Customer" c
SET "subsidiaryId" = lis.subsidiary_id
FROM latest_income_scope lis
WHERE c."id" = lis.customer_id
  AND c."subsidiaryId" IS NULL;

UPDATE "Customer" c
SET "subsidiaryId" = u."subsidiaryId"
FROM "User" u
WHERE c."createdById" = u."id"
  AND c."subsidiaryId" IS NULL
  AND u."subsidiaryId" IS NOT NULL;

DO $$
DECLARE
  fallback_subsidiary_id TEXT;
BEGIN
  SELECT s."id"
  INTO fallback_subsidiary_id
  FROM "Subsidiary" s
  WHERE UPPER(s."code") = 'MAIN'
  ORDER BY s."createdAt" ASC
  LIMIT 1;

  IF fallback_subsidiary_id IS NULL THEN
    SELECT s."id"
    INTO fallback_subsidiary_id
    FROM "Subsidiary" s
    WHERE s."isActive" = true
    ORDER BY s."createdAt" ASC
    LIMIT 1;
  END IF;

  IF fallback_subsidiary_id IS NULL THEN
    SELECT s."id"
    INTO fallback_subsidiary_id
    FROM "Subsidiary" s
    ORDER BY s."createdAt" ASC
    LIMIT 1;
  END IF;

  IF fallback_subsidiary_id IS NOT NULL THEN
    UPDATE "Customer"
    SET "subsidiaryId" = fallback_subsidiary_id
    WHERE "subsidiaryId" IS NULL;
  END IF;
END $$;

ALTER TABLE "Customer"
ALTER COLUMN "subsidiaryId" SET NOT NULL;

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_subsidiaryId_fkey"
FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX "Customer_subsidiaryId_idx" ON "Customer"("subsidiaryId");
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
    UPDATE "Expense"
    SET "subsidiaryId" = fallback_subsidiary_id
    WHERE "subsidiaryId" IS NULL;
  END IF;
END $$;

ALTER TABLE "Expense"
ALTER COLUMN "subsidiaryId" SET NOT NULL;

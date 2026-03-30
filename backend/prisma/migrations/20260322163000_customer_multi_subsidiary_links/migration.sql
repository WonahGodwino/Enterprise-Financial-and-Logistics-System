CREATE TABLE "CustomerSubsidiary" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "subsidiaryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerSubsidiary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerSubsidiary_customerId_subsidiaryId_key"
  ON "CustomerSubsidiary"("customerId", "subsidiaryId");

CREATE INDEX "CustomerSubsidiary_customerId_idx"
  ON "CustomerSubsidiary"("customerId");

CREATE INDEX "CustomerSubsidiary_subsidiaryId_idx"
  ON "CustomerSubsidiary"("subsidiaryId");

ALTER TABLE "CustomerSubsidiary"
ADD CONSTRAINT "CustomerSubsidiary_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerSubsidiary"
ADD CONSTRAINT "CustomerSubsidiary_subsidiaryId_fkey"
FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CustomerSubsidiary" ("id", "customerId", "subsidiaryId")
SELECT
  'cust_sub_' || md5(c."id" || '_' || c."subsidiaryId") AS "id",
  c."id" AS "customerId",
  c."subsidiaryId" AS "subsidiaryId"
FROM "Customer" c
WHERE c."subsidiaryId" IS NOT NULL
ON CONFLICT ("customerId", "subsidiaryId") DO NOTHING;

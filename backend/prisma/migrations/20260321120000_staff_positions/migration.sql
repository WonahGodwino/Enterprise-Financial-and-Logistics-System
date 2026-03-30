ALTER TABLE "User"
ADD COLUMN "positionId" TEXT;

CREATE TABLE "StaffPosition" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "jobDescription" TEXT,
  "archived" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  CONSTRAINT "StaffPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffPositionSubsidiary" (
  "id" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "subsidiaryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffPositionSubsidiary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffPosition_name_key" ON "StaffPosition"("name");
CREATE INDEX "StaffPosition_archived_idx" ON "StaffPosition"("archived");
CREATE INDEX "StaffPosition_createdById_idx" ON "StaffPosition"("createdById");
CREATE INDEX "StaffPosition_updatedById_idx" ON "StaffPosition"("updatedById");
CREATE UNIQUE INDEX "StaffPositionSubsidiary_positionId_subsidiaryId_key" ON "StaffPositionSubsidiary"("positionId", "subsidiaryId");
CREATE INDEX "StaffPositionSubsidiary_positionId_idx" ON "StaffPositionSubsidiary"("positionId");
CREATE INDEX "StaffPositionSubsidiary_subsidiaryId_idx" ON "StaffPositionSubsidiary"("subsidiaryId");
CREATE INDEX "User_positionId_idx" ON "User"("positionId");

ALTER TABLE "User"
ADD CONSTRAINT "User_positionId_fkey"
FOREIGN KEY ("positionId") REFERENCES "StaffPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffPosition"
ADD CONSTRAINT "StaffPosition_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffPosition"
ADD CONSTRAINT "StaffPosition_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffPositionSubsidiary"
ADD CONSTRAINT "StaffPositionSubsidiary_positionId_fkey"
FOREIGN KEY ("positionId") REFERENCES "StaffPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffPositionSubsidiary"
ADD CONSTRAINT "StaffPositionSubsidiary_subsidiaryId_fkey"
FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "StaffPosition" ("id", "name", "jobDescription", "archived", "createdAt", "updatedAt")
VALUES
  ('staff_position_strategic_growth_market_development', 'Strategic Growth & Market Development', NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('staff_position_client_stakeholder_engagement', 'Client & Stakeholder Engagement', NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('staff_position_monitoring_reporting', 'Monitoring & Reporting', NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('staff_position_content_production', 'Content Production', NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('staff_position_creative_development', 'Creative Development', NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('staff_position_research_innovation', 'Research & Innovation', NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('staff_position_operational_support', 'Operational Support', NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "StaffPositionSubsidiary" ("id", "positionId", "subsidiaryId", "createdAt")
SELECT
  CONCAT(sp."id", '_', s."id"),
  sp."id",
  s."id",
  CURRENT_TIMESTAMP
FROM "StaffPosition" sp
JOIN "Subsidiary" s ON UPPER(s."code") = 'MAIN'
WHERE sp."name" IN (
  'Strategic Growth & Market Development',
  'Client & Stakeholder Engagement',
  'Monitoring & Reporting',
  'Content Production',
  'Creative Development',
  'Research & Innovation',
  'Operational Support'
)
ON CONFLICT ("positionId", "subsidiaryId") DO NOTHING;
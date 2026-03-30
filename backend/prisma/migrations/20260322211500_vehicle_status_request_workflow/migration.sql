CREATE TYPE "VehicleStatusRequestStatus" AS ENUM (
  'PENDING_CHIEF_REVIEW',
  'PENDING_EXECUTIVE_REVIEW',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "VehicleStatusRequest" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "initialStatus" "VehicleStatus" NOT NULL,
  "targetStatus" "VehicleStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "VehicleStatusRequestStatus" NOT NULL DEFAULT 'PENDING_CHIEF_REVIEW',
  "chiefDecisionById" TEXT,
  "chiefDecisionReason" TEXT,
  "chiefDecisionAt" TIMESTAMP(3),
  "finalDecisionById" TEXT,
  "finalDecisionReason" TEXT,
  "finalDecisionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleStatusRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleStatusRequest_vehicleId_idx" ON "VehicleStatusRequest"("vehicleId");
CREATE INDEX "VehicleStatusRequest_requesterId_idx" ON "VehicleStatusRequest"("requesterId");
CREATE INDEX "VehicleStatusRequest_status_idx" ON "VehicleStatusRequest"("status");
CREATE INDEX "VehicleStatusRequest_chiefDecisionById_idx" ON "VehicleStatusRequest"("chiefDecisionById");
CREATE INDEX "VehicleStatusRequest_finalDecisionById_idx" ON "VehicleStatusRequest"("finalDecisionById");

ALTER TABLE "VehicleStatusRequest"
ADD CONSTRAINT "VehicleStatusRequest_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehicleStatusRequest"
ADD CONSTRAINT "VehicleStatusRequest_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VehicleStatusRequest"
ADD CONSTRAINT "VehicleStatusRequest_chiefDecisionById_fkey"
FOREIGN KEY ("chiefDecisionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VehicleStatusRequest"
ADD CONSTRAINT "VehicleStatusRequest_finalDecisionById_fkey"
FOREIGN KEY ("finalDecisionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

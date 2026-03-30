CREATE TABLE "VehicleAssignment" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "subsidiaryId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleAssignment_vehicleId_key"
  ON "VehicleAssignment"("vehicleId");

CREATE INDEX "VehicleAssignment_staffId_idx"
  ON "VehicleAssignment"("staffId");

CREATE INDEX "VehicleAssignment_assignedById_idx"
  ON "VehicleAssignment"("assignedById");

CREATE INDEX "VehicleAssignment_subsidiaryId_idx"
  ON "VehicleAssignment"("subsidiaryId");

ALTER TABLE "VehicleAssignment"
ADD CONSTRAINT "VehicleAssignment_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehicleAssignment"
ADD CONSTRAINT "VehicleAssignment_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VehicleAssignment"
ADD CONSTRAINT "VehicleAssignment_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VehicleAssignment"
ADD CONSTRAINT "VehicleAssignment_subsidiaryId_fkey"
FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

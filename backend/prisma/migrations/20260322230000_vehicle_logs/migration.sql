-- CreateTable
CREATE TABLE "VehicleLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "startPoint" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "initialOdometer" INTEGER NOT NULL,
    "destinationOdometer" INTEGER NOT NULL,
    "distanceCoveredKm" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleLog_vehicleId_idx" ON "VehicleLog"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleLog_driverId_idx" ON "VehicleLog"("driverId");

-- CreateIndex
CREATE INDEX "VehicleLog_departureAt_idx" ON "VehicleLog"("departureAt");

-- CreateIndex
CREATE INDEX "VehicleLog_arrivalAt_idx" ON "VehicleLog"("arrivalAt");

-- AddForeignKey
ALTER TABLE "VehicleLog" ADD CONSTRAINT "VehicleLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleLog" ADD CONSTRAINT "VehicleLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

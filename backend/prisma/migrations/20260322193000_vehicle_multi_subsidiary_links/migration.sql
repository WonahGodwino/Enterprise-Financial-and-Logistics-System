-- CreateTable
CREATE TABLE "VehicleSubsidiary" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleSubsidiary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleSubsidiary_vehicleId_subsidiaryId_key" ON "VehicleSubsidiary"("vehicleId", "subsidiaryId");

-- CreateIndex
CREATE INDEX "VehicleSubsidiary_vehicleId_idx" ON "VehicleSubsidiary"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleSubsidiary_subsidiaryId_idx" ON "VehicleSubsidiary"("subsidiaryId");

-- AddForeignKey
ALTER TABLE "VehicleSubsidiary" ADD CONSTRAINT "VehicleSubsidiary_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSubsidiary" ADD CONSTRAINT "VehicleSubsidiary_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

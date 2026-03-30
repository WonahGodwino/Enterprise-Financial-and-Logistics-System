-- AlterTable
ALTER TABLE "Subsidiary"
ADD COLUMN "country" TEXT NOT NULL DEFAULT 'Nigeria',
ADD COLUMN "state" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "postalCode" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "website" TEXT;

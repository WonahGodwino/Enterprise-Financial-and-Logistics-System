-- DropForeignKey
ALTER TABLE "IncomeRecord" DROP CONSTRAINT "IncomeRecord_subsidiaryId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_subsidiaryId_fkey";

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

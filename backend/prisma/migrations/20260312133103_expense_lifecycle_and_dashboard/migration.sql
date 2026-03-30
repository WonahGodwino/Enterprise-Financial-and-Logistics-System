-- CreateEnum
CREATE TYPE "ExpenseProcessStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "processStatus" "ExpenseProcessStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Expense_processStatus_idx" ON "Expense"("processStatus");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

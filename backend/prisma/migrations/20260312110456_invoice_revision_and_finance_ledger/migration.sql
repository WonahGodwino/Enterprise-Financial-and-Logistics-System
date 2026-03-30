-- CreateEnum
CREATE TYPE "InvoiceChangeType" AS ENUM ('INITIAL_GENERATION', 'REGENERATED_FROM_INCOME', 'APPROVED_MODIFICATION', 'MANUAL_UPDATE');

-- CreateEnum
CREATE TYPE "FinanceTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'INVOICE_ISSUED', 'INVOICE_REVISED', 'PAYMENT_RECEIVED', 'PAYMENT_MADE', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "FinanceTransactionStatus" AS ENUM ('POSTED', 'PENDING', 'VOID', 'REVERSED');

-- CreateEnum
CREATE TYPE "TransactionSourceType" AS ENUM ('INCOME', 'EXPENSE', 'INVOICE', 'PAYMENT', 'MANUAL');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "parentInvoiceId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "InvoiceRevision" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "incomeRecordId" TEXT,
    "previousVersion" INTEGER NOT NULL,
    "nextVersion" INTEGER NOT NULL,
    "changeType" "InvoiceChangeType" NOT NULL DEFAULT 'REGENERATED_FROM_INCOME',
    "reason" TEXT,
    "requestId" TEXT,
    "snapshot" JSONB NOT NULL,
    "approvedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "transactionType" "FinanceTransactionType" NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "status" "FinanceTransactionStatus" NOT NULL DEFAULT 'POSTED',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "exchangeRate" DOUBLE PRECISION DEFAULT 1,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" "TransactionSourceType" NOT NULL,
    "sourceId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "incomeRecordId" TEXT,
    "expenseId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "customerId" TEXT,
    "subsidiaryId" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceRevision_invoiceId_idx" ON "InvoiceRevision"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceRevision_incomeRecordId_idx" ON "InvoiceRevision"("incomeRecordId");

-- CreateIndex
CREATE INDEX "InvoiceRevision_createdAt_idx" ON "InvoiceRevision"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTransaction_transactionRef_key" ON "FinanceTransaction"("transactionRef");

-- CreateIndex
CREATE INDEX "FinanceTransaction_transactionDate_idx" ON "FinanceTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "FinanceTransaction_transactionType_idx" ON "FinanceTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "FinanceTransaction_sourceType_sourceId_idx" ON "FinanceTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_incomeRecordId_idx" ON "FinanceTransaction"("incomeRecordId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_expenseId_idx" ON "FinanceTransaction"("expenseId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_invoiceId_idx" ON "FinanceTransaction"("invoiceId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_paymentId_idx" ON "FinanceTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_customerId_idx" ON "FinanceTransaction"("customerId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_subsidiaryId_idx" ON "FinanceTransaction"("subsidiaryId");

-- CreateIndex
CREATE INDEX "Invoice_parentInvoiceId_idx" ON "Invoice"("parentInvoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_parentInvoiceId_fkey" FOREIGN KEY ("parentInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceRevision" ADD CONSTRAINT "InvoiceRevision_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceRevision" ADD CONSTRAINT "InvoiceRevision_incomeRecordId_fkey" FOREIGN KEY ("incomeRecordId") REFERENCES "IncomeRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceRevision" ADD CONSTRAINT "InvoiceRevision_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceRevision" ADD CONSTRAINT "InvoiceRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_incomeRecordId_fkey" FOREIGN KEY ("incomeRecordId") REFERENCES "IncomeRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

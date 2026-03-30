import prisma from '../config/database.js';

const randomSuffix = () => Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

export class TransactionLedgerService {
  buildRef(prefix) {
    return `${prefix}-${Date.now()}-${randomSuffix()}`;
  }

  async safeCreate(payload) {
    try {
      return await prisma.financeTransaction.create(payload);
    } catch (error) {
      console.warn('FinanceTransaction write skipped:', error.message);
      return null;
    }
  }

  async recordIncome(income, userId, description = 'Income recorded') {
    if (!income) return null;

    return this.safeCreate({
      data: {
        transactionRef: this.buildRef('TRX-INC'),
        transactionType: 'INCOME',
        direction: 'CREDIT',
        amount: income.netAmount || income.amount,
        currency: income.currency || 'NGN',
        exchangeRate: income.exchangeRate || 1,
        transactionDate: income.incomeDate || new Date(),
        sourceType: 'INCOME',
        sourceId: income.id,
        description,
        metadata: {
          incomeType: income.incomeType,
          category: income.category,
        },
        incomeRecordId: income.id,
        customerId: income.customerId || null,
        subsidiaryId: income.subsidiaryId || null,
        recordedById: userId,
      },
    });
  }

  async recordExpense(expense, userId, description = 'Expense recorded') {
    if (!expense) return null;

    return this.safeCreate({
      data: {
        transactionRef: this.buildRef('TRX-EXP'),
        transactionType: 'EXPENSE',
        direction: 'DEBIT',
        amount: expense.amount,
        currency: expense.currency || 'NGN',
        exchangeRate: expense.exchangeRate || 1,
        transactionDate: expense.expenseDate || new Date(),
        sourceType: 'EXPENSE',
        sourceId: expense.id,
        description,
        metadata: {
          expenseType: expense.expenseType,
          expenseCategory: expense.expenseCategory,
        },
        expenseId: expense.id,
        subsidiaryId: expense.subsidiaryId || null,
        recordedById: userId,
      },
    });
  }

  async recordExpenseLifecycle(expense, userId, lifecycleStatus, description = 'Expense lifecycle updated') {
    if (!expense) return null;

    return this.safeCreate({
      data: {
        transactionRef: this.buildRef('TRX-EXP-LF'),
        transactionType: 'ADJUSTMENT',
        direction: 'DEBIT',
        amount: 0,
        currency: expense.currency || 'NGN',
        exchangeRate: expense.exchangeRate || 1,
        transactionDate: new Date(),
        sourceType: 'EXPENSE',
        sourceId: expense.id,
        description,
        metadata: {
          expenseType: expense.expenseType,
          expenseCategory: expense.expenseCategory,
          processStatus: lifecycleStatus,
        },
        expenseId: expense.id,
        subsidiaryId: expense.subsidiaryId || null,
        recordedById: userId,
      },
    });
  }

  async recordInvoice(invoice, userId, transactionType = 'INVOICE_ISSUED', description = 'Invoice generated') {
    if (!invoice) return null;

    return this.safeCreate({
      data: {
        transactionRef: this.buildRef('TRX-INV'),
        transactionType,
        direction: 'CREDIT',
        amount: invoice.totalAmount,
        currency: 'NGN',
        exchangeRate: 1,
        transactionDate: invoice.issueDate || new Date(),
        sourceType: 'INVOICE',
        sourceId: invoice.id,
        description,
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          version: invoice.version || 1,
        },
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        subsidiaryId: invoice.subsidiaryId,
        recordedById: userId,
      },
    });
  }

  async recordPayment(payment, userId, direction = 'CREDIT', description = 'Payment recorded') {
    if (!payment) return null;

    return this.safeCreate({
      data: {
        transactionRef: this.buildRef('TRX-PAY'),
        transactionType: direction === 'DEBIT' ? 'PAYMENT_MADE' : 'PAYMENT_RECEIVED',
        direction,
        amount: payment.amount,
        currency: payment.currency || 'NGN',
        exchangeRate: payment.exchangeRate || 1,
        transactionDate: payment.paymentDate || new Date(),
        sourceType: 'PAYMENT',
        sourceId: payment.id,
        description,
        paymentId: payment.id,
        incomeRecordId: payment.incomeRecordId || null,
        expenseId: payment.expenseId || null,
        invoiceId: payment.invoiceId || null,
        customerId: payment.customerId || null,
        recordedById: userId,
      },
    });
  }

  async recordReversal({
    amount,
    currency = 'NGN',
    exchangeRate = 1,
    transactionDate = new Date(),
    sourceType = 'MANUAL',
    sourceId = null,
    description = 'Transaction reversal',
    metadata = {},
    recordedById,
    incomeRecordId = null,
    expenseId = null,
    invoiceId = null,
    paymentId = null,
    customerId = null,
    subsidiaryId = null,
  }) {
    return this.safeCreate({
      data: {
        transactionRef: this.buildRef('TRX-REV'),
        transactionType: 'REVERSAL',
        direction: 'CREDIT',
        status: 'POSTED',
        amount,
        currency,
        exchangeRate,
        transactionDate,
        sourceType,
        sourceId,
        description,
        metadata,
        incomeRecordId,
        expenseId,
        invoiceId,
        paymentId,
        customerId,
        subsidiaryId,
        recordedById,
      },
    });
  }
}

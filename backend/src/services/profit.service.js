import { OperationRepository } from '../repositories/operation.repository.js';
import { ExpenseRepository } from '../repositories/expense.repository.js';
import { ContributorRepository } from '../repositories/contributor.repository.js';
import { DistributionRepository } from '../repositories/distribution.repository.js';
import { AppError } from '../utils/AppError.js';
import { calculateShares } from '../utils/profitCalculator.js';

export class ProfitService {
  constructor() {
    this.operationRepository = new OperationRepository();
    this.expenseRepository = new ExpenseRepository();
    this.contributorRepository = new ContributorRepository();
    this.distributionRepository = new DistributionRepository();
  }

  async calculateMonthlyProfit(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get all operations
    const operations = await this.operationRepository.findMany({
      operationDate: {
        gte: startDate,
        lte: endDate,
      },
    });

    // Get all expenses
    const expenses = await this.expenseRepository.findMany({
      expenseDate: {
        gte: startDate,
        lte: endDate,
      },
    });

    const totalRevenue = operations.reduce((sum, op) => sum + op.income, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const grossProfit = totalRevenue - totalExpenses;

    // Apply retention rate
    const retentionRate = 0.1; // 10% retained
    const retainedProfit = grossProfit * retentionRate;
    const distributableProfit = grossProfit * 0.9;

    // Distribution setup can be incomplete in early environments; do not fail the KPI endpoint.
    const contributors = await this.contributorRepository.findMany({ isActive: true });
    let distributions = [];
    let distribution = null;
    let distributionWarning = null;

    if (contributors.length > 0) {
      try {
        distributions = calculateShares(distributableProfit, contributors);

        distribution = await this.distributionRepository.create({
          periodStart: startDate,
          periodEnd: endDate,
          totalProfit: grossProfit,
          retainedProfit,
          distributableProfit,
          status: 'CALCULATED',
          details: {
            create: distributions.map(d => ({
              contributorId: d.contributorId,
              amount: d.amount,
              paymentStatus: 'PENDING',
            })),
          },
        });
      } catch (error) {
        distributionWarning = error.message;
      }
    } else {
      distributionWarning = 'No active contributors configured';
    }

    return {
      period: `${year}-${month}`,
      totalRevenue,
      totalExpenses,
      grossProfit,
      retainedProfit,
      distributableProfit,
      distribution: distribution?.id || null,
      distributions,
      distributionWarning,
    };
  }

  async processDistribution(distributionId, paymentData) {
    const distribution = await this.distributionRepository.findById(distributionId, {
      include: { details: true },
    });

    if (!distribution) {
      throw new AppError('Distribution not found', 404);
    }

    if (distribution.status !== 'APPROVED') {
      throw new AppError('Distribution must be approved first', 400);
    }

    // Process payments
    for (const detail of distribution.details) {
      // Integrate with payment gateway
      const paymentResult = await this.processPayment({
        amount: detail.amount,
        contributorId: detail.contributorId,
        ...paymentData,
      });

      await this.distributionRepository.updateDetail(detail.id, {
        paymentStatus: paymentResult.success ? 'PAID' : 'FAILED',
        paidDate: paymentResult.success ? new Date() : null,
      });
    }

    await this.distributionRepository.update(distributionId, {
      status: 'PROCESSED',
      processedAt: new Date(),
    });

    return { success: true, message: 'Distribution processed successfully' };
  }

  async getProfitAnalytics(year) {
    const monthlyData = [];

    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const [operations, expenses] = await Promise.all([
        this.operationRepository.findMany({
          operationDate: { gte: startDate, lte: endDate },
        }),
        this.expenseRepository.findMany({
          expenseDate: { gte: startDate, lte: endDate },
        }),
      ]);

      const revenue = operations.reduce((sum, op) => sum + op.income, 0);
      const costs = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      monthlyData.push({
        month,
        revenue,
        expenses: costs,
        profit: revenue - costs,
        margin: revenue ? ((revenue - costs) / revenue * 100).toFixed(2) : 0,
      });
    }

    return monthlyData;
  }
}
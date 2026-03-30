import { ProfitService } from '../services/profit.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.middleware.js';

export class ProfitController {
  constructor() {
    this.profitService = new ProfitService();
  }

  calculateMonthlyProfit = asyncHandler(async (req, res) => {
    const { year, month } = req.params;
    
    const result = await this.profitService.calculateMonthlyProfit(
      parseInt(year),
      parseInt(month)
    );

    res.json({
      success: true,
      data: result,
    });
  });

  getProfitAnalytics = asyncHandler(async (req, res) => {
    const { year } = req.params;
    
    const analytics = await this.profitService.getProfitAnalytics(parseInt(year));

    res.json({
      success: true,
      data: analytics,
    });
  });

  processDistribution = asyncHandler(async (req, res) => {
    authorize(['ADMIN', 'ACCOUNTANT'])(req, res, async () => {
      const { distributionId } = req.params;
      
      const result = await this.profitService.processDistribution(
        distributionId,
        req.body
      );

      res.json({
        success: true,
        data: result,
      });
    });
  });

  getDistributions = asyncHandler(async (req, res) => {
    const { year } = req.query;
    
    const distributions = await this.profitService.getDistributions(year);

    res.json({
      success: true,
      data: distributions,
    });
  });
}

export default ProfitController;
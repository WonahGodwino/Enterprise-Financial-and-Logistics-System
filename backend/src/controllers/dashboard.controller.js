// backend/src/controllers/dashboard.controller.js
import dashboardService from '../services/dashboard.service.js';

/**
 * Dashboard Controller
 * Provides aggregated data and metrics for dashboards
 */
export class DashboardController {
  /**
   * Get executive dashboard data
   */
  async getExecutiveDashboard(req, res, next) {
    try {
      const filters = req.query;
      const data = await dashboardService.getExecutiveDashboard(filters);
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get operations dashboard data
   */
  async getOperationsDashboard(req, res, next) {
    try {
      const filters = req.query;
      const data = await dashboardService.getOperationsDashboard(filters);
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get financial dashboard data
   */
  async getFinancialDashboard(req, res, next) {
    try {
      const { period = 'month' } = req.query;
      const data = await dashboardService.getFinancialDashboard(period);
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get fleet dashboard data
   */
  async getFleetDashboard(req, res, next) {
    try {
      const filters = req.query;
      const data = await dashboardService.getFleetDashboard(filters);
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get driver dashboard data
   */
  async getDriverDashboard(req, res, next) {
    try {
      const driverId = req.params.driverId || req.user.id;
      const data = await dashboardService.getDriverDashboard(driverId);
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get maintenance dashboard
   */
  async getMaintenanceDashboard(req, res, next) {
    try {
      const data = await dashboardService.getMaintenanceDashboard();
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get AI insights dashboard
   */
  async getAIInsightsDashboard(req, res, next) {
    try {
      const data = await dashboardService.getAIInsightsDashboard();
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(req, res, next) {
    try {
      const metrics = await dashboardService.getRealTimeMetrics();
      
      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get KPI summary
   */
  async getKPISummary(req, res, next) {
    try {
      const { period = 'monthly' } = req.query;
      const kpis = await dashboardService.getKPISummary(period);
      
      res.status(200).json({
        success: true,
        data: kpis
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get chart data for specific metric
   */
  async getChartData(req, res, next) {
    try {
      const metric = req.params.metric || req.query.metric || 'income-expense-trend';
      const { period = 'monthly' } = req.query;
      
      const chartData = await dashboardService.getChartData(metric, period);
      
      res.status(200).json({
        success: true,
        data: chartData
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get drill-down rows for a selected dashboard chart point
   */
  async getDrilldownData(req, res, next) {
    try {
      const {
        metric = 'income-expense-trend',
        period = 'monthly',
        label,
        series,
        entityId,
      } = req.query;

      const data = await dashboardService.getDrilldownData({
        metric,
        period,
        label,
        series,
        entityId,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get alerts and notifications
   */
  async getAlerts(req, res, next) {
    try {
      const userId = req.user.id;
      const alerts = await dashboardService.getUserAlerts(userId);
      
      res.status(200).json({
        success: true,
        data: alerts
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dismiss alert
   */
  async dismissAlert(req, res, next) {
    try {
      const { alertId } = req.params;
      await dashboardService.dismissAlert(alertId);
      
      res.status(200).json({
        success: true,
        message: 'Alert dismissed'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get forecast data
   */
  async getForecastData(req, res, next) {
    try {
      const { metric } = req.params;
      const { horizon = 30 } = req.query;
      
      const forecast = await dashboardService.getForecastData(metric, parseInt(horizon));
      
      res.status(200).json({
        success: true,
        data: forecast
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get anomaly detection results
   */
  async getAnomalies(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const anomalies = await dashboardService.getAnomalies(startDate, endDate);
      
      res.status(200).json({
        success: true,
        data: anomalies
      });
    } catch (error) {
      next(error);
    }
  }
}

export default DashboardController;
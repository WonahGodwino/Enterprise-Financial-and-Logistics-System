import prisma from '../config/database.js';
import { ReportProcessingService } from './reportProcessing.service.js';
import { AppError } from '../utils/AppError.js';
import { generateKPITrends, calculateCorrelation } from '../utils/statistics.js';

export class EmployeePerformanceService {
  constructor() {
    this.reportProcessor = new ReportProcessingService();
  }

  /**
   * Upload and process weekly report
   */
  async uploadWeeklyReport(userId, file, weekData, managerId) {
    try {
      const { weekStartDate, weekEndDate, weekNumber, year } = weekData;

      // Check if report already exists for this week
      const existingReport = await prisma.weeklyReport.findFirst({
        where: {
          userId,
          weekStartDate,
          weekEndDate
        }
      });

      if (existingReport) {
        throw new AppError('Report for this week already exists', 400);
      }

      // Process the report
      const analysis = await this.reportProcessor.processReport(
        file, 
        userId, 
        weekStartDate, 
        weekEndDate
      );

      // Create weekly report record
      const report = await prisma.weeklyReport.create({
        data: {
          userId,
          weekStartDate,
          weekEndDate,
          weekNumber,
          year,
          originalFile: file.path,
          fileType: file.mimetype,
          fileSize: file.size,
          extractedData: analysis.extractedData,
          kpiAnalysis: analysis.kpiAnalysis,
          performanceScore: analysis.performanceScore,
          performanceRating: analysis.performanceRating,
          colorCode: analysis.colorCode,
          aiAnalysis: analysis.analysis,
          status: 'PROCESSING'
        }
      });

      // Update user's average performance score
      await this.updateUserPerformanceScore(userId);

      // If manager is reviewing immediately
      if (managerId) {
        await this.reviewWeeklyReport(report.id, managerId, {
          comments: 'Auto-reviewed after submission',
          status: 'ANALYZED'
        });
      }

      // Generate performance insights
      const insights = await this.generatePerformanceInsights(userId, report);

      return { report, insights };
    } catch (error) {
      throw new AppError('Failed to upload weekly report: ' + error.message, 500);
    }
  }

  /**
   * Review weekly report
   */
  async reviewWeeklyReport(reportId, managerId, reviewData) {
    const { comments, status = 'REVIEWED' } = reviewData;

    const report = await prisma.weeklyReport.update({
      where: { id: reportId },
      data: {
        status,
        managerComments: comments,
        managerId,
        reviewedAt: new Date()
      },
      include: {
        user: true
      }
    });

    // If report is rejected, notify employee
    if (status === 'REJECTED' || status === 'NEEDS_REVISION') {
      await this.sendRevisionNotification(report.user, report);
    }

    return report;
  }

  /**
   * Get employee performance dashboard
   */
  async getEmployeeDashboard(userId, period = 'month') {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'quarter':
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const [user, recentReports, performanceTrend, kpiSummary] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { jobDescription: true }
      }),
      prisma.weeklyReport.findMany({
        where: {
          userId,
          weekStartDate: { gte: startDate }
        },
        orderBy: { weekStartDate: 'desc' }
      }),
      this.getPerformanceTrend(userId, startDate),
      this.getKPISummary(userId, startDate)
    ]);

    // Calculate averages
    const avgScore = recentReports.length > 0
      ? recentReports.reduce((sum, r) => sum + (r.performanceScore || 0), 0) / recentReports.length
      : 0;

    // Get rating distribution
    const ratingDistribution = {
      EXCELLENT: recentReports.filter(r => r.performanceRating === 'EXCELLENT').length,
      GOOD: recentReports.filter(r => r.performanceRating === 'GOOD').length,
      AVERAGE: recentReports.filter(r => r.performanceRating === 'AVERAGE').length,
      POOR: recentReports.filter(r => r.performanceRating === 'POOR').length,
      CRITICAL: recentReports.filter(r => r.performanceRating === 'CRITICAL').length
    };

    // Color code distribution
    const colorDistribution = {
      green: recentReports.filter(r => r.colorCode === 'green').length,
      yellow: recentReports.filter(r => r.colorCode === 'yellow').length,
      orange: recentReports.filter(r => r.colorCode === 'orange').length,
      red: recentReports.filter(r => r.colorCode === 'red').length
    };

    return {
      employee: {
        id: user.id,
        name: user.fullName,
        employeeId: user.employeeId,
        position: user.position,
        department: user.department,
        jobTitle: user.jobDescription?.title
      },
      performance: {
        currentScore: avgScore,
        currentRating: this.getRatingFromScore(avgScore),
        reportsSubmitted: recentReports.length,
        trend: performanceTrend
      },
      kpis: kpiSummary,
      recentReports: recentReports.slice(0, 5),
      distributions: {
        byRating: ratingDistribution,
        byColor: colorDistribution
      }
    };
  }

  /**
   * Get manager dashboard with team performance
   */
  async getManagerDashboard(managerId) {
    // Get all subordinates
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      include: {
        subordinates: {
          include: {
            weeklyReports: {
              orderBy: { weekStartDate: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!manager) {
      throw new AppError('Manager not found', 404);
    }

    const teamPerformance = await Promise.all(
      manager.subordinates.map(async employee => {
        const recentReports = await prisma.weeklyReport.findMany({
          where: {
            userId: employee.id,
            weekStartDate: { gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) }
          },
          orderBy: { weekStartDate: 'desc' }
        });

        const avgScore = recentReports.length > 0
          ? recentReports.reduce((sum, r) => sum + (r.performanceScore || 0), 0) / recentReports.length
          : 0;

        return {
          employeeId: employee.id,
          name: employee.fullName,
          position: employee.position,
          lastReport: employee.weeklyReports[0],
          averageScore: avgScore,
          rating: this.getRatingFromScore(avgScore),
          reportsCount: recentReports.length
        };
      })
    );

    // Team statistics
    const teamStats = {
      totalMembers: manager.subordinates.length,
      activeMembers: manager.subordinates.filter(e => e.isActive).length,
      averageTeamScore: teamPerformance.reduce((sum, e) => sum + e.averageScore, 0) / teamPerformance.length || 0,
      byRating: {
        EXCELLENT: teamPerformance.filter(e => e.rating === 'EXCELLENT').length,
        GOOD: teamPerformance.filter(e => e.rating === 'GOOD').length,
        AVERAGE: teamPerformance.filter(e => e.rating === 'AVERAGE').length,
        POOR: teamPerformance.filter(e => e.rating === 'POOR').length,
        CRITICAL: teamPerformance.filter(e => e.rating === 'CRITICAL').length
      }
    };

    return {
      manager: {
        id: manager.id,
        name: manager.fullName,
        department: manager.department
      },
      teamStats,
      teamPerformance: teamPerformance.sort((a, b) => b.averageScore - a.averageScore)
    };
  }

  /**
   * Upload job description for employee
   */
  async uploadJobDescription(userId, jobData, adminId) {
    const {
      title,
      department,
      reportsTo,
      jobSummary,
      responsibilities,
      qualifications,
      skills,
      experience,
      kpis,
      goals,
      objectives,
      performanceStandards,
      effectiveDate
    } = jobData;

    // Check if job description already exists
    const existing = await prisma.jobDescription.findUnique({
      where: { userId }
    });

    if (existing) {
      // Update with version increment
      return prisma.jobDescription.update({
        where: { userId },
        data: {
          title,
          department,
          reportsTo,
          jobSummary,
          responsibilities,
          qualifications,
          skills,
          experience,
          kpis,
          goals,
          objectives,
          performanceStandards,
          effectiveDate: new Date(effectiveDate),
          version: existing.version + 1,
          updatedAt: new Date(),
          createdById: adminId
        }
      });
    } else {
      // Create new
      return prisma.jobDescription.create({
        data: {
          userId,
          title,
          department,
          reportsTo,
          jobSummary,
          responsibilities,
          qualifications,
          skills,
          experience,
          kpis,
          goals,
          objectives,
          performanceStandards,
          effectiveDate: new Date(effectiveDate),
          createdById: adminId
        }
      });
    }
  }

  /**
   * Generate performance insights and recommendations
   */
  async generatePerformanceInsights(userId, report) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { jobDescription: true }
    });

    const insights = {
      strengths: [],
      improvements: [],
      recommendations: [],
      correlationWithJob: 0
    };

    // Analyze KPI performance
    if (report.kpiAnalysis) {
      report.kpiAnalysis.forEach(kpi => {
        if (kpi.percentage >= 90) {
          insights.strengths.push({
            kpi: kpi.kpiName,
            achievement: `${kpi.percentage}% of target`,
            color: 'green'
          });
        } else if (kpi.percentage < 60) {
          insights.improvements.push({
            kpi: kpi.kpiName,
            gap: `${(100 - kpi.percentage).toFixed(2)}% below target`,
            color: 'red'
          });
        }
      });
    }

    // Calculate correlation with job description
    if (user.jobDescription && report.aiAnalysis) {
      insights.correlationWithJob = report.aiAnalysis.textAnalysis?.relevanceScore || 0;
      
      if (insights.correlationWithJob < 50) {
        insights.recommendations.push({
          type: 'alignment',
          message: 'Reports show low correlation with job description. Consider reviewing job duties or providing additional guidance.',
          priority: 'high'
        });
      }
    }

    // Trend analysis
    const previousReports = await prisma.weeklyReport.findMany({
      where: {
        userId,
        weekStartDate: { lt: report.weekStartDate },
        status: 'REVIEWED'
      },
      orderBy: { weekStartDate: 'desc' },
      take: 4
    });

    if (previousReports.length > 0) {
      const trend = report.performanceScore - 
        (previousReports[0].performanceScore || 0);
      
      insights.trend = {
        direction: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
        change: Math.abs(trend).toFixed(2),
        color: trend > 0 ? 'green' : trend < 0 ? 'red' : 'yellow'
      };
    }

    return insights;
  }

  /**
   * Get performance trend
   */
  async getPerformanceTrend(userId, startDate) {
    const reports = await prisma.weeklyReport.findMany({
      where: {
        userId,
        weekStartDate: { gte: startDate },
        status: { in: ['ANALYZED', 'REVIEWED'] }
      },
      orderBy: { weekStartDate: 'asc' },
      select: {
        weekStartDate: true,
        weekEndDate: true,
        performanceScore: true,
        performanceRating: true,
        colorCode: true
      }
    });

    return generateKPITrends(reports, 'performanceScore');
  }

  /**
   * Get KPI summary
   */
  async getKPISummary(userId, startDate) {
    const reports = await prisma.weeklyReport.findMany({
      where: {
        userId,
        weekStartDate: { gte: startDate }
      },
      select: {
        kpiAnalysis: true
      }
    });

    const kpiSummary = {};

    reports.forEach(report => {
      if (report.kpiAnalysis) {
        report.kpiAnalysis.forEach(kpi => {
          if (!kpiSummary[kpi.kpiId]) {
            kpiSummary[kpi.kpiId] = {
              name: kpi.kpiName,
              target: kpi.target,
              achieved: [],
              percentages: [],
              weight: kpi.weight
            };
          }
          kpiSummary[kpi.kpiId].achieved.push(kpi.achieved);
          kpiSummary[kpi.kpiId].percentages.push(kpi.percentage);
        });
      }
    });

    // Calculate averages
    Object.values(kpiSummary).forEach(kpi => {
      kpi.averageAchieved = kpi.achieved.reduce((a, b) => a + b, 0) / kpi.achieved.length;
      kpi.averagePercentage = kpi.percentages.reduce((a, b) => a + b, 0) / kpi.percentages.length;
      kpi.consistency = this.calculateConsistency(kpi.percentages);
      delete kpi.achieved;
      delete kpi.percentages;
    });

    return kpiSummary;
  }

  /**
   * Update user's average performance score
   */
  async updateUserPerformanceScore(userId) {
    const reports = await prisma.weeklyReport.findMany({
      where: {
        userId,
        status: { in: ['ANALYZED', 'REVIEWED'] }
      },
      select: { performanceScore: true }
    });

    const avgScore = reports.length > 0
      ? reports.reduce((sum, r) => sum + (r.performanceScore || 0), 0) / reports.length
      : 0;

    const rating = this.getRatingFromScore(avgScore);

    await prisma.user.update({
      where: { id: userId },
      data: {
        performanceScore: avgScore,
        performanceRating: rating
      }
    });
  }

  /**
   * Calculate consistency of KPI performance
   */
  calculateConsistency(percentages) {
    if (percentages.length < 2) return 100;

    const mean = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    const variance = percentages.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / percentages.length;
    const stdDev = Math.sqrt(variance);
    const cv = (stdDev / mean) * 100; // Coefficient of variation

    // Lower CV means more consistent
    return Math.max(0, 100 - cv);
  }

  /**
   * Get rating from score
   */
  getRatingFromScore(score) {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 75) return 'GOOD';
    if (score >= 60) return 'AVERAGE';
    if (score >= 40) return 'POOR';
    return 'CRITICAL';
  }

  /**
   * Send revision notification (placeholder - implement with email service)
   */
  async sendRevisionNotification(user, report) {
    // Implement email notification
    console.log(`Notification sent to ${user.email} about report revision needed`);
  }
}
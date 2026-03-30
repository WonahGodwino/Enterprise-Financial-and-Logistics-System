import { EmployeePerformanceService } from '../services/employeePerformance.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import multer from 'multer';
import path from 'path';

const upload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Invalid file type. Only Word, Excel, and CSV files are allowed.', 400));
    }
  }
});

export class EmployeePerformanceController {
  constructor() {
    this.performanceService = new EmployeePerformanceService();
  }

  /**
   * Upload weekly report
   */
  uploadWeeklyReport = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const { weekStartDate, weekEndDate, weekNumber, year } = req.body;
    
    if (!weekStartDate || !weekEndDate || !weekNumber || !year) {
      throw new AppError('Missing required fields: weekStartDate, weekEndDate, weekNumber, year', 400);
    }

    const result = await this.performanceService.uploadWeeklyReport(
      req.user.id,
      req.file,
      {
        weekStartDate: new Date(weekStartDate),
        weekEndDate: new Date(weekEndDate),
        weekNumber: parseInt(weekNumber),
        year: parseInt(year)
      },
      req.user.role === 'MANAGER' || req.user.role === 'ADMIN' ? req.user.id : null
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Weekly report uploaded and analyzed successfully'
    });
  });

  /**
   * Get employee performance dashboard
   */
  getEmployeeDashboard = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { period } = req.query;

    // Check if user has access
    if (req.user.id !== userId && 
        req.user.role !== 'ADMIN' && 
        req.user.role !== 'CEO' && 
        req.user.role !== 'MANAGER') {
      throw new AppError('Unauthorized to view this employee\'s data', 403);
    }

    const dashboard = await this.performanceService.getEmployeeDashboard(userId, period);

    res.json({
      success: true,
      data: dashboard
    });
  });

  /**
   * Get manager dashboard with team performance
   */
  getManagerDashboard = asyncHandler(async (req, res) => {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN' && req.user.role !== 'CEO') {
      throw new AppError('Only managers can access team dashboard', 403);
    }

    const dashboard = await this.performanceService.getManagerDashboard(req.user.id);

    res.json({
      success: true,
      data: dashboard
    });
  });

  /**
   * Review weekly report (for managers)
   */
  reviewWeeklyReport = asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { comments, status } = req.body;

    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN' && req.user.role !== 'CEO') {
      throw new AppError('Only managers can review reports', 403);
    }

    const report = await this.performanceService.reviewWeeklyReport(
      reportId,
      req.user.id,
      { comments, status }
    );

    res.json({
      success: true,
      data: report,
      message: 'Report reviewed successfully'
    });
  });

  /**
   * Upload job description (admin/manager only)
   */
  uploadJobDescription = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (req.user.role !== 'ADMIN' && req.user.role !== 'CEO' && req.user.role !== 'MANAGER') {
      throw new AppError('Only admins and managers can upload job descriptions', 403);
    }

    const jobDescription = await this.performanceService.uploadJobDescription(
      userId,
      req.body,
      req.user.id
    );

    res.status(201).json({
      success: true,
      data: jobDescription,
      message: 'Job description uploaded successfully'
    });
  });

  /**
   * Get employee's weekly reports
   */
  getEmployeeReports = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { startDate, endDate, limit = 20, page = 1 } = req.query;

    const where = { userId };
    
    if (startDate && endDate) {
      where.weekStartDate = { gte: new Date(startDate) };
      where.weekEndDate = { lte: new Date(endDate) };
    }

    const reports = await prisma.weeklyReport.findMany({
      where,
      orderBy: { weekStartDate: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    const total = await prisma.weeklyReport.count({ where });

    res.json({
      success: true,
      data: reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  });

  /**
   * Get performance statistics for organization
   */
  getOrganizationPerformance = asyncHandler(async (req, res) => {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'CEO') {
      throw new AppError('Unauthorized', 403);
    }

    const { department, startDate, endDate } = req.query;

    const where = {};
    if (department) where.department = department;

    const employees = await prisma.user.findMany({
      where: {
        ...where,
        role: { in: ['EMPLOYEE', 'SUPERVISOR'] },
        isActive: true
      },
      include: {
        weeklyReports: {
          where: {
            weekStartDate: {
              gte: startDate ? new Date(startDate) : undefined,
              lte: endDate ? new Date(endDate) : undefined
            }
          },
          orderBy: { weekStartDate: 'desc' }
        }
      }
    });

    const stats = {
      totalEmployees: employees.length,
      averageScore: 0,
      byRating: {
        EXCELLENT: 0,
        GOOD: 0,
        AVERAGE: 0,
        POOR: 0,
        CRITICAL: 0
      },
      byColor: {
        green: 0,
        yellow: 0,
        orange: 0,
        red: 0
      },
      topPerformers: [],
      needsAttention: []
    };

    employees.forEach(emp => {
      if (emp.weeklyReports.length > 0) {
        const latestReport = emp.weeklyReports[0];
        stats.averageScore += latestReport.performanceScore || 0;
        
        if (latestReport.performanceRating) {
          stats.byRating[latestReport.performanceRating]++;
        }
        if (latestReport.colorCode) {
          stats.byColor[latestReport.colorCode]++;
        }

        if (latestReport.performanceRating === 'EXCELLENT') {
          stats.topPerformers.push({
            id: emp.id,
            name: emp.fullName,
            score: latestReport.performanceScore,
            department: emp.department
          });
        }

        if (latestReport.performanceRating === 'POOR' || latestReport.performanceRating === 'CRITICAL') {
          stats.needsAttention.push({
            id: emp.id,
            name: emp.fullName,
            score: latestReport.performanceScore,
            rating: latestReport.performanceRating,
            department: emp.department
          });
        }
      }
    });

    stats.averageScore = employees.length > 0 
      ? stats.averageScore / employees.length 
      : 0;

    res.json({
      success: true,
      data: stats
    });
  });

  /**
   * Get report for download
   */
  downloadReport = asyncHandler(async (req, res) => {
    const { reportId } = req.params;

    const report = await prisma.weeklyReport.findUnique({
      where: { id: reportId },
      select: { originalFile: true, fileType: true }
    });

    if (!report) {
      throw new AppError('Report not found', 404);
    }

    res.download(report.originalFile);
  });
}
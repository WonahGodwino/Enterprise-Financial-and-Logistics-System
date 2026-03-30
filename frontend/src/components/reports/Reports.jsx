// frontend/src/components/reports/Reports.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  BarChart3,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  FilePieChart,
  Truck,
  DollarSign,
  Wrench,
  Users,
  TrendingUp
} from 'lucide-react';
import api from '../../services/api';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const Reports = () => {
  const { mode } = useTheme();
  const [selectedReport, setSelectedReport] = useState('expense');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [reportResult, setReportResult] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [format, setFormat] = useState('csv');
  const [filters, setFilters] = useState({
    customerId: '',
    staffId: '',
    incomeCategory: '',
    expenseCategory: '',
  });

  const reportTypes = [
    {
      id: 'expense',
      name: 'Expense Report',
      icon: DollarSign,
      description: 'Detailed breakdown of all expenses',
      color: 'bg-green-500'
    },
    {
      id: 'fuel',
      name: 'Fuel Consumption',
      icon: TrendingUp,
      description: 'Fuel usage and efficiency analysis',
      color: 'bg-blue-500'
    },
    {
      id: 'maintenance',
      name: 'Maintenance',
      icon: Wrench,
      description: 'Maintenance history and costs',
      color: 'bg-yellow-500'
    },
    {
      id: 'vehicle',
      name: 'Vehicle Utilization',
      icon: Truck,
      description: 'Vehicle usage and performance',
      color: 'bg-purple-500'
    },
    {
      id: 'driver',
      name: 'Driver Performance',
      icon: Users,
      description: 'Driver metrics and efficiency',
      color: 'bg-indigo-500'
    },
    {
      id: 'financial',
      name: 'Financial Summary',
      icon: BarChart3,
      description: 'Profit & loss overview',
      color: 'bg-blue-500'
    }
  ];

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timer = setTimeout(() => setSuccessMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const reportData = useMemo(() => reportResult?.data || reportResult || {}, [reportResult]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    setError('');
    try {
      const response = await api.generateReport({
        reportType: selectedReport,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        customerId: filters.customerId || undefined,
        staffId: filters.staffId || undefined,
        incomeCategory: filters.incomeCategory || undefined,
        expenseCategory: filters.expenseCategory || undefined,
      });

      setReportResult(response?.data || response || {});
      setSuccessMessage('Report generated successfully.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to generate report';
      setError(message);
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = async () => {
    setDownloading(true);
    setError('');

    try {
      const blob = await api.exportReport(format, {
        reportType: selectedReport,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        customerId: filters.customerId || undefined,
        staffId: filters.staffId || undefined,
        incomeCategory: filters.incomeCategory || undefined,
        expenseCategory: filters.expenseCategory || undefined,
      });

      const hasContent = blob && typeof blob.size === 'number' && blob.size > 0;
      const fallback = new Blob([''], { type: 'text/plain' });
      const downloadable = hasContent ? blob : fallback;

      const ext = format === 'excel' ? 'xlsx' : format;
      const fileName = `${selectedReport}-report-${dateRange.startDate}-to-${dateRange.endDate}.${ext}`;

      const url = window.URL.createObjectURL(downloadable);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMessage('Report downloaded successfully.');
    } catch (downloadError) {
      const message = downloadError?.response?.data?.message || 'Failed to download report';
      setError(message);
    } finally {
      setDownloading(false);
    }
  };

  const expenseCategoryData = reportData.expenseByCategory || [];
  const incomeByCustomerData = reportData.incomeByCustomer || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        <div className="flex items-center space-x-3">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={`rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${mode === 'dark' ? 'border border-slate-600 bg-slate-800 text-white' : 'border border-gray-300 bg-white text-gray-900'}`}
          >
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
            <option value="json">JSON</option>
          </select>

          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </button>

          <button
            onClick={handleDownloadReport}
            disabled={downloading}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center"
          >
            {downloading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-blue-50 text-blue-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={`bg-white rounded-lg shadow p-6 text-left hover:shadow-lg transition-shadow ${
              selectedReport === report.id ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <div className="flex items-start space-x-4">
              <div className={`${report.color} p-3 rounded-lg`}>
                <report.icon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{report.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{report.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Report Parameters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer ID (optional)
            </label>
            <input
              type="text"
              value={filters.customerId}
              onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
              placeholder="e.g. cm123..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Staff ID (optional)
            </label>
            <input
              type="text"
              value={filters.staffId}
              onChange={(e) => setFilters({ ...filters, staffId: e.target.value })}
              placeholder="e.g. user-1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Income Category (optional)
            </label>
            <input
              type="text"
              value={filters.incomeCategory}
              onChange={(e) => setFilters({ ...filters, incomeCategory: e.target.value })}
              placeholder="e.g. SERVICE_REVENUE"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expense Category (optional)
            </label>
            <input
              type="text"
              value={filters.expenseCategory}
              onChange={(e) => setFilters({ ...filters, expenseCategory: e.target.value })}
              placeholder="e.g. FUEL"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center space-x-4">
          <button className="flex items-center text-gray-600 hover:text-gray-900">
            <Filter className="h-4 w-4 mr-1" />
            Advanced Filters
          </button>
          <div className="flex-1"></div>
          <div className="flex items-center space-x-2">
            <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
              <FileSpreadsheet className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
              <FilePieChart className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
              <Download className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Preview</h2>
        {!reportResult ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">
              Select parameters, click Generate Report, then download the selected format.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-700">Total Income</p>
                <p className="text-xl font-semibold text-blue-900">{Number(reportData.summary?.totalIncome || 0).toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-700">Total Expenses</p>
                <p className="text-xl font-semibold text-blue-900">{Number(reportData.summary?.totalExpenses || 0).toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4">
                <p className="text-sm text-emerald-700">Net Profit</p>
                <p className="text-xl font-semibold text-emerald-900">{Number(reportData.summary?.netProfit || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Customer Income</h3>
                <Bar
                  data={{
                    labels: incomeByCustomerData.map((r) => r.label),
                    datasets: [{
                      label: 'Income',
                      data: incomeByCustomerData.map((r) => r.value),
                      backgroundColor: 'rgba(37, 99, 235, 0.7)',
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } } }}
                />
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Expenses by Category</h3>
                <Doughnut
                  data={{
                    labels: expenseCategoryData.map((r) => r.label),
                    datasets: [{
                      data: expenseCategoryData.map((r) => r.value),
                      backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
                />
              </div>
            </div>

            {Array.isArray(reportData.notes) && reportData.notes.length > 0 && (
              <div className="bg-amber-50 text-amber-800 rounded-lg p-3 text-sm">
                {reportData.notes.join(' ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saved Reports */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Saved Reports</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 hover:bg-gray-50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Monthly Expense Report - March 2026
                  </p>
                  <p className="text-xs text-gray-500">Generated on Mar 1, 2026</p>
                </div>
              </div>
              <button className="text-blue-600 hover:text-blue-800">
                <Download className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Reports;
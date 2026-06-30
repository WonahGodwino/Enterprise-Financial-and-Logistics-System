// frontend/src/components/reports/Reports.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '../../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const Reports = () => {
  const { mode } = useTheme();
  const { user } = useAuth();
  const dm = mode === 'dark';
  const dc = (light, dark) => dm ? dark : light;
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

  // Debtors report
  const [debtorsReport, setDebtorsReport] = useState(null);
  const [debtorsLoading, setDebtorsLoading] = useState(false);
  const [debtorsSubsidiaryFilter, setDebtorsSubsidiaryFilter] = useState('');
  const [subsidiaries, setSubsidiaries] = useState([]);

  const isDebtorsReport = selectedReport === 'debtors';

  const loadSubsidiaries = useCallback(async () => {
    try {
      const res = await api.getSubsidiaries();
      setSubsidiaries(Array.isArray(res?.data) ? res.data : []);
    } catch { setSubsidiaries([]); }
  }, []);
  useEffect(() => { loadSubsidiaries(); }, [loadSubsidiaries]);

  const loadDebtorsReport = useCallback(async () => {
    setDebtorsLoading(true);
    setError('');
    try {
      const params = { minBalance: 0 };
      if (debtorsSubsidiaryFilter) params.subsidiaryId = debtorsSubsidiaryFilter;
      const res = await api.getIndebtedCustomersReport(params);
      setDebtorsReport(res?.data || null);
      setSuccessMessage('Debtors report loaded.');
    } catch (err) {
      setDebtorsReport(null);
      setError('Failed to load debtors report. Ensure the backend is running and the migration has been applied.');
    } finally {
      setDebtorsLoading(false);
    }
  }, [debtorsSubsidiaryFilter]);

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
    },
    {
      id: 'debtors',
      name: 'Debtors Report',
      icon: DollarSign,
      description: 'All customers with outstanding balances — CEO sees all, staff see own',
      color: 'bg-red-500'
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

  // Load debtors when tab switches
  useEffect(() => {
    if (isDebtorsReport) loadDebtorsReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport]);

  const handleGenerateReport = async () => {
    if (isDebtorsReport) {
      await loadDebtorsReport();
      return;
    }
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
    if (isDebtorsReport) {
      const customers = debtorsReport?.customers || [];
      const headers = 'Created,Last Transaction,Customer,Assigned Staff,Subsidiary,Total Amount,Amount Paid,Balance\n';
      let csv = headers;
      customers.forEach((c) => {
        const name = (c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.id).replace(/"/g, '""');
        const staff = (c.assignedStaff?.fullName || 'Unassigned').replace(/"/g, '""');
        const sub = (c.subsidiary?.name || '-').replace(/"/g, '""');
        const created = c.initialTransactionDate ? new Date(c.initialTransactionDate).toLocaleDateString() : '-';
        const lastDate = c.lastTransactionDate ? new Date(c.lastTransactionDate).toLocaleDateString() : '-';
        csv += `${created},${lastDate},"${name}","${staff}","${sub}",${c.totalAmount || 0},${c.amountPaid || 0},${c.outstandingBalance || 0}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debtors-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccessMessage('Debtors report downloaded.');
      return;
    }

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
    <div className="space-y-6 pt-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={dc('text-2xl font-bold text-gray-800','text-2xl font-bold text-slate-100')}>Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={dc('rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 bg-white text-gray-900','rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-600 bg-slate-700 text-slate-100')}
          >
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
            <option value="json">JSON</option>
          </select>

          <button
            onClick={handleGenerateReport}
            disabled={generating || debtorsLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center whitespace-nowrap"
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
            disabled={downloading || (isDebtorsReport && !debtorsReport)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center whitespace-nowrap"
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
            className={dc(
              `bg-white rounded-lg shadow p-6 text-left hover:shadow-lg transition-shadow ${selectedReport === report.id ? 'ring-2 ring-blue-500' : ''}`,
              `bg-slate-800 rounded-lg shadow p-6 text-left hover:shadow-lg transition-shadow border border-slate-700 ${selectedReport === report.id ? 'ring-2 ring-blue-500' : ''}`
            )}
          >
            <div className="flex items-start space-x-4">
              <div className={`${report.color} p-3 rounded-lg`}>
                <report.icon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className={dc('font-semibold text-gray-900','font-semibold text-slate-100')}>{report.name}</h3>
                <p className={dc('text-sm text-gray-500 mt-1','text-sm text-slate-400 mt-1')}>{report.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Date Range Filter */}
      <div className={dc('bg-white rounded-lg shadow p-6','bg-slate-800 rounded-lg shadow p-6 border border-slate-700')}>
        <h2 className={dc('text-lg font-semibold mb-4','text-lg font-semibold mb-4 text-slate-100')}>Report Parameters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={dc('block text-sm font-medium text-gray-700 mb-2','block text-sm font-medium text-slate-200 mb-2')}>
              Start Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className={dc('w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500','w-full pl-10 pr-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]')}
              />
            </div>
          </div>

          <div>
            <label className={dc('block text-sm font-medium text-gray-700 mb-2','block text-sm font-medium text-slate-200 mb-2')}>
              End Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className={dc('w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500','w-full pl-10 pr-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]')}
              />
            </div>
          </div>

          <div>
            <label className={dc('block text-sm font-medium text-gray-700 mb-2','block text-sm font-medium text-slate-200 mb-2')}>
              Customer ID (optional)
            </label>
            <input
              type="text"
              value={filters.customerId}
              onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
              placeholder="e.g. cm123..."
              className={dc('w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500','w-full px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500')}
            />
          </div>

          <div>
            <label className={dc('block text-sm font-medium text-gray-700 mb-2','block text-sm font-medium text-slate-200 mb-2')}>
              Staff ID (optional)
            </label>
            <input
              type="text"
              value={filters.staffId}
              onChange={(e) => setFilters({ ...filters, staffId: e.target.value })}
              placeholder="e.g. user-1"
              className={dc('w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500','w-full px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500')}
            />
          </div>

          <div>
            <label className={dc('block text-sm font-medium text-gray-700 mb-2','block text-sm font-medium text-slate-200 mb-2')}>
              Income Category (optional)
            </label>
            <input
              type="text"
              value={filters.incomeCategory}
              onChange={(e) => setFilters({ ...filters, incomeCategory: e.target.value })}
              placeholder="e.g. SERVICE_REVENUE"
              className={dc('w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500','w-full px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500')}
            />
          </div>

          <div>
            <label className={dc('block text-sm font-medium text-gray-700 mb-2','block text-sm font-medium text-slate-200 mb-2')}>
              Expense Category (optional)
            </label>
            <input
              type="text"
              value={filters.expenseCategory}
              onChange={(e) => setFilters({ ...filters, expenseCategory: e.target.value })}
              placeholder="e.g. FUEL"
              className={dc('w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500','w-full px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500')}
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
      {isDebtorsReport ? (
        <div className={dc('bg-white rounded-lg shadow p-6','bg-slate-800 rounded-lg shadow p-6 border border-slate-700')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={dc('text-lg font-semibold','text-lg font-semibold text-slate-100')}>Debtors Report</h2>
            <select
              value={debtorsSubsidiaryFilter}
              onChange={(e) => setDebtorsSubsidiaryFilter(e.target.value)}
              className={dc('rounded-lg border border-gray-300 px-3 py-2 text-sm','rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100')}
            >
              <option value="">All Subsidiaries</option>
              {subsidiaries.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          {debtorsLoading ? (
            <div className={dc('bg-gray-50 rounded-lg p-8 text-center','bg-slate-700/50 rounded-lg p-8 text-center')}><RefreshCw className={dc('h-12 w-12 text-gray-400 mx-auto mb-3 animate-spin','h-12 w-12 text-slate-500 mx-auto mb-3 animate-spin')} /><p className={dc('text-gray-500','text-slate-400')}>Loading debtors report...</p></div>
          ) : !debtorsReport ? (
            <div className={dc('bg-gray-50 rounded-lg p-8 text-center','bg-slate-700/50 rounded-lg p-8 text-center')}><BarChart3 className={dc('h-12 w-12 text-gray-400 mx-auto mb-3','h-12 w-12 text-slate-500 mx-auto mb-3')} /><p className={dc('text-gray-500','text-slate-400')}>Click Generate Report to load indebted customers.</p></div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div className={dc('bg-amber-50 rounded-lg p-4','bg-amber-500/10 rounded-lg p-4 border border-amber-500/30')}><p className={dc('text-sm text-amber-700','text-sm text-amber-300')}>Indebted Customers</p><p className={dc('text-xl font-semibold text-amber-900','text-xl font-semibold text-amber-200')}>{debtorsReport.summary?.totalIndebtedCustomers || 0}</p></div>
                <div className={dc('bg-red-50 rounded-lg p-4','bg-red-500/10 rounded-lg p-4 border border-red-500/30')}><p className={dc('text-sm text-red-700','text-sm text-red-300')}>Total Outstanding</p><p className={dc('text-xl font-semibold text-red-900','text-xl font-semibold text-red-200')}>₦{(debtorsReport.summary?.totalOutstandingBalance || 0).toLocaleString()}</p></div>
                <div className={dc('bg-blue-50 rounded-lg p-4','bg-blue-500/10 rounded-lg p-4 border border-blue-500/30')}><p className={dc('text-sm text-blue-700','text-sm text-blue-300')}>Total Owed</p><p className={dc('text-xl font-semibold text-blue-900','text-xl font-semibold text-blue-200')}>₦{(debtorsReport.summary?.totalAmountOwed || 0).toLocaleString()}</p></div>
                <div className={dc('bg-emerald-50 rounded-lg p-4','bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/30')}><p className={dc('text-sm text-emerald-700','text-sm text-emerald-300')}>Total Paid</p><p className={dc('text-xl font-semibold text-emerald-900','text-xl font-semibold text-emerald-200')}>₦{(debtorsReport.summary?.totalAmountPaid || 0).toLocaleString()}</p></div>
                <div className={dc('bg-orange-50 rounded-lg p-4','bg-orange-500/10 rounded-lg p-4 border border-orange-500/30')}><p className={dc('text-sm text-orange-700','text-sm text-orange-300')}>Avg Debt</p><p className={dc('text-xl font-semibold text-orange-900','text-xl font-semibold text-orange-200')}>₦{(debtorsReport.summary?.averageDebt || 0).toLocaleString()}</p></div>
              </div>
              {debtorsReport.customers?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className={dc('bg-red-100','bg-red-500/20')}><tr className={dc('text-left text-red-900','text-left text-red-200')}><th className="py-2 px-3">Created</th><th className="py-2 px-3">Last Trans.</th><th className="py-2 px-3">Customer</th><th className="py-2 px-3">Assigned Staff</th><th className="py-2 px-3">Subsidiary</th><th className="py-2 px-3 text-right">Total Amount</th><th className="py-2 px-3 text-right">Amount Paid</th><th className="py-2 px-3 text-right">Balance</th></tr></thead>
                    <tbody>{debtorsReport.customers.map((c) => (
                      <tr key={c.id} className={dc('border-b border-gray-100','border-b border-slate-700')}><td className={dc('py-2 px-3 text-xs','py-2 px-3 text-xs text-slate-300')}>{c.initialTransactionDate ? new Date(c.initialTransactionDate).toLocaleDateString() : '-'}</td><td className={dc('py-2 px-3 text-xs','py-2 px-3 text-xs text-slate-300')}>{c.lastTransactionDate ? new Date(c.lastTransactionDate).toLocaleDateString() : '-'}</td><td className={dc('py-2 px-3','py-2 px-3 text-slate-100')}>{c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.id}</td><td className={dc('py-2 px-3','py-2 px-3 text-slate-200')}>{c.assignedStaff?.fullName || 'Unassigned'}</td><td className={dc('py-2 px-3','py-2 px-3 text-slate-200')}>{c.subsidiary?.name || '-'}</td><td className={dc('py-2 px-3 text-right','py-2 px-3 text-right text-slate-200')}>₦{(c.totalAmount || 0).toLocaleString()}</td><td className={dc('py-2 px-3 text-right text-emerald-700','py-2 px-3 text-right text-emerald-400')}>₦{(c.amountPaid || 0).toLocaleString()}</td><td className={dc('py-2 px-3 text-right font-medium text-red-700','py-2 px-3 text-right font-medium text-red-400')}>₦{(c.outstandingBalance || 0).toLocaleString()}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
      <div className={dc('bg-white rounded-lg shadow p-6','bg-slate-800 rounded-lg shadow p-6 border border-slate-700')}>
        <h2 className={dc('text-lg font-semibold mb-4','text-lg font-semibold mb-4 text-slate-100')}>Preview</h2>
        {!reportResult ? (
          <div className={dc('bg-gray-50 rounded-lg p-8 text-center','bg-slate-700/50 rounded-lg p-8 text-center')}>
            <BarChart3 className={dc('h-12 w-12 text-gray-400 mx-auto mb-3','h-12 w-12 text-slate-500 mx-auto mb-3')} />
            <p className={dc('text-gray-500','text-slate-400')}>
              Select parameters, click Generate Report, then download the selected format.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={dc('bg-blue-50 rounded-lg p-4','bg-blue-500/10 rounded-lg p-4 border border-blue-500/30')}>
                <p className={dc('text-sm text-blue-700','text-sm text-blue-300')}>Total Income</p>
                <p className={dc('text-xl font-semibold text-blue-900','text-xl font-semibold text-blue-200')}>{Number(reportData.summary?.totalIncome || 0).toLocaleString()}</p>
              </div>
              <div className={dc('bg-blue-50 rounded-lg p-4','bg-blue-500/10 rounded-lg p-4 border border-blue-500/30')}>
                <p className={dc('text-sm text-blue-700','text-sm text-blue-300')}>Total Expenses</p>
                <p className={dc('text-xl font-semibold text-blue-900','text-xl font-semibold text-blue-200')}>{Number(reportData.summary?.totalExpenses || 0).toLocaleString()}</p>
              </div>
              <div className={dc('bg-emerald-50 rounded-lg p-4','bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/30')}>
                <p className={dc('text-sm text-emerald-700','text-sm text-emerald-300')}>Net Profit</p>
                <p className={dc('text-xl font-semibold text-emerald-900','text-xl font-semibold text-emerald-200')}>{Number(reportData.summary?.netProfit || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={dc('border border-gray-200 rounded-lg p-4','border border-slate-600 rounded-lg p-4')}>
                <h3 className={dc('text-sm font-semibold text-gray-700 mb-3','text-sm font-semibold text-slate-200 mb-3')}>Customer Income</h3>
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

              <div className={dc('border border-gray-200 rounded-lg p-4','border border-slate-600 rounded-lg p-4')}>
                <h3 className={dc('text-sm font-semibold text-gray-700 mb-3','text-sm font-semibold text-slate-200 mb-3')}>Expenses by Category</h3>
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
      )}

      {/* Saved Reports */}
      <div className={dc('bg-white rounded-lg shadow','bg-slate-800 rounded-lg shadow border border-slate-700')}>
        <div className={dc('px-6 py-4 border-b border-gray-200','px-6 py-4 border-b border-slate-700')}>
          <h2 className={dc('text-lg font-semibold','text-lg font-semibold text-slate-100')}>Saved Reports</h2>
        </div>
        <div className={dc('divide-y divide-gray-200','divide-y divide-slate-700')}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={dc('p-4 hover:bg-gray-50 flex items-center justify-between','p-4 hover:bg-slate-700/50 flex items-center justify-between')}>
              <div className="flex items-center space-x-3">
                <FileText className={dc('h-5 w-5 text-gray-400','h-5 w-5 text-slate-500')} />
                <div>
                  <p className={dc('text-sm font-medium text-gray-900','text-sm font-medium text-slate-200')}>
                    Monthly Expense Report - March 2026
                  </p>
                  <p className={dc('text-xs text-gray-500','text-xs text-slate-400')}>Generated on Mar 1, 2026</p>
                </div>
              </div>
              <button className={dc('text-blue-600 hover:text-blue-800','text-blue-400 hover:text-blue-300')}>
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, DollarSign, PieChart, TrendingUp } from 'lucide-react';
import { Chart, Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
  Filler,
} from 'chart.js';
import api from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
  Filler
);

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const CHART_METRICS = {
  trend: 'income-expense-trend',
  expenseByCategory: 'expenses-by-category',
  incomeByCustomer: 'income-by-customer',
};


const formatTrendLabels = (period, labels = []) => {
  const safeLabels = Array.isArray(labels) ? labels : [];

  if (period === 'monthly') {
    return safeLabels.map((label) => {
      const [yearPart, monthPart] = String(label || '').split('-');
      const year = Number(yearPart);
      const month = Number(monthPart);

      if (!year || !month || month < 1 || month > 12) {
        return label;
      }

      const date = new Date(Date.UTC(year, month - 1, 1));
      return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    });
  }

  if (period === 'yearly') {
    return safeLabels.map((label) => String(label || ''));
  }

  return safeLabels;
};


const buildCompanyFinanceSnapshot = (subsidiaryRows = [], incomeRows = [], expenseRows = []) => {
  const subsidiaries = Array.isArray(subsidiaryRows) ? subsidiaryRows : [];
  const incomes = Array.isArray(incomeRows) ? incomeRows : [];
  const expenses = Array.isArray(expenseRows) ? expenseRows : [];

  const unitMap = new Map(
    subsidiaries.map((row) => [
      row.id,
      {
        id: row.id,
        code: String(row.code || '').toUpperCase(),
        label: row.code || row.name || 'Subsidiary',
        income: 0,
        expenses: 0,
      },
    ])
  );

  const toAmount = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  let totalIncome = 0;
  let totalExpenses = 0;

  incomes.forEach((income) => {
    const value = toAmount(income?.netAmount ?? income?.amount);
    totalIncome += value;
    const subsidiaryId = income?.subsidiaryId || income?.subsidiary?.id;
    if (subsidiaryId && unitMap.has(subsidiaryId)) {
      unitMap.get(subsidiaryId).income += value;
    }
  });

  expenses.forEach((expense) => {
    const value = toAmount(expense?.amount);
    totalExpenses += value;
    const subsidiaryId = expense?.subsidiaryId || expense?.subsidiary?.id;
    if (subsidiaryId && unitMap.has(subsidiaryId)) {
      unitMap.get(subsidiaryId).expenses += value;
    }
  });

  const allUnits = Array.from(unitMap.values());
  const mainUnit = allUnits.find((unit) => unit.code === 'MAIN') || null;
  const subsidiaryUnits = allUnits
    .filter((unit) => unit.code !== 'MAIN')
    .sort((a, b) => (b.income + b.expenses) - (a.income + a.expenses));

  const maxUnits = 8;
  const subsidiarySlots = mainUnit ? maxUnits - 1 : maxUnits;
  const chartUnits = [
    ...(mainUnit ? [mainUnit] : []),
    ...subsidiaryUnits.slice(0, Math.max(subsidiarySlots, 0)),
  ];

  const hasUnitBreakdown = chartUnits.length > 0;
  const labels = hasUnitBreakdown ? chartUnits.map((unit) => unit.label) : ['Main (Aggregate)'];
  const incomeValues = hasUnitBreakdown ? chartUnits.map((unit) => unit.income) : [totalIncome];
  const expenseValues = hasUnitBreakdown ? chartUnits.map((unit) => unit.expenses) : [totalExpenses];
  const netValues = incomeValues.map((value, index) => value - (expenseValues[index] || 0));

  const netIncome = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0;

  return {
    summary: {
      mainCount: mainUnit ? 1 : 0,
      subsidiaryCount: subsidiaryUnits.length,
      income: totalIncome,
      expenses: totalExpenses,
      net: netIncome,
      margin,
    },
    chartData: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeValues,
          backgroundColor: 'rgba(37, 99, 235, 0.85)',
          borderColor: '#1d4ed8',
          borderWidth: 1,
        },
        {
          label: 'Expenditure',
          data: expenseValues,
          backgroundColor: 'rgba(220, 38, 38, 0.82)',
          borderColor: '#b91c1c',
          borderWidth: 1,
        },
        {
          type: 'line',
          label: 'Net',
          data: netValues,
          borderColor: '#0f766e',
          backgroundColor: 'rgba(15, 118, 110, 0.1)',
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: '#0f766e',
          yAxisID: 'y',
        },
      ],
    },
    hasUnitBreakdown,
  };
};

const buildSnapshotFromTotals = (income = 0, expenses = 0) => {
  const normalizedIncome = Number(income || 0);
  const normalizedExpenses = Number(expenses || 0);
  const net = normalizedIncome - normalizedExpenses;
  const margin = normalizedIncome > 0 ? (net / normalizedIncome) * 100 : 0;

  return {
    summary: {
      mainCount: 0,
      subsidiaryCount: 0,
      income: normalizedIncome,
      expenses: normalizedExpenses,
      net,
      margin,
    },
    chartData: {
      labels: ['Main (Aggregate)'],
      datasets: [
        {
          label: 'Income',
          data: [normalizedIncome],
          backgroundColor: 'rgba(37, 99, 235, 0.85)',
          borderColor: '#1d4ed8',
          borderWidth: 1,
        },
        {
          label: 'Expenditure',
          data: [normalizedExpenses],
          backgroundColor: 'rgba(220, 38, 38, 0.82)',
          borderColor: '#b91c1c',
          borderWidth: 1,
        },
        {
          type: 'line',
          label: 'Net',
          data: [net],
          borderColor: '#0f766e',
          backgroundColor: 'rgba(15, 118, 110, 0.1)',
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: '#0f766e',
          yAxisID: 'y',
        },
      ],
    },
    hasUnitBreakdown: false,
  };
};

const Dashboard = () => {
  const { mode } = useTheme();
  const dm = mode === 'dark';
  const [period, setPeriod] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [focusedSection, setFocusedSection] = useState('trend');
  const [drillState, setDrillState] = useState(null);
  const [cacheHealthChecking, setCacheHealthChecking] = useState(false);

  const [kpi, setKpi] = useState({
    totals: { income: 0, expenses: 0, net: 0 },
    topCustomers: [],
    topExpenseCategories: [],
  });

  const [trendData, setTrendData] = useState({ labels: [], datasets: [] });
  const [expenseCategoryData, setExpenseCategoryData] = useState({ labels: [], datasets: [] });
  const [incomeByCustomerData, setIncomeByCustomerData] = useState({ labels: [], datasets: [] });
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyFinanceNote, setCompanyFinanceNote] = useState('');
  const [companyFinanceSnapshot, setCompanyFinanceSnapshot] = useState({
    summary: {
      mainCount: 0,
      subsidiaryCount: 0,
      income: 0,
      expenses: 0,
      net: 0,
      margin: 0,
    },
    chartData: { labels: [], datasets: [] },
    hasUnitBreakdown: false,
  });

  const formatNaira = (value) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value || 0);
  };

  const handleCacheHealthCheck = useCallback(async () => {
    setCacheHealthChecking(true);

    try {
      const response = await api.getCacheHealth();
      const payload = response?.data || {};

      const message = [
        `Cache Status: ${payload.enabled ? 'ENABLED' : 'DISABLED'}`,
        `Overall Health: ${payload.status ? String(payload.status).toUpperCase() : (payload.hasError ? 'DEGRADED' : 'OPERATIONAL')}`,
        `Total Keys: ${payload.totalKeys || 0}`,
        payload.source ? `Source: ${payload.source}` : null,
        payload.error ? `Error: ${payload.error}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      window.alert(message);
    } catch (checkError) {
      const status = checkError?.response?.status;
      const message = checkError?.response?.data?.message || 'Unable to fetch cache health.';
      window.alert(`Cache Health Check Failed${status ? ` (HTTP ${status})` : ''}\n${message}`);
    } finally {
      setCacheHealthChecking(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    const params = { period };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    try {
      const [kpiResponse, trendResponse, categoryResponse, customerResponse] = await Promise.all([
        api.getDashboardKPI(params),
        api.getDashboardCharts({ ...params, metric: CHART_METRICS.trend }),
        api.getDashboardCharts({ ...params, metric: CHART_METRICS.expenseByCategory }),
        api.getDashboardCharts({ ...params, metric: CHART_METRICS.incomeByCustomer }),
      ]);

      setKpi(kpiResponse.data);
      setTrendData(trendResponse?.data || { labels: [], datasets: [] });
      setExpenseCategoryData(categoryResponse?.data || { labels: [], datasets: [] });
      setIncomeByCustomerData(customerResponse?.data || { labels: [], datasets: [] });

      const [subsidiaryResult, incomeResult, expenseResult] = await Promise.allSettled([
        api.getSubsidiaries(),
        api.getIncomes({ page: 1, limit: 5000 }),
        api.getExpenses({ page: 1, limit: 5000 }),
      ]);

      const subsidiaryRows = subsidiaryResult.status === 'fulfilled' ? (subsidiaryResult.value?.data || []) : [];
      const incomeRows = incomeResult.status === 'fulfilled' ? (incomeResult.value?.data || []) : [];
      const expenseRows = expenseResult.status === 'fulfilled' ? (expenseResult.value?.data || []) : [];

      const canBuildDetailedSnapshot = subsidiaryRows.length > 0 && (incomeRows.length > 0 || expenseRows.length > 0);
      const nextSnapshot = canBuildDetailedSnapshot
        ? buildCompanyFinanceSnapshot(subsidiaryRows, incomeRows, expenseRows)
        : buildSnapshotFromTotals(kpiResponse?.data?.totals?.income, kpiResponse?.data?.totals?.expenses);

      setCompanyFinanceSnapshot(nextSnapshot);
      setCompanyFinanceNote(
        canBuildDetailedSnapshot
          ? ''
          : 'Detailed unit-level snapshot is temporarily unavailable. Showing aggregate values only.'
      );
    } catch (loadError) {
      setError(loadError?.response?.data?.message || 'Unable to load live dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    setDrillState(null);
  }, [period, startDate, endDate]);

  const resetDrilldown = useCallback((event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }
    setDrillState(null);
  }, []);

  const fetchDrilldown = useCallback(async ({ metric, label, series, entityId, fallbackTitle, fallbackMetricLabel, fallbackDimensionLabel, contextRows }) => {
    setDrilldownLoading(true);

    try {
      const response = await api.getDashboardDrilldown({
        metric,
        period,
        label,
        series,
        entityId,
      });

      const payload = response?.data || {};
      setDrillState({
        section: metric,
        title: payload.title || fallbackTitle,
        metricLabel: payload.metricLabel || fallbackMetricLabel,
        dimensionLabel: payload.dimensionLabel || fallbackDimensionLabel,
        rows: Array.isArray(payload.rows) ? payload.rows : [],
        contextRows: contextRows || payload.contextRows || [],
      });
    } catch (_error) {
      setDrillState({
        section: metric,
        title: fallbackTitle,
        metricLabel: fallbackMetricLabel,
        dimensionLabel: fallbackDimensionLabel,
        rows: [],
        contextRows: contextRows || [],
      });
    } finally {
      setDrilldownLoading(false);
    }
  }, [period, startDate, endDate]);

  const handleIncomeChartClick = useCallback(async (event, elements = []) => {
    if (!elements.length) {
      return;
    }

    const point = elements[0];
    const index = point?.index;
    const customerName = incomeByCustomerData?.labels?.[index];
    const customerId = incomeByCustomerData?.meta?.customerIds?.[index] || null;

    if (!customerName) {
      return;
    }

    setFocusedSection('incomeByCustomer');
    await fetchDrilldown({
      metric: 'income-by-customer',
      label: customerName,
      entityId: customerId,
      fallbackTitle: `Income Sources: ${customerName}`,
      fallbackMetricLabel: 'Income',
      fallbackDimensionLabel: 'Source / Patronage',
    });
  }, [fetchDrilldown, incomeByCustomerData]);

  const handleExpenseChartClick = useCallback(async (event, elements = []) => {
    if (!elements.length) {
      return;
    }

    const point = elements[0];
    const index = point?.index;
    const categoryName = expenseCategoryData?.labels?.[index];

    if (!categoryName) {
      return;
    }

    setFocusedSection('expenseByCategory');
    await fetchDrilldown({
      metric: 'expenses-by-category',
      label: categoryName,
      fallbackTitle: `Expense Drivers: ${categoryName}`,
      fallbackMetricLabel: 'Expenses',
      fallbackDimensionLabel: 'Source / Driver',
    });
  }, [expenseCategoryData, fetchDrilldown]);

  const handleTrendChartClick = useCallback(async (event, elements = []) => {
    if (!elements.length) {
      return;
    }

    const point = elements[0];
    const index = point?.index;
    const datasetIndex = point?.datasetIndex;

    const label = trendData?.labels?.[index];
    const incomeValue = Number(trendData?.datasets?.[0]?.data?.[index] || 0);
    const expenseValue = Number(trendData?.datasets?.[1]?.data?.[index] || 0);

    if (!label) {
      return;
    }

    const clickedMetricLabel = datasetIndex === 1 ? 'Expenses' : 'Income';
    const clickedSeries = datasetIndex === 1 ? 'expenses' : 'income';

    setFocusedSection('trend');
    await fetchDrilldown({
      metric: 'income-expense-trend',
      label,
      series: clickedSeries,
      fallbackTitle: `${clickedMetricLabel} Breakdown: ${label}`,
      fallbackMetricLabel: clickedMetricLabel,
      fallbackDimensionLabel: 'Component',
      contextRows: [
        { label: 'Income', value: incomeValue },
        { label: 'Expenses', value: expenseValue },
        { label: 'Net Income', value: incomeValue - expenseValue },
      ],
    });
  }, [fetchDrilldown, trendData]);

  const drilldownRows = useMemo(() => {
    if (drillState?.rows?.length) {
      return drillState.rows;
    }

    if (focusedSection === 'incomeByCustomer') {
      return (kpi.topCustomers || []).map((row) => ({
        label: row.customerName,
        value: row.total,
      }));
    }

    if (focusedSection === 'expenseByCategory') {
      return (kpi.topExpenseCategories || []).map((row) => ({
        label: row.category,
        value: row.total,
      }));
    }

    const labels = trendData.labels || [];
    const incomeSeries = trendData?.datasets?.[0]?.data || [];
    const expenseSeries = trendData?.datasets?.[1]?.data || [];

    return labels.map((label, index) => ({
      label,
      value: (incomeSeries[index] || 0) - (expenseSeries[index] || 0),
    }));
  }, [drillState, focusedSection, kpi, trendData]);

  const drilldownDimensionLabel = useMemo(() => {
    if (drillState?.dimensionLabel) {
      return drillState.dimensionLabel;
    }

    return 'Dimension';
  }, [drillState]);

  const drilldownMetricLabel = useMemo(() => {
    if (drillState?.metricLabel) {
      return drillState.metricLabel;
    }

    if (focusedSection === 'incomeByCustomer') {
      return 'Income';
    }

    if (focusedSection === 'expenseByCategory') {
      return 'Expenses';
    }

    return 'Net Income';
  }, [drillState, focusedSection]);

  const grossIncome = Number(kpi?.totals?.income || 0);
  const totalExpenses = Number(kpi?.totals?.expenses || 0);
  const netIncome = grossIncome - totalExpenses;
  const companyMargin = Number(companyFinanceSnapshot?.summary?.margin || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="pt-16 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Financial Dashboard</h1>
          <p className="text-sm text-gray-500">Dynamic income, expense and expenditure analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCacheHealthCheck}
            disabled={cacheHealthChecking}
            className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
            title="Test cache status"
          >
            {cacheHealthChecking ? 'Testing Cache...' : 'Test Cache'}
          </button>
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${period === option.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
            >
              {option.label}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Start date"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="End date"
            />
            {(startDate || endDate) ? (
              <button
                type="button"
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="rounded-lg px-2 py-2 text-sm text-gray-500 hover:bg-gray-100"
                title="Clear dates"
              >
                ✕
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            className="rounded-lg bg-gray-100 p-2 text-gray-700 hover:bg-gray-200"
            title="Refresh"
          >
            <Activity className="h-5 w-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => {
            setFocusedSection('trend');
            setDrillState(null);
          }}
          className="rounded-lg bg-white p-5 text-left shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Gross Income</p>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatNaira(grossIncome)}</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setFocusedSection('expenseByCategory');
            setDrillState(null);
          }}
          className="rounded-lg bg-white p-5 text-left shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Total Expenses</p>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatNaira(totalExpenses)}</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setFocusedSection('incomeByCustomer');
            setDrillState(null);
          }}
          className="rounded-lg bg-white p-5 text-left shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Net Income</p>
            <BarChart3 className={`h-5 w-5 ${netIncome < 0 || companyMargin < 10 ? 'text-red-600' : 'text-emerald-600'}`} />
          </div>
          <p className={`mt-2 text-2xl font-bold ${netIncome < 0 || companyMargin < 10 ? 'text-red-600' : 'text-emerald-700'}`}>{formatNaira(netIncome)}</p>
        </button>
      </div>

      <div className="rounded-lg bg-white p-5 shadow">
        <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Main vs Subsidiary Income and Expenditure</h2>
            <p className="text-sm text-gray-500">Main is an aggregate of main company and all subsidiaries for quick executive view.</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${companyFinanceSnapshot.hasUnitBreakdown ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
            >
              {companyFinanceSnapshot.hasUnitBreakdown ? 'Live Unit Data' : 'Aggregate Fallback'}
            </span>
            <p className={`text-sm font-semibold ${companyMargin < 10 ? 'text-red-600' : 'text-emerald-700'}`}>
              Net Margin: {companyMargin.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-gray-200 px-3 py-2">
            <p className="text-xs text-gray-500">Main Companies</p>
            <p className="text-lg font-bold text-gray-900">{companyFinanceSnapshot.summary.mainCount}</p>
          </div>
          <div className="rounded-md border border-gray-200 px-3 py-2">
            <p className="text-xs text-gray-500">Subsidiary Units</p>
            <p className="text-lg font-bold text-gray-900">{companyFinanceSnapshot.summary.subsidiaryCount}</p>
          </div>
          <div className="rounded-md border border-gray-200 px-3 py-2">
            <p className="text-xs text-gray-500">Aggregate Income</p>
            <p className="text-lg font-bold text-blue-700">{formatNaira(companyFinanceSnapshot.summary.income)}</p>
          </div>
          <div className="rounded-md border border-gray-200 px-3 py-2">
            <p className="text-xs text-gray-500">Aggregate Expenditure</p>
            <p className="text-lg font-bold text-blue-700">{formatNaira(companyFinanceSnapshot.summary.expenses)}</p>
          </div>
        </div>

        {companyFinanceNote && (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {companyFinanceNote}
          </p>
        )}

        <div className="h-96">
          <Chart
            type="bar"
            data={companyFinanceSnapshot.chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                  callbacks: {
                    label: (context) => `${context.dataset.label}: ${formatNaira(context.parsed.y)}`,
                  },
                },
              },
              scales: {
                x: {
                  ticks: {
                    maxRotation: 25,
                    minRotation: 0,
                  },
                },
                y: {
                  ticks: {
                    callback: (value) => `${Number(value).toLocaleString()}`,
                  },
                },
              },
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div
          role="button"
          tabIndex={0}
          className={dm ? 'rounded-lg bg-slate-800 p-5 shadow border border-slate-700 text-left' : 'rounded-lg bg-white p-5 shadow text-left'}
          onClick={() => setFocusedSection('trend')}
          onContextMenu={resetDrilldown}
        >
          <h2 className={dm ? 'mb-4 text-lg font-semibold text-slate-100' : 'mb-4 text-lg font-semibold text-gray-900'}>Income vs Expenses ({period})</h2>
          <div className="h-72">
          <Line
            data={trendData}
            onClick={handleTrendChartClick}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { position: 'bottom', labels: { color: dm ? '#94a3b8' : '#374151', usePointStyle: true, padding: 20 } },
                tooltip: { backgroundColor: dm ? '#1e293b' : '#fff', titleColor: dm ? '#e2e8f0' : '#111', bodyColor: dm ? '#cbd5e1' : '#374151', borderColor: dm ? '#334155' : '#e5e7eb', borderWidth: 1, padding: 12, cornerRadius: 8, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatNaira(ctx.parsed.y)}` } }
              },
              scales: {
                x: { grid: { color: dm ? '#334155' : '#e5e7eb' }, ticks: { color: dm ? '#94a3b8' : '#6b7280' } },
                y: { grid: { color: dm ? '#334155' : '#e5e7eb' }, ticks: { color: dm ? '#94a3b8' : '#6b7280', callback: (v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v) }, beginAtZero: true }
              }
            }}
          />
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          className={dm ? 'rounded-lg bg-slate-800 p-5 shadow border border-slate-700 text-left' : 'rounded-lg bg-white p-5 shadow text-left'}
          onClick={() => setFocusedSection('expenseByCategory')}
          onContextMenu={resetDrilldown}
        >
          <h2 className={dm ? 'mb-4 text-lg font-semibold text-slate-100' : 'mb-4 text-lg font-semibold text-gray-900'}>Expenses by Category</h2>
          <div className="h-72 flex items-center justify-center">
          <Doughnut
            data={expenseCategoryData}
            onClick={handleExpenseChartClick}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: '60%',
              plugins: {
                legend: { position: 'bottom', labels: { color: dm ? '#94a3b8' : '#374151', usePointStyle: true, padding: 20 } },
                tooltip: { backgroundColor: dm ? '#1e293b' : '#fff', titleColor: dm ? '#e2e8f0' : '#111', bodyColor: dm ? '#cbd5e1' : '#374151', borderColor: dm ? '#334155' : '#e5e7eb', borderWidth: 1, padding: 12, cornerRadius: 8, callbacks: { label: (ctx) => ` ${ctx.label}: ${formatNaira(ctx.parsed)}` } }
              }
            }}
          />
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          className={dm ? 'rounded-lg bg-slate-800 p-5 shadow border border-slate-700 text-left' : 'rounded-lg bg-white p-5 shadow text-left'}
          onClick={() => setFocusedSection('incomeByCustomer')}
          onContextMenu={resetDrilldown}
        >
          <h2 className={dm ? 'mb-4 text-lg font-semibold text-slate-100' : 'mb-4 text-lg font-semibold text-gray-900'}>Income by Customer</h2>
          <div className="h-72">
          <Bar
            data={incomeByCustomerData}
            onClick={handleIncomeChartClick}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'y',
              plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: dm ? '#1e293b' : '#fff', titleColor: dm ? '#e2e8f0' : '#111', bodyColor: dm ? '#cbd5e1' : '#374151', borderColor: dm ? '#334155' : '#e5e7eb', borderWidth: 1, padding: 12, cornerRadius: 8, callbacks: { label: (ctx) => ` ${formatNaira(ctx.parsed.x)}` } }
              },
              scales: {
                x: { grid: { color: dm ? '#334155' : '#e5e7eb' }, ticks: { color: dm ? '#94a3b8' : '#6b7280', callback: (v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v) }, beginAtZero: true },
                y: { grid: { display: false }, ticks: { color: dm ? '#94a3b8' : '#6b7280', font: { size: 11 } } }
              }
            }}
          />
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-5 shadow">
        <div className="mb-3 flex items-center gap-2">
          <PieChart className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">{drillState?.title || 'Drill-down Details'}</h3>
        </div>
        <p className="mb-2 text-sm font-medium text-gray-700">Showing: {drilldownMetricLabel}</p>
        <p className="mb-4 text-sm text-gray-500">
          Click a chart data point to drill down. Right-click any chart to drill up to summary.
        </p>

        {drillState?.contextRows?.length ? (
          <div className="mb-4 rounded-md bg-gray-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Selected Point Summary</p>
            <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-3">
              {drillState.contextRows.map((item) => (
                <div key={item.label} className="rounded bg-white px-3 py-2 shadow-sm">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="font-semibold text-gray-900">{formatNaira(item.value)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {drilldownRows.length === 0 ? (
          <p className="text-sm text-gray-500">{drilldownLoading ? 'Loading drill-down...' : 'No data for selected period.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-red-600">
                <tr className="border-b border-gray-200 text-left text-white">
                  <th className="py-2">{drilldownDimensionLabel}</th>
                  <th className="py-2">{drilldownMetricLabel} (NGN)</th>
                </tr>
              </thead>
              <tbody>
                {drilldownRows.map((row) => (
                  <tr key={row.label} className="border-b border-gray-100">
                    <td className="py-2 text-gray-800">{row.label}</td>
                    <td className="py-2 font-medium text-gray-900">{formatNaira(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;


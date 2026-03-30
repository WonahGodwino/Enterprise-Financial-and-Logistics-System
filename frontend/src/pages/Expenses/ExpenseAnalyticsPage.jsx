import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  TextField,
  Tab,
  Tabs,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  LinearProgress,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  TablePagination
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  CalendarToday,
  Category,
  LocalGasStation,
  Build,
  Business,
  DirectionsCar,
  Person,
  AttachMoney,
  Download,
  Print,
  Share,
  Refresh,
  BarChart,
  PieChart as PieChartIcon,
  ShowChart,
  Assessment,
  DateRange,
  FilterList,
  Clear,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info
} from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { useExpenses } from '../../hooks/useExpenses';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#8dd1e1'];

export const ExpenseAnalyticsPage = () => {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  
  // State
  const [tabValue, setTabValue] = useState(0);
  const [chartType, setChartType] = useState('bar');
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(subMonths(new Date(), 11)), // Last 12 months
    end: endOfMonth(new Date())
  });
  const [comparisonPeriod, setComparisonPeriod] = useState('month');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubsidiary, setSelectedSubsidiary] = useState('all');
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [paymentStatusData, setPaymentStatusData] = useState([]);
  const [subsidiaryData, setSubsidiaryData] = useState([]);
  const [vehicleData, setVehicleData] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reference data
  const [vehicles, setVehicles] = useState([]);
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [categories, setCategories] = useState([]);

  // Use the hook for data
  const {
    expenses,
    loading: expensesLoading,
    stats,
    filters,
    updateFilters,
    refresh
  } = useExpenses({
    startDate: dateRange.start,
    endDate: dateRange.end
  });

  // Fetch reference data
  const fetchReferenceData = useCallback(async () => {
    try {
      const [vehiclesRes, subsidiariesRes] = await Promise.all([
        api.get('/vehicles?limit=100'),
        api.get('/subsidiaries')
      ]);
      setVehicles(vehiclesRes.data.data || []);
      setSubsidiaries(subsidiariesRes.data.data || []);
      
      // Extract unique categories from expenses
      const uniqueCategories = [...new Set(expenses.map(e => e.expenseCategory))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching reference data:', error);
    }
  }, [expenses]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  // Process analytics data when expenses change
  useEffect(() => {
    if (expenses.length > 0) {
      processAnalyticsData();
    }
  }, [expenses, selectedCategory, selectedSubsidiary, selectedVehicle]);

  const processAnalyticsData = () => {
    setLoading(true);
    
    try {
      // Filter expenses based on selections
      let filteredExpenses = [...expenses];
      
      if (selectedCategory !== 'all') {
        filteredExpenses = filteredExpenses.filter(e => e.expenseCategory === selectedCategory);
      }
      
      if (selectedSubsidiary !== 'all') {
        filteredExpenses = filteredExpenses.filter(e => e.subsidiaryId === selectedSubsidiary);
      }
      
      if (selectedVehicle !== 'all') {
        filteredExpenses = filteredExpenses.filter(e => e.vehicleId === selectedVehicle);
      }

      // Process trend data (monthly)
      const months = eachMonthOfInterval({
        start: dateRange.start,
        end: dateRange.end
      });

      const monthlyData = months.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        
        const monthExpenses = filteredExpenses.filter(e => {
          const expenseDate = new Date(e.expenseDate);
          return expenseDate >= monthStart && expenseDate <= monthEnd;
        });

        const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const operational = monthExpenses.filter(e => e.expenseType === 'OPERATIONAL')
          .reduce((sum, e) => sum + e.amount, 0);
        const administrative = monthExpenses.filter(e => e.expenseType === 'ADMINISTRATIVE')
          .reduce((sum, e) => sum + e.amount, 0);
        const capital = monthExpenses.filter(e => e.expenseType === 'CAPITAL')
          .reduce((sum, e) => sum + e.amount, 0);
        const count = monthExpenses.length;

        return {
          month: format(month, 'MMM yyyy'),
          timestamp: month.getTime(),
          total,
          operational,
          administrative,
          capital,
          count,
          average: count > 0 ? total / count : 0
        };
      });

      setTrendData(monthlyData);

      // Process category breakdown
      const categoryMap = new Map();
      filteredExpenses.forEach(expense => {
        const cat = expense.expenseCategory;
        if (!categoryMap.has(cat)) {
          categoryMap.set(cat, {
            category: cat,
            total: 0,
            count: 0,
            type: expense.expenseType,
            avgAmount: 0
          });
        }
        const item = categoryMap.get(cat);
        item.total += expense.amount;
        item.count += 1;
      });

      // Calculate averages
      categoryMap.forEach(item => {
        item.avgAmount = item.count > 0 ? item.total / item.count : 0;
      });

      const categoryArray = Array.from(categoryMap.values())
        .sort((a, b) => b.total - a.total);
      setCategoryData(categoryArray);

      // Process payment status breakdown
      const statusMap = new Map();
      filteredExpenses.forEach(expense => {
        const status = expense.paymentStatus;
        if (!statusMap.has(status)) {
          statusMap.set(status, {
            status,
            total: 0,
            count: 0
          });
        }
        const item = statusMap.get(status);
        item.total += expense.amount;
        item.count += 1;
      });
      setPaymentStatusData(Array.from(statusMap.values()));

      // Process subsidiary breakdown
      const subsidiaryMap = new Map();
      filteredExpenses.forEach(expense => {
        const subId = expense.subsidiaryId || 'unassigned';
        const subName = expense.subsidiary?.name || 'Unassigned';
        if (!subsidiaryMap.has(subId)) {
          subsidiaryMap.set(subId, {
            subsidiary: subName,
            total: 0,
            count: 0
          });
        }
        const item = subsidiaryMap.get(subId);
        item.total += expense.amount;
        item.count += 1;
      });
      setSubsidiaryData(Array.from(subsidiaryMap.values()));

      // Process vehicle breakdown (top 10)
      const vehicleMap = new Map();
      filteredExpenses.forEach(expense => {
        if (expense.vehicle) {
          const vehicleId = expense.vehicle.id;
          const vehicleName = expense.vehicle.registrationNumber;
          if (!vehicleMap.has(vehicleId)) {
            vehicleMap.set(vehicleId, {
              vehicle: vehicleName,
              total: 0,
              count: 0,
              model: expense.vehicle.model
            });
          }
          const item = vehicleMap.get(vehicleId);
          item.total += expense.amount;
          item.count += 1;
        }
      });
      setVehicleData(Array.from(vehicleMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10));

      // Generate insights
      generateInsights(filteredExpenses, monthlyData, categoryArray);
      
    } catch (error) {
      console.error('Error processing analytics data:', error);
      showToast('Error processing analytics data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = (expenses, monthlyData, categoryData) => {
    const insights = [];

    // Total expenses insight
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    insights.push({
      type: 'info',
      icon: <Info />,
      title: 'Total Expenses',
      description: `Total expenses for the period: ₦${totalExpenses.toLocaleString()}`,
      value: totalExpenses
    });

    // Average monthly trend
    if (monthlyData.length > 1) {
      const lastMonth = monthlyData[monthlyData.length - 1];
      const prevMonth = monthlyData[monthlyData.length - 2];
      
      if (lastMonth && prevMonth) {
        const change = ((lastMonth.total - prevMonth.total) / prevMonth.total) * 100;
        insights.push({
          type: change > 0 ? 'warning' : 'success',
          icon: change > 0 ? <TrendingUp /> : <TrendingDown />,
          title: 'Month-over-Month Change',
          description: `${change > 0 ? 'Increase' : 'Decrease'} of ${Math.abs(change).toFixed(1)}% from previous month`,
          value: change
        });
      }
    }

    // Top expense category
    if (categoryData.length > 0) {
      const topCategory = categoryData[0];
      insights.push({
        type: 'info',
        icon: <Category />,
        title: 'Top Expense Category',
        description: `${topCategory.category}: ₦${topCategory.total.toLocaleString()} (${((topCategory.total / totalExpenses) * 100).toFixed(1)}% of total)`,
        value: topCategory.total
      });
    }

    // Payment status alert
    const unpaidTotal = expenses
      .filter(e => e.paymentStatus === 'UNPAID' || e.paymentStatus === 'OVERDUE')
      .reduce((sum, e) => sum + e.amount, 0);
    
    if (unpaidTotal > 0) {
      insights.push({
        type: 'error',
        icon: <Warning />,
        title: 'Outstanding Payments',
        description: `₦${unpaidTotal.toLocaleString()} in unpaid/overdue expenses`,
        value: unpaidTotal
      });
    }

    // Average transaction value
    const avgTransaction = totalExpenses / (expenses.length || 1);
    insights.push({
      type: 'info',
      icon: <AttachMoney />,
      title: 'Average Transaction',
      description: `₦${avgTransaction.toLocaleString()} per transaction`,
      value: avgTransaction
    });

    setInsights(insights);
  };

  const handleDateRangeChange = (type, date) => {
    setDateRange(prev => ({
      ...prev,
      [type]: date
    }));
  };

  const applyFilters = () => {
    updateFilters({
      startDate: dateRange.start,
      endDate: dateRange.end
    });
  };

  const clearFilters = () => {
    setDateRange({
      start: startOfMonth(subMonths(new Date(), 11)),
      end: endOfMonth(new Date())
    });
    setSelectedCategory('all');
    setSelectedSubsidiary('all');
    setSelectedVehicle('all');
    updateFilters({
      startDate: startOfMonth(subMonths(new Date(), 11)),
      endDate: endOfMonth(new Date())
    });
  };

  const handleExport = async (format) => {
    try {
      const exportData = {
        trendData,
        categoryData,
        paymentStatusData,
        subsidiaryData,
        vehicleData,
        insights,
        dateRange,
        totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
        totalCount: expenses.length
      };

      if (format === 'pdf') {
        await exportToPDF(exportData);
      } else if (format === 'excel') {
        await exportToExcel(exportData);
      } else if (format === 'image') {
        await exportToImage();
      }
      
      showToast(`Analytics exported as ${format.toUpperCase()}`, 'success');
    } catch (error) {
      showToast('Failed to export analytics', 'error');
    }
  };

  const exportToPDF = async (data) => {
    const pdf = new jsPDF('landscape', 'pt', 'a4');
    // Implementation for PDF export
    // This would include charts and tables
    pdf.save(`expense-analytics-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportToExcel = async (data) => {
    // Implementation for Excel export
    console.log('Exporting to Excel:', data);
  };

  const exportToImage = async () => {
    const element = document.getElementById('analytics-dashboard');
    if (element) {
      const canvas = await html2canvas(element);
      const link = document.createElement('a');
      link.download = `expense-analytics-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  // Format currency for tooltips
  const formatCurrency = (value) => `₦${value.toLocaleString()}`;

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      PAID: 'success',
      PARTIALLY_PAID: 'info',
      PENDING: 'warning',
      UNPAID: 'error',
      OVERDUE: 'error'
    };
    return colors[status] || 'default';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ width: '100%', p: 3 }} id="analytics-dashboard">
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Expense Analytics
          </Typography>
          <Box>
            <Tooltip title="Export as PDF">
              <IconButton onClick={() => handleExport('pdf')} sx={{ mr: 1 }}>
                <Download />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export as Image">
              <IconButton onClick={() => handleExport('image')} sx={{ mr: 1 }}>
                <Print />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share">
              <IconButton sx={{ mr: 1 }}>
                <Share />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={refresh}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Date Range and Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={2}>
              <DatePicker
                label="Start Date"
                value={dateRange.start}
                onChange={(date) => handleDateRangeChange('start', date)}
                renderInput={(params) => (
                  <TextField {...params} size="small" fullWidth />
                )}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <DatePicker
                label="End Date"
                value={dateRange.end}
                onChange={(date) => handleDateRangeChange('end', date)}
                renderInput={(params) => (
                  <TextField {...params} size="small" fullWidth />
                )}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory}
                  label="Category"
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {categories.map(cat => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Subsidiary</InputLabel>
                <Select
                  value={selectedSubsidiary}
                  label="Subsidiary"
                  onChange={(e) => setSelectedSubsidiary(e.target.value)}
                >
                  <MenuItem value="all">All Subsidiaries</MenuItem>
                  {subsidiaries.map(sub => (
                    <MenuItem key={sub.id} value={sub.id}>{sub.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Vehicle</InputLabel>
                <Select
                  value={selectedVehicle}
                  label="Vehicle"
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                >
                  <MenuItem value="all">All Vehicles</MenuItem>
                  {vehicles.map(v => (
                    <MenuItem key={v.id} value={v.id}>{v.registrationNumber}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={applyFilters}
                  startIcon={<FilterList />}
                >
                  Apply
                </Button>
                <IconButton onClick={clearFilters} size="small">
                  <Clear />
                </IconButton>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Loading State */}
        {(loading || expensesLoading) && <LinearProgress sx={{ mb: 2 }} />}

        {/* Insights Cards */}
        {insights.length > 0 && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {insights.map((insight, index) => (
              <Grid item xs={12} sm={6} md={2.4} key={index}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Avatar sx={{ bgcolor: `${insight.type}.light`, mr: 1 }}>
                        {insight.icon}
                      </Avatar>
                      <Typography variant="subtitle2" color="textSecondary">
                        {insight.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      {insight.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="Overview" />
            <Tab label="Trends" />
            <Tab label="Categories" />
            <Tab label="Comparison" />
            <Tab label="Detailed Breakdown" />
          </Tabs>
        </Box>

        {/* Tab 0: Overview */}
        {tabValue === 0 && (
          <Grid container spacing={3}>
            {/* Summary Cards */}
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Expenses
                  </Typography>
                  <Typography variant="h4">
                    ₦{expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {expenses.length} transactions
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Average per Transaction
                  </Typography>
                  <Typography variant="h4">
                    ₦{(expenses.reduce((sum, e) => sum + e.amount, 0) / (expenses.length || 1)).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Highest Expense
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    ₦{Math.max(...expenses.map(e => e.amount), 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Categories
                  </Typography>
                  <Typography variant="h4">
                    {categoryData.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Main Chart - Trend */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Expense Trend
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" angle={-45} textAnchor="end" height={60} />
                    <YAxis />
                    <ChartTooltip formatter={formatCurrency} />
                    <Legend />
                    <Area type="monotone" dataKey="total" stackId="1" stroke="#8884d8" fill="#8884d8" />
                    <Area type="monotone" dataKey="operational" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                    <Area type="monotone" dataKey="administrative" stackId="1" stroke="#ffc658" fill="#ffc658" />
                  </AreaChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Payment Status Pie */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Payment Status
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentStatusData}
                      dataKey="total"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => `${entry.status}: ₦${entry.total.toLocaleString()}`}
                    >
                      {paymentStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip formatter={formatCurrency} />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Top Categories */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Top Expense Categories
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="category" width={150} />
                    <ChartTooltip formatter={formatCurrency} />
                    <Legend />
                    <Bar dataKey="total" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Tab 1: Trends */}
        {tabValue === 1 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">Monthly Trends Analysis</Typography>
                  <FormControl size="small" sx={{ width: 150 }}>
                    <InputLabel>Chart Type</InputLabel>
                    <Select
                      value={chartType}
                      label="Chart Type"
                      onChange={(e) => setChartType(e.target.value)}
                    >
                      <MenuItem value="bar">Bar Chart</MenuItem>
                      <MenuItem value="line">Line Chart</MenuItem>
                      <MenuItem value="area">Area Chart</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <ResponsiveContainer width="100%" height={400}>
                  {chartType === 'bar' && (
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <ChartTooltip formatter={formatCurrency} />
                      <Legend />
                      <Bar dataKey="total" fill="#8884d8" />
                      <Bar dataKey="operational" fill="#82ca9d" />
                      <Bar dataKey="administrative" fill="#ffc658" />
                    </BarChart>
                  )}
                  {chartType === 'line' && (
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <ChartTooltip formatter={formatCurrency} />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} />
                      <Line type="monotone" dataKey="operational" stroke="#82ca9d" />
                      <Line type="monotone" dataKey="administrative" stroke="#ffc658" />
                    </LineChart>
                  )}
                  {chartType === 'area' && (
                    <AreaChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <ChartTooltip formatter={formatCurrency} />
                      <Legend />
                      <Area type="monotone" dataKey="total" stackId="1" stroke="#8884d8" fill="#8884d8" />
                      <Area type="monotone" dataKey="operational" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                      <Area type="monotone" dataKey="administrative" stackId="1" stroke="#ffc658" fill="#ffc658" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>

                {/* Monthly Data Table */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Monthly Breakdown
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Month</TableCell>
                          <TableCell align="right">Total (₦)</TableCell>
                          <TableCell align="right">Operational (₦)</TableCell>
                          <TableCell align="right">Administrative (₦)</TableCell>
                          <TableCell align="right">Capital (₦)</TableCell>
                          <TableCell align="right">Transactions</TableCell>
                          <TableCell align="right">Average (₦)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {trendData.map((row) => (
                          <TableRow key={row.month} hover>
                            <TableCell>{row.month}</TableCell>
                            <TableCell align="right">{row.total.toLocaleString()}</TableCell>
                            <TableCell align="right">{row.operational.toLocaleString()}</TableCell>
                            <TableCell align="right">{row.administrative.toLocaleString()}</TableCell>
                            <TableCell align="right">{row.capital.toLocaleString()}</TableCell>
                            <TableCell align="right">{row.count}</TableCell>
                            <TableCell align="right">{row.average.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Tab 2: Categories */}
        {tabValue === 2 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Expense by Category
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={150}
                      label={(entry) => `${entry.category}: ₦${(entry.total / 1000).toFixed(0)}k`}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip formatter={formatCurrency} />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Category Details
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Total (₦)</TableCell>
                        <TableCell align="right">Count</TableCell>
                        <TableCell align="right">Average (₦)</TableCell>
                        <TableCell>% of Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {categoryData.map((row) => {
                        const totalAll = categoryData.reduce((sum, r) => sum + r.total, 0);
                        const percentage = ((row.total / totalAll) * 100).toFixed(1);
                        return (
                          <TableRow key={row.category} hover>
                            <TableCell>
                              <Chip
                                label={row.category}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">{row.total.toLocaleString()}</TableCell>
                            <TableCell align="right">{row.count}</TableCell>
                            <TableCell align="right">{row.avgAmount.toLocaleString()}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box sx={{ width: 50, mr: 1 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={parseFloat(percentage)}
                                    color={parseFloat(percentage) > 30 ? 'error' : 'primary'}
                                  />
                                </Box>
                                <Typography variant="caption">{percentage}%</Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Tab 3: Comparison */}
        {tabValue === 3 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Period Comparison
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Compare By</InputLabel>
                      <Select
                        value={comparisonPeriod}
                        label="Compare By"
                        onChange={(e) => setComparisonPeriod(e.target.value)}
                      >
                        <MenuItem value="month">Month over Month</MenuItem>
                        <MenuItem value="quarter">Quarter over Quarter</MenuItem>
                        <MenuItem value="year">Year over Year</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {/* Comparison Chart */}
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <ChartTooltip formatter={formatCurrency} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="total" fill="#8884d8" />
                    <Line yAxisId="right" type="monotone" dataKey="count" stroke="#ff7300" />
                  </ComposedChart>
                </ResponsiveContainer>

                {/* Comparison Stats */}
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Current Period
                        </Typography>
                        <Typography variant="h5">
                          ₦{trendData.slice(-1)[0]?.total.toLocaleString() || 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Previous Period
                        </Typography>
                        <Typography variant="h5">
                          ₦{trendData.slice(-2, -1)[0]?.total.toLocaleString() || 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Change
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {trendData.length > 1 && (
                            <>
                              <Typography variant="h5" color={
                                (trendData.slice(-1)[0]?.total - trendData.slice(-2, -1)[0]?.total) > 0
                                  ? 'error.main' : 'success.main'
                              }>
                                ₦{Math.abs(trendData.slice(-1)[0]?.total - trendData.slice(-2, -1)[0]?.total).toLocaleString()}
                              </Typography>
                              {trendData.slice(-1)[0]?.total > trendData.slice(-2, -1)[0]?.total ? (
                                <TrendingUp color="error" sx={{ ml: 1 }} />
                              ) : (
                                <TrendingDown color="success" sx={{ ml: 1 }} />
                              )}
                            </>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Tab 4: Detailed Breakdown */}
        {tabValue === 4 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Subsidiary Breakdown
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={subsidiaryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subsidiary" />
                    <YAxis />
                    <ChartTooltip formatter={formatCurrency} />
                    <Legend />
                    <Bar dataKey="total" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Top Vehicles by Expense
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={vehicleData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="vehicle" width={100} />
                    <ChartTooltip formatter={formatCurrency} />
                    <Legend />
                    <Bar dataKey="total" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* All Transactions Table */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  All Transactions
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Amount (₦)</TableCell>
                        <TableCell>Payment Status</TableCell>
                        <TableCell>Vehicle</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {expenses
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((expense) => (
                          <TableRow key={expense.id} hover>
                            <TableCell>{format(new Date(expense.expenseDate), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{expense.description || expense.expenseCategory}</TableCell>
                            <TableCell>
                              <Chip
                                label={expense.expenseCategory}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">{expense.amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <Chip
                                label={expense.paymentStatus}
                                size="small"
                                color={getStatusColor(expense.paymentStatus)}
                              />
                            </TableCell>
                            <TableCell>{expense.vehicle?.registrationNumber || '-'}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={expenses.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(e, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                />
              </Paper>
            </Grid>
          </Grid>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default ExpenseAnalyticsPage;
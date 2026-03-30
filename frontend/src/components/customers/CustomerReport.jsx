import React, { useState, useEffect } from 'react';
import {
  Paper,
  Grid,
  Typography,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Alert
} from '@mui/material';
import {
  Download,
  Print,
  Email,
  Person,
  Business,
  TrendingUp,
  TrendingDown,
  Warning
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from 'recharts';
import { DatePicker } from '@mui/x-date-pickers';
import api from '../../services/api';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const CustomerReport = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date(),
    includeInactive: false
  });

  useEffect(() => {
    fetchReport();
  }, [filters]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/customers/report', {
        params: {
          startDate: filters.startDate.toISOString().split('T')[0],
          endDate: filters.endDate.toISOString().split('T')[0],
          includeInactive: filters.includeInactive
        }
      });
      setReportData(response.data.data);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      if (format === 'excel') {
        await exportToExcel(reportData, 'customer-report');
      } else if (format === 'pdf') {
        await exportToPDF(reportData, 'customer-report');
      }
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  if (!reportData) return null;

  const { summary, customersWithIncome, customersWithoutIncome, topCustomers } = reportData;

  return (
    <Paper sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Customer Report</Typography>
        <Box>
          <Tooltip title="Export to Excel">
            <IconButton onClick={() => handleExport('excel')}>
              <Download />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print">
            <IconButton onClick={() => window.print()}>
              <Print />
            </IconButton>
          </Tooltip>
          <Tooltip title="Email Report">
            <IconButton>
              <Email />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <DatePicker
            label="Start Date"
            value={filters.startDate}
            onChange={(date) => setFilters({ ...filters, startDate: date })}
            renderInput={(params) => <TextField {...params} fullWidth size="small" />}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <DatePicker
            label="End Date"
            value={filters.endDate}
            onChange={(date) => setFilters({ ...filters, endDate: date })}
            renderInput={(params) => <TextField {...params} fullWidth size="small" />}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Include Inactive</InputLabel>
            <Select
              value={filters.includeInactive}
              label="Include Inactive"
              onChange={(e) => setFilters({ ...filters, includeInactive: e.target.value })}
            >
              <MenuItem value={false}>Active Customers Only</MenuItem>
              <MenuItem value={true}>All Customers</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Customers
              </Typography>
              <Typography variant="h4">
                {summary.totalCustomers}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {summary.activeCustomers} active, {summary.inactiveCustomers} inactive
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Revenue Generating
              </Typography>
              <Typography variant="h4">
                {summary.revenueGeneratingCustomers}
              </Typography>
              <Typography variant="body2" color="success.main">
                {((summary.revenueGeneratingCustomers / summary.totalCustomers) * 100).toFixed(1)}% of total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Revenue
              </Typography>
              <Typography variant="h4">
                ₦{summary.totalRevenue.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Avg: ₦{summary.averageRevenue.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Customers Without Revenue
              </Typography>
              <Typography variant="h4" color="warning.main">
                {summary.inactiveCustomers}
              </Typography>
              <Typography variant="body2" color="warning.main">
                Need attention
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top Customers Chart */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Top 10 Customers by Revenue
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCustomers}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="customer_name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <ChartTooltip formatter={(value) => `₦${value.toLocaleString()}`} />
              <Bar dataKey="total_income" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Customer Distribution
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'With Revenue', value: customersWithIncome.length },
                  { name: 'Without Revenue', value: customersWithoutIncome.length }
                ]}
                dataKey="value"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                <Cell fill="#4caf50" />
                <Cell fill="#ff9800" />
              </Pie>
              <ChartTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Grid>
      </Grid>

      {/* Customers With Revenue */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Customers with Revenue
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Customer</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="right">Total Revenue (₦)</TableCell>
            <TableCell align="right">Transactions</TableCell>
            <TableCell>Last Transaction</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {customersWithIncome.map((customer) => (
            <TableRow key={customer.id} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {customer.customerType === 'ORGANIZATION' ? (
                    <Business sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                  ) : (
                    <Person sx={{ mr: 1, fontSize: 20, color: 'secondary.main' }} />
                  )}
                  {customer.customerType === 'ORGANIZATION' 
                    ? customer.companyName 
                    : `${customer.firstName} ${customer.lastName}`}
                </Box>
              </TableCell>
              <TableCell>
                <Chip 
                  label={customer.customerType} 
                  size="small"
                  color={customer.customerType === 'ORGANIZATION' ? 'primary' : 'secondary'}
                />
              </TableCell>
              <TableCell align="right">
                {customer.totalIncome?.toLocaleString()}
              </TableCell>
              <TableCell align="right">{customer.incomeRecords?.length || 0}</TableCell>
              <TableCell>
                {customer.lastTransactionAt 
                  ? new Date(customer.lastTransactionAt).toLocaleDateString()
                  : 'N/A'}
              </TableCell>
              <TableCell>
                <Chip 
                  label={customer.status} 
                  size="small"
                  color={customer.status === 'ACTIVE' ? 'success' : 'default'}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Customers Without Revenue */}
      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        Customers Without Revenue (Need Attention)
      </Typography>
      {customersWithoutIncome.length > 0 ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Customer</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customersWithoutIncome.map((customer) => (
              <TableRow key={customer.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {customer.customerType === 'ORGANIZATION' ? (
                      <Business sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                    ) : (
                      <Person sx={{ mr: 1, fontSize: 20, color: 'secondary.main' }} />
                    )}
                    {customer.customerType === 'ORGANIZATION' 
                      ? customer.companyName 
                      : `${customer.firstName} ${customer.lastName}`}
                  </Box>
                </TableCell>
                <TableCell>{customer.customerType}</TableCell>
                <TableCell>{customer.email || 'N/A'}</TableCell>
                <TableCell>{customer.phone || 'N/A'}</TableCell>
                <TableCell>{new Date(customer.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button size="small" variant="outlined">
                    Record Income
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Alert severity="success">
          All customers have recorded income! Great job!
        </Alert>
      )}
    </Paper>
  );
};
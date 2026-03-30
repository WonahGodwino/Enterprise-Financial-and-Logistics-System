import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  Avatar,
  Tooltip,
  Badge,
  LinearProgress,
  Alert,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  FormControl,
  InputLabel,
  Select,
  InputAdornment,
  Switch,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormLabel,
  Stack,
  Fade,
  Zoom,
  Grow,
  Slide,
  useTheme,
  alpha
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  DirectionsCar,
  People,
  Receipt,
  Download,
  Refresh,
  Settings,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  Visibility,
  Edit,
  Delete,
  Add,
  Search,
  Clear,
  FilterList,
  DateRange,
  Category,
  Business,
  Person,
  AdminPanelSettings,
  Security,
  Construction,
  LocalGasStation,
  Build,
  Assessment,
  Dashboard as DashboardIcon,
  Notifications,
  NotificationsActive,
  Email,
  Phone,
  Message,
  Timeline,
  BarChart,
  PieChart,
  ShowChart,
  CloudUpload,
  Print,
  Share,
  MoreVert,
  AccountBalance,
  AccountCircle,
  Speed,
  Memory,
  Storage,
  CloudDone,
  WarningAmber,
  CheckCircleOutline,
  CancelOutlined,
  PendingOutlined,
  Schedule,
  CalendarToday,
  Today,
  Week,
  Month,
  Year,
  ArrowUpward,
  ArrowDownward,
  Remove,
  SettingsApplications,
  SettingsBackupRestore,
  Security as SecurityIcon,
  Language,
  Palette,
  DarkMode,
  LightMode,
  Logout,
  Menu as MenuIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { format, subDays, subWeeks, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
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
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Scatter,
  ResponsiveContainer
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTheme as useAppTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { useExpenses } from '../../hooks/useExpenses';
import { UserManagement } from './UserManagement';
import { AuditLogs } from './AuditLogs';
import { BackupRestore } from './BackupRestore';
import { ApiSettings } from './ApiSettings';
import { SystemHealth } from './SystemHealth';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

const TabPanel = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

export const AdminDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, hasPermission, logout } = useAuth();
  const { showToast } = useToast();
  const { mode, toggleTheme } = useAppTheme();
  
  // State
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [kpiData, setKpiData] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  const [profitData, setProfitData] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [subsidiaryPerformance, setSubsidiaryPerformance] = useState([]);
  const [topExpenses, setTopExpenses] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: startOfDay(subDays(new Date(), 30)),
    endDate: endOfDay(new Date())
  });
  const [period, setPeriod] = useState('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubsidiary, setSelectedSubsidiary] = useState('all');
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);

  // Use the expense hook
  const {
    expenses,
    stats: expenseStats,
    pendingApprovals: pendingExpenses,
    refresh: refreshExpenses
  } = useExpenses({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        kpiRes,
        revenueRes,
        expenseRes,
        profitRes,
        usersRes,
        logsRes,
        alertsRes,
        notificationsRes,
        healthRes,
        activitiesRes,
        subsidiaryRes,
        subsidiariesRes
      ] = await Promise.all([
        api.get('/admin/kpi', { params: { ...dateRange, subsidiaryId: selectedSubsidiary } }),
        api.get('/admin/revenue', { params: { ...dateRange, subsidiaryId: selectedSubsidiary } }),
        api.get('/admin/expenses', { params: { ...dateRange, subsidiaryId: selectedSubsidiary } }),
        api.get('/admin/profit', { params: { ...dateRange, subsidiaryId: selectedSubsidiary } }),
        api.get('/admin/users', { params: { limit: 10 } }),
        api.get('/admin/audit-logs', { params: { limit: 20 } }),
        api.get('/admin/alerts'),
        api.get('/admin/notifications'),
        api.get('/admin/system-health'),
        api.get('/admin/recent-activities', { params: { limit: 20 } }),
        api.get('/admin/subsidiary-performance', { params: dateRange }),
        api.get('/subsidiaries')
      ]);

      setKpiData(kpiRes.data);
      setRevenueData(revenueRes.data);
      setExpenseData(expenseRes.data);
      setProfitData(profitRes.data);
      setUsers(usersRes.data.data || []);
      setAuditLogs(logsRes.data);
      setAlerts(alertsRes.data);
      setNotifications(notificationsRes.data);
      setSystemHealth(healthRes.data);
      setRecentActivities(activitiesRes.data);
      setSubsidiaryPerformance(subsidiaryRes.data);
      setSubsidiaries(subsidiariesRes.data.data || []);
      
      // Process top expenses
      const topEx = expenses
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);
      setTopExpenses(topEx);
      
      setPendingApprovals(pendingExpenses);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedSubsidiary, expenses, pendingExpenses, showToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Handle period change
  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    const now = new Date();
    let start;

    switch (newPeriod) {
      case 'day':
        start = startOfDay(now);
        break;
      case 'week':
        start = startOfDay(subWeeks(now, 1));
        break;
      case 'month':
        start = startOfDay(subMonths(now, 1));
        break;
      case 'quarter':
        start = startOfDay(subMonths(now, 3));
        break;
      case 'year':
        start = startOfDay(subYears(now, 1));
        break;
      default:
        start = startOfDay(subMonths(now, 1));
    }

    setDateRange({
      startDate: start,
      endDate: endOfDay(now)
    });
  };

  // Handle export
  const handleExport = async (format) => {
    try {
      const response = await api.get('/admin/export', {
        params: { ...dateRange, format },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `admin-report-${format(new Date(), 'yyyy-MM-dd')}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      showToast(`Report exported as ${format.toUpperCase()}`, 'success');
    } catch (error) {
      showToast('Failed to export report', 'error');
    }
  };

  // Handle user actions
  const handleUserAction = async (action, user) => {
    try {
      switch (action) {
        case 'activate':
          await api.put(`/admin/users/${user.id}`, { isActive: true });
          showToast('User activated', 'success');
          break;
        case 'deactivate':
          await api.put(`/admin/users/${user.id}`, { isActive: false });
          showToast('User deactivated', 'success');
          break;
        case 'delete':
          if (window.confirm(`Are you sure you want to delete ${user.fullName}?`)) {
            await api.delete(`/admin/users/${user.id}`);
            showToast('User deleted', 'success');
          }
          break;
        case 'reset-password':
          await api.post(`/admin/users/${user.id}/reset-password`);
          showToast('Password reset email sent', 'success');
          break;
      }
      fetchDashboardData();
    } catch (error) {
      showToast(`Failed to ${action} user`, 'error');
    }
  };

  // Handle alert acknowledgment
  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await api.put(`/admin/alerts/${alertId}/acknowledge`);
      setAlerts(alerts.filter(a => a.id !== alertId));
      showToast('Alert acknowledged', 'success');
    } catch (error) {
      showToast('Failed to acknowledge alert', 'error');
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      healthy: 'success',
      warning: 'warning',
      error: 'error',
      offline: 'default'
    };
    return colors[status] || 'default';
  };

  // Get role icon
  const getRoleIcon = (role) => {
    switch (role) {
      case 'ADMIN': return <AdminPanelSettings />;
      case 'CEO': return <Business />;
      case 'MANAGER': return <Person />;
      case 'ACCOUNTANT': return <AccountBalance />;
      default: return <AccountCircle />;
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                <AdminPanelSettings />
              </Avatar>
              <Box>
                <Typography variant="h5">Admin Dashboard</Typography>
                <Typography variant="body2" color="textSecondary">
                  Welcome back, {user?.fullName}
                </Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant={period === 'day' ? 'contained' : 'outlined'}
                onClick={() => handlePeriodChange('day')}
              >
                Day
              </Button>
              <Button
                size="small"
                variant={period === 'week' ? 'contained' : 'outlined'}
                onClick={() => handlePeriodChange('week')}
              >
                Week
              </Button>
              <Button
                size="small"
                variant={period === 'month' ? 'contained' : 'outlined'}
                onClick={() => handlePeriodChange('month')}
              >
                Month
              </Button>
              <Button
                size="small"
                variant={period === 'quarter' ? 'contained' : 'outlined'}
                onClick={() => handlePeriodChange('quarter')}
              >
                Quarter
              </Button>
              <Button
                size="small"
                variant={period === 'year' ? 'contained' : 'outlined'}
                onClick={() => handlePeriodChange('year')}
              >
                Year
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
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
              
              <Tooltip title="Export PDF">
                <IconButton onClick={() => handleExport('pdf')}>
                  <Download />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Refresh">
                <IconButton onClick={fetchDashboardData}>
                  <Refresh />
                </IconButton>
              </Tooltip>
              
              <Tooltip title={mode === 'dark' ? 'Light Mode' : 'Dark Mode'}>
                <IconButton onClick={toggleTheme}>
                  {mode === 'dark' ? <LightMode /> : <DarkMode />}
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Fade in timeout={500}>
          <Paper sx={{ p: 2, mb: 3, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Warning sx={{ color: 'warning.main', mr: 1 }} />
              <Typography variant="h6" color="warning.main">
                Active Alerts ({alerts.length})
              </Typography>
            </Box>
            <Grid container spacing={2}>
              {alerts.map((alert, index) => (
                <Grid item xs={12} md={6} lg={4} key={index}>
                  <Alert
                    severity={alert.severity}
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    }
                  >
                    <Typography variant="body2">{alert.message}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {format(new Date(alert.timestamp), 'PPpp')}
                    </Typography>
                  </Alert>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Fade>
      )}

      {/* Loading State */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* KPI Cards */}
      {kpiData && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Zoom in timeout={500}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Total Revenue
                      </Typography>
                      <Typography variant="h4">
                        ₦{kpiData.totalRevenue?.toLocaleString() || 0}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        {kpiData.revenueGrowth > 0 ? (
                          <ArrowUpward fontSize="small" color="success" />
                        ) : (
                          <ArrowDownward fontSize="small" color="error" />
                        )}
                        <Typography
                          variant="body2"
                          color={kpiData.revenueGrowth > 0 ? 'success.main' : 'error.main'}
                          sx={{ ml: 0.5 }}
                        >
                          {Math.abs(kpiData.revenueGrowth).toFixed(1)}% from last period
                        </Typography>
                      </Box>
                    </Box>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                      <AttachMoney />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Zoom>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Zoom in timeout={600}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Total Expenses
                      </Typography>
                      <Typography variant="h4">
                        ₦{kpiData.totalExpenses?.toLocaleString() || 0}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        {kpiData.expenseGrowth < 0 ? (
                          <ArrowDownward fontSize="small" color="success" />
                        ) : (
                          <ArrowUpward fontSize="small" color="error" />
                        )}
                        <Typography
                          variant="body2"
                          color={kpiData.expenseGrowth < 0 ? 'success.main' : 'error.main'}
                          sx={{ ml: 0.5 }}
                        >
                          {Math.abs(kpiData.expenseGrowth).toFixed(1)}% from last period
                        </Typography>
                      </Box>
                    </Box>
                    <Avatar sx={{ bgcolor: 'error.main', width: 56, height: 56 }}>
                      <Receipt />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Zoom>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Zoom in timeout={700}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Net Profit
                      </Typography>
                      <Typography variant="h4">
                        ₦{kpiData.netProfit?.toLocaleString() || 0}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <Chip
                          size="small"
                          label={`${kpiData.profitMargin?.toFixed(1) || 0}% margin`}
                          color={kpiData.profitMargin > 20 ? 'success' : kpiData.profitMargin > 10 ? 'warning' : 'error'}
                        />
                      </Box>
                    </Box>
                    <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                      <TrendingUp />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Zoom>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Zoom in timeout={800}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Active Users
                      </Typography>
                      <Typography variant="h4">
                        {kpiData.activeUsers || 0}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <Chip
                          size="small"
                          label={`${kpiData.activeSessions || 0} active sessions`}
                          color="info"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                    <Avatar sx={{ bgcolor: 'info.main', width: 56, height: 56 }}>
                      <People />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Zoom>
          </Grid>
        </Grid>
      )}

      {/* System Health Cards */}
      {systemHealth && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: getStatusColor(systemHealth.api) + '.light', mr: 2 }}>
                    <CloudDone />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="textSecondary">API Status</Typography>
                    <Typography variant="h6" color={`${getStatusColor(systemHealth.api)}.main`}>
                      {systemHealth.api?.toUpperCase()}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: getStatusColor(systemHealth.database) + '.light', mr: 2 }}>
                    <Storage />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="textSecondary">Database</Typography>
                    <Typography variant="h6" color={`${getStatusColor(systemHealth.database)}.main`}>
                      {systemHealth.database?.toUpperCase()}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: getStatusColor(systemHealth.redis) + '.light', mr: 2 }}>
                    <Speed />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="textSecondary">Redis Cache</Typography>
                    <Typography variant="h6" color={`${getStatusColor(systemHealth.redis)}.main`}>
                      {systemHealth.redis?.toUpperCase()}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: getStatusColor(systemHealth.storage) + '.light', mr: 2 }}>
                    <Memory />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="textSecondary">Storage</Typography>
                    <Typography variant="h6" color={`${getStatusColor(systemHealth.storage)}.main`}>
                      {systemHealth.usedStorage} / {systemHealth.totalStorage} GB
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Tabs */}
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<DashboardIcon />} label="Overview" />
          <Tab icon={<Timeline />} label="Analytics" />
          <Tab icon={<People />} label="User Management" />
          <Tab icon={<Receipt />} label="Audit Logs" />
          <Tab icon={<SettingsApplications />} label="System Settings" />
          <Tab icon={<SecurityIcon />} label="Security" />
          <Tab icon={<SettingsBackupRestore />} label="Backup & Restore" />
          <Tab icon={<Notifications />} label="Notifications" />
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Revenue Chart */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Revenue vs Expenses
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={profitData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip formatter={(value) => `₦${value.toLocaleString()}`} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" stackId="1" stroke="#8884d8" fill="#8884d8" />
                      <Area type="monotone" dataKey="expenses" stackId="1" stroke="#ff7300" fill="#ff7300" />
                      <Line type="monotone" dataKey="profit" stroke="#82ca9d" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Subsidiary Performance */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Subsidiary Performance
                  </Typography>
                  <List>
                    {subsidiaryPerformance.slice(0, 5).map((sub, index) => (
                      <ListItem key={index} divider={index < 4}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: COLORS[index % COLORS.length] }}>
                            {sub.name.charAt(0)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={sub.name}
                          secondary={`₦${sub.revenue.toLocaleString()} revenue`}
                        />
                        <Chip
                          size="small"
                          label={`${sub.growth > 0 ? '+' : ''}${sub.growth}%`}
                          color={sub.growth > 0 ? 'success' : 'error'}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* Expense Breakdown */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Expense by Category
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={expenseData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.name}: ₦${(entry.value / 1000).toFixed(0)}k`}
                      >
                        {expenseData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(value) => `₦${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Recent Activities */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Activities
                  </Typography>
                  <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {recentActivities.map((activity, index) => (
                      <ListItem key={index} divider={index < recentActivities.length - 1}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: activity.type === 'expense' ? 'error.light' : 'success.light' }}>
                            {activity.type === 'expense' ? <Receipt /> : <AttachMoney />}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={activity.description}
                          secondary={
                            <>
                              <Typography variant="caption" color="textSecondary" component="span">
                                {activity.user} • {format(new Date(activity.timestamp), 'PPpp')}
                              </Typography>
                            </>
                          }
                        />
                        <Chip
                          size="small"
                          label={`₦${activity.amount?.toLocaleString()}`}
                          color={activity.type === 'expense' ? 'error' : 'success'}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* Top Expenses */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top 10 Expenses
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Description</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topExpenses.map((expense) => (
                        <TableRow key={expense.id} hover>
                          <TableCell>{expense.description || expense.expenseCategory}</TableCell>
                          <TableCell>
                            <Chip
                              label={expense.expenseCategory}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            ₦{expense.amount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>

            {/* Pending Approvals */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Pending Approvals
                  </Typography>
                  <List>
                    {pendingApprovals.slice(0, 5).map((approval) => (
                      <ListItem key={approval.id} divider>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'warning.light' }}>
                            <PendingOutlined />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={approval.description || approval.expenseCategory}
                          secondary={`₦${approval.amount.toLocaleString()} • ${approval.user}`}
                        />
                        <Box>
                          <IconButton size="small" color="success">
                            <CheckCircle />
                          </IconButton>
                          <IconButton size="small" color="error">
                            <CancelOutlined />
                          </IconButton>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Revenue Trend Analysis
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <ChartTooltip formatter={(value) => `₦${value.toLocaleString()}`} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" />
                      <Bar yAxisId="left" dataKey="expenses" fill="#ff7300" />
                      <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#82ca9d" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    User Growth
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={users}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="#8884d8" />
                      <Line type="monotone" dataKey="active" stroke="#82ca9d" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    System Performance
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart outerRadius={90} data={systemHealth?.metrics || []}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar name="Performance" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* User Management Tab */}
        <TabPanel value={tabValue} index={2}>
          <UserManagement />
        </TabPanel>

        {/* Audit Logs Tab */}
        <TabPanel value={tabValue} index={3}>
          <AuditLogs />
        </TabPanel>

        {/* System Settings Tab */}
        <TabPanel value={tabValue} index={4}>
          <ApiSettings />
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={tabValue} index={5}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Security Overview
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircle color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary="2FA Status"
                        secondary="Enabled for all admin users"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircle color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary="SSL Certificate"
                        secondary="Valid until Dec 2024"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Warning color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Failed Login Attempts"
                        secondary="23 in last 24 hours"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Security Actions
                  </Typography>
                  <Stack spacing={2}>
                    <Button variant="outlined" startIcon={<SecurityIcon />}>
                      Force Logout All Users
                    </Button>
                    <Button variant="outlined" startIcon={<Language />}>
                      Review IP Whitelist
                    </Button>
                    <Button variant="outlined" startIcon={<Palette />}>
                      Update Security Policies
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Backup & Restore Tab */}
        <TabPanel value={tabValue} index={6}>
          <BackupRestore />
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={tabValue} index={7}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    System Notifications
                  </Typography>
                  <List>
                    {notifications.map((notification, index) => (
                      <ListItem key={index} divider>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: notification.type === 'success' ? 'success.light' : 'info.light' }}>
                            {notification.type === 'success' ? <CheckCircle /> : <Info />}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={notification.title}
                          secondary={notification.message}
                        />
                        <ListItemSecondaryAction>
                          <Typography variant="caption" color="textSecondary">
                            {format(new Date(notification.timestamp), 'PP')}
                          </Typography>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Quick Actions FAB */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000
        }}
      >
        <Tooltip title="Quick Actions">
          <IconButton
            color="primary"
            sx={{
              width: 56,
              height: 56,
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }}
            onClick={() => setActionMenuAnchor(document.body)}
          >
            <Add />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Quick Actions Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={() => setActionMenuAnchor(null)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right'
        }}
      >
        <MenuItem onClick={() => navigate('/users/invite')}>
          <ListItemIcon><Person /></ListItemIcon>
          <ListItemText>Invite User</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => navigate('/expenses/add')}>
          <ListItemIcon><Receipt /></ListItemIcon>
          <ListItemText>Add Expense</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => navigate('/vehicles/add')}>
          <ListItemIcon><DirectionsCar /></ListItemIcon>
          <ListItemText>Add Vehicle</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => navigate('/customers/add')}>
          <ListItemIcon><People /></ListItemIcon>
          <ListItemText>Add Customer</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={logout}>
          <ListItemIcon><Logout /></ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};
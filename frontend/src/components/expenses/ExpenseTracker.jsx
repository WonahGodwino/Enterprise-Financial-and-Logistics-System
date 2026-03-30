import React, { useState, useEffect, useCallback } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { format } from 'date-fns';
import { useExpenses } from '../../hooks/useExpenses';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import FormHelperText from '@mui/material/FormHelperText';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { LocalizationProvider, DatePicker } from '@mui/lab';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import Close from '@mui/icons-material/Close';
import Visibility from '@mui/icons-material/Visibility';
import Edit from '@mui/icons-material/Edit';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Cancel from '@mui/icons-material/Cancel';
import AttachMoney from '@mui/icons-material/AttachMoney';
import FileCopy from '@mui/icons-material/FileCopy';
import Print from '@mui/icons-material/Print';
import Delete from '@mui/icons-material/Delete';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import Save from '@mui/icons-material/Save';
import LocalGasStation from '@mui/icons-material/LocalGasStation';
import Build from '@mui/icons-material/Build';
import Person from '@mui/icons-material/Person';
import DirectionsCar from '@mui/icons-material/DirectionsCar';

const MAIN_SUBSIDIARY_CODE = 'MAIN';

// Validation schema for expense form
const expenseValidationSchema = Yup.object({
  expenseType: Yup.string().required('Expense type is required'),
  expenseCategory: Yup.string().required('Expense category is required'),
  amount: Yup.number()
    .positive('Amount must be positive')
    .required('Amount is required'),
  expenseDate: Yup.date()
    .max(new Date(), 'Date cannot be in future')
    .required('Date is required'),
  vehicleId: Yup.string().optional(),
  subsidiaryId: Yup.string().required('Subsidiary is required'),
  vendorName: Yup.string().optional(),
  description: Yup.string().max(500, 'Description too long').optional(),
  quantity: Yup.number().positive('Quantity must be positive').optional(),
  unitPrice: Yup.number().positive('Unit price must be positive').optional(),
  taxAmount: Yup.number().min(0, 'Tax amount cannot be negative').optional(),
  receiptNumber: Yup.string().optional(),
  isRecurring: Yup.boolean(),
  recurrencePattern: Yup.string().when('isRecurring', {
    is: true,
    then: Yup.string().required('Recurrence pattern is required')
  })
});

export const ExpenseTracker = () => {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();

  const formatSubsidiaryLabel = useCallback((subsidiary) => {
    const isMain = String(subsidiary?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
    if (isMain) {
      return `${subsidiary.name} (Main)`;
    }
    return `${subsidiary.name}${subsidiary?.code ? ` (${subsidiary.code})` : ''}`;
  }, []);

  // Use the custom hook for expense management
  const {
    expenses,
    loading,
    stats,
    pendingApprovals,
    recurringExpenses,
    pagination,
    filters: hookFilters,
    updateFilters,
    resetFilters,
    selectExpense,
    selectedExpense,
    clearSelectedExpense,
    createExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
    rejectExpense,
    markAsPaid,
    bulkUpload,
    exportExpenses,
    refresh,
    goToPage,
    changeLimit,
    refreshStats,
    refreshPending,
    refreshRecurring
  } = useExpenses({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date()
  });

  // Local state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    expenseType: 'all',
    expenseCategory: 'all',
    paymentStatus: 'all',
    approvalStatus: 'all',
    vehicleId: 'all',
    subsidiaryId: 'all',
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date()
  });
  
  // Dialog state
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  
  // Reference data
  const [vehicles, setVehicles] = useState([]);
  const [subsidiaries, setSubsidiaries] = useState([]);
  
  // Tab state
  const [tabValue, setTabValue] = useState(0);
  
  // File upload
  const [uploading, setUploading] = useState(false);

  // Expense categories from constants
  const expenseCategories = {
    OPERATIONAL: [
      'FUEL', 'MAINTENANCE', 'REPAIRS', 'TYRES', 'INSURANCE', 
      'ROAD_TOLLS', 'PARKING', 'DRIVER_ALLOWANCE', 'VEHICLE_REGISTRATION',
      'VEHICLE_INSPECTION', 'OIL_CHANGE', 'BRAKE_PADS', 'BATTERY',
      'LIGHTS', 'WIPERS', 'CAR_WASH', 'DETAILING'
    ],
    ADMINISTRATIVE: [
      'SALARIES', 'WAGES', 'BONUSES', 'COMMISSIONS', 'STAFF_BENEFITS',
      'PENSION', 'TRAINING', 'RECRUITMENT', 'RENT', 'UTILITIES',
      'ELECTRICITY', 'WATER', 'INTERNET', 'TELEPHONE', 'OFFICE_SUPPLIES',
      'STATIONERY', 'PRINTING', 'POSTAGE', 'COURIER', 'LEGAL_FEES',
      'ACCOUNTING_FEES', 'CONSULTING_FEES', 'AUDIT_FEES', 'BANK_CHARGES',
      'INTEREST', 'INSURANCE_ADMIN', 'SECURITY', 'CLEANING', 'WASTE_DISPOSAL'
    ],
    MARKETING: [
      'ADVERTISING', 'DIGITAL_MARKETING', 'SOCIAL_MEDIA_ADS', 'PRINT_ADS',
      'BILLBOARDS', 'RADIO_ADS', 'TV_ADS', 'PROMOTIONS', 'DISCOUNTS',
      'WEBSITE', 'SEO', 'CONTENT_CREATION', 'BRANDING', 'EVENT_SPONSORSHIP',
      'TRADE_SHOWS', 'MARKETING_MATERIALS', 'BROCHURES', 'FLYERS', 'BUSINESS_CARDS'
    ],
    CAPITAL: [
      'VEHICLE_PURCHASE', 'VEHICLE_IMPORT', 'VEHICLE_CUSTOMS', 'EQUIPMENT',
      'MACHINERY', 'TOOLS', 'FURNITURE', 'OFFICE_EQUIPMENT', 'COMPUTER',
      'LAPTOP', 'PRINTER', 'SCANNER', 'SOFTWARE', 'LICENSE', 'SUBSCRIPTION',
      'RENOVATION', 'CONSTRUCTION', 'BUILDING', 'LAND'
    ],
    SECURITY_SERVICES: [
      'UNIFORMS', 'SECURITY_GEAR', 'GUARD_EQUIPMENT', 'CCTV_CAMERAS',
      'CCTV_INSTALLATION', 'CCTV_MAINTENANCE', 'ALARM_SYSTEMS',
      'ACCESS_CONTROL', 'SMART_HOME_DEVICES', 'SECURITY_CONSULTING',
      'RISK_ASSESSMENT', 'SECURITY_AUDIT', 'GUARD_TRAINING',
      'SECURITY_LICENSES', 'SECURITY_PERMITS', 'PATROL_VEHICLES',
      'COMMUNICATION_EQUIPMENT', 'RADIOS', 'BODY_CAMERAS'
    ],
    CONSTRUCTION: [
      'CONSTRUCTION_MATERIALS', 'CEMENT', 'SAND', 'GRAVEL', 'GRANITE',
      'BLOCKS', 'BRICKS', 'TIMBER', 'STEEL', 'REINFORCEMENT', 'NAILS',
      'SCREWS', 'PAINT', 'TILES', 'ROOFING', 'PLUMBING_MATERIALS',
      'ELECTRICAL_MATERIALS', 'WIRES', 'CONDUITS', 'FITTINGS', 'FIXTURES',
      'DOORS', 'WINDOWS', 'HARDWARE', 'TOOLS_CONSTRUCTION', 'EQUIPMENT_RENTAL',
      'CRANE', 'EXCAVATOR', 'CONCRETE_MIXER', 'GENERATOR', 'SUBCONTRACTORS',
      'LABOR', 'SKILLED_LABOR', 'UNSKILLED_LABOR', 'PERMITS', 'BUILDING_PERMITS',
      'ENVIRONMENTAL_PERMITS', 'SAFETY_GEAR', 'HELMETS', 'BOOTS', 'VESTS',
      'GLOVES', 'SITE_SECURITY', 'SITE_CLEANUP', 'WASTE_REMOVAL'
    ],
    TRAVEL: [
      'LOCAL_TRAVEL', 'INTERNATIONAL_TRAVEL', 'AIRFARE', 'HOTEL', 'MEALS',
      'TRANSPORTATION', 'TAXI', 'RENTAL_CAR', 'FUEL_TRAVEL', 'PARKING_TRAVEL',
      'TOLLS_TRAVEL', 'VISA', 'PASSPORT'
    ],
    MISCELLANEOUS: [
      'DONATIONS', 'CHARITY', 'GIFTS', 'ENTERTAINMENT', 'CLIENT_ENTERTAINMENT',
      'STAFF_ENTERTAINMENT', 'TEAM_BUILDING', 'STAFF_PARTY', 'SUBSISTENCE',
      'PETTY_CASH', 'CONTINGENCY', 'MISCELLANEOUS', 'OTHER'
    ]
  };

  // Formik for expense form
  const formik = useFormik({
    initialValues: {
      expenseType: '',
      expenseCategory: '',
      amount: '',
      quantity: '',
      unitPrice: '',
      description: '',
      details: '',
      expenseDate: new Date(),
      vehicleId: '',
      subsidiaryId: '',
      vendorName: '',
      vendorId: '',
      receiptNumber: '',
      taxAmount: 0,
      taxRate: 0,
      isRecurring: false,
      recurrencePattern: '',
      notes: ''
    },
    validationSchema: expenseValidationSchema,
    onSubmit: async (values) => {
      try {
        const payload = {
          ...values,
        };

        // Calculate amount if quantity and unit price provided
        if (payload.quantity && payload.unitPrice && !payload.amount) {
          payload.amount = payload.quantity * payload.unitPrice;
        }

        // Calculate tax if tax rate provided
        if (payload.taxRate && !payload.taxAmount) {
          payload.taxAmount = payload.amount * (payload.taxRate / 100);
        }

        if (selectedExpense) {
          // Update existing expense using the hook
          await updateExpense(selectedExpense.id, payload);
        } else {
          // Create new expense using the hook
          await createExpense(payload);
        }
        
        setExpenseDialog(false);
        clearSelectedExpense();
        formik.resetForm();
      } catch (error) {
        // Error is already handled in the hook
        console.error('Error saving expense:', error);
      }
    }
  });

  // Fetch reference data
  const fetchReferenceData = async () => {
    try {
      const [vehiclesRes, subsidiariesRes] = await Promise.all([
        api.getVehicles({ limit: 100 }),
        api.getSubsidiaries()
      ]);

      const vehiclesRows = Array.isArray(vehiclesRes?.data) ? vehiclesRes.data : [];
      setVehicles(vehiclesRows);

      const subsidiariesRows = Array.isArray(subsidiariesRes?.data)
        ? [...subsidiariesRes.data].sort((a, b) => {
            const aIsMain = String(a?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
            const bIsMain = String(b?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
            if (aIsMain && !bIsMain) return -1;
            if (!aIsMain && bIsMain) return 1;
            return String(a?.name || '').localeCompare(String(b?.name || ''));
          })
        : [];
      setSubsidiaries(subsidiariesRows);
    } catch (error) {
      console.error('Error fetching reference data:', error);
    }
  };

  useEffect(() => {
    fetchReferenceData();
  }, []);

  // Sync local filters with hook filters
  useEffect(() => {
    const timer = setTimeout(() => {
      updateFilters({
        search: searchTerm,
        expenseType: filters.expenseType !== 'all' ? filters.expenseType : undefined,
        expenseCategory: filters.expenseCategory !== 'all' ? filters.expenseCategory : undefined,
        paymentStatus: filters.paymentStatus !== 'all' ? filters.paymentStatus : undefined,
        approvalStatus: filters.approvalStatus !== 'all' ? filters.approvalStatus : undefined,
        vehicleId: filters.vehicleId !== 'all' ? filters.vehicleId : undefined,
        subsidiaryId: filters.subsidiaryId !== 'all' ? filters.subsidiaryId : undefined,
        startDate: filters.startDate,
        endDate: filters.endDate
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, filters, updateFilters]);

  // Sync pagination with hook
  useEffect(() => {
    goToPage(page + 1);
  }, [page, goToPage]);

  useEffect(() => {
    changeLimit(rowsPerPage);
  }, [rowsPerPage, changeLimit]);

  // Handle tab change
  useEffect(() => {
    switch (tabValue) {
      case 0: // All Expenses
        updateFilters({ approvalStatus: undefined, paymentStatus: undefined });
        break;
      case 1: // Pending Approval
        updateFilters({ approvalStatus: 'PENDING', paymentStatus: undefined });
        break;
      case 2: // Unpaid
        updateFilters({ paymentStatus: 'UNPAID', approvalStatus: undefined });
        break;
      case 3: // Recurring
        // This would need a specific API endpoint
        break;
    }
  }, [tabValue, updateFilters]);

  // Handle file upload
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    setUploading(true);
    try {
      await bulkUpload(formData);
      showToast('Files uploaded successfully', 'success');
    } catch (error) {
      showToast('Error uploading files', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Handle edit expense
  const handleEditExpense = (expense) => {
    selectExpense(expense);
    formik.setValues({
      expenseType: expense.expenseType || '',
      expenseCategory: expense.expenseCategory || '',
      amount: expense.amount || '',
      quantity: expense.quantity || '',
      unitPrice: expense.unitPrice || '',
      description: expense.description || '',
      details: expense.details || '',
      expenseDate: new Date(expense.expenseDate),
      vehicleId: expense.vehicleId || '',
      subsidiaryId: expense.subsidiaryId || '',
      vendorName: expense.vendorName || '',
      vendorId: expense.vendorId || '',
      receiptNumber: expense.receiptNumber || '',
      taxAmount: expense.taxAmount || 0,
      taxRate: expense.taxRate || 0,
      isRecurring: expense.isRecurring || false,
      recurrencePattern: expense.recurrencePattern || '',
      notes: expense.notes || ''
    });
    setExpenseDialog(true);
    setActionMenuAnchor(null);
  };

  // Handle delete expense
  const handleDeleteExpense = async (expense) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    
    await deleteExpense(expense.id);
    setActionMenuAnchor(null);
  };

  // Handle approve expense
  const handleApproveExpense = async (expense) => {
    await approveExpense(expense.id, 'Approved by manager');
    setActionMenuAnchor(null);
  };

  // Handle reject expense
  const handleRejectExpense = async (expense) => {
    const reason = window.prompt('Please provide a reason for rejection:');
    if (!reason) return;

    await rejectExpense(expense.id, reason);
    setActionMenuAnchor(null);
  };

  // Handle mark as paid
  const handleMarkAsPaid = async (expense) => {
    await markAsPaid(expense.id, {
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: new Date()
    });
    setActionMenuAnchor(null);
  };

  // Handle duplicate
  const handleDuplicate = (expense) => {
    const { id, createdAt, updatedAt, approvedBy, createdBy, ...duplicateData } = expense;
    selectExpense(null);
    formik.setValues({
      ...duplicateData,
      amount: '',
      expenseDate: new Date(),
      receiptNumber: '',
      notes: `Duplicate of ${expense.receiptNumber || expense.id}`
    });
    setExpenseDialog(true);
    setActionMenuAnchor(null);
  };

  // Handle export
  const handleExport = async (format) => {
    try {
      await exportExpenses(format);
    } catch (error) {
      showToast('Failed to export expenses', 'error');
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({
      expenseType: 'all',
      expenseCategory: 'all',
      paymentStatus: 'all',
      approvalStatus: 'all',
      vehicleId: 'all',
      subsidiaryId: 'all',
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate: new Date()
    });
    setPage(0);
    resetFilters();
  };

  // Get color for expense type
  const getExpenseTypeColor = (type) => {
    const colors = {
      OPERATIONAL: 'primary',
      ADMINISTRATIVE: 'secondary',
      MARKETING: 'info',
      CAPITAL: 'success',
      SECURITY_SERVICES: 'warning',
      CONSTRUCTION: 'error',
      TRAVEL: 'default',
      MISCELLANEOUS: 'default'
    };
    return colors[type] || 'default';
  };

  // Get color for payment status
  const getPaymentStatusColor = (status) => {
    const colors = {
      PAID: 'success',
      PARTIALLY_PAID: 'info',
      PENDING: 'warning',
      UNPAID: 'error',
      OVERDUE: 'error'
    };
    return colors[status] || 'default';
  };

  // Get color for approval status
  const getApprovalStatusColor = (status) => {
    const colors = {
      APPROVED: 'success',
      PENDING: 'warning',
      REJECTED: 'error',
      UNDER_REVIEW: 'info'
    };
    return colors[status] || 'default';
  };

  // Get icon for expense type
  const getExpenseTypeIcon = (type) => {
    switch (type) {
      case 'FUEL': return <LocalGasStation />;
      case 'MAINTENANCE':
      case 'REPAIRS': return <Build />;
      case 'SALARIES':
      case 'WAGES': return <Person />;
      case 'VEHICLE_PURCHASE': return <DirectionsCar />;
      default: return <AttachMoney />;
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Expense Tracker</h3>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 bg-red-600 text-white rounded-md"
            onClick={() => {
              clearSelectedExpense();
              formik.resetForm();
              setExpenseDialog(true);
            }}
          >
            Add Expense
          </button>
          <label className="inline-block">
            <input type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            <span className={`px-3 py-2 border rounded-md ${uploading ? 'opacity-50' : 'hover:bg-gray-100'}`}>{uploading ? 'Uploading...' : 'Bulk Upload'}</span>
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button className={`px-3 py-1 rounded ${tabValue === 0 ? 'bg-red-50 text-red-600' : 'bg-white'}`} onClick={() => setTabValue(0)}>All Expenses</button>
        <button className={`px-3 py-1 rounded ${tabValue === 1 ? 'bg-red-50 text-red-600' : 'bg-white'}`} onClick={() => setTabValue(1)}>Pending Approval <span className="ml-2 text-sm text-gray-500">{pendingApprovals?.length || 0}</span></button>
        <button className={`px-3 py-1 rounded ${tabValue === 2 ? 'bg-red-50 text-red-600' : 'bg-white'}`} onClick={() => setTabValue(2)}>Unpaid</button>
        <button className={`px-3 py-1 rounded ${tabValue === 3 ? 'bg-red-50 text-red-600' : 'bg-white'}`} onClick={() => setTabValue(3)}>Recurring <span className="ml-2 text-sm text-gray-500">{recurringExpenses?.length || 0}</span></button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-gray-500">Total Expenses</div>
            <div className="text-2xl font-bold">₦{stats.totalAmount?.toLocaleString() || 0}</div>
            <div className="text-xs text-gray-500">{stats.totalCount} transactions</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-gray-500">Average per Transaction</div>
            <div className="text-2xl font-bold">₦{stats.averageAmount?.toLocaleString() || 0}</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-gray-500">Pending Approval</div>
            <div className="text-2xl font-bold">{pendingApprovals?.length || 0}</div>
            <button className="text-sm mt-2 text-red-600" onClick={() => setTabValue(1)}>View</button>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-gray-500">Overdue Payments</div>
            <div className="text-2xl font-bold text-red-600">{stats.overdueCount || 0}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Search expenses..." />
          </div>
          <div>
            <select value={filters.expenseType} onChange={(e) => setFilters({ ...filters, expenseType: e.target.value })} className="w-full px-3 py-2 border rounded">
              <option value="all">All Types</option>
              <option value="OPERATIONAL">Operational</option>
              <option value="ADMINISTRATIVE">Administrative</option>
              <option value="MARKETING">Marketing</option>
              <option value="CAPITAL">Capital</option>
              <option value="SECURITY_SERVICES">Security Services</option>
              <option value="CONSTRUCTION">Construction</option>
            </select>
          </div>
          <div>
            <select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })} className="w-full px-3 py-2 border rounded">
              <option value="all">All Status</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="UNPAID">Unpaid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
          <div>
            <select value={filters.approvalStatus} onChange={(e) => setFilters({ ...filters, approvalStatus: e.target.value })} className="w-full px-3 py-2 border rounded">
              <option value="all">All</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div>
            <input type="date" value={filters.startDate ? new Date(filters.startDate).toISOString().slice(0,10) : ''} onChange={(e) => setFilters({ ...filters, startDate: new Date(e.target.value) })} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <input type="date" value={filters.endDate ? new Date(filters.endDate).toISOString().slice(0,10) : ''} onChange={(e) => setFilters({ ...filters, endDate: new Date(e.target.value) })} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <select value={filters.vehicleId} onChange={(e) => setFilters({ ...filters, vehicleId: e.target.value })} className="w-full px-3 py-2 border rounded">
              <option value="all">All Vehicles</option>
              {vehicles.map(v => (<option key={v.id} value={v.id}>{v.registrationNumber} - {v.model}</option>))}
            </select>
          </div>
          <div>
            <select value={filters.subsidiaryId} onChange={(e) => setFilters({ ...filters, subsidiaryId: e.target.value })} className="w-full px-3 py-2 border rounded">
              <option value="all">All Subsidiaries</option>
              {subsidiaries.map(s => (<option key={s.id} value={s.id}>{formatSubsidiaryLabel(s)}</option>))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleClearFilters} className="px-3 py-2 border rounded w-full">Clear Filters</button>
            <button onClick={() => handleExport('excel')} className="px-3 py-2 border rounded w-full">Export</button>
            <button onClick={refresh} className="px-3 py-2 border rounded">Refresh</button>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded shadow overflow-x-auto">
        {loading && <div className="h-1 bg-red-500 animate-pulse" />}
        <table className="min-w-full">
          <thead className="bg-red-600">
            <tr className="text-left text-sm text-gray-600 border-b">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Vehicle/Subsidiary</th>
              <th className="px-4 py-3 text-right">Amount (₦)</th>
              <th className="px-4 py-3">Payment Status</th>
              <th className="px-4 py-3">Approval</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  No expenses found
                  <div className="mt-2">
                    <button onClick={() => { clearSelectedExpense(); formik.resetForm(); setExpenseDialog(true); }} className="text-red-600">Add your first expense</button>
                  </div>
                </td>
              </tr>
            ) : (
              expenses.map(expense => (
                <tr key={expense.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{format(new Date(expense.expenseDate), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-gray-200 rounded flex items-center justify-center">{(expense.expenseCategory || '').slice(0,1)}</div>
                      <div>
                        <div className="text-sm">{expense.description || expense.expenseCategory}</div>
                        {expense.receiptNumber && <div className="text-xs text-gray-500">Receipt: {expense.receiptNumber}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm px-2 py-1 border rounded text-gray-700">{expense.expenseCategory}</span></td>
                  <td className="px-4 py-3">
                    {expense.vehicle ? expense.vehicle.registrationNumber : expense.subsidiary ? expense.subsidiary.name : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">₦{expense.amount?.toLocaleString()}</td>
                  <td className="px-4 py-3">{expense.paymentStatus}</td>
                  <td className="px-4 py-3">{expense.approvalStatus}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { selectExpense(expense); setActionMenuAnchor(expense.id); }} className="px-2 py-1 rounded hover:bg-gray-100">•••</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="text-sm text-gray-600">{pagination.total || 0} items</div>
          <div className="flex items-center gap-2">
            <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(parseInt(e.target.value,10)); setPage(0); }} className="px-2 py-1 border rounded">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button onClick={() => setPage(Math.max(0, page-1))} className="px-2 py-1 border rounded">Prev</button>
            <span className="px-2">{page+1}</span>
            <button onClick={() => setPage(page+1)} className="px-2 py-1 border rounded">Next</button>
          </div>
        </div>
      </div>

        {/* Action Menu */}
        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={() => setActionMenuAnchor(null)}
        >
          <MenuItem onClick={() => {
            setViewDialog(true);
            setActionMenuAnchor(null);
          }}>
            <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItem>
          
          {(hasPermission('ADMIN') || hasPermission('MANAGER') || hasPermission('ACCOUNTANT')) && (
            <MenuItem onClick={() => handleEditExpense(selectedExpense)}>
              <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          )}
          
          {selectedExpense?.approvalStatus === 'PENDING' && 
           (hasPermission('ADMIN') || hasPermission('MANAGER')) && (
            <>
              <MenuItem onClick={() => handleApproveExpense(selectedExpense)}>
                <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
                <ListItemText>Approve</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => handleRejectExpense(selectedExpense)}>
                <ListItemIcon><Cancel fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Reject</ListItemText>
              </MenuItem>
            </>
          )}
          
          {selectedExpense?.paymentStatus !== 'PAID' && 
           (hasPermission('ADMIN') || hasPermission('ACCOUNTANT')) && (
            <MenuItem onClick={() => handleMarkAsPaid(selectedExpense)}>
              <ListItemIcon><AttachMoney fontSize="small" color="success" /></ListItemIcon>
              <ListItemText>Mark as Paid</ListItemText>
            </MenuItem>
          )}
          
          <Divider />
          
          <MenuItem onClick={() => handleDuplicate(selectedExpense)}>
            <ListItemIcon><FileCopy fontSize="small" /></ListItemIcon>
            <ListItemText>Duplicate</ListItemText>
          </MenuItem>
          
          <MenuItem onClick={() => handleExport('pdf')}>
            <ListItemIcon><Print fontSize="small" /></ListItemIcon>
            <ListItemText>Print Receipt</ListItemText>
          </MenuItem>
          
          {hasPermission('ADMIN') && (
            <>
              <Divider />
              <MenuItem 
                onClick={() => handleDeleteExpense(selectedExpense)}
                sx={{ color: 'error.main' }}
              >
                <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            </>
          )}
        </Menu>

        {/* Add/Edit Expense Dialog */}
        <Dialog
          open={expenseDialog}
          onClose={() => {
            setExpenseDialog(false);
            clearSelectedExpense();
            formik.resetForm();
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {selectedExpense ? 'Edit Expense' : 'Add New Expense'}
          </DialogTitle>
          <form onSubmit={formik.handleSubmit}>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Expense Type *</InputLabel>
                    <Select
                      name="expenseType"
                      value={formik.values.expenseType}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.expenseType && Boolean(formik.errors.expenseType)}
                    >
                      <MenuItem value="OPERATIONAL">Operational</MenuItem>
                      <MenuItem value="ADMINISTRATIVE">Administrative</MenuItem>
                      <MenuItem value="MARKETING">Marketing</MenuItem>
                      <MenuItem value="CAPITAL">Capital</MenuItem>
                      <MenuItem value="SECURITY_SERVICES">Security Services</MenuItem>
                      <MenuItem value="CONSTRUCTION">Construction</MenuItem>
                      <MenuItem value="TRAVEL">Travel</MenuItem>
                      <MenuItem value="MISCELLANEOUS">Miscellaneous</MenuItem>
                    </Select>
                    {formik.touched.expenseType && formik.errors.expenseType && (
                      <FormHelperText error>{formik.errors.expenseType}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Expense Category *</InputLabel>
                    <Select
                      name="expenseCategory"
                      value={formik.values.expenseCategory}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.expenseCategory && Boolean(formik.errors.expenseCategory)}
                    >
                      {formik.values.expenseType && 
                       expenseCategories[formik.values.expenseType]?.map(category => (
                        <MenuItem key={category} value={category}>
                          {category.replace(/_/g, ' ')}
                        </MenuItem>
                      ))}
                    </Select>
                    {formik.touched.expenseCategory && formik.errors.expenseCategory && (
                      <FormHelperText error>{formik.errors.expenseCategory}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    name="amount"
                    label="Amount (₦) *"
                    type="number"
                    value={formik.values.amount}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.amount && Boolean(formik.errors.amount)}
                    helperText={formik.touched.amount && formik.errors.amount}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    name="quantity"
                    label="Quantity"
                    type="number"
                    value={formik.values.quantity}
                    onChange={formik.handleChange}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    name="unitPrice"
                    label="Unit Price (₦)"
                    type="number"
                    value={formik.values.unitPrice}
                    onChange={formik.handleChange}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    name="description"
                    label="Description"
                    value={formik.values.description}
                    onChange={formik.handleChange}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    name="details"
                    label="Details"
                    multiline
                    rows={2}
                    value={formik.values.details}
                    onChange={formik.handleChange}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <DatePicker
                    label="Expense Date *"
                    value={formik.values.expenseDate}
                    onChange={(date) => formik.setFieldValue('expenseDate', date)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        error={formik.touched.expenseDate && Boolean(formik.errors.expenseDate)}
                        helperText={formik.touched.expenseDate && formik.errors.expenseDate}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Vehicle (Optional)</InputLabel>
                    <Select
                      name="vehicleId"
                      value={formik.values.vehicleId}
                      onChange={formik.handleChange}
                    >
                      <MenuItem value="">None</MenuItem>
                      {vehicles.map(vehicle => (
                        <MenuItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.registrationNumber} - {vehicle.model}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth error={formik.touched.subsidiaryId && Boolean(formik.errors.subsidiaryId)}>
                    <InputLabel>Subsidiary *</InputLabel>
                    <Select
                      name="subsidiaryId"
                      value={formik.values.subsidiaryId}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    >
                      <MenuItem value="">Select subsidiary</MenuItem>
                      {subsidiaries.map(sub => (
                        <MenuItem key={sub.id} value={sub.id}>{formatSubsidiaryLabel(sub)}</MenuItem>
                      ))}
                    </Select>
                    {formik.touched.subsidiaryId && formik.errors.subsidiaryId && (
                      <FormHelperText>{formik.errors.subsidiaryId}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="vendorName"
                    label="Vendor/Supplier"
                    value={formik.values.vendorName}
                    onChange={formik.handleChange}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    name="receiptNumber"
                    label="Receipt Number"
                    value={formik.values.receiptNumber}
                    onChange={formik.handleChange}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    name="taxRate"
                    label="Tax Rate (%)"
                    type="number"
                    value={formik.values.taxRate}
                    onChange={formik.handleChange}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    name="taxAmount"
                    label="Tax Amount (₦)"
                    type="number"
                    value={formik.values.taxAmount}
                    onChange={formik.handleChange}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="isRecurring"
                        checked={formik.values.isRecurring}
                        onChange={formik.handleChange}
                      />
                    }
                    label="This is a recurring expense"
                  />
                </Grid>

                {formik.values.isRecurring && (
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Recurrence Pattern</InputLabel>
                      <Select
                        name="recurrencePattern"
                        value={formik.values.recurrencePattern}
                        onChange={formik.handleChange}
                      >
                        <MenuItem value="DAILY">Daily</MenuItem>
                        <MenuItem value="WEEKLY">Weekly</MenuItem>
                        <MenuItem value="MONTHLY">Monthly</MenuItem>
                        <MenuItem value="QUARTERLY">Quarterly</MenuItem>
                        <MenuItem value="ANNUALLY">Annually</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    name="notes"
                    label="Notes"
                    multiline
                    rows={2}
                    value={formik.values.notes}
                    onChange={formik.handleChange}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<PhotoCamera />}
                  >
                    Upload Receipt
                    <input
                      type="file"
                      hidden
                      accept="image/*,.pdf"
                    />
                  </Button>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setExpenseDialog(false);
                clearSelectedExpense();
                formik.resetForm();
              }}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={formik.isSubmitting || subsidiaries.length === 0}
                startIcon={<Save />}
              >
                {formik.isSubmitting ? 'Saving...' : (selectedExpense ? 'Update' : 'Save')}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* View Expense Dialog */}
        <Dialog
          open={viewDialog}
          onClose={() => {
            setViewDialog(false);
            clearSelectedExpense();
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Expense Details
            <IconButton
              onClick={() => {
                setViewDialog(false);
                clearSelectedExpense();
              }}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {selectedExpense && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Expense ID
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedExpense.id}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Date
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {format(new Date(selectedExpense.expenseDate), 'PPP')}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Type
                  </Typography>
                  <Chip
                    label={selectedExpense.expenseType}
                    size="small"
                    color={getExpenseTypeColor(selectedExpense.expenseType)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Category
                  </Typography>
                  <Chip
                    label={selectedExpense.expenseCategory}
                    size="small"
                    variant="outlined"
                  />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Amount
                  </Typography>
                  <Typography variant="h6" color="primary">
                    ₦{selectedExpense.amount.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Tax
                  </Typography>
                  <Typography variant="body1">
                    ₦{selectedExpense.taxAmount?.toLocaleString() || 0}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Payment Status
                  </Typography>
                  <Chip
                    label={selectedExpense.paymentStatus}
                    size="small"
                    color={getPaymentStatusColor(selectedExpense.paymentStatus)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Approval Status
                  </Typography>
                  <Chip
                    label={selectedExpense.approvalStatus}
                    size="small"
                    color={getApprovalStatusColor(selectedExpense.approvalStatus)}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Description
                  </Typography>
                  <Typography variant="body1" paragraph>
                    {selectedExpense.description || 'No description provided'}
                  </Typography>
                </Grid>

                {selectedExpense.details && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Details
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {selectedExpense.details}
                    </Typography>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created By
                  </Typography>
                  <Typography variant="body1">
                    {selectedExpense.createdBy?.fullName} on {format(new Date(selectedExpense.createdAt), 'PPP')}
                  </Typography>
                </Grid>

                {selectedExpense.approvedBy && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Approved By
                    </Typography>
                    <Typography variant="body1">
                      {selectedExpense.approvedBy.fullName} on {format(new Date(selectedExpense.approvedAt), 'PPP')}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setViewDialog(false);
              clearSelectedExpense();
            }}>
              Close
            </Button>
            <Button
              variant="contained"
              startIcon={<Print />}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ExpenseTracker;

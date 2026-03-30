// frontend/src/components/expenses/Expenses.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Plus,
  Search,
  Edit,
  Trash2,
  Filter,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  X
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const EXPENSE_CATEGORIES_BY_TYPE = {
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
  OTHER: ['OTHER']
};

const EXPENSE_TYPE_OPTIONS = Object.keys(EXPENSE_CATEGORIES_BY_TYPE);
const VEHICLE_RELATED_EXPENSE_CATEGORIES = new Set([
  'FUEL',
  'MAINTENANCE',
  'REPAIRS',
  'TYRES',
  'INSURANCE',
  'ROAD_TOLLS',
  'PARKING',
  'DRIVER_ALLOWANCE',
  'VEHICLE_REGISTRATION',
  'VEHICLE_INSPECTION',
  'OIL_CHANGE',
  'BRAKE_PADS',
  'BATTERY',
  'LIGHTS',
  'WIPERS',
  'CAR_WASH',
  'DETAILING',
  'VEHICLE_PURCHASE',
  'VEHICLE_IMPORT',
  'VEHICLE_CUSTOMS',
  'PATROL_VEHICLES',
]);

const MAIN_SUBSIDIARY_CODE = 'MAIN';
const EXPENSES_PER_PAGE = 10;
const EXPENSE_APPROVER_ROLES = new Set(['CHIEF_DRIVER', 'ADMIN', 'CEO', 'SUPER_ADMIN']);
const EXECUTIVE_APPROVER_ROLES = new Set(['CEO', 'SUPER_ADMIN']);
const EXPENSE_REQUESTER_ROLES = new Set(['DRIVER', 'CHIEF_DRIVER', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN', 'AUDITOR', 'EMPLOYEE', 'SUPERVISOR']);
const STRICT_VEHICLE_REQUEST_ROLES = new Set(['DRIVER', 'CHIEF_DRIVER', 'CEO', 'SUPER_ADMIN']);
const RECEIPT_UPLOAD_ALLOWED_ROLES = new Set(['CHIEF_DRIVER', 'ADMIN', 'CEO', 'SUPER_ADMIN']);

const Expenses = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { mode } = useTheme();
  const defaultSummaryRange = useMemo(() => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }, []);
  const [expenses, setExpenses] = useState([]);
  const [summaryRange, setSummaryRange] = useState(defaultSummaryRange);
  const [showSummaryRangeControls, setShowSummaryRangeControls] = useState(false);
  const handleSummaryStartDateChange = (value) => {
    setSummaryRange((prev) => {
      const nextStart = value || prev.startDate;
      const nextEnd = prev.endDate && nextStart > prev.endDate ? nextStart : prev.endDate;
      return { ...prev, startDate: nextStart, endDate: nextEnd };
    });
  };
  const handleSummaryEndDateChange = (value) => {
    setSummaryRange((prev) => {
      const nextEnd = value || prev.endDate;
      if (prev.startDate && nextEnd < prev.startDate) {
        showToast('End date cannot be earlier than start date.', 'error');
        return prev;
      }
      return { ...prev, endDate: nextEnd };
    });
  };
  const [summaryTotals, setSummaryTotals] = useState({
    total: 0,
    pendingApproval: 0,
    approved: 0,
    completed: 0,
  });
  const [vehicles, setVehicles] = useState([]);
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [modificationReason, setModificationReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showNoReceiptDialog, setShowNoReceiptDialog] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCompleteWithoutReceiptDialog, setShowCompleteWithoutReceiptDialog] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewExpense, setViewExpense] = useState(null);
  const [completingExpense, setCompletingExpense] = useState(null);
  const [completionReceiptFile, setCompletionReceiptFile] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [postCompletionReceiptFile, setPostCompletionReceiptFile] = useState(null);
  const [postCompletionReceiptNumber, setPostCompletionReceiptNumber] = useState('');
  const [uploadingPostCompletionReceipt, setUploadingPostCompletionReceipt] = useState(false);
  const [modificationRequests, setModificationRequests] = useState([]);
  const [modificationHistory, setModificationHistory] = useState([]);
  const [decisionNotes, setDecisionNotes] = useState({});
  const [decidingId, setDecidingId] = useState('');
  const [approvingExpenseId, setApprovingExpenseId] = useState('');
  const [showRejectExpenseDialog, setShowRejectExpenseDialog] = useState(false);
  const [rejectExpenseId, setRejectExpenseId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [prefillSourceMeta, setPrefillSourceMeta] = useState(null);
  const [newExpense, setNewExpense] = useState({
    expenseType: 'OPERATIONAL',
    expenseCategory: 'FUEL',
    amount: '',
    requestedDate: new Date().toISOString().slice(0, 10),
    expenseDate: new Date().toISOString().slice(0, 10),
    description: '',
    details: '',
    vehicleId: '',
    subsidiaryId: '',
    receiptFile: null,
  });

  const currentRole = String(user?.role || '').toUpperCase();
  const requiresVehicleSelection = VEHICLE_RELATED_EXPENSE_CATEGORIES.has(newExpense.expenseCategory)
    || currentRole === 'DRIVER'
    || currentRole === 'CHIEF_DRIVER';
  const mustUseVehicleRelatedCategory = STRICT_VEHICLE_REQUEST_ROLES.has(currentRole);
  const filteredExpenseTypeOptions = useMemo(() => {
    if (!mustUseVehicleRelatedCategory) return EXPENSE_TYPE_OPTIONS;
    return EXPENSE_TYPE_OPTIONS.filter((type) =>
      (EXPENSE_CATEGORIES_BY_TYPE[type] || []).some((category) => VEHICLE_RELATED_EXPENSE_CATEGORIES.has(category))
    );
  }, [mustUseVehicleRelatedCategory]);
  const availableCategories = useMemo(() => {
    const categoriesForType = EXPENSE_CATEGORIES_BY_TYPE[newExpense.expenseType] || ['OTHER'];
    if (!mustUseVehicleRelatedCategory) return categoriesForType;
    return categoriesForType.filter((category) => VEHICLE_RELATED_EXPENSE_CATEGORIES.has(category));
  }, [mustUseVehicleRelatedCategory, newExpense.expenseType]);
  const vehiclesForSelectedSubsidiary = useMemo(() => vehicles, [vehicles]);
  const isExpenseApprover = EXPENSE_APPROVER_ROLES.has(String(user?.role || '').toUpperCase());
  const canRequestExpense = EXPENSE_REQUESTER_ROLES.has(String(user?.role || '').toUpperCase());
  const canUploadCompletedExpenseReceipt = RECEIPT_UPLOAD_ALLOWED_ROLES.has(currentRole);
  const isApprovalPage = location.pathname.startsWith('/expenses/approvals');
  const prefillAppliedRef = React.useRef('');
  const viewExpenseAppliedRef = React.useRef('');
  const isVehicleApprovalPrefill = !editingExpense && prefillSourceMeta?.source === 'vehicle-status-approval';

  useEffect(() => {
    if (filteredExpenseTypeOptions.length === 0) return;

    if (!filteredExpenseTypeOptions.includes(newExpense.expenseType)) {
      const nextType = filteredExpenseTypeOptions[0];
      const nextCategories = (EXPENSE_CATEGORIES_BY_TYPE[nextType] || ['OTHER'])
        .filter((category) => !mustUseVehicleRelatedCategory || VEHICLE_RELATED_EXPENSE_CATEGORIES.has(category));

      setNewExpense((prev) => ({
        ...prev,
        expenseType: nextType,
        expenseCategory: nextCategories[0] || 'FUEL',
      }));
      return;
    }

    if (availableCategories.length > 0 && !availableCategories.includes(newExpense.expenseCategory)) {
      setNewExpense((prev) => ({
        ...prev,
        expenseCategory: availableCategories[0],
      }));
    }
  }, [
    availableCategories,
    filteredExpenseTypeOptions,
    mustUseVehicleRelatedCategory,
    newExpense.expenseCategory,
    newExpense.expenseType,
  ]);

  const resetExpenseForm = () => {
    setEditingExpense(null);
    setModificationReason('');
    setPrefillSourceMeta(null);
    setNewExpense({
      expenseType: 'OPERATIONAL',
      expenseCategory: 'FUEL',
      amount: '',
      requestedDate: new Date().toISOString().slice(0, 10),
      expenseDate: new Date().toISOString().slice(0, 10),
      description: '',
      details: '',
      vehicleId: '',
      subsidiaryId: '',
      receiptFile: null,
    });
  };

  const formatSubsidiaryLabel = (subsidiary) => {
    const isMain = String(subsidiary?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
    if (isMain) return `${subsidiary.name} (Main)`;
    return `${subsidiary.name}${subsidiary?.code ? ` (${subsidiary.code})` : ''}`;
  };

  const fetchVehiclesForSelection = useCallback(async (subsidiaryId) => {
    try {
      const response = await api.getVehicles({ subsidiaryId });
      const data = Array.isArray(response?.data) ? response.data : [];
      setVehicles(data);
    } catch (error) {
      console.error('Error fetching vehicles for expense form:', error);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetchSubsidiaries();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadExpenseSummaryTotals();
  }, [summaryRange.endDate, summaryRange.startDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isExpenseApprover) {
      fetchExpenseModificationData();
    }
  }, [isExpenseApprover]);

  useEffect(() => {
    if (!newExpense.subsidiaryId) {
      setVehicles([]);
      return;
    }
    fetchVehiclesForSelection(newExpense.subsidiaryId);
  }, [fetchVehiclesForSelection, newExpense.subsidiaryId]);

  useEffect(() => {
    const handleWindowFocus = () => {
      if (newExpense.subsidiaryId) {
        fetchVehiclesForSelection(newExpense.subsidiaryId);
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [fetchVehiclesForSelection, newExpense.subsidiaryId]);

  useEffect(() => {
    const prefill = location.state?.prefillExpense;
    if (!prefill || !canRequestExpense) return;

    const hasPrefillField = (field) => Object.prototype.hasOwnProperty.call(prefill, field);
    const getPrefillValue = (field, fallback) => (hasPrefillField(field) ? prefill[field] : fallback);

    const uniqueKey = String(prefill.requestId || prefill.source || 'prefill');
    if (prefillAppliedRef.current === uniqueKey) return;
    prefillAppliedRef.current = uniqueKey;

    setEditingExpense(null);
    setModificationReason('');
    setPrefillSourceMeta({
      source: prefill.source || 'prefill',
      requestId: prefill.requestId || null,
    });
    setNewExpense((prev) => ({
      ...prev,
      expenseType: getPrefillValue('expenseType', prev.expenseType),
      expenseCategory: getPrefillValue('expenseCategory', prev.expenseCategory),
      amount: getPrefillValue('amount', prev.amount),
      requestedDate: getPrefillValue('requestedDate', prev.requestedDate),
      expenseDate: getPrefillValue('expenseDate', prev.expenseDate),
      description: getPrefillValue('description', prev.description),
      details: getPrefillValue('details', prev.details),
      vehicleId: getPrefillValue('vehicleId', prev.vehicleId),
      subsidiaryId: getPrefillValue('subsidiaryId', prev.subsidiaryId),
      receiptFile: null,
    }));
    setShowAddModal(true);

    if (prefill.subsidiaryId) {
      fetchVehiclesForSelection(prefill.subsidiaryId);
    }

    showToast('Expense form prefilled from approved vehicle request.', 'info');
    navigate(location.pathname, { replace: true, state: {} });
  }, [canRequestExpense, fetchVehiclesForSelection, location.pathname, location.state, navigate, showToast]);

  useEffect(() => {
    const viewExpenseId = String(location.state?.viewExpenseId || '').trim();
    if (!viewExpenseId) return;

    if (viewExpenseAppliedRef.current === viewExpenseId) return;
    viewExpenseAppliedRef.current = viewExpenseId;

    const openRequestedExpense = async () => {
      let expenseToView = expenses.find((item) => item.id === viewExpenseId) || null;

      if (!expenseToView) {
        try {
          const response = await api.getExpenseById(viewExpenseId);
          expenseToView = response?.data || null;
        } catch (_error) {
          expenseToView = null;
        }
      }

      if (expenseToView) {
        setViewExpense(expenseToView);
        setShowViewModal(true);
      } else {
        showToast('Unable to open the requested expense record.', 'error');
      }

      navigate(location.pathname, { replace: true, state: {} });
    };

    openRequestedExpense();
  }, [expenses, location.pathname, location.state, navigate, showToast]);

  useEffect(() => {
    if (!showViewModal) {
      setPostCompletionReceiptFile(null);
      setPostCompletionReceiptNumber('');
      setUploadingPostCompletionReceipt(false);
    }
  }, [showViewModal]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const response = await api.getExpenses({ page: 1, limit: 100 });
      setExpenses(response?.data || []);
      await loadExpenseSummaryTotals();
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExpenseSummaryTotals = async () => {
    if (!summaryRange.startDate || !summaryRange.endDate || summaryRange.startDate > summaryRange.endDate) {
      setSummaryTotals({ total: 0, pendingApproval: 0, approved: 0, completed: 0 });
      return;
    }

    try {
      const response = await api.getExpenses({
        page: 1,
        limit: 5000,
        startDate: summaryRange.startDate,
        endDate: summaryRange.endDate,
      });

      const rows = Array.isArray(response?.data) ? response.data : [];
      const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const pendingApproval = rows
        .filter((item) => item.approvalStatus === 'PENDING')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const approved = rows
        .filter((item) => item.approvalStatus === 'APPROVED')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const completed = rows
        .filter((item) => item.processStatus === 'COMPLETED')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

      setSummaryTotals({ total, pendingApproval, approved, completed });
    } catch (_error) {
      setSummaryTotals({ total: 0, pendingApproval: 0, approved: 0, completed: 0 });
    }
  };

  const fetchSubsidiaries = async () => {
    try {
      const response = await api.getSubsidiaries();
      const raw = Array.isArray(response?.data) ? response.data : [];
      setSubsidiaries(
        [...raw].sort((a, b) => {
          const aIsMain = String(a?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
          const bIsMain = String(b?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
          if (aIsMain && !bIsMain) return -1;
          if (!aIsMain && bIsMain) return 1;
          return String(a?.name || '').localeCompare(String(b?.name || ''));
        })
      );
    } catch (error) {
      console.error('Error fetching subsidiaries:', error);
    }
  };

  const fetchExpenseModificationData = async () => {
    try {
      const [pendingResponse, historyResponse] = await Promise.all([
        api.getPendingExpenseModifications(),
        api.getExpenseModificationHistory(),
      ]);
      setModificationRequests(pendingResponse?.data || []);
      setModificationHistory(historyResponse?.data || []);
    } catch (error) {
      console.error('Error fetching expense modification requests:', error);
    }
  };

  const canEditExpense = (expense) => {
    if (!expense) return false;
    if (expense.paymentStatus === 'PAID') return false;
    if (isExpenseApprover) return true;
    return expense.createdById === user?.id;
  };

  const isExecutiveApprovedExpense = (expense) => {
    if (!expense || expense.approvalStatus !== 'APPROVED') return false;
    const approverRole = String(expense.approvedBy?.role || '').toUpperCase();
    return EXECUTIVE_APPROVER_ROLES.has(approverRole);
  };

  const canApproveExpense = (expense) => {
    if (!isExpenseApprover || !expense || expense.approvalStatus !== 'PENDING') return false;
    const nextRoles = Array.isArray(expense?.approvalProgress?.nextRoles)
      ? expense.approvalProgress.nextRoles.map((role) => String(role || '').toUpperCase()).filter(Boolean)
      : [String(expense?.approvalProgress?.nextRole || '').toUpperCase()].filter(Boolean);
    if (nextRoles.length === 0) return false;
    return nextRoles.includes(currentRole);
  };

  const getPendingStageLabel = (expense) => {
    const nextRoles = Array.isArray(expense?.approvalProgress?.nextRoles)
      ? expense.approvalProgress.nextRoles.map((role) => String(role || '').toUpperCase()).filter(Boolean)
      : [String(expense?.approvalProgress?.nextRole || '').toUpperCase()].filter(Boolean);
    if (nextRoles.length === 0) return null;

    const roleSet = new Set(nextRoles);
    if (roleSet.has('CEO') && roleSet.has('SUPER_ADMIN')) {
      return 'CEO approval (SUPER_ADMIN approval stands in for CEO)';
    }

    return nextRoles
      .map((role) => role.replace(/_/g, ' '))
      .join(' / ');
  };

  const isDriverVehicleExpenseFlow = (expense) => {
    const workflowInit = Array.isArray(expense?.approvalHistory)
      ? expense.approvalHistory.find((entry) => entry?.kind === 'WORKFLOW_INIT')
      : null;
    const initiatedByRole = String(workflowInit?.initiatedByRole || '').toUpperCase();
    return initiatedByRole === 'DRIVER' && Boolean(expense?.vehicleId);
  };

  const isAwaitingReceiptUpload = (expense) => {
    if (!expense) return false;
    return (
      expense.approvalStatus === 'APPROVED'
      && expense.processStatus === 'IN_PROGRESS'
      && Boolean(expense.completedById || expense.completedAt)
      && !expense.receiptUrl
    );
  };

  const hasReceiptRecord = (expense) => {
    if (!expense) return false;
    if (typeof expense.hasReceiptRecord === 'boolean') return expense.hasReceiptRecord;
    return Boolean(expense.receiptUrl || expense.receiptNumber);
  };

  const isCompletedWithoutReceipt = (expense) => {
    if (!expense) return false;
    if (typeof expense.completedWithoutReceipt === 'boolean') {
      return expense.completedWithoutReceipt;
    }
    return expense.processStatus === 'COMPLETED' && !hasReceiptRecord(expense);
  };

  const getStatusIcon = (status) => {
    const normalized = String(status || '').toLowerCase();
    switch (status) {
      case 'approved':
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-emerald-700" />;
      case 'COMPLETED_NO_RECEIPT':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'IN_PROGRESS':
      case 'APPROVED / IN_PROGRESS':
        return <Clock className="h-4 w-4 text-amber-600" />;
      case 'AWAITING_RECEIPT':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'rejected':
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        if (normalized.includes('review')) return <Clock className="h-4 w-4 text-yellow-600" />;
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getLifecycleStatus = (expense) => {
    if (isCompletedWithoutReceipt(expense)) return 'COMPLETED_NO_RECEIPT';
    if (expense.processStatus === 'COMPLETED') return 'COMPLETED';
    if (isAwaitingReceiptUpload(expense)) return 'AWAITING_RECEIPT';
    if (expense.approvalStatus === 'APPROVED' && expense.processStatus === 'IN_PROGRESS') {
      return 'APPROVED / IN_PROGRESS';
    }
    if (expense.approvalStatus === 'REJECTED') return 'REJECTED';
    if (expense.approvalStatus === 'APPROVED') return 'APPROVED';
    return 'PENDING';
  };

  const formatLifecycleStatusLabel = (status) => {
    if (status === 'AWAITING_RECEIPT') return 'Awaiting Receipt Upload';
    if (status === 'COMPLETED_NO_RECEIPT') return 'Completed - Receipt Missing';
    return String(status || '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getApprovalTimelineEntries = (expense) => {
    const history = Array.isArray(expense?.approvalHistory) ? expense.approvalHistory : [];
    const workflowInit = history.find((entry) => entry?.kind === 'WORKFLOW_INIT') || null;
    const fallbackRoles = Array.isArray(expense?.approvalProgress?.roles) ? expense.approvalProgress.roles : [];
    const workflowRoles = Array.isArray(workflowInit?.roles) ? workflowInit.roles : fallbackRoles;

    const rawSteps = history.filter((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      if (entry.kind === 'APPROVAL_STEP') return true;
      return entry.kind !== 'WORKFLOW_INIT' && (entry.approverId || entry.level || entry.status);
    });

    return rawSteps
      .map((step, index) => {
        const level = Number(step.level) || index + 1;
        const roleFromWorkflow = workflowRoles[level - 1];
        const role = String(step.role || roleFromWorkflow || 'APPROVER').toUpperCase();
        const status = String(step.status || '').toUpperCase() || 'APPROVED';
        const rawDate = step.date || step.approvedAt || step.createdAt || null;
        const dateLabel = rawDate ? new Date(rawDate).toLocaleString() : 'Date not recorded';

        const isFinalApprover = step.approverId && step.approverId === expense?.approvedById;
        const approverName = step.approverName
          || step.approverFullName
          || (isFinalApprover ? expense?.approvedBy?.fullName : null)
          || step.approverId
          || 'Unknown user';

        return {
          key: `${level}-${step.approverId || 'unknown'}-${rawDate || index}`,
          level,
          role,
          status,
          approverName,
          dateLabel,
          comment: step.comments || step.reason || null,
        };
      })
      .sort((a, b) => a.level - b.level);
  };

  const filteredExpenses = useMemo(() => expenses.filter((expense) => {
    const derivedLifecycleStatus = (() => {
      const hasReceipt = typeof expense.hasReceiptRecord === 'boolean'
        ? expense.hasReceiptRecord
        : Boolean(expense.receiptUrl || expense.receiptNumber);
      const completedWithoutReceipt = typeof expense.completedWithoutReceipt === 'boolean'
        ? expense.completedWithoutReceipt
        : expense.processStatus === 'COMPLETED' && !hasReceipt;

      if (completedWithoutReceipt) return 'COMPLETED_NO_RECEIPT';
      if (expense.processStatus === 'COMPLETED') return 'COMPLETED';
      if (
        expense.approvalStatus === 'APPROVED'
        && expense.processStatus === 'IN_PROGRESS'
        && Boolean(expense.completedById || expense.completedAt)
        && !expense.receiptUrl
      ) {
        return 'AWAITING_RECEIPT';
      }
      if (expense.approvalStatus === 'APPROVED' && expense.processStatus === 'IN_PROGRESS') {
        return 'APPROVED / IN_PROGRESS';
      }
      if (expense.approvalStatus === 'REJECTED') return 'REJECTED';
      if (expense.approvalStatus === 'APPROVED') return 'APPROVED';
      return 'PENDING';
    })();

    // Normalise to lowercase_underscore, stripping slashes (e.g. "APPROVED / IN_PROGRESS" → "approved_in_progress")
    const statusToken = derivedLifecycleStatus
      .toLowerCase()
      .replace(/\s*\/\s*/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');
    const matchesStatus = filter === 'all' || statusToken === filter;
    const haystack = [
      expense.description,
      expense.details,
      expense.expenseCategory,
      expense.expenseType,
      expense.createdBy?.fullName,
    ].filter(Boolean).join(' ').toLowerCase();

    const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  }), [expenses, filter, searchTerm]);

  const sortedFilteredExpenses = useMemo(() => {
    const toTime = (value) => {
      const ts = new Date(value || 0).getTime();
      return Number.isFinite(ts) ? ts : 0;
    };

    return [...filteredExpenses].sort((a, b) => {
      const byExpenseDate = toTime(b.expenseDate) - toTime(a.expenseDate);
      if (byExpenseDate !== 0) return byExpenseDate;

      const byCreatedAt = toTime(b.createdAt) - toTime(a.createdAt);
      if (byCreatedAt !== 0) return byCreatedAt;

      const byUpdatedAt = toTime(b.updatedAt) - toTime(a.updatedAt);
      if (byUpdatedAt !== 0) return byUpdatedAt;

      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [filteredExpenses]);

  const totalFilteredExpenses = sortedFilteredExpenses.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredExpenses / EXPENSES_PER_PAGE));
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * EXPENSES_PER_PAGE;
    return sortedFilteredExpenses.slice(start, start + EXPENSES_PER_PAGE);
  }, [currentPage, sortedFilteredExpenses]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Set initial filter to 'pending' when landing on the approval page.
  // Using a ref ensures this only runs once on mount, not reactively, so the
  // user can freely change the filter afterwards.
  const approvalPageInitialisedRef = React.useRef(false);
  useEffect(() => {
    if (isApprovalPage && !approvalPageInitialisedRef.current) {
      approvalPageInitialisedRef.current = true;
      setFilter('pending');
    }
  }, [isApprovalPage]);

  const pendingApprovalExpenses = useMemo(
    () => expenses.filter((expense) => expense.approvalStatus === 'PENDING'),
    [expenses]
  );

  const saveExpense = async () => {
    if (!newExpense.amount || Number(newExpense.amount) <= 0) {
      const message = 'Amount must be greater than zero.';
      showToast(message, 'error');
      return;
    }

    if (!newExpense.subsidiaryId) {
      const message = 'Please select a subsidiary.';
      showToast(message, 'error');
      return;
    }

    if (requiresVehicleSelection && !newExpense.vehicleId) {
      const message = 'Please select a car for this vehicle-related expense category.';
      showToast(message, 'error');
      return;
    }

    if (mustUseVehicleRelatedCategory && !VEHICLE_RELATED_EXPENSE_CATEGORIES.has(newExpense.expenseCategory)) {
      showToast('Your role can only submit car-related expense categories.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('expenseType', newExpense.expenseType);
      payload.append('expenseCategory', newExpense.expenseCategory);
      payload.append('amount', newExpense.amount);
      payload.append('requestedDate', newExpense.requestedDate);
      payload.append('expenseDate', newExpense.expenseDate);
      if (newExpense.description) payload.append('description', newExpense.description);
      if (newExpense.details) payload.append('details', newExpense.details);
      if (newExpense.vehicleId) payload.append('vehicleId', newExpense.vehicleId);
      payload.append('subsidiaryId', newExpense.subsidiaryId);
      if (newExpense.receiptFile) payload.append('receipt', newExpense.receiptFile);

      let successMessage = 'Expense record submitted successfully.';

      if (editingExpense) {
        if (editingExpense.approvalStatus === 'APPROVED') {
          if (!modificationReason.trim()) {
            throw new Error('Modification reason is required for approved expenses.');
          }
          payload.append('modificationReason', modificationReason.trim());
        }

        const response = await api.updateExpense(editingExpense.id, payload);
        successMessage = response?.message || (editingExpense.approvalStatus === 'APPROVED'
          ? 'Expense modification request submitted successfully.'
          : 'Expense updated successfully.');
      } else {
        await api.createExpense(payload);
      }

      setShowAddModal(false);
      resetExpenseForm();
      showToast(successMessage, 'success');
      await fetchExpenses();
      if (isExpenseApprover) {
        await fetchExpenseModificationData();
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error || 'Failed to add expense';
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const performCompleteExpense = async (allowWithoutReceipt = false) => {
    if (!completingExpense) return;

    const isDriverFlowCompletion = isDriverVehicleExpenseFlow(completingExpense);

    const hasReceiptOnRecord = Boolean(completingExpense.receiptUrl || completingExpense.receiptNumber);
    const hasReceiptForCompletion = Boolean(completionReceiptFile || hasReceiptOnRecord);

    if (!isDriverFlowCompletion && !hasReceiptForCompletion && !allowWithoutReceipt) {
      setShowCompleteWithoutReceiptDialog(true);
      return;
    }

    setCompleting(true);
    try {
      const payload = new FormData();
      if (completionNotes) payload.append('notes', completionNotes);
      if (!isDriverFlowCompletion && completionReceiptFile) payload.append('receipt', completionReceiptFile);

      const response = await api.completeExpense(completingExpense.id, payload);
      setShowCompleteModal(false);
      setShowCompleteWithoutReceiptDialog(false);
      setCompletingExpense(null);
      setCompletionNotes('');
      setCompletionReceiptFile(null);
      showToast(response?.message || 'Expense completed successfully.', 'success');
      await fetchExpenses();
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error || 'Failed to complete expense';
      showToast(message, 'error');
    } finally {
      setCompleting(false);
    }
  };

  const completeExpense = async () => performCompleteExpense(false);

  const uploadReceiptForCompletedExpense = async () => {
    if (!viewExpense?.id) return;

    if (!postCompletionReceiptFile) {
      showToast('Please choose a receipt file first.', 'error');
      return;
    }

    setUploadingPostCompletionReceipt(true);
    try {
      const payload = new FormData();
      payload.append('receipt', postCompletionReceiptFile);
      if (postCompletionReceiptNumber.trim()) {
        payload.append('receiptNumber', postCompletionReceiptNumber.trim());
      }

      await api.uploadExpenseReceipt(viewExpense.id, payload);
      showToast('Receipt uploaded successfully. All approval participants have been notified.', 'success');

      await fetchExpenses();
      try {
        const fresh = await api.getExpenseById(viewExpense.id);
        setViewExpense(fresh?.data || null);
      } catch (_error) {
        setViewExpense((prev) => ({
          ...(prev || {}),
          receiptUrl: prev?.receiptUrl || 'Uploaded',
          receiptNumber: postCompletionReceiptNumber.trim() || postCompletionReceiptFile.name,
        }));
      }

      setPostCompletionReceiptFile(null);
      setPostCompletionReceiptNumber('');
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error || 'Failed to upload receipt';
      showToast(message, 'error');
    } finally {
      setUploadingPostCompletionReceipt(false);
    }
  };

  const handleAddExpense = async (event) => {
    event.preventDefault();

    if (!canRequestExpense) {
      showToast('You do not have permission to request expenses.', 'error');
      return;
    }

    if (editingExpense) {
      await saveExpense();
      return;
    }

    if (!newExpense.receiptFile) {
      setShowNoReceiptDialog(true);
      return;
    }

    await saveExpense();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(value);
  };

  const renderAuditIdentity = (user, dateValue) => {
    const formattedDate = dateValue ? new Date(dateValue).toLocaleString() : '-';

    return (
      <div className="min-w-[180px]">
        <p className="text-sm text-gray-900">{user?.fullName || '-'}</p>
        <p className="text-xs text-gray-500">ID: {user?.id || '-'}</p>
        <p className="text-xs text-gray-500">{formattedDate}</p>
      </div>
    );
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setModificationReason('');
    setPrefillSourceMeta(null);
    setNewExpense({
      expenseType: expense.expenseType || 'OPERATIONAL',
      expenseCategory: expense.expenseCategory || 'FUEL',
      amount: expense.amount || '',
      requestedDate: expense.recordedDate ? new Date(expense.recordedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: expense.description || '',
      details: expense.details || '',
      vehicleId: expense.vehicleId || '',
      subsidiaryId: expense.subsidiaryId || '',
      receiptFile: null,
    });
    setShowAddModal(true);
  };

  const submitModificationDecision = async (requestId, decision) => {
    const approvalReason = (decisionNotes[requestId] || '').trim();
    if (!approvalReason) {
      showToast('Approval or rejection reason is required.', 'error');
      return;
    }

    setDecidingId(requestId);
    try {
      await api.approveExpenseModification(requestId, {
        decision,
        approvalReason,
      });
      showToast(`Expense modification request ${decision === 'APPROVE' ? 'approved' : 'rejected'} successfully.`, 'success');
      setDecisionNotes((prev) => ({ ...prev, [requestId]: '' }));
      await Promise.all([fetchExpenses(), fetchExpenseModificationData()]);
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error || 'Failed to submit expense modification decision';
      showToast(message, 'error');
    } finally {
      setDecidingId('');
    }
  };

  const submitExpenseApprovalDecision = async (expenseId, decision) => {
    if (!isExpenseApprover) {
      showToast('You do not have permission to approve this expense stage.', 'error');
      return;
    }

    if (decision === 'REJECT') {
      setRejectExpenseId(expenseId);
      setRejectReason('');
      setShowRejectExpenseDialog(true);
      return;
    }

    setApprovingExpenseId(expenseId);
    try {
      await api.approveExpense(expenseId, { comments: `Approved by ${currentRole.replace(/_/g, ' ')}` });
      showToast('Expense approved successfully.', 'success');

      await fetchExpenses();
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error || 'Failed to process expense approval';
      showToast(message, 'error');
    } finally {
      setApprovingExpenseId('');
    }
  };

  const confirmRejectExpenseApproval = async () => {
    const reason = String(rejectReason || '').trim();
    if (!reason) {
      showToast('Rejection reason is required.', 'error');
      return;
    }

    setApprovingExpenseId(rejectExpenseId);
    try {
      await api.rejectExpense(rejectExpenseId, { reason });
      showToast('Expense rejected successfully.', 'success');
      setShowRejectExpenseDialog(false);
      setRejectExpenseId('');
      setRejectReason('');
      await fetchExpenses();
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error || 'Failed to process expense rejection';
      showToast(message, 'error');
    } finally {
      setApprovingExpenseId('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">{isApprovalPage ? 'Expense Approvals' : 'Expenses'}</h1>
        <div className="flex items-center space-x-3">
          <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          {!isApprovalPage && canRequestExpense && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Request Expense
            </button>
          )}
        </div>
      </div>

      {isApprovalPage && isExpenseApprover && (
        <section className={`rounded-lg p-6 shadow ${mode === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
          <h2 className={`text-lg font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>Pending Expense Approvals</h2>
          <p className={`mt-1 text-sm ${mode === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
            Review and action pending requests from all subsidiaries, including Main.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-xs text-yellow-700">Pending Count</p>
              <p className="text-xl font-semibold text-yellow-800">{pendingApprovalExpenses.length}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700">Pending Amount</p>
              <p className="text-xl font-semibold text-emerald-800">
                {formatCurrency(pendingApprovalExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0))}
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs text-red-700">Scope</p>
              <p className="text-xl font-semibold text-red-800">All Subsidiaries</p>
            </div>
          </div>
        </section>
      )}

      {/* Stats Cards */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`text-sm font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-700'}`}>Expense summary period</p>
          <p className={`text-xs ${mode === 'dark' ? 'text-white' : 'text-gray-500'}`}>Adjusts expense summary cards only. End date cannot be earlier than start date.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Expenses (Selected Range)</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatCurrency(summaryTotals.total)}
              </p>
            </div>
            <div className="bg-gray-100 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-gray-700" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Approval (Selected Range)</p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency(summaryTotals.pendingApproval)}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved (Selected Range)</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summaryTotals.approved)}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed (Selected Range)</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(summaryTotals.completed)}
              </p>
              <p className="mt-1 text-xs text-purple-700">Range: {summaryRange.startDate} to {summaryRange.endDate}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="approved_in_progress">Approved / In Progress</option>
            <option value="completed">Completed</option>
            <option value="completed_no_receipt">Completed without Receipt</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            type="button"
            onClick={() => setShowSummaryRangeControls((prev) => !prev)}
            className={`px-4 py-2 rounded-lg flex items-center ${showSummaryRangeControls ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showSummaryRangeControls ? 'Hide Date Range' : 'Date Range'}
          </button>
        </div>

        {showSummaryRangeControls && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Start Date</span>
              <input
                type="date"
                value={summaryRange.startDate}
                max={summaryRange.endDate}
                onChange={(event) => handleSummaryStartDateChange(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-700">End Date</span>
              <input
                type="date"
                value={summaryRange.endDate}
                min={summaryRange.startDate}
                onChange={(event) => handleSummaryEndDateChange(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
        )}
      </div>

      {isExpenseApprover && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Expense Modification Requests</h2>
            {modificationRequests.length === 0 ? (
              <div className="py-6 text-sm text-gray-500">No pending modification requests.</div>
            ) : (
              <div className="space-y-4">
                {modificationRequests.map((item) => {
                  const payload = item.newValue || {};
                  const previous = item.oldValue || {};
                  const requestedBy = payload.requestedBy?.fullName || 'Unknown user';
                  const requestedAt = payload.requestedAt ? new Date(payload.requestedAt).toLocaleString() : '-';
                  const changes = payload.changes || {};

                  const CHANGE_LABELS = {
                    amount: 'Amount',
                    description: 'Description',
                    details: 'Details',
                    expenseDate: 'Expense Date',
                    expenseType: 'Expense Type',
                    expenseCategory: 'Category',
                    subsidiaryId: 'Subsidiary',
                    isRecurring: 'Recurring',
                    notes: 'Notes',
                  };

                  const formatChangeValue = (key, value, row) => {
                    if (value === null || value === undefined || value === '') return '—';
                    if (key === 'amount') {
                      return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value);
                    }
                    if (key === 'expenseDate') {
                      return new Date(value).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
                    }
                    if (key === 'subsidiaryId') {
                      // Use resolved name from backend if available
                      const name = row === 'new' ? changes.subsidiaryName : previous.subsidiaryName;
                      return name || String(value);
                    }
                    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
                    return String(value).replace(/_/g, ' ');
                  };

                  // Build comparison rows: only fields that exist in changes
                  const comparisonRows = Object.entries(changes)
                    .filter(([key]) => key in CHANGE_LABELS)
                    .map(([key]) => ({
                      key,
                      label: CHANGE_LABELS[key],
                      before: previous[key],
                      after: changes[key],
                      changed: String(previous[key] ?? '') !== String(changes[key] ?? ''),
                    }));

                  return (
                    <div key={item.id} className="rounded-lg border border-gray-200 overflow-hidden">
                      {/* Request header */}
                      <div className="flex items-start justify-between bg-amber-50 px-4 py-3 border-b border-amber-100">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{requestedBy}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Requested {requestedAt}</p>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                          Pending Review
                        </span>
                      </div>

                      <div className="px-4 py-4 space-y-4">
                        {/* Reason */}
                        {payload.modificationReason && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Reason for Change</p>
                            <p className="text-sm text-gray-700 bg-gray-50 rounded px-3 py-2 border border-gray-100">{payload.modificationReason}</p>
                          </div>
                        )}

                        {/* Before / After comparison */}
                        {comparisonRows.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Proposed Changes</p>
                            <div className="rounded-lg border border-gray-200 overflow-hidden">
                              <table className="min-w-full text-sm">
                                <thead className="bg-red-600">
                                  <tr className="border-b border-red-500">
                                    <th className="px-3 py-2 text-left text-xs font-medium text-white w-1/4">Field</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-white w-[37.5%]">Current Value</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-white w-[37.5%]">Proposed Value</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {comparisonRows.map(({ key, label, before, after, changed }) => (
                                    <tr key={key} className={changed ? 'bg-amber-50/40' : ''}>
                                      <td className="px-3 py-2 text-xs font-medium text-white">{label}</td>
                                      <td className={`px-3 py-2 text-sm ${changed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                        {formatChangeValue(key, before, 'old')}
                                      </td>
                                      <td className={`px-3 py-2 text-sm font-semibold ${changed ? 'text-gray-900' : 'text-gray-500'}`}>
                                        {formatChangeValue(key, after, 'new')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Decision input */}
                        <div>
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 block">
                            Your Decision Note <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={decisionNotes[item.id] || ''}
                            onChange={(e) => setDecisionNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="State your reason for approving or rejecting this request"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            rows={2}
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => submitModificationDecision(item.id, 'APPROVE')}
                            disabled={decidingId === item.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Approve Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => submitModificationDecision(item.id, 'REJECT')}
                            disabled={decidingId === item.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`rounded-lg p-6 shadow ${mode === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <h2 className={`mb-4 text-lg font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>Expense Modification History</h2>
            {modificationHistory.length === 0 ? (
              <div className={`py-6 text-sm ${mode === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>No modification history yet.</div>
            ) : (
              <div className="max-h-[32rem] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-red-600">
                    <tr className="border-b text-left text-white">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Expense ID</th>
                      <th className="py-2 pr-4">Decision</th>
                      <th className="py-2 pr-4">By</th>
                      <th className="py-2 pr-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modificationHistory.map((entry) => {
                      const meta = entry.newValue || {};
                      const person = meta.approvedBy || {};
                      return (
                        <tr key={entry.id} className={`${mode === 'dark' ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-800'} border-b`}>
                          <td className="py-2 pr-4">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}</td>
                          <td className="py-2 pr-4">{entry.entityId}</td>
                          <td className="py-2 pr-4">{meta.decision || '-'}</td>
                          <td className="py-2 pr-4">{person.fullName || '-'}</td>
                          <td className={`py-2 pr-4 ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{meta.approvalReason || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-red-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Approved By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Completed By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Last Modified
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {expense.description || expense.details || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                        {expense.expenseCategory}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.vehicle?.registrationNumber || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const displayStatus = getLifecycleStatus(expense);
                        return (
                      <div className="flex items-center">
                        {getStatusIcon(displayStatus)}
                        <span className="ml-1 text-sm text-gray-600">
                          {formatLifecycleStatusLabel(displayStatus)}
                        </span>
                        {displayStatus === 'COMPLETED_NO_RECEIPT' ? (
                          <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                            Upload receipt before audit
                          </span>
                        ) : null}
                        {expense.approvalStatus === 'PENDING' && getPendingStageLabel(expense) ? (
                          <span className="ml-2 text-xs text-amber-700">
                            Next: {getPendingStageLabel(expense)}
                          </span>
                        ) : null}
                      </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {renderAuditIdentity(expense.createdBy, expense.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {renderAuditIdentity(expense.approvedBy, expense.approvedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {renderAuditIdentity(expense.completedBy, expense.completedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {renderAuditIdentity(expense.updatedBy, expense.updatedBy ? expense.updatedAt : null)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        {isExecutiveApprovedExpense(expense) && expense.processStatus !== 'COMPLETED' ? (
                          <>
                            <button
                              type="button"
                              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                              onClick={() => {
                                setViewExpense(expense);
                                setShowViewModal(true);
                              }}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditExpense(expense)}
                              disabled={!canEditExpense(expense)}
                              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Request Changes
                            </button>
                            <button
                              type="button"
                              className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                              disabled={isAwaitingReceiptUpload(expense)}
                              onClick={() => {
                                setCompletingExpense(expense);
                                setCompletionReceiptFile(null);
                                setCompletionNotes('');
                                setShowCompleteWithoutReceiptDialog(false);
                                setShowCompleteModal(true);
                              }}
                            >
                              {isDriverVehicleExpenseFlow(expense) ? 'Proceed' : 'Complete'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-900"
                              onClick={() => {
                                setViewExpense(expense);
                                setShowViewModal(true);
                              }}
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditExpense(expense)}
                              disabled={!canEditExpense(expense)}
                              className="text-green-600 hover:text-green-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button className="text-red-600 hover:text-red-900">
                              <Trash2 className="h-4 w-4" />
                            </button>
                            {canApproveExpense(expense) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => submitExpenseApprovalDecision(expense.id, 'APPROVE')}
                                  disabled={approvingExpenseId === expense.id}
                                  className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => submitExpenseApprovalDecision(expense.id, 'REJECT')}
                                  disabled={approvingExpenseId === expense.id}
                                  className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {expense.approvalStatus === 'APPROVED' && expense.processStatus !== 'COMPLETED' && !isAwaitingReceiptUpload(expense) && (
                              <button
                                className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                                onClick={() => {
                                  setCompletingExpense(expense);
                                  setCompletionReceiptFile(null);
                                  setCompletionNotes('');
                                  setShowCompleteWithoutReceiptDialog(false);
                                  setShowCompleteModal(true);
                                }}
                              >
                                {isDriverVehicleExpenseFlow(expense) ? 'Proceed' : 'Complete'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan="11" className="px-6 py-12 text-center text-gray-500">
                      <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>No expenses found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredExpenses.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-3">
            <p className="text-xs text-gray-500">
              {totalPages > 1
                ? `Showing ${(currentPage - 1) * EXPENSES_PER_PAGE + 1}-${Math.min(currentPage * EXPENSES_PER_PAGE, totalFilteredExpenses)} of ${totalFilteredExpenses} expenses`
                : `${totalFilteredExpenses} expense${totalFilteredExpenses !== 1 ? 's' : ''}`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-600">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showViewModal && viewExpense && (
        <div className="fixed inset-0 z-[62] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">View Expense</h3>
              <button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  setViewExpense(null);
                }}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
              <p><span className="font-semibold text-gray-900">Expense Type:</span> {viewExpense.expenseType || '-'}</p>
              <p><span className="font-semibold text-gray-900">Category:</span> {viewExpense.expenseCategory || '-'}</p>
              <p><span className="font-semibold text-gray-900">Amount:</span> {formatCurrency(viewExpense.amount || 0)}</p>
              <p><span className="font-semibold text-gray-900">Date:</span> {viewExpense.expenseDate ? new Date(viewExpense.expenseDate).toLocaleDateString() : '-'}</p>
              <p><span className="font-semibold text-gray-900">Status:</span> {formatLifecycleStatusLabel(getLifecycleStatus(viewExpense))}</p>
              <p><span className="font-semibold text-gray-900">Subsidiary:</span> {viewExpense.subsidiary?.name || '-'}</p>
              <p className="md:col-span-2"><span className="font-semibold text-gray-900">Description:</span> {viewExpense.description || '-'}</p>
              <p className="md:col-span-2"><span className="font-semibold text-gray-900">Details:</span> {viewExpense.details || '-'}</p>
              <p className="md:col-span-2"><span className="font-semibold text-gray-900">Receipt:</span> {viewExpense.receiptUrl || 'No receipt uploaded'}</p>
            </div>

            {canUploadCompletedExpenseReceipt && (isAwaitingReceiptUpload(viewExpense) || (viewExpense?.processStatus === 'COMPLETED' && !viewExpense?.receiptUrl)) ? (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h4 className="text-sm font-semibold text-amber-900">Upload Receipt</h4>
                <p className="mt-1 text-xs text-amber-800">
                  This expense is awaiting receipt upload. Uploading receipt here does not create an expense edit request.
                </p>

                <label className="mt-3 block text-sm text-amber-900">
                  Receipt Number (optional)
                  <input
                    className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2"
                    type="text"
                    value={postCompletionReceiptNumber}
                    onChange={(e) => setPostCompletionReceiptNumber(e.target.value)}
                    placeholder="Enter receipt number"
                  />
                </label>

                <label className="mt-3 block text-sm text-amber-900">
                  Receipt File
                  <input
                    className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setPostCompletionReceiptFile(e.target.files?.[0] || null)}
                  />
                </label>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={uploadReceiptForCompletedExpense}
                    disabled={uploadingPostCompletionReceipt}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {uploadingPostCompletionReceipt ? 'Uploading...' : 'Upload Receipt'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">Approval Timeline</h4>
              {viewExpense?.approvalStatus === 'PENDING' && getPendingStageLabel(viewExpense) ? (
                <p className="mt-1 text-xs text-amber-700">
                  Pending stage: {getPendingStageLabel(viewExpense)}
                </p>
              ) : null}

              {getApprovalTimelineEntries(viewExpense).length === 0 ? (
                <p className="mt-2 text-sm text-gray-600">No approval actions recorded yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {getApprovalTimelineEntries(viewExpense).map((entry) => {
                    const isRejected = entry.status === 'REJECTED';
                    const statusLabel = isRejected ? 'Rejected' : 'Approved';
                    return (
                      <div key={entry.key} className="rounded-md border border-gray-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-gray-900">
                            Stage {entry.level}: {entry.role.replace(/_/g, ' ')}
                          </p>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isRejected ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">By: {entry.approverName}</p>
                        <p className="text-xs text-gray-500">When: {entry.dateLabel}</p>
                        {entry.comment ? <p className="mt-1 text-xs text-gray-600">Note: {entry.comment}</p> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  setViewExpense(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectExpenseDialog && (
        <div className="fixed inset-0 z-[63] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Reject Expense</h3>
            <p className="mt-1 text-sm text-gray-600">Provide a reason for rejection.</p>

            <label className="mt-4 block text-sm text-gray-700">
              Rejection Reason
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="State rejection reason"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectExpenseDialog(false);
                  setRejectExpenseId('');
                  setRejectReason('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRejectExpenseApproval}
                disabled={approvingExpenseId === rejectExpenseId}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {approvingExpenseId === rejectExpenseId ? 'Submitting...' : 'Reject Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{editingExpense ? 'Edit Expense' : 'Request Expense'}</h2>
                {!editingExpense && prefillSourceMeta?.source === 'vehicle-status-approval' ? (
                  <p className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    From Vehicle Approval Request{prefillSourceMeta.requestId ? ` #${prefillSourceMeta.requestId}` : ''}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  resetExpenseForm();
                }}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm text-gray-700">
                  Expense Type
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={newExpense.expenseType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      const nextCategoryOptions = (EXPENSE_CATEGORIES_BY_TYPE[nextType] || ['OTHER'])
                        .filter((category) => !mustUseVehicleRelatedCategory || VEHICLE_RELATED_EXPENSE_CATEGORIES.has(category));
                      const nextCategory = nextCategoryOptions[0] || 'FUEL';
                      setNewExpense((prev) => ({
                        ...prev,
                        expenseType: nextType,
                        expenseCategory: nextCategory,
                      }));
                    }}
                  >
                    {filteredExpenseTypeOptions.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-gray-700">
                  Expense Category
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={newExpense.expenseCategory}
                    onChange={(e) => setNewExpense((prev) => ({ ...prev, expenseCategory: e.target.value }))}
                    required
                  >
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-gray-700">
                  Amount
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense((prev) => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </label>

                <label className="text-sm text-gray-700">
                  Date Requested
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    type="date"
                    value={newExpense.requestedDate}
                    onChange={(e) => setNewExpense((prev) => ({ ...prev, requestedDate: e.target.value }))}
                    required
                  />
                </label>

                <label className="text-sm text-gray-700">
                  Date of Expense
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    type="date"
                    value={newExpense.expenseDate}
                    onChange={(e) => setNewExpense((prev) => ({ ...prev, expenseDate: e.target.value }))}
                    required
                  />
                </label>

                <label className="text-sm text-gray-700 md:col-span-2">
                  Subsidiary *
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={newExpense.subsidiaryId}
                    onChange={(e) => {
                      const nextSubsidiaryId = e.target.value;
                      setNewExpense((prev) => ({
                        ...prev,
                        subsidiaryId: nextSubsidiaryId,
                        vehicleId: prev.subsidiaryId === nextSubsidiaryId ? prev.vehicleId : '',
                      }));
                    }}
                    disabled={isVehicleApprovalPrefill}
                    required
                  >
                    <option value="">Select subsidiary</option>
                    {subsidiaries.map((sub) => (
                      <option key={sub.id} value={sub.id}>{formatSubsidiaryLabel(sub)}</option>
                    ))}
                  </select>
                </label>

                {requiresVehicleSelection && (
                  <div className="text-sm text-gray-700 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <span>Car Number</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                          onClick={() => fetchVehiclesForSelection(newExpense.subsidiaryId)}
                          disabled={!newExpense.subsidiaryId || isVehicleApprovalPrefill}
                        >
                          Refresh list
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                          onClick={() => {
                            window.open('/vehicles/new', '_blank', 'noopener,noreferrer');
                          }}
                        >
                          Add Car
                        </button>
                      </div>
                    </div>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      value={newExpense.vehicleId}
                      onChange={(e) => setNewExpense((prev) => ({ ...prev, vehicleId: e.target.value }))}
                      disabled={!newExpense.subsidiaryId || isVehicleApprovalPrefill}
                      required
                    >
                      <option value="">{newExpense.subsidiaryId ? 'Select car number' : 'Select subsidiary first'}</option>
                      {vehiclesForSelectedSubsidiary.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.registrationNumber} {vehicle.model ? `- ${vehicle.model}` : ''}
                        </option>
                      ))}
                    </select>
                    {!newExpense.subsidiaryId && (
                      <p className="mt-1 text-xs text-amber-700">
                        Select subsidiary first, then choose a car from that subsidiary.
                      </p>
                    )}
                    {isVehicleApprovalPrefill ? (
                      <p className="mt-1 text-xs text-emerald-700">
                        Car number and subsidiary are locked from the approved vehicle request to avoid mistakes.
                      </p>
                    ) : null}
                    {newExpense.subsidiaryId && vehiclesForSelectedSubsidiary.length === 0 && (
                      <p className="mt-1 text-xs text-amber-700">
                        No active cars found for this subsidiary. Click Add Car to register a vehicle, then Refresh list.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {editingExpense?.approvalStatus === 'APPROVED' && (
                <label className="block text-sm text-gray-700">
                  Modification Reason
                  <textarea
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    rows={2}
                    value={modificationReason}
                    onChange={(e) => setModificationReason(e.target.value)}
                    placeholder="State why this approved expense needs to be edited"
                    required
                  />
                  <p className="mt-1 text-xs text-amber-700">Approved expense changes will be submitted to CEO/SUPER_ADMIN for approval.</p>
                </label>
              )}

              <label className="block text-sm text-gray-700">
                Description
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="What was this expense for?"
                />
              </label>

              <label className="block text-sm text-gray-700">
                Details
                <textarea
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  rows={3}
                  value={newExpense.details}
                  onChange={(e) => setNewExpense((prev) => ({ ...prev, details: e.target.value }))}
                  placeholder="Additional context"
                />
              </label>

              <label className="block text-sm text-gray-700">
                Receipt Upload (optional)
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setNewExpense((prev) => ({ ...prev, receiptFile: e.target.files?.[0] || null }))}
                />
                <p className="mt-1 text-xs text-gray-500">For transparency, attach receipt when available.</p>
              </label>

              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetExpenseForm();
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {submitting ? (editingExpense ? 'Saving...' : 'Submitting...') : (editingExpense ? (editingExpense.approvalStatus === 'APPROVED' ? 'Submit Edit Request' : 'Save Changes') : 'Request Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">
              {isDriverVehicleExpenseFlow(completingExpense) ? 'Proceed Expense' : 'Complete Expenses'}
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              {isDriverVehicleExpenseFlow(completingExpense)
                ? 'Proceed this approved driver vehicle expense to awaiting-receipt stage. Upload receipt from the expense details dialog to mark it completed.'
                : 'You can upload receipt now. Receipt is optional, but recommended for transparency.'}
            </p>

            <label className="mt-4 block text-sm text-gray-700">
              Completion Note (optional)
              <textarea
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                rows={3}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Add completion note"
              />
            </label>

            {!isDriverVehicleExpenseFlow(completingExpense) && (
              <label className="mt-4 block text-sm text-gray-700">
                Upload Receipt (optional)
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setCompletionReceiptFile(e.target.files?.[0] || null)}
                />
              </label>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCompleteModal(false);
                  setShowCompleteWithoutReceiptDialog(false);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={completeExpense}
                disabled={completing}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {completing ? 'Processing...' : (isDriverVehicleExpenseFlow(completingExpense) ? 'Proceed' : 'Complete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompleteWithoutReceiptDialog && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Complete Without Receipt?</h3>
            <p className="mt-3 text-sm text-gray-700">
              You are about to Complete an Expenses without Receipt, Click to Continue or Cancel to back and upload receipt.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCompleteWithoutReceiptDialog(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await performCompleteExpense(true);
                }}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoReceiptDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Proceed Without Receipt?</h3>
            <p className="mt-3 text-sm text-gray-700">
              You are making expenses without receipt, expenses require receipt, do you want to proceed?
            </p>
            <p className="mt-2 text-sm text-gray-700">
              Click Cancel return and upload receipt before saving.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNoReceiptDialog(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowNoReceiptDialog(false);
                  await saveExpense();
                }}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;

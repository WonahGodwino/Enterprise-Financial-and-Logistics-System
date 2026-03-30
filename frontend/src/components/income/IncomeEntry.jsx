import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, PlusCircle, RefreshCw, TrendingUp, FileText, Download, Printer, History, Loader2, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

const INCOME_TYPE_OPTIONS = [
  'SERVICE',
  'PRODUCT',
  'RENTAL',
  'INSTALLATION',
  'MAINTENANCE',
  'CONSULTING',
  'OTHER',
];

const INCOME_CATEGORY_OPTIONS = [
  'CAR_HIRE',
  'CAR_SALES',
  'CAR_MAINTENANCE',
  'SECURITY_GUARD',
  'CCTV_INSTALLATION',
  'SMART_HOME',
  'SECURITY_CONSULTING',
  'GENERAL_CONTRACT',
  'RENOVATION',
  'CONSTRUCTION_MATERIALS',
  'PROJECT_MANAGEMENT',
  'OTHER',
];

const MAIN_SUBSIDIARY_CODE = 'MAIN';
const CAR_RELATED_INCOME_CATEGORIES = new Set(['CAR_HIRE', 'CAR_SALES', 'CAR_MAINTENANCE']);
const INCOME_RECORDS_PER_PAGE = 10;

// ── per-item / overall payment status helpers ─────────────────────────────────
const deriveItemStatus = ({ cost, taxAmount = 0, paidAmount = 0, discountAmount = 0 }) => {
  if (paidAmount === 0) return 'PENDING';
  const due = cost + taxAmount;
  const settled = paidAmount + discountAmount;
  if (Math.abs(due - settled) < 0.005) return 'PAID';
  return 'PARTIALLY_PAID';
};

const deriveOverallStatus = ({ totalCost, totalTax = 0, totalPaid = 0, totalDiscount = 0 }) => {
  if (totalPaid === 0) return 'PENDING';
  const due = totalCost + totalTax;
  const settled = totalPaid + totalDiscount;
  if (Math.abs(due - settled) < 0.005) return 'PAID';
  return 'PARTIALLY_PAID';
};

const STATUS_BADGE = {
  PAID: {
    light: 'bg-emerald-100 text-emerald-800',
    dark: 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-200',
  },
  PARTIALLY_PAID: {
    light: 'bg-amber-100 text-amber-800',
    dark: 'border border-amber-500/40 bg-amber-500/20 text-amber-200',
  },
  PENDING: {
    light: 'bg-gray-100 text-gray-700',
    dark: 'border border-slate-500/40 bg-slate-500/20 text-slate-200',
  },
  OVERDUE: {
    light: 'bg-rose-100 text-rose-800',
    dark: 'border border-rose-500/40 bg-rose-500/20 text-rose-200',
  },
};

const getStatusBadgeClass = (status, mode = 'light') => {
  const key = String(status || 'PENDING').toUpperCase();
  const palette = STATUS_BADGE[key] || STATUS_BADGE.PENDING;
  return mode === 'dark' ? palette.dark : palette.light;
};

const StatusIcon = ({ status }) => {
  if (status === 'PAID') return <CheckCircle className="h-3.5 w-3.5" />;
  if (status === 'PARTIALLY_PAID') return <AlertCircle className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
};

const BLANK_ITEM = {
  serviceType: '',
  serviceDescription: '',
  quantity: '1',
  unitPrice: '',
  taxAmount: '0',
  paidAmount: '',
  discountAmount: '0',
  notes: '',
};

// Safely extract a string message from an axios error.
// In development mode the backend sends `error: { stack, details }` — an
// object — which causes "Objects are not valid as a React child" if rendered.
const extractErrorMessage = (err, fallback = 'An unexpected error occurred.') => {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  // prefer the human-readable `message` field
  if (typeof data.message === 'string' && data.message) return data.message;
  // `error` may be a string (production) or an object (development)
  if (typeof data.error === 'string' && data.error) return data.error;
  // fall back to the plain JS error message
  return err?.message || fallback;
};

const getCustomerDisplayName = (customer) => {
  if (!customer) return '-';
  return customer.companyName
    || `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
    || customer.email
    || customer.phone
    || '-';
};

const getSubsidiaryDisplayName = (subsidiary) => {
  if (!subsidiary) return '-';
  const isMain = String(subsidiary.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
  if (isMain) return `${subsidiary.name} (Main)`;
  return subsidiary.name || subsidiary.code || '-';
};

const formatCurrency = (value) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const IncomeEntry = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [incomes, setIncomes] = useState([]);
  const [monthlyTotals, setMonthlyTotals] = useState({ totalIncome: 0, paidIncome: 0, pendingIncome: 0 });
  const [summaryRange, setSummaryRange] = useState(defaultSummaryRange);
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
      const nextStart = prev.startDate && nextEnd < prev.startDate ? nextEnd : prev.startDate;
      return { ...prev, startDate: nextStart, endDate: nextEnd };
    });
  };
  const [incomePage, setIncomePage] = useState(1);
  const [incomePagination, setIncomePagination] = useState({
    page: 1,
    limit: INCOME_RECORDS_PER_PAGE,
    total: 0,
    pages: 1,
  });
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [subsidiaryLoading, setSubsidiaryLoading] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState('');

  // ── header-level fields (customer, date, category …) ─────────────────────
  const [formData, setFormData] = useState({
    incomeType: 'SERVICE',
    category: 'CAR_HIRE',
    customerId: '',
    subsidiaryId: '',
    vehicleId: '',
    incomeDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // ── staging area: the item being built before "Add to List" ───────────────
  const [stagingItem, setStagingItem] = useState({ ...BLANK_ITEM });

  // ── confirmed item list ───────────────────────────────────────────────────
  const [stagedItems, setStagedItems] = useState([]);

  // ── per-staging-item derived values (live preview) ────────────────────────
  const stagingCost = useMemo(() => {
    const qty = Number(stagingItem.quantity);
    const up = Number(stagingItem.unitPrice);
    return Number.isFinite(qty) && Number.isFinite(up) && qty > 0 && up > 0 ? qty * up : 0;
  }, [stagingItem.quantity, stagingItem.unitPrice]);

  const stagingStatus = useMemo(() => {
    const tax = Number(stagingItem.taxAmount) || 0;
    const paid = Number(stagingItem.paidAmount) || 0;
    const discount = Number(stagingItem.discountAmount) || 0;
    return deriveItemStatus({ cost: stagingCost, taxAmount: tax, paidAmount: paid, discountAmount: discount });
  }, [stagingCost, stagingItem.taxAmount, stagingItem.paidAmount, stagingItem.discountAmount]);

  // ── overall summary derived from stagedItems ──────────────────────────────
  const summary = useMemo(() => {
    if (!stagedItems.length) {
      return { totalCost: 0, totalTax: 0, totalPaid: 0, totalDiscount: 0, balance: 0, overallStatus: 'PENDING' };
    }
    const totalCost = stagedItems.reduce((s, i) => s + i.cost, 0);
    const totalTax = stagedItems.reduce((s, i) => s + i.taxAmount, 0);
    const totalPaid = stagedItems.reduce((s, i) => s + i.paidAmount, 0);
    const totalDiscount = stagedItems.reduce((s, i) => s + i.discountAmount, 0);
    const overallStatus = deriveOverallStatus({ totalCost, totalTax, totalPaid, totalDiscount });
    const balance = Math.max(0, totalCost + totalTax - totalPaid - totalDiscount);
    return { totalCost, totalTax, totalPaid, totalDiscount, balance, overallStatus };
  }, [stagedItems]);

  const subsidiaryOptions = useMemo(() => {
    return [...subsidiaries].sort((a, b) => {
      const aIsMain = String(a?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
      const bIsMain = String(b?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;

      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
  }, [subsidiaries]);

  const vehicleOptions = useMemo(() => vehicles, [vehicles]);
  const requiresVehicleSelection = CAR_RELATED_INCOME_CATEGORIES.has(formData.category);

  const getPreferredSubsidiaryId = useCallback((availableSubsidiaries = []) => {
    const preferredIds = [user?.subsidiaryId, ...(user?.subsidiaryAccess || [])].filter(Boolean);
    const matched = preferredIds.find((id) => availableSubsidiaries.some((subsidiary) => subsidiary.id === id));
    return matched || '';
  }, [user?.subsidiaryAccess, user?.subsidiaryId]);

  const loadSubsidiaries = useCallback(async () => {
    setSubsidiaryLoading(true);
    try {
      const response = await api.getSubsidiaries();
      const rows = Array.isArray(response?.data) ? response.data : [];
      setSubsidiaries(rows);

      const preferredId = getPreferredSubsidiaryId(rows);
      if (preferredId) {
        setFormData((prev) => (prev.subsidiaryId ? prev : { ...prev, subsidiaryId: preferredId }));
      }
    } catch (err) {
      setSubsidiaries([]);
    } finally {
      setSubsidiaryLoading(false);
    }
  }, [getPreferredSubsidiaryId]);

  useEffect(() => {
    loadSubsidiaries();
  }, [loadSubsidiaries]);

  useEffect(() => {
    if (!formData.subsidiaryId || !requiresVehicleSelection) {
      setVehicles([]);
      return;
    }
    loadVehicles(formData.subsidiaryId);
  }, [formData.subsidiaryId, requiresVehicleSelection]);

  useEffect(() => {
    if (!formData.subsidiaryId) {
      setCustomers([]);
      return;
    }
    loadCustomers(formData.subsidiaryId);
  }, [formData.subsidiaryId]);

  useEffect(() => {
    if (!formData.vehicleId) return;
    const stillAvailable = vehicleOptions.some((vehicle) => vehicle.id === formData.vehicleId);
    if (!stillAvailable) {
      setFormData((prev) => ({ ...prev, vehicleId: '' }));
    }
  }, [formData.vehicleId, vehicleOptions]);

  const loadIncomes = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const response = await api.getIncomes({ page, limit: INCOME_RECORDS_PER_PAGE });
      const records = Array.isArray(response?.data) ? response.data : [];
      const pagination = response?.pagination || {};

      setIncomes(records);
      setIncomePagination({
        page: Number(pagination.page) || page,
        limit: Number(pagination.limit) || INCOME_RECORDS_PER_PAGE,
        total: Number(pagination.total) || records.length,
        pages: Number(pagination.pages) || 1,
      });
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to load income records', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadMonthlyTotals = useCallback(async () => {
    if (!summaryRange.startDate || !summaryRange.endDate || summaryRange.startDate > summaryRange.endDate) {
      setMonthlyTotals({ totalIncome: 0, paidIncome: 0, pendingIncome: 0 });
      return;
    }

    try {
      const response = await api.getIncomes({
        page: 1,
        limit: 5000,
        startDate: summaryRange.startDate,
        endDate: summaryRange.endDate,
      });

      const records = Array.isArray(response?.data) ? response.data : [];
      const totalIncome = records.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const paidIncome = records
        .filter((item) => item.paymentStatus === 'PAID')
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      setMonthlyTotals({
        totalIncome,
        paidIncome,
        pendingIncome: totalIncome - paidIncome,
      });
    } catch (_err) {
      setMonthlyTotals({ totalIncome: 0, paidIncome: 0, pendingIncome: 0 });
    }
  }, [summaryRange.endDate, summaryRange.startDate]);

  useEffect(() => {
    loadIncomes(incomePage);
  }, [incomePage, loadIncomes]);

  useEffect(() => {
    loadMonthlyTotals();
  }, [loadMonthlyTotals]);

  const loadCustomers = async (subsidiaryId) => {
    try {
      const response = await api.getCustomers({
        limit: 500,
        status: 'ACTIVE',
        subsidiaryId,
      });
      setCustomers(response?.data || []);
    } catch (err) {
      // Keep form usable even if customer list fails to load.
      setCustomers([]);
    }
  };

  const loadVehicles = async (subsidiaryId) => {
    setVehicleLoading(true);
    try {
      const response = await api.getVehicles({ subsidiaryId });
      setVehicles(Array.isArray(response?.data) ? response.data : []);
    } catch (_err) {
      setVehicles([]);
    } finally {
      setVehicleLoading(false);
    }
  };

  // ── header-field change handler ───────────────────────────────────────────
  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'subsidiaryId' ? { vehicleId: '', customerId: '' } : {}),
      ...(name === 'category' && !CAR_RELATED_INCOME_CATEGORIES.has(value) ? { vehicleId: '' } : {}),
    }));
  };

  // ── staging item field change handler ─────────────────────────────────────
  const handleStagingChange = (event) => {
    const { name, value } = event.target;
    setStagingItem((prev) => ({ ...prev, [name]: value }));
  };

  // ── "Add to List" button ──────────────────────────────────────────────────
  const handleAddItem = () => {
    const description = stagingItem.serviceDescription.trim();
    const qty = Number(stagingItem.quantity);
    const up = Number(stagingItem.unitPrice);

    if (!description) {
      showToast('Service/product description is required.', 'error');
      return;
    }
    if (!(qty > 0)) {
      showToast('Quantity must be greater than zero.', 'error');
      return;
    }
    if (!(up > 0)) {
      showToast('Unit price must be greater than zero.', 'error');
      return;
    }

    const cost = qty * up;
    const taxAmount = Math.max(0, Number(stagingItem.taxAmount) || 0);
    const paidAmount = Math.max(0, Number(stagingItem.paidAmount) || 0);
    const discountAmount = Math.max(0, Number(stagingItem.discountAmount) || 0);
    const paymentStatus = deriveItemStatus({ cost, taxAmount, paidAmount, discountAmount });

    setStagedItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        serviceType: stagingItem.serviceType.trim() || undefined,
        serviceDescription: description,
        quantity: qty,
        unitPrice: up,
        cost,
        taxAmount,
        paidAmount,
        discountAmount,
        paymentStatus,
        notes: stagingItem.notes.trim() || undefined,
      },
    ]);
    setStagingItem({ ...BLANK_ITEM });
  };

  const handleRemoveItem = (id) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  };

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (!formData.customerId && !requiresVehicleSelection) {
        throw new Error('Select a customer before recording income. If none exists, register a customer first.');
      }

      const resolvedSubsidiaryId = formData.subsidiaryId || user?.subsidiaryId || user?.subsidiaryAccess?.[0];
      if (!resolvedSubsidiaryId) {
        throw new Error('A subsidiary is required to auto-generate an invoice. Set subsidiary on your profile or select one.');
      }

      if (requiresVehicleSelection && !formData.vehicleId) {
        throw new Error('Select a vehicle for car-related income categories.');
      }

      if (!stagedItems.length) {
        throw new Error('Add at least one service or product item before saving.');
      }

      const incomeItems = stagedItems.map(({ id: _id, cost, paymentStatus: _s, ...rest }) => ({
        ...rest,
        amount: cost,
      }));

      const payload = {
        incomeType: formData.incomeType,
        category: formData.category,
        incomeDate: formData.incomeDate,
        customerId: formData.customerId || undefined,
        subsidiaryId: resolvedSubsidiaryId,
        vehicleId: formData.vehicleId || undefined,
        notes: formData.notes || undefined,
        incomeItems,
      };

      await api.createIncome(payload);
      showToast('Income entry recorded successfully.', 'success');

      // reset form but keep subsidiary/incomeType/category for convenience
      setFormData((prev) => ({
        ...prev,
        customerId: '',
        vehicleId: '',
        notes: '',
        incomeDate: new Date().toISOString().slice(0, 10),
      }));
      setStagedItems([]);
      setStagingItem({ ...BLANK_ITEM });
      setIncomePage(1);
      await loadIncomes(1);
      await loadMonthlyTotals();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to record income'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadInvoice = async (incomeId) => {
    setInvoiceLoadingId(incomeId);
    try {
      const response = await api.getIncomeInvoice(incomeId);
      setActiveInvoice(response?.data?.invoice || null);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load invoice'), 'error');
    } finally {
      setInvoiceLoadingId('');
    }
  };

  const handleDownloadInvoice = async (incomeId) => {
    setInvoiceLoadingId(incomeId);
    try {
      await api.downloadIncomeInvoicePdf(incomeId);
      showToast('Invoice PDF downloaded successfully.', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to download invoice PDF'), 'error');
    } finally {
      setInvoiceLoadingId('');
    }
  };

  const handlePrintInvoice = async (incomeId) => {
    setInvoiceLoadingId(incomeId);
    try {
      await api.printIncomeInvoice(incomeId);
      showToast('Invoice sent to printer successfully.', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to print invoice'), 'error');
    } finally {
      setInvoiceLoadingId('');
    }
  };

  return (
    <div className="income-entry-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Income Entry</h1>
          <p className="text-sm text-gray-600">
            Record and track income for ADMIN, CEO, SUPER_ADMIN, and ACCOUNTANT accounts.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-700 text-sm">
          <TrendingUp className="h-4 w-4" />
          Signed in as {user?.role || 'USER'}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700">Income summary period</p>
          <p className="text-xs text-gray-500">Adjusts Total, Paid, and Pending cards only. End date cannot be earlier than start date.</p>
        </div>
        <div className="flex items-end gap-3">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-lg p-4 ${mode === 'dark' ? 'bg-slate-800 border border-sky-500/35' : 'bg-emerald-50'}`}>
          <p className={`text-sm ${mode === 'dark' ? 'text-sky-200' : 'text-emerald-700'}`}>Total Income (Selected Range)</p>
          <p className={`mt-1 text-xl font-semibold ${mode === 'dark' ? 'text-sky-100' : 'text-emerald-900'}`}>{formatCurrency(monthlyTotals.totalIncome)}</p>
        </div>
        <div className={`rounded-lg p-4 ${mode === 'dark' ? 'bg-slate-800 border border-emerald-500/35' : 'bg-emerald-50'}`}>
          <p className={`text-sm ${mode === 'dark' ? 'text-emerald-200' : 'text-emerald-700'}`}>Paid Income (Selected Range)</p>
          <p className={`mt-1 text-xl font-semibold ${mode === 'dark' ? 'text-emerald-100' : 'text-emerald-900'}`}>{formatCurrency(monthlyTotals.paidIncome)}</p>
        </div>
        <div className={`rounded-lg p-4 ${mode === 'dark' ? 'bg-slate-800 border border-amber-500/35' : 'bg-amber-50'}`}>
          <p className={`text-sm ${mode === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>Pending Income (Selected Range)</p>
          <p className={`mt-1 text-xl font-semibold ${mode === 'dark' ? 'text-amber-100' : 'text-amber-900'}`}>{formatCurrency(monthlyTotals.pendingIncome)}</p>
          <p className={`mt-1 text-xs ${mode === 'dark' ? 'text-slate-300' : 'text-amber-700'}`}>Range: {summaryRange.startDate} to {summaryRange.endDate}</p>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
          <PlusCircle className="h-5 w-5 text-red-600" />
          New Income Entry
        </h2>

        {formData.subsidiaryId && customers.length === 0 && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            No customer found for this subsidiary. Register a customer in this subsidiary context before recording income.
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Income Type</span>
            <select
              name="incomeType"
              value={formData.incomeType}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {INCOME_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Income Category</span>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {INCOME_CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Income Subsidiary</span>
            <select
              name="subsidiaryId"
              value={formData.subsidiaryId}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            >
              <option value="">Select subsidiary</option>
              {subsidiaryOptions.map((subsidiary) => {
                const isMain = String(subsidiary.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
                const label = isMain
                  ? `${subsidiary.name} (Main)`
                  : `${subsidiary.name}${subsidiary.code ? ` (${subsidiary.code})` : ''}`;
                return (
                  <option key={subsidiary.id} value={subsidiary.id}>{label}</option>
                );
              })}
            </select>
            {subsidiaryLoading && <span className="mt-1 block text-xs text-gray-500">Loading subsidiaries...</span>}
            {!subsidiaryLoading && subsidiaryOptions.length === 0 && (
              <span className="mt-1 block text-xs text-amber-700">No subsidiaries found. Create Main Company or a subsidiary first.</span>
            )}
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">
              Income Source (Customer){requiresVehicleSelection ? ' (Optional)' : ''}
            </span>
            <select
              name="customerId"
              value={formData.customerId}
              onChange={handleChange}
              required={!requiresVehicleSelection}
              disabled={!formData.subsidiaryId}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
            >
              <option value="">{formData.subsidiaryId ? 'Select customer' : 'Select subsidiary first'}</option>
              {customers.map((customer) => {
                const customerName =
                  customer.companyName ||
                  `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
                  customer.email ||
                  customer.id;
                return (
                  <option key={customer.id} value={customer.id}>{customerName}</option>
                );
              })}
            </select>
            {!formData.subsidiaryId && (
              <span className="mt-1 block text-xs text-amber-700">Choose subsidiary first to see customers in that subsidiary context.</span>
            )}
          </label>

          {requiresVehicleSelection && (
            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Vehicle</span>
              <select
                name="vehicleId"
                value={formData.vehicleId}
                onChange={handleChange}
                disabled={!formData.subsidiaryId || vehicleLoading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
                required
              >
                <option value="">
                  {!formData.subsidiaryId ? 'Select subsidiary first' : vehicleLoading ? 'Loading vehicles...' : 'Select vehicle'}
                </option>
                {vehicleOptions.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registrationNumber} {vehicle.model ? `- ${vehicle.model}` : ''}
                  </option>
                ))}
              </select>
              {formData.subsidiaryId && !vehicleLoading && vehicleOptions.length === 0 && (
                <span className="mt-1 block text-xs text-amber-700">No vehicles found in this subsidiary.</span>
              )}
            </label>
          )}

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Income Date</span>
            <input
              name="incomeDate"
              type="date"
              required
              value={formData.incomeDate}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>

          {/* ── Item staging area ────────────────────────────────────────── */}
          <div className="md:col-span-2 rounded-lg border border-red-100 bg-red-50 p-4">
            <h3 className="mb-3 font-semibold text-red-800 text-sm">Add Service / Product Item</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Description <span className="text-rose-500">*</span></span>
                <input
                  name="serviceDescription"
                  value={stagingItem.serviceDescription}
                  onChange={handleStagingChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                  placeholder="e.g. Security Guard Shift, CCTV Camera"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Service Type / Staff</span>
                <input
                  name="serviceType"
                  value={stagingItem.serviceType}
                  onChange={handleStagingChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                  placeholder="e.g. Guard Shift, CCTV Installation"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Quantity <span className="text-rose-500">*</span></span>
                <input
                  name="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stagingItem.quantity}
                  onChange={handleStagingChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Unit Price <span className="text-rose-500">*</span></span>
                <input
                  name="unitPrice"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stagingItem.unitPrice}
                  onChange={handleStagingChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                  placeholder="0.00"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Tax Amount</span>
                <input
                  name="taxAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={stagingItem.taxAmount}
                  onChange={handleStagingChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                  placeholder="0.00"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Paid Amount</span>
                <input
                  name="paidAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={stagingItem.paidAmount}
                  onChange={handleStagingChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                  placeholder="0.00"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Discount Amount</span>
                <input
                  name="discountAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={stagingItem.discountAmount}
                  onChange={handleStagingChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                  placeholder="0.00"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Notes (optional)</span>
                <input
                  name="notes"
                  value={stagingItem.notes}
                  onChange={handleStagingChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                  placeholder="Additional notes for this item"
                />
              </label>
            </div>

            {/* live preview */}
            {stagingCost > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-white px-4 py-2 text-sm border border-red-100">
                <span className="text-gray-600">Cost: <strong className="text-gray-800">{stagingCost.toLocaleString()}</strong></span>
                <span className="text-gray-600">
                  Due: <strong className="text-gray-800">
                    {(stagingCost + (Number(stagingItem.taxAmount) || 0)).toLocaleString()}
                  </strong>
                </span>
                <span className="text-gray-600">
                  Settled: <strong className="text-gray-800">
                    {((Number(stagingItem.paidAmount) || 0) + (Number(stagingItem.discountAmount) || 0)).toLocaleString()}
                  </strong>
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(stagingStatus, mode)}`}>
                  <StatusIcon status={stagingStatus} />
                  {stagingStatus.replace('_', ' ')}
                </span>
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                <PlusCircle className="h-4 w-4" />
                Add to List
              </button>
            </div>
          </div>

          {/* ── Staged items list ─────────────────────────────────────────── */}
          {stagedItems.length > 0 && (
            <div className="md:col-span-2 rounded-lg border border-gray-200 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-600">
                  <tr className="text-left text-xs text-gray-600">
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">Tax</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Discount</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {stagedItems.map((item) => {
                    const due = item.cost + item.taxAmount;
                    const settled = item.paidAmount + item.discountAmount;
                    const itemBalance = Math.max(0, due - settled);
                    return (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-800">{item.serviceDescription}</div>
                          {item.serviceType && <div className="text-xs text-gray-500">{item.serviceType}</div>}
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{item.unitPrice.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-medium">{item.cost.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-amber-700">{item.taxAmount > 0 ? item.taxAmount.toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-right text-emerald-700">{item.paidAmount > 0 ? item.paidAmount.toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-right text-red-700">{item.discountAmount > 0 ? item.discountAmount.toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-right font-medium text-rose-700">{itemBalance > 0 ? itemBalance.toLocaleString() : '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(item.paymentStatus, mode)}`}>
                            <StatusIcon status={item.paymentStatus} />
                            {item.paymentStatus.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-rose-400 hover:text-rose-600"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* totals footer */}
                <tfoot className="border-t-2 border-gray-300 bg-gray-50 text-sm font-semibold">
                  <tr>
                    <td className="px-3 py-2 text-gray-700" colSpan={3}>Totals</td>
                    <td className="px-3 py-2 text-right">{summary.totalCost.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-amber-700">{summary.totalTax > 0 ? summary.totalTax.toLocaleString() : '-'}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{summary.totalPaid > 0 ? summary.totalPaid.toLocaleString() : '-'}</td>
                    <td className="px-3 py-2 text-right text-red-700">{summary.totalDiscount > 0 ? summary.totalDiscount.toLocaleString() : '-'}</td>
                    <td className="px-3 py-2 text-right text-rose-700">{summary.balance > 0 ? summary.balance.toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(summary.overallStatus, mode)}`}>
                        <StatusIcon status={summary.overallStatus} />
                        {summary.overallStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td></td>
                  </tr>
                  <tr className="border-t border-gray-200 text-xs font-medium text-gray-600">
                    <td className="px-3 py-2" colSpan={3}>Items: {stagedItems.length}</td>
                    <td className="px-3 py-2 text-right" colSpan={2}>
                      Due: {(summary.totalCost + summary.totalTax).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right" colSpan={2}>
                      Settled: {(summary.totalPaid + summary.totalDiscount).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right" colSpan={3}>
                      Outstanding: {summary.balance > 0 ? summary.balance.toLocaleString() : '0'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-gray-700">Notes (overall)</span>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              rows={2}
              placeholder="Overall notes for this income entry"
            />
          </label>

          <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-gray-500">
              {stagedItems.length === 0
                ? 'Add at least one item to enable saving.'
                : `${stagedItems.length} item${stagedItems.length !== 1 ? 's' : ''} staged — overall status: `}
              {stagedItems.length > 0 && (
                <span className={`font-semibold ${summary.overallStatus === 'PAID' ? (mode === 'dark' ? 'text-emerald-300' : 'text-emerald-700') : summary.overallStatus === 'PARTIALLY_PAID' ? (mode === 'dark' ? 'text-amber-300' : 'text-amber-700') : (mode === 'dark' ? 'text-slate-300' : 'text-gray-600')}`}>
                  {summary.overallStatus.replace('_', ' ')}
                </span>
              )}
            </p>
            <button
              type="submit"
              disabled={
                saving ||
                stagedItems.length === 0 ||
                subsidiaryLoading ||
                subsidiaryOptions.length === 0 ||
                (!requiresVehicleSelection && customers.length === 0)
              }
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Income Entry'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Recent Income Records</h2>
          <button
            onClick={async () => {
              await Promise.all([loadIncomes(incomePage), loadMonthlyTotals()]);
            }}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading income records...</div>
        ) : incomes.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No income records yet.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-600">
                  <tr className="border-b text-left text-white">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Subsidiary</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Staff</th>
                    <th className="py-2 pr-4">Created At</th>
                    <th className="py-2 pr-4">Last Updated</th>
                    <th className="py-2 pr-4">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2 pr-4">{new Date(item.incomeDate).toISOString().slice(0, 10)}</td>
                      <td className="py-2 pr-4">{getSubsidiaryDisplayName(item.subsidiary)}</td>
                      <td className="py-2 pr-4">{getCustomerDisplayName(item.customer)}</td>
                      <td className="py-2 pr-4">{item.incomeType}</td>
                      <td className="py-2 pr-4">{item.category}</td>
                      <td className="py-2 pr-4">{Number(item.amount || 0).toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(item.paymentStatus, mode)}`}>
                          <StatusIcon status={item.paymentStatus} />
                          {String(item.paymentStatus || 'PENDING').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{item.createdBy?.fullName || '-'}</td>
                      <td className="py-2 pr-4">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                      <td className="py-2 pr-4">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => loadInvoice(item.id)}
                            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${mode === 'dark' ? 'border-slate-600 text-slate-100 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                          >
                            {invoiceLoadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoice(item.id)}
                            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${mode === 'dark' ? 'border-slate-600 text-slate-100 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintInvoice(item.id)}
                            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${mode === 'dark' ? 'border-slate-600 text-slate-100 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500">
                Showing {incomes.length ? (incomePagination.page - 1) * incomePagination.limit + 1 : 0}
                -{(incomePagination.page - 1) * incomePagination.limit + incomes.length} of {incomePagination.total} records
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIncomePage((prev) => Math.max(1, prev - 1))}
                  disabled={incomePagination.page <= 1 || loading}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-600">
                  Page {incomePagination.page} of {Math.max(1, incomePagination.pages)}
                </span>
                <button
                  type="button"
                  onClick={() => setIncomePage((prev) => Math.min(incomePagination.pages || 1, prev + 1))}
                  disabled={incomePagination.page >= incomePagination.pages || loading}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {activeInvoice && (
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-gray-800">
              <History className="h-5 w-5 text-indigo-600" />
              Invoice {activeInvoice.invoiceNumber} (v{activeInvoice.version || 1})
            </h2>
            <button
              type="button"
              onClick={() => setActiveInvoice(null)}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="rounded bg-gray-50 p-3 text-sm">
              <p className="text-gray-500">Issue Date</p>
              <p className="font-medium text-gray-800">{new Date(activeInvoice.issueDate).toISOString().slice(0, 10)}</p>
            </div>
            <div className="rounded bg-gray-50 p-3 text-sm">
              <p className="text-gray-500">Due Date</p>
              <p className="font-medium text-gray-800">{new Date(activeInvoice.dueDate).toISOString().slice(0, 10)}</p>
            </div>
            <div className="rounded bg-gray-50 p-3 text-sm">
              <p className="text-gray-500">Total</p>
              <p className="font-medium text-gray-800">{Number(activeInvoice.totalAmount || 0).toLocaleString()}</p>
            </div>
          </div>

          <h3 className="mb-2 text-sm font-semibold text-gray-800">Revision History</h3>
          {activeInvoice.revisionHistory?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-red-600">
                  <tr className="border-b text-left text-white">
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">From</th>
                    <th className="py-2 pr-4">To</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">By</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInvoice.revisionHistory.map((rev) => (
                    <tr key={rev.id} className="border-b">
                      <td className="py-2 pr-4">{new Date(rev.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-4">v{rev.previousVersion}</td>
                      <td className="py-2 pr-4">v{rev.nextVersion}</td>
                      <td className="py-2 pr-4">{rev.changeType}</td>
                      <td className="py-2 pr-4">{rev.reason || '-'}</td>
                      <td className="py-2 pr-4">{rev.approvedBy?.fullName || rev.createdBy?.fullName || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded bg-gray-50 p-3 text-sm text-gray-600">No revision history yet.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default IncomeEntry;




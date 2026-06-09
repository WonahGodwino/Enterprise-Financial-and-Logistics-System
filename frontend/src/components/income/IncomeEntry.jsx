import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DollarSign, PlusCircle, RefreshCw, TrendingUp, FileText, Download, Printer,
  History, Loader2, Trash2, CheckCircle, Clock, AlertCircle, X, Eye, Banknote, Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

const INCOME_TYPE_OPTIONS = [
  'SERVICE', 'PRODUCT', 'RENTAL', 'INSTALLATION', 'MAINTENANCE', 'CONSULTING', 'OTHER',
];
const INCOME_CATEGORY_OPTIONS = [
  'CAR_HIRE', 'CAR_SALES', 'CAR_MAINTENANCE', 'SECURITY_GUARD', 'CCTV_INSTALLATION',
  'SMART_HOME', 'SECURITY_CONSULTING', 'GENERAL_CONTRACT', 'RENOVATION',
  'CONSTRUCTION_MATERIALS', 'PROJECT_MANAGEMENT', 'OTHER',
];
const MAIN_SUBSIDIARY_CODE = 'MAIN';
const CAR_RELATED_INCOME_CATEGORIES = new Set(['CAR_HIRE', 'CAR_SALES', 'CAR_MAINTENANCE']);
const INCOME_RECORDS_PER_PAGE = 10;
const CAN_RECORD_PAYMENT_ROLES = new Set(['ADMIN', 'CEO', 'SUPER_ADMIN']);
const PAYMENT_METHOD_OPTIONS = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'POS', 'USSD', 'MOBILE_MONEY', 'ONLINE_PAYMENT', 'OTHER'];

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
  PAID: { light: 'bg-emerald-100 text-emerald-800', dark: 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-200' },
  PARTIALLY_PAID: { light: 'bg-amber-100 text-amber-800', dark: 'border border-amber-500/40 bg-amber-500/20 text-amber-200' },
  PENDING: { light: 'bg-gray-100 text-gray-700', dark: 'border border-slate-500/40 bg-slate-500/20 text-slate-200' },
  OVERDUE: { light: 'bg-rose-100 text-rose-800', dark: 'border border-rose-500/40 bg-rose-500/20 text-rose-200' },
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
const BLANK_ITEM = { serviceType: '', serviceDescription: '', quantity: '1', unitPrice: '', taxAmount: '0', paidAmount: '', discountAmount: '0', notes: '' };

const extractErrorMessage = (err, fallback = 'An unexpected error occurred.') => {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data.message === 'string' && data.message) return data.message;
  if (typeof data.error === 'string' && data.error) return data.error;
  return err?.message || fallback;
};
const getCustomerDisplayName = (customer) => {
  if (!customer) return '-';
  return customer.companyName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email || customer.phone || '-';
};
const getSubsidiaryDisplayName = (subsidiary) => {
  if (!subsidiary) return '-';
  const isMain = String(subsidiary.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
  return isMain ? `${subsidiary.name} (Main)` : subsidiary.name || subsidiary.code || '-';
};
const formatCurrency = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0));

const IncomeEntry = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { mode } = useTheme();
  const defaultSummaryRange = useMemo(() => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }, []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [incomes, setIncomes] = useState([]);
  const [monthlyTotals, setMonthlyTotals] = useState({ totalIncome: 0, paidIncome: 0, pendingIncome: 0 });
  const [summaryRange, setSummaryRange] = useState(defaultSummaryRange);
  const [incomePage, setIncomePage] = useState(1);
  const [incomePagination, setIncomePagination] = useState({ page: 1, limit: INCOME_RECORDS_PER_PAGE, total: 0, pages: 1 });
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [subsidiaryLoading, setSubsidiaryLoading] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState('');

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailIncome, setDetailIncome] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMethod: 'BANK_TRANSFER', paymentDate: new Date().toISOString().slice(0, 10), reference: '', notes: '' });
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [incomeSearch, setIncomeSearch] = useState('');
  const [incomeStatusFilter, setIncomeStatusFilter] = useState('all');

  const canRecordPayment = CAN_RECORD_PAYMENT_ROLES.has(String(user?.role || '').toUpperCase());

  const [formData, setFormData] = useState({ incomeType: 'SERVICE', category: 'CAR_HIRE', customerId: '', subsidiaryId: '', vehicleId: '', incomeDate: new Date().toISOString().slice(0, 10), notes: '' });
  const [stagingItem, setStagingItem] = useState({ ...BLANK_ITEM });
  const [stagedItems, setStagedItems] = useState([]);

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
  const summary = useMemo(() => {
    if (!stagedItems.length) return { totalCost: 0, totalTax: 0, totalPaid: 0, totalDiscount: 0, balance: 0, overallStatus: 'PENDING' };
    const totalCost = stagedItems.reduce((s, i) => s + i.cost, 0);
    const totalTax = stagedItems.reduce((s, i) => s + i.taxAmount, 0);
    const totalPaid = stagedItems.reduce((s, i) => s + i.paidAmount, 0);
    const totalDiscount = stagedItems.reduce((s, i) => s + i.discountAmount, 0);
    const overallStatus = deriveOverallStatus({ totalCost, totalTax, totalPaid, totalDiscount });
    const balance = Math.max(0, totalCost + totalTax - totalPaid - totalDiscount);
    return { totalCost, totalTax, totalPaid, totalDiscount, balance, overallStatus };
  }, [stagedItems]);
  const subsidiaryOptions = useMemo(() => [...subsidiaries].sort((a, b) => {
    const aIsMain = String(a?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
    const bIsMain = String(b?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
    if (aIsMain && !bIsMain) return -1;
    if (!aIsMain && bIsMain) return 1;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  }), [subsidiaries]);
  const vehicleOptions = useMemo(() => vehicles, [vehicles]);
  const requiresVehicleSelection = CAR_RELATED_INCOME_CATEGORIES.has(formData.category);

  const getPreferredSubsidiaryId = useCallback((availableSubsidiaries = []) => {
    const preferredIds = [user?.subsidiaryId, ...(user?.subsidiaryAccess || [])].filter(Boolean);
    return preferredIds.find((id) => availableSubsidiaries.some((s) => s.id === id)) || '';
  }, [user?.subsidiaryAccess, user?.subsidiaryId]);

  const loadSubsidiaries = useCallback(async () => {
    setSubsidiaryLoading(true);
    try {
      const res = await api.getSubsidiaries();
      const rows = Array.isArray(res?.data) ? res.data : [];
      setSubsidiaries(rows);
      const pref = getPreferredSubsidiaryId(rows);
      if (pref) setFormData((prev) => (prev.subsidiaryId ? prev : { ...prev, subsidiaryId: pref }));
    } catch { setSubsidiaries([]); } finally { setSubsidiaryLoading(false); }
  }, [getPreferredSubsidiaryId]);
  useEffect(() => { loadSubsidiaries(); }, [loadSubsidiaries]);

  const loadVehicles = async (sid) => {
    setVehicleLoading(true);
    try { const res = await api.getVehicles({ subsidiaryId: sid }); setVehicles(Array.isArray(res?.data) ? res.data : []); } catch { setVehicles([]); } finally { setVehicleLoading(false); }
  };
  const loadCustomers = async (sid) => {
    try { const res = await api.getCustomers({ limit: 500, status: 'ACTIVE', subsidiaryId: sid }); setCustomers(res?.data || []); } catch { setCustomers([]); }
  };
  useEffect(() => { if (!formData.subsidiaryId || !requiresVehicleSelection) { setVehicles([]); return; } loadVehicles(formData.subsidiaryId); }, [formData.subsidiaryId, requiresVehicleSelection]);
  useEffect(() => { if (!formData.subsidiaryId) { setCustomers([]); return; } loadCustomers(formData.subsidiaryId); }, [formData.subsidiaryId]);
  useEffect(() => { if (!formData.vehicleId) return; if (!vehicleOptions.some((v) => v.id === formData.vehicleId)) setFormData((p) => ({ ...p, vehicleId: '' })); }, [formData.vehicleId, vehicleOptions]);

  const loadIncomes = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.getIncomes({ page, limit: INCOME_RECORDS_PER_PAGE });
      const records = Array.isArray(res?.data) ? res.data : [];
      const pag = res?.pagination || {};
      setIncomes(records);
      setIncomePagination({ page: Number(pag.page) || page, limit: Number(pag.limit) || INCOME_RECORDS_PER_PAGE, total: Number(pag.total) || records.length, pages: Number(pag.pages) || 1 });
    } catch (err) { showToast(err?.response?.data?.message || 'Failed to load income records', 'error'); } finally { setLoading(false); }
  }, [showToast]);
  const loadMonthlyTotals = useCallback(async () => {
    if (!summaryRange.startDate || !summaryRange.endDate || summaryRange.startDate > summaryRange.endDate) { setMonthlyTotals({ totalIncome: 0, paidIncome: 0, pendingIncome: 0 }); return; }
    try {
      const res = await api.getIncomes({ page: 1, limit: 5000, startDate: summaryRange.startDate, endDate: summaryRange.endDate });
      const records = Array.isArray(res?.data) ? res.data : [];
      const total = records.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const paid = records.filter((i) => i.paymentStatus === 'PAID').reduce((s, i) => s + (Number(i.amount) || 0), 0);
      setMonthlyTotals({ totalIncome: total, paidIncome: paid, pendingIncome: total - paid });
    } catch { setMonthlyTotals({ totalIncome: 0, paidIncome: 0, pendingIncome: 0 }); }
  }, [summaryRange.endDate, summaryRange.startDate]);
  useEffect(() => { loadIncomes(incomePage); }, [incomePage, loadIncomes]);
  useEffect(() => { loadMonthlyTotals(); }, [loadMonthlyTotals]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value, ...(name === 'subsidiaryId' ? { vehicleId: '', customerId: '' } : {}), ...(name === 'category' && !CAR_RELATED_INCOME_CATEGORIES.has(value) ? { vehicleId: '' } : {}) }));
  };
  const handleStagingChange = (e) => { const { name, value } = e.target; setStagingItem((p) => ({ ...p, [name]: value })); };
  const handleAddItem = () => {
    const desc = stagingItem.serviceDescription.trim();
    const qty = Number(stagingItem.quantity);
    const up = Number(stagingItem.unitPrice);
    if (!desc) { showToast('Service/product description is required.', 'error'); return; }
    if (!(qty > 0)) { showToast('Quantity must be greater than zero.', 'error'); return; }
    if (!(up > 0)) { showToast('Unit price must be greater than zero.', 'error'); return; }
    const cost = qty * up;
    const taxAmount = Math.max(0, Number(stagingItem.taxAmount) || 0);
    const paidAmount = Math.max(0, Number(stagingItem.paidAmount) || 0);
    const discountAmount = Math.max(0, Number(stagingItem.discountAmount) || 0);
    setStagedItems((prev) => [...prev, { id: Date.now(), serviceType: stagingItem.serviceType.trim() || undefined, serviceDescription: desc, quantity: qty, unitPrice: up, cost, taxAmount, paidAmount, discountAmount, paymentStatus: deriveItemStatus({ cost, taxAmount, paidAmount, discountAmount }), notes: stagingItem.notes.trim() || undefined }]);
    setStagingItem({ ...BLANK_ITEM });
  };
  const handleRemoveItem = (id) => { setStagedItems((p) => p.filter((i) => i.id !== id)); };

  const handleSubmit = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      if (!formData.customerId && !requiresVehicleSelection) throw new Error('Select a customer before recording income.');
      const sid = formData.subsidiaryId || user?.subsidiaryId || user?.subsidiaryAccess?.[0];
      if (!sid) throw new Error('A subsidiary is required to auto-generate an invoice.');
      if (requiresVehicleSelection && !formData.vehicleId) throw new Error('Select a vehicle for car-related income categories.');
      if (!stagedItems.length) throw new Error('Add at least one item.');
      const incomeItems = stagedItems.map(({ id: _id, cost, paymentStatus: _s, ...rest }) => ({ ...rest, amount: cost }));
      await api.createIncome({ incomeType: formData.incomeType, category: formData.category, incomeDate: formData.incomeDate, customerId: formData.customerId || undefined, subsidiaryId: sid, vehicleId: formData.vehicleId || undefined, notes: formData.notes || undefined, incomeItems });
      showToast('Income entry recorded successfully.', 'success');
      setFormData((p) => ({ ...p, customerId: '', vehicleId: '', notes: '', incomeDate: new Date().toISOString().slice(0, 10) }));
      setStagedItems([]); setStagingItem({ ...BLANK_ITEM }); setIncomePage(1); await loadIncomes(1); await loadMonthlyTotals();
    } catch (err) { showToast(extractErrorMessage(err, 'Failed to record income'), 'error'); } finally { setSaving(false); }
  };

  const loadInvoice = async (id) => {
    setInvoiceLoadingId(id);
    try { const r = await api.getIncomeInvoice(id); setDetailIncome(null); setActiveInvoice(r?.data?.invoice || null); } catch (err) { showToast(extractErrorMessage(err, 'Failed to load invoice'), 'error'); } finally { setInvoiceLoadingId(''); }
  };
  const [activeInvoice, setActiveInvoice] = useState(null);
  const handleDownloadInvoice = async (id) => { setInvoiceLoadingId(id); try { await api.downloadIncomeInvoicePdf(id); showToast('PDF downloaded.', 'success'); } catch (err) { showToast(extractErrorMessage(err, 'Failed to download'), 'error'); } finally { setInvoiceLoadingId(''); } };
  const handlePrintInvoice = async (id) => { setInvoiceLoadingId(id); try { await api.printIncomeInvoice(id); showToast('Sent to printer.', 'success'); } catch (err) { showToast(extractErrorMessage(err, 'Failed to print'), 'error'); } finally { setInvoiceLoadingId(''); } };

  // ── Detail Modal ──
  const openDetailModal = async (income) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    setDetailIncome(null);
    setShowPaymentForm(false);
    setPaymentForm({ amount: '', paymentMethod: 'BANK_TRANSFER', paymentDate: new Date().toISOString().slice(0, 10), reference: '', notes: '' });
    setPaymentError('');
    try {
      const res = await api.getIncomeById(income.id);
      setDetailIncome(res?.data || income);
    } catch (err) {
      setDetailIncome(income);
      showToast(extractErrorMessage(err, 'Failed to load full details'), 'error');
    } finally { setLoadingDetail(false); }
  };
  const closeDetailModal = () => { setShowDetailModal(false); setDetailIncome(null); setShowPaymentForm(false); };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amt = Number(paymentForm.amount);
    if (!amt || amt <= 0) { setPaymentError('Valid payment amount is required.'); return; }
    setSubmittingPayment(true); setPaymentError('');
    try {
      const res = await api.recordIncomePayment(detailIncome.id, {
        amount: amt,
        paymentMethod: paymentForm.paymentMethod,
        paymentDate: paymentForm.paymentDate,
        reference: paymentForm.reference.trim() || undefined,
        notes: paymentForm.notes.trim() || undefined,
      });
      showToast(res?.message || 'Payment recorded successfully.', 'success');
      setDetailIncome((prev) => ({ ...prev, ...res?.data, payments: res?.data?.payments || prev?.payments }));
      setShowPaymentForm(false);
      setPaymentForm({ amount: '', paymentMethod: 'BANK_TRANSFER', paymentDate: new Date().toISOString().slice(0, 10), reference: '', notes: '' });
      await Promise.all([loadIncomes(incomePage), loadMonthlyTotals()]);
    } catch (err) {
      setPaymentError(extractErrorMessage(err, 'Failed to record payment'));
    } finally { setSubmittingPayment(false); }
  };

  const computedDetail = useMemo(() => {
    if (!detailIncome) return null;
    const items = Array.isArray(detailIncome.incomeItems) ? detailIncome.incomeItems : [];
    const totalCost = items.reduce((s, i) => s + (Number(i.amount) || Number(i.cost) || 0), 0);
    const totalTax = items.reduce((s, i) => s + (Number(i.taxAmount) || 0), 0);
    // totalDue comes from items only — detailIncome.amount is a top-level aggregate that would double-count
    const totalDue = totalCost + totalTax;
    const paymentRecords = Array.isArray(detailIncome.payments) ? detailIncome.payments : [];
    // totalPaid from the authoritative paidAmount field on the income record (already updated by the backend)
    const totalPaid = Number(detailIncome.paidAmount) || 0;
    const balance = Math.max(0, totalDue - totalPaid);
    return { items, totalCost, totalTax, totalDue, paymentRecords, totalPaid, balance };
  }, [detailIncome]);

  const filteredIncomes = useMemo(() => {
    return incomes.filter((item) => {
      const searchLower = incomeSearch.toLowerCase().trim();
      if (searchLower) {
        const haystack = [
          getCustomerDisplayName(item.customer),
          item.incomeType,
          item.category,
          item.createdBy?.fullName,
          ...(Array.isArray(item.incomeItems) ? item.incomeItems.map((i) => i.serviceDescription || '') : []),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      if (incomeStatusFilter !== 'all') {
        const status = String(item.paymentStatus || 'PENDING').toUpperCase();
        if (status !== incomeStatusFilter.toUpperCase()) return false;
      }
      return true;
    });
  }, [incomes, incomeSearch, incomeStatusFilter]);

  const handleSummaryStartDateChange = (v) => setSummaryRange((p) => { const ns = v || p.startDate; return { ...p, startDate: ns, endDate: p.endDate && ns > p.endDate ? ns : p.endDate }; });
  const handleSummaryEndDateChange = (v) => setSummaryRange((p) => { const ne = v || p.endDate; return { ...p, endDate: ne, startDate: p.startDate && ne < p.startDate ? ne : p.startDate }; });

  return (
    <div className="income-entry-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Income Entry</h1><p className="text-sm text-gray-600">Record and track income for ADMIN, CEO, SUPER_ADMIN, and ACCOUNTANT accounts.</p></div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-700 text-sm"><TrendingUp className="h-4 w-4" />Signed in as {user?.role || 'USER'}</div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm font-medium text-gray-700">Income summary period</p><p className="text-xs text-gray-500">Adjusts Total, Paid, and Pending cards only.</p></div>
        <div className="flex items-end gap-3">
          <label className="text-sm"><span className="mb-1 block text-gray-700">Start Date</span><input type="date" value={summaryRange.startDate} max={summaryRange.endDate} onChange={(e) => handleSummaryStartDateChange(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2" /></label>
          <label className="text-sm"><span className="mb-1 block text-gray-700">End Date</span><input type="date" value={summaryRange.endDate} min={summaryRange.startDate} onChange={(e) => handleSummaryEndDateChange(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2" /></label>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-lg p-4 ${mode === 'dark' ? 'bg-slate-800 border border-sky-500/35' : 'bg-emerald-50'}`}><p className={`text-sm ${mode === 'dark' ? 'text-sky-200' : 'text-emerald-700'}`}>Total Income (Selected)</p><p className={`mt-1 text-xl font-semibold ${mode === 'dark' ? 'text-sky-100' : 'text-emerald-900'}`}>{formatCurrency(monthlyTotals.totalIncome)}</p></div>
        <div className={`rounded-lg p-4 ${mode === 'dark' ? 'bg-slate-800 border border-emerald-500/35' : 'bg-emerald-50'}`}><p className={`text-sm ${mode === 'dark' ? 'text-emerald-200' : 'text-emerald-700'}`}>Paid Income (Selected)</p><p className={`mt-1 text-xl font-semibold ${mode === 'dark' ? 'text-emerald-100' : 'text-emerald-900'}`}>{formatCurrency(monthlyTotals.paidIncome)}</p></div>
        <div className={`rounded-lg p-4 ${mode === 'dark' ? 'bg-slate-800 border border-amber-500/35' : 'bg-amber-50'}`}><p className={`text-sm ${mode === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>Pending Income (Selected)</p><p className={`mt-1 text-xl font-semibold ${mode === 'dark' ? 'text-amber-100' : 'text-amber-900'}`}>{formatCurrency(monthlyTotals.pendingIncome)}</p><p className={`mt-1 text-xs ${mode === 'dark' ? 'text-slate-300' : 'text-amber-700'}`}>Range: {summaryRange.startDate} to {summaryRange.endDate}</p></div>
      </div>

      {/* New Income Form */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800"><PlusCircle className="h-5 w-5 text-red-600" />New Income Entry</h2>
        {formData.subsidiaryId && customers.length === 0 && (<div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No customer found for this subsidiary. Register a customer first.</div>)}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm"><span className="mb-1 block text-gray-700">Income Type</span><select name="incomeType" value={formData.incomeType} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2">{INCOME_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block text-gray-700">Income Category</span><select name="category" value={formData.category} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2">{INCOME_CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block text-gray-700">Income Subsidiary</span><select name="subsidiaryId" value={formData.subsidiaryId} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" required><option value="">Select subsidiary</option>{subsidiaryOptions.map((s) => <option key={s.id} value={s.id}>{String(s.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE ? `${s.name} (Main)` : `${s.name}${s.code ? ` (${s.code})` : ''}`}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block text-gray-700">Income Source (Customer)</span><select name="customerId" value={formData.customerId} onChange={handleChange} required={!requiresVehicleSelection} disabled={!formData.subsidiaryId} className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"><option value="">{formData.subsidiaryId ? 'Select customer' : 'Select subsidiary first'}</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.id}</option>)}</select></label>
          {requiresVehicleSelection && (<label className="text-sm"><span className="mb-1 block text-gray-700">Vehicle</span><select name="vehicleId" value={formData.vehicleId} onChange={handleChange} disabled={!formData.subsidiaryId || vehicleLoading} className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" required><option value="">{!formData.subsidiaryId ? 'Select subsidiary first' : vehicleLoading ? 'Loading...' : 'Select vehicle'}</option>{vehicleOptions.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} {v.model ? `- ${v.model}` : ''}</option>)}</select></label>)}
          <label className="text-sm"><span className="mb-1 block text-gray-700">Income Date</span><input name="incomeDate" type="date" required value={formData.incomeDate} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
          <div className="md:col-span-2 rounded-lg border border-red-100 bg-red-50 p-4">
            <h3 className="mb-3 font-semibold text-red-800 text-sm">Add Service / Product Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm"><span className="mb-1 block text-gray-700">Description *</span><input name="serviceDescription" value={stagingItem.serviceDescription} onChange={handleStagingChange} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2" placeholder="e.g. Security Guard Shift" /></label>
              <label className="text-sm"><span className="mb-1 block text-gray-700">Service Type / Staff</span><input name="serviceType" value={stagingItem.serviceType} onChange={handleStagingChange} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2" placeholder="e.g. Guard Shift" /></label>
              <label className="text-sm"><span className="mb-1 block text-gray-700">Quantity *</span><input name="quantity" type="number" min="0.01" step="0.01" value={stagingItem.quantity} onChange={handleStagingChange} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2" /></label>
              <label className="text-sm"><span className="mb-1 block text-gray-700">Unit Price *</span><input name="unitPrice" type="number" min="0.01" step="0.01" value={stagingItem.unitPrice} onChange={handleStagingChange} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2" placeholder="0.00" /></label>
              <label className="text-sm"><span className="mb-1 block text-gray-700">Tax Amount</span><input name="taxAmount" type="number" min="0" step="0.01" value={stagingItem.taxAmount} onChange={handleStagingChange} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2" placeholder="0.00" /></label>
              <label className="text-sm"><span className="mb-1 block text-gray-700">Paid Amount</span><input name="paidAmount" type="number" min="0" step="0.01" value={stagingItem.paidAmount} onChange={handleStagingChange} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2" placeholder="0.00" /></label>
              <label className="text-sm"><span className="mb-1 block text-gray-700">Discount Amount</span><input name="discountAmount" type="number" min="0" step="0.01" value={stagingItem.discountAmount} onChange={handleStagingChange} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2" placeholder="0.00" /></label>
              <label className="text-sm"><span className="mb-1 block text-gray-700">Notes (optional)</span><input name="notes" value={stagingItem.notes} onChange={handleStagingChange} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2" placeholder="Additional notes" /></label>
            </div>
            {stagingCost > 0 && (<div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-white px-4 py-2 text-sm border border-red-100"><span className="text-gray-600">Cost: <strong className="text-gray-800">{stagingCost.toLocaleString()}</strong></span><span className="text-gray-600">Due: <strong className="text-gray-800">{(stagingCost + (Number(stagingItem.taxAmount) || 0)).toLocaleString()}</strong></span><span className="text-gray-600">Settled: <strong className="text-gray-800">{((Number(stagingItem.paidAmount) || 0) + (Number(stagingItem.discountAmount) || 0)).toLocaleString()}</strong></span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(stagingStatus, mode)}`}><StatusIcon status={stagingStatus} />{stagingStatus.replace('_', ' ')}</span></div>)}
            <div className="mt-3 flex justify-end"><button type="button" onClick={handleAddItem} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"><PlusCircle className="h-4 w-4" />Add to List</button></div>
          </div>
          {stagedItems.length > 0 && (
            <div className="md:col-span-2 rounded-lg border border-gray-200 overflow-x-auto">
              <table className="min-w-full text-sm"><thead className="bg-red-600"><tr className="text-left text-xs text-white"><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit Price</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">Tax</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">Discount</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>{stagedItems.map((item) => { const due = item.cost + item.taxAmount; const settled = item.paidAmount + item.discountAmount; const bal = Math.max(0, due - settled); return (<tr key={item.id} className="border-t"><td className="px-3 py-2"><div className="font-medium text-gray-800">{item.serviceDescription}</div>{item.serviceType && <div className="text-xs text-gray-500">{item.serviceType}</div>}</td><td className="px-3 py-2 text-right">{item.quantity}</td><td className="px-3 py-2 text-right">{item.unitPrice.toLocaleString()}</td><td className="px-3 py-2 text-right font-medium">{item.cost.toLocaleString()}</td><td className="px-3 py-2 text-right text-amber-700">{item.taxAmount > 0 ? item.taxAmount.toLocaleString() : '-'}</td><td className="px-3 py-2 text-right text-emerald-700">{item.paidAmount > 0 ? item.paidAmount.toLocaleString() : '-'}</td><td className="px-3 py-2 text-right text-red-700">{item.discountAmount > 0 ? item.discountAmount.toLocaleString() : '-'}</td><td className="px-3 py-2 text-right font-medium text-rose-700">{bal > 0 ? bal.toLocaleString() : '—'}</td><td className="px-3 py-2 text-center"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(item.paymentStatus, mode)}`}><StatusIcon status={item.paymentStatus} />{item.paymentStatus.replace('_', ' ')}</span></td><td className="px-3 py-2"><button type="button" onClick={() => handleRemoveItem(item.id)} className="text-rose-400 hover:text-rose-600" title="Remove"><Trash2 className="h-4 w-4" /></button></td></tr>); })}</tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50 text-sm font-semibold"><tr><td className="px-3 py-2 text-gray-700" colSpan={3}>Totals</td><td className="px-3 py-2 text-right">{summary.totalCost.toLocaleString()}</td><td className="px-3 py-2 text-right text-amber-700">{summary.totalTax > 0 ? summary.totalTax.toLocaleString() : '-'}</td><td className="px-3 py-2 text-right text-emerald-700">{summary.totalPaid > 0 ? summary.totalPaid.toLocaleString() : '-'}</td><td className="px-3 py-2 text-right text-red-700">{summary.totalDiscount > 0 ? summary.totalDiscount.toLocaleString() : '-'}</td><td className="px-3 py-2 text-right text-rose-700">{summary.balance > 0 ? summary.balance.toLocaleString() : '—'}</td><td className="px-3 py-2 text-center"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(summary.overallStatus, mode)}`}><StatusIcon status={summary.overallStatus} />{summary.overallStatus.replace('_', ' ')}</span></td><td></td></tr></tfoot>
            </table>
            </div>
          )}
          <label className="text-sm md:col-span-2"><span className="mb-1 block text-gray-700">Notes (overall)</span><textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" rows={2} placeholder="Overall notes for this income entry" /></label>
          <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-gray-500">{stagedItems.length === 0 ? 'Add at least one item to enable saving.' : `${stagedItems.length} item${stagedItems.length !== 1 ? 's' : ''} staged — overall status: `}{stagedItems.length > 0 && (<span className={`font-semibold ${summary.overallStatus === 'PAID' ? (mode === 'dark' ? 'text-emerald-300' : 'text-emerald-700') : summary.overallStatus === 'PARTIALLY_PAID' ? (mode === 'dark' ? 'text-amber-300' : 'text-amber-700') : (mode === 'dark' ? 'text-slate-300' : 'text-gray-600')}`}>{summary.overallStatus.replace('_', ' ')}</span>)}</p>
            <button type="submit" disabled={saving || stagedItems.length === 0 || subsidiaryLoading || subsidiaryOptions.length === 0 || (!requiresVehicleSelection && customers.length === 0)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-white hover:bg-red-700 disabled:opacity-50">{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}{saving ? 'Saving...' : 'Save Income Entry'}</button>
          </div>
        </form>
      </div>

      {/* Recent Income Records */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-800">Recent Income Records</h2>
          <button onClick={async () => { await Promise.all([loadIncomes(incomePage), loadMonthlyTotals()]); }} className="text-sm text-red-600 hover:text-red-800">Refresh</button>
        </div>
        {/* Search & Filter */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search by customer, service, category..." value={incomeSearch} onChange={(e) => setIncomeSearch(e.target.value)} className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <select value={incomeStatusFilter} onChange={(e) => setIncomeStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
            <option value="all">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
        {loading ? (<div className="py-8 text-center text-gray-500">Loading income records...</div>) : filteredIncomes.length === 0 ? (<div className="py-8 text-center text-gray-500">{incomes.length === 0 ? 'No income records yet.' : 'No matching records found.'}</div>) : (<><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-red-600"><tr className="border-b text-left text-white"><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Subsidiary</th><th className="py-2 pr-4">Customer</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Category</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Staff</th><th className="py-2 pr-4">Actions</th></tr></thead><tbody>{filteredIncomes.map((item) => (<tr key={item.id} className="border-b"><td className="py-2 pr-4">{new Date(item.incomeDate).toISOString().slice(0, 10)}</td><td className="py-2 pr-4">{getSubsidiaryDisplayName(item.subsidiary)}</td><td className="py-2 pr-4">{getCustomerDisplayName(item.customer)}</td><td className="py-2 pr-4">{item.incomeType}</td><td className="py-2 pr-4">{item.category}</td><td className="py-2 pr-4">{Number(item.amount || 0).toLocaleString()}</td><td className="py-2 pr-4"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(item.paymentStatus, mode)}`}><StatusIcon status={item.paymentStatus} />{String(item.paymentStatus || 'PENDING').replace('_', ' ')}</span></td><td className="py-2 pr-4">{item.createdBy?.fullName || '-'}</td><td className="py-2 pr-4"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => openDetailModal(item)} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${mode === 'dark' ? 'border-slate-600 text-slate-100 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}><Eye className="h-3.5 w-3.5" />View</button><button type="button" onClick={() => handleDownloadInvoice(item.id)} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${mode === 'dark' ? 'border-slate-600 text-slate-100 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}><Download className="h-3.5 w-3.5" />PDF</button><button type="button" onClick={() => handlePrintInvoice(item.id)} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${mode === 'dark' ? 'border-slate-600 text-slate-100 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}><Printer className="h-3.5 w-3.5" />Print</button></div></td></tr>))}</tbody></table></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3"><p className="text-xs text-gray-500">Showing {filteredIncomes.length} of {incomePagination.total} records{incomeStatusFilter !== 'all' || incomeSearch ? ' (filtered)' : ''}</p><div className="flex items-center gap-2"><button type="button" onClick={() => setIncomePage((p) => Math.max(1, p - 1))} disabled={incomePagination.page <= 1 || loading} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Previous</button><span className="text-xs text-gray-600">Page {incomePagination.page} of {Math.max(1, incomePagination.pages)}</span><button type="button" onClick={() => setIncomePage((p) => Math.min(incomePagination.pages || 1, p + 1))} disabled={incomePagination.page >= incomePagination.pages || loading} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Next</button></div></div></>)}
      </div>

      {/* ── Income Detail Modal ── */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-2 sm:p-4">
          <div className="mx-auto my-2 w-full max-w-3xl sm:my-6">
            <div className={`max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl shadow-2xl ${mode === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
              <div className={`sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4 ${mode === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'}`}>
                <h2 className={`text-lg font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-900'}`}>Income Detail</h2>
                <button onClick={closeDetailModal} className={`rounded p-1 ${mode === 'dark' ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><X className="h-5 w-5" /></button>
              </div>
              {loadingDetail ? (<div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-red-600" /></div>) : detailIncome ? (
                <div className="px-6 py-5 space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className={`rounded-lg p-3 ${mode === 'dark' ? 'bg-slate-700' : 'bg-gray-50'}`}><p className={`text-xs ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Type</p><p className={`text-sm font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>{detailIncome.incomeType}</p></div>
                    <div className={`rounded-lg p-3 ${mode === 'dark' ? 'bg-slate-700' : 'bg-gray-50'}`}><p className={`text-xs ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Category</p><p className={`text-sm font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>{detailIncome.category}</p></div>
                    <div className={`rounded-lg p-3 ${mode === 'dark' ? 'bg-slate-700' : 'bg-gray-50'}`}><p className={`text-xs ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Date</p><p className={`text-sm font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>{detailIncome.incomeDate ? new Date(detailIncome.incomeDate).toLocaleDateString() : '-'}</p></div>
                    <div className={`rounded-lg p-3 ${mode === 'dark' ? 'bg-slate-700' : 'bg-gray-50'}`}><p className={`text-xs ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Status</p><span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(detailIncome.paymentStatus, mode)}`}><StatusIcon status={detailIncome.paymentStatus} />{String(detailIncome.paymentStatus || 'PENDING').replace('_', ' ')}</span></div>
                  </div>

                  {/* Financial Summary */}
                  {computedDetail && (
                    <div className={`rounded-lg border p-4 ${mode === 'dark' ? 'border-slate-600' : 'border-gray-200'}`}>
                      <h3 className={`mb-3 text-sm font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>Financial Summary</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div><span className={`block text-xs ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Total Due</span><span className={`font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(computedDetail.totalDue)}</span></div>
                        <div><span className={`block text-xs ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Total Paid</span><span className="font-semibold text-emerald-600">{formatCurrency(computedDetail.totalPaid)}</span></div>
                        <div><span className={`block text-xs ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Outstanding</span><span className={`font-semibold ${computedDetail.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(computedDetail.balance)}</span></div>
                        <div><span className={`block text-xs ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Customer</span><span className={`font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>{getCustomerDisplayName(detailIncome.customer)}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Income Items */}
                  {computedDetail && computedDetail.items.length > 0 && (
                    <div>
                      <h3 className={`mb-2 text-sm font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>Income Items</h3>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-xs"><thead className="bg-red-600"><tr className="text-left text-white"><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit Price</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">Tax</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">Discount</th></tr></thead><tbody>{computedDetail.items.map((item, idx) => (<tr key={idx} className="border-t"><td className="px-3 py-2 font-medium">{item.serviceDescription || '-'}</td><td className="px-3 py-2 text-right">{item.quantity || 0}</td><td className="px-3 py-2 text-right">{Number(item.unitPrice || 0).toLocaleString()}</td><td className="px-3 py-2 text-right">{Number(item.amount || item.cost || 0).toLocaleString()}</td><td className="px-3 py-2 text-right text-amber-700">{Number(item.taxAmount || 0).toLocaleString()}</td><td className="px-3 py-2 text-right text-emerald-700">{Number(item.paidAmount || 0).toLocaleString()}</td><td className="px-3 py-2 text-right text-red-700">{Number(item.discountAmount || 0).toLocaleString()}</td></tr>))}</tbody></table>
                      </div>
                    </div>
                  )}

                  {/* Payment History */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className={`text-sm font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>Payment History</h3>
                      {canRecordPayment && computedDetail && computedDetail.balance > 0 && !showPaymentForm && (
                        <button type="button" onClick={() => setShowPaymentForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"><Banknote className="h-3.5 w-3.5" />Record Payment</button>
                      )}
                    </div>
                    {computedDetail && computedDetail.paymentRecords.length === 0 ? (
                      <p className={`text-xs ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>No payments recorded yet.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-xs"><thead className="bg-red-600"><tr className="text-left text-white"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Method</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Received By</th></tr></thead><tbody>{computedDetail?.paymentRecords?.map((p) => (<tr key={p.id} className="border-t"><td className="px-3 py-2">{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '-'}</td><td className="px-3 py-2">{String(p.paymentMethod || '-').replace(/_/g, ' ')}</td><td className="px-3 py-2 text-right font-semibold text-emerald-700">{Number(p.amount || 0).toLocaleString()}</td><td className="px-3 py-2">{p.reference || '-'}</td><td className="px-3 py-2">{p.receivedBy?.fullName || '-'}</td></tr>))}</tbody></table>
                      </div>
                    )}
                  </div>

                  {/* Payment Form */}
                  {showPaymentForm && (
                    <div className={`rounded-lg border p-4 ${mode === 'dark' ? 'border-emerald-700 bg-slate-700' : 'border-emerald-200 bg-emerald-50'}`}>
                      <h3 className={`mb-3 text-sm font-semibold ${mode === 'dark' ? 'text-emerald-200' : 'text-emerald-800'}`}>Record New Payment</h3>
                      <form onSubmit={handleRecordPayment} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className={`text-xs ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                            Amount *
                            <input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))} className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-600 text-white placeholder:text-slate-400' : 'border-gray-300 text-gray-900'}`} placeholder={computedDetail?.balance ? `${computedDetail.balance.toLocaleString()}` : '0.00'} required />
                          </label>
                          <label className={`text-xs ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                            Payment Method
                            <select value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm((p) => ({ ...p, paymentMethod: e.target.value }))} className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-600 text-white' : 'border-gray-300 text-gray-900'}`}>{PAYMENT_METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}</select>
                          </label>
                          <label className={`text-xs ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                            Payment Date
                            <input type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm((p) => ({ ...p, paymentDate: e.target.value }))} className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-600 text-white' : 'border-gray-300 text-gray-900'}`} />
                          </label>
                          <label className={`text-xs ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                            Reference
                            <input type="text" value={paymentForm.reference} onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))} className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-600 text-white placeholder:text-slate-400' : 'border-gray-300 text-gray-900'}`} placeholder="Receipt/Transaction No." />
                          </label>
                        </div>
                        <label className={`block text-xs ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                          Notes
                          <input type="text" value={paymentForm.notes} onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))} className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-600 text-white placeholder:text-slate-400' : 'border-gray-300 text-gray-900'}`} placeholder="Payment notes (optional)" />
                        </label>
                        {paymentError && (<p className={`rounded-md px-3 py-2 text-xs ${mode === 'dark' ? 'bg-red-900/60 text-red-200' : 'bg-red-50 text-red-700'}`}>{paymentError}</p>)}
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => { setShowPaymentForm(false); setPaymentError(''); }} className={`rounded-lg border px-3 py-1.5 text-xs ${mode === 'dark' ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Cancel</button>
                          <button type="submit" disabled={submittingPayment} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60">{submittingPayment ? 'Processing...' : 'Submit Payment'}</button>
                        </div>
                      </form>
                    </div>
                  )}

                  {detailIncome.notes && (<div><h3 className={`mb-1 text-sm font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>Notes</h3><p className={`text-sm ${mode === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>{detailIncome.notes}</p></div>)}
                </div>
              ) : (<div className={`px-6 py-16 text-center ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Failed to load income details.</div>)}
              <div className={`sticky bottom-0 flex justify-end border-t px-6 py-4 ${mode === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'}`}>
                <button onClick={closeDetailModal} className={`rounded-lg border px-4 py-2 text-sm ${mode === 'dark' ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncomeEntry;
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, PlusCircle, RefreshCw, UserCircle, ArrowLeftRight, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'ORGANIZATION', label: 'Corporate Organization' },
];

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'BLACKLISTED', 'PROSPECT'];
const MAIN_SUBSIDIARY_CODE = 'MAIN';

const defaultForm = {
  subsidiaryIds: [],
  customerType: 'INDIVIDUAL',
  companyName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  alternativePhone: '',
  address: '',
  city: '',
  state: '',
  country: 'Nigeria',
  taxId: '',
  registrationNumber: '',
  contactPerson: '',
  contactPosition: '',
  status: 'ACTIVE',
  creditLimit: '',
  paymentTerms: '',
  notes: '',
};

const getCustomerDisplayName = (customer) => {
  if (customer.companyName) return customer.companyName;
  const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
  return fullName || customer.email || customer.id;
};

const toErrorMessage = (err, fallback) => {
  const apiError = err?.response?.data?.error;
  const apiMessage = err?.response?.data?.message;

  if (typeof apiError === 'string' && apiError.trim()) return apiError;
  if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
  if (apiError && typeof apiError === 'object') {
    if (typeof apiError.message === 'string' && apiError.message.trim()) return apiError.message;
    if (typeof apiError.details === 'string' && apiError.details.trim()) return apiError.details;
  }
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return fallback;
};

const CustomerEntry = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { mode } = useTheme();
  const dm = mode === 'dark';
  const c = (light, dark) => dm ? dark : light;
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [countryOptions, setCountryOptions] = useState(['Nigeria']);
  const [stateOptions, setStateOptions] = useState([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [stateLoading, setStateLoading] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    type: '',
    status: '',
    subsidiaryId: '',
  });

  const [formData, setFormData] = useState(defaultForm);
  const [editingCustomerId, setEditingCustomerId] = useState(null);

  const stats = useMemo(() => {
    const total = customers.length;
    const organizations = customers.filter((c) => c.customerType === 'ORGANIZATION').length;
    const individuals = customers.filter((c) => c.customerType === 'INDIVIDUAL').length;
    return { total, organizations, individuals };
  }, [customers]);

  const subsidiaryOptions = useMemo(() => {
    return [...subsidiaries].sort((a, b) => {
      const aIsMain = String(a?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
      const bIsMain = String(b?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
  }, [subsidiaries]);

  const formatSubsidiaryLabel = useCallback((subsidiary) => {
    const isMain = String(subsidiary?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
    if (isMain) return `${subsidiary.name} (Main)`;
    return `${subsidiary.name}${subsidiary?.code ? ` (${subsidiary.code})` : ''}`;
  }, []);

  const getCustomerSubsidiaryLabels = useCallback((customer) => {
    const links = Array.isArray(customer?.customerSubsidiaries) ? customer.customerSubsidiaries : [];
    if (links.length > 0) {
      return links
        .map((link) => formatSubsidiaryLabel(link?.subsidiary || {}))
        .filter(Boolean)
        .join(', ');
    }

    if (customer?.subsidiary) {
      return formatSubsidiaryLabel(customer.subsidiary);
    }

    return '-';
  }, [formatSubsidiaryLabel]);

  const getPreferredSubsidiaryIds = useCallback((availableSubsidiaries = []) => {
    const preferredIds = [user?.subsidiaryId, ...(user?.subsidiaryAccess || [])].filter(Boolean);
    const matched = preferredIds.find((id) => availableSubsidiaries.some((subsidiary) => subsidiary.id === id));
    const fallback = matched || availableSubsidiaries[0]?.id || '';
    return fallback ? [fallback] : [];
  }, [user?.subsidiaryAccess, user?.subsidiaryId]);

  const fetchCountries = useCallback(async () => {
    setCountryLoading(true);
    try {
      const response = await fetch('https://restcountries.com/v3.1/all?fields=name');
      const data = await response.json();
      const names = data.map((c) => c.name.common).sort();
      if (!names.includes('Nigeria')) names.unshift('Nigeria');
      setCountryOptions(names);
    } catch (_err) {
      setCountryOptions(['Nigeria']);
    } finally {
      setCountryLoading(false);
    }
  }, []);

  const fetchStatesByCountry = useCallback(async (countryName) => {
    if (!countryName) { setStateOptions([]); return; }
    setStateLoading(true);
    try {
      const response = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryName }),
      });
      const data = await response.json();
      setStateOptions((data?.data?.states || []).map((s) => s.name).sort());
    } catch (_err) {
      setStateOptions([]);
    } finally {
      setStateLoading(false);
    }
  }, []);

  const loadSubsidiaries = useCallback(async () => {
    try {
      const response = await api.getSubsidiaries();
      const rows = Array.isArray(response?.data) ? response.data : [];
      setSubsidiaries(rows);

      const preferredIds = getPreferredSubsidiaryIds(rows);
      if (preferredIds.length > 0) {
        setFormData((prev) => (prev.subsidiaryIds?.length ? prev : { ...prev, subsidiaryIds: preferredIds }));
      }
    } catch (_err) {
      setSubsidiaries([]);
    }
  }, [getPreferredSubsidiaryIds]);

  const loadCustomers = useCallback(async (currentFilters) => {
    setLoading(true);

    try {
      const response = await api.getCustomers({
        page: 1,
        limit: 100,
        search: currentFilters?.search || undefined,
        type: currentFilters?.type || undefined,
        status: currentFilters?.status || undefined,
        subsidiaryId: currentFilters?.subsidiaryId || undefined,
      });
      setCustomers(response?.data || []);
    } catch (err) {
      showToast(toErrorMessage(err, 'Failed to load customers'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadCustomers({ search: '', type: '', status: '' });
  }, [loadCustomers]);

  useEffect(() => {
    loadSubsidiaries();
  }, [loadSubsidiaries]);

  useEffect(() => {
    fetchCountries();
    fetchStatesByCountry('Nigeria');
  }, [fetchCountries, fetchStatesByCountry]);

  useEffect(() => {
    fetchStatesByCountry(formData.country);
  }, [formData.country, fetchStatesByCountry]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    if (name === 'country') {
      setFormData((prev) => ({ ...prev, country: value, state: '' }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubsidiaryToggle = (subsidiaryId) => {
    setFormData((prev) => {
      const current = prev.subsidiaryIds || [];
      const updated = current.includes(subsidiaryId)
        ? current.filter((id) => id !== subsidiaryId)
        : [...current, subsidiaryId];
      return { ...prev, subsidiaryIds: updated };
    });
  };

  const resetForm = () => {
    setFormData((prev) => ({
      ...defaultForm,
      subsidiaryIds: getPreferredSubsidiaryIds(subsidiaryOptions),
    }));
    setEditingCustomerId(null);
  };

  const validateForm = () => {
    if (!Array.isArray(formData.subsidiaryIds) || formData.subsidiaryIds.length === 0) {
      return 'At least one subsidiary is required for customer registration';
    }

    if (formData.customerType === 'ORGANIZATION' && !formData.companyName.trim()) {
      return 'Company name is required for corporate organization';
    }

    if (formData.customerType === 'INDIVIDUAL' && (!formData.firstName.trim() || !formData.lastName.trim())) {
      return 'First name and last name are required for individual customer';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const validationError = validateForm();
      if (validationError) {
        throw new Error(validationError);
      }

      const payload = {
        subsidiaryIds: formData.subsidiaryIds,
        subsidiaryId: formData.subsidiaryIds[0] || undefined,
        customerType: formData.customerType,
        companyName: formData.companyName || undefined,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        alternativePhone: formData.alternativePhone || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        country: formData.country || undefined,
        taxId: formData.taxId || undefined,
        registrationNumber: formData.registrationNumber || undefined,
        contactPerson: formData.contactPerson || undefined,
        contactPosition: formData.contactPosition || undefined,
        status: formData.status || undefined,
        creditLimit: formData.creditLimit ? Number(formData.creditLimit) : undefined,
        paymentTerms: formData.paymentTerms || undefined,
        notes: formData.notes || undefined,
      };

      if (editingCustomerId) {
        await api.updateCustomer(editingCustomerId, payload);
        showToast('Customer updated successfully.', 'success');
      } else {
        await api.createCustomer(payload);
        showToast('Customer registered successfully.', 'success');
      }

      resetForm();
      await loadCustomers(filters);
    } catch (err) {
      showToast(toErrorMessage(err, 'Failed to save customer'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditCustomer = (customer) => {
    setEditingCustomerId(customer.id);
    const linkedSubsidiaryIds = Array.isArray(customer.customerSubsidiaries)
      ? customer.customerSubsidiaries.map((link) => link.subsidiaryId).filter(Boolean)
      : [];

    setFormData({
      subsidiaryIds: linkedSubsidiaryIds.length > 0 ? linkedSubsidiaryIds : [customer.subsidiaryId].filter(Boolean),
      customerType: customer.customerType || 'INDIVIDUAL',
      companyName: customer.companyName || '',
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      alternativePhone: customer.alternativePhone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      country: customer.country || 'Nigeria',
      taxId: customer.taxId || '',
      registrationNumber: customer.registrationNumber || '',
      contactPerson: customer.contactPerson || '',
      contactPosition: customer.contactPosition || '',
      status: customer.status || 'ACTIVE',
      creditLimit: customer.creditLimit ?? '',
      paymentTerms: customer.paymentTerms || '',
      notes: customer.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchStatesByCountry(customer.country || 'Nigeria');
  };

  const handleSoftDeleteCustomer = async (customer) => {
    const confirmed = window.confirm(`Soft-delete customer "${getCustomerDisplayName(customer)}"? This will mark the customer as INACTIVE.`);
    if (!confirmed) return;

    try {
      await api.softDeleteCustomer(customer.id);
      showToast('Customer soft-deleted successfully.', 'success');
      await loadCustomers(filters);
    } catch (err) {
      showToast(toErrorMessage(err, 'Failed to soft-delete customer'), 'error');
    }
  };

  // ---- TRANSFER FEATURE / ADMIN VIEW ----
  const canTransfer = useMemo(() => {
    const role = String(user?.role || '').toUpperCase();
    return role === 'CEO' || role === 'SUPER_ADMIN';
  }, [user?.role]);
  const [adminSubsidiaryFilter, setAdminSubsidiaryFilter] = useState('');
  const [transferModal, setTransferModal] = useState({ open: false, customer: null });
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [transferForm, setTransferForm] = useState({ toStaffId: '', reason: '', notes: '' });
  const [transferring, setTransferring] = useState(false);
  const [staffCustomerCounts, setStaffCustomerCounts] = useState([]);

  const loadStaffList = useCallback(async () => {
    if (!canTransfer) return;
    setStaffLoading(true);
    try {
      const params = { limit: 500, isActive: true };
      if (adminSubsidiaryFilter) params.subsidiaryId = adminSubsidiaryFilter;
      const res = await api.getUsers(params);
      const users = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setStaffList(users.filter((u) => u.isActive).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')));
    } catch { setStaffList([]); }
    finally { setStaffLoading(false); }
  }, [canTransfer, adminSubsidiaryFilter]);

  const loadStaffCustomerCounts = useCallback(async () => {
    if (!canTransfer) return;
    try {
      const params = { limit: 1000, status: 'ACTIVE' };
      if (adminSubsidiaryFilter) params.subsidiaryId = adminSubsidiaryFilter;
      const res = await api.getCustomers(params);
      const allCustomers = Array.isArray(res?.data) ? res.data : [];
      const counts = {};
      allCustomers.forEach((c) => { const sid = c.assignedStaffId || 'unassigned'; if (!counts[sid]) counts[sid] = { id: sid, name: 'Unassigned', count: 0 }; counts[sid].count++; if (c.assignedStaff) counts[sid].name = c.assignedStaff.fullName; });
      setStaffCustomerCounts(Object.values(counts).sort((a, b) => b.count - a.count));
    } catch { setStaffCustomerCounts([]); }
  }, [canTransfer, adminSubsidiaryFilter]);

  useEffect(() => { if (canTransfer) { loadStaffList(); loadStaffCustomerCounts(); } }, [canTransfer, loadStaffList, loadStaffCustomerCounts]);

  const openTransferModal = (customer) => { setTransferForm({ toStaffId: customer.assignedStaffId || '', reason: '', notes: '' }); setTransferModal({ open: true, customer }); };
  const handleTransfer = async () => {
    if (!transferModal.customer || !transferForm.toStaffId) return;
    setTransferring(true);
    try {
      await api.transferCustomer({ customerId: transferModal.customer.id, toStaffId: transferForm.toStaffId, reason: transferForm.reason || undefined, notes: transferForm.notes || undefined });
      showToast('Customer transferred successfully.', 'success');
      setTransferModal({ open: false, customer: null });
      await loadCustomers(filters); await loadStaffCustomerCounts();
    } catch (err) { showToast(toErrorMessage(err, 'Transfer failed'), 'error'); }
    finally { setTransferring(false); }
  };
  // ---- END TRANSFER ----

  return (
    <div className="space-y-6 pt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={c('text-2xl font-bold text-gray-800','text-2xl font-bold text-slate-100')}>Customer Entry</h1>
          <p className={c('text-sm text-gray-600','text-sm text-slate-400')}>
            Register Individual or Corporate Organization customer records using your CUSTOMER MANAGEMENT process.
          </p>
        </div>
        <div className={c('inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-700 text-sm','inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-red-200 text-sm border border-red-500/40')}>
          <UserCircle className="h-4 w-4" />
          Signed in as {user?.role || 'USER'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={c('rounded-lg bg-red-50 p-4','rounded-lg bg-red-500/10 p-4 border border-red-500/30')}>
          <p className={c('text-sm text-red-700','text-sm text-red-300')}>Total Customers</p>
          <p className={c('mt-1 text-xl font-semibold text-red-900','mt-1 text-xl font-semibold text-red-200')}>{stats.total}</p>
        </div>
        <div className={c('rounded-lg bg-emerald-50 p-4','rounded-lg bg-emerald-500/10 p-4 border border-emerald-500/30')}>
          <p className={c('text-sm text-emerald-700','text-sm text-emerald-300')}>Corporate Organizations</p>
          <p className={c('mt-1 text-xl font-semibold text-emerald-900','mt-1 text-xl font-semibold text-emerald-200')}>{stats.organizations}</p>
        </div>
        <div className={c('rounded-lg bg-amber-50 p-4','rounded-lg bg-amber-500/10 p-4 border border-amber-500/30')}>
          <p className={c('text-sm text-amber-700','text-sm text-amber-300')}>Individuals</p>
          <p className={c('mt-1 text-xl font-semibold text-amber-900','mt-1 text-xl font-semibold text-amber-200')}>{stats.individuals}</p>
        </div>
      </div>

      {/* CEO / SUPER_ADMIN: Customers per Staff */}
      {canTransfer && (
        <div className="space-y-4">
          <div className={c('flex items-center gap-3 rounded-lg bg-white p-4 shadow','flex items-center gap-3 rounded-lg bg-slate-800 p-4 shadow border border-slate-700')}>
            <Users className="h-5 w-5 text-blue-600" />
            <span className={c('text-sm font-medium text-gray-700','text-sm font-medium text-slate-200')}>Admin View — Filter by Subsidiary:</span>
            <select value={adminSubsidiaryFilter} onChange={(e) => setAdminSubsidiaryFilter(e.target.value)} className={c('rounded-lg border border-gray-300 px-3 py-1.5 text-sm','rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-100')}>
              <option value="">All Subsidiaries</option>
              {subsidiaryOptions.map((s) => <option key={s.id} value={s.id}>{formatSubsidiaryLabel(s)}</option>)}
            </select>
          </div>
          <div className={c('rounded-lg bg-white p-6 shadow','rounded-lg bg-slate-800 p-6 shadow border border-slate-700')}>
            <h3 className={c('mb-3 flex items-center gap-2 text-base font-semibold text-gray-800','mb-3 flex items-center gap-2 text-base font-semibold text-slate-100')}>
              <Users className="h-5 w-5 text-blue-600" />Customers per Staff
            </h3>
            {staffCustomerCounts.length === 0 ? (
              <p className={c('text-sm text-gray-500','text-sm text-slate-400')}>No customer assignments yet. Assign customers to staff via the Transfer button.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {staffCustomerCounts.map((s) => (
                  <div key={s.id} className={c('rounded-lg border border-gray-200 p-3 text-center','rounded-lg border border-slate-600 p-3 text-center bg-slate-700/50')}>
                    <p className={c('text-xs text-gray-500 truncate','text-xs text-slate-400 truncate')} title={s.name}>{s.name}</p>
                    <p className="mt-1 text-xl font-bold text-blue-700">{s.count}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={c(`rounded-lg bg-white p-6 shadow`,`rounded-lg bg-slate-800 p-6 shadow border border-slate-700`)}>
        <h2 className={c('mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800','mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100')}>
          <PlusCircle className="h-5 w-5 text-red-600" />
          {editingCustomerId ? 'Edit Customer' : 'New Customer Registration'}
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Customer Type</span>
            <select
              name="customerType"
              value={formData.customerType}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
            >
              {CUSTOMER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Subsidiaries <span className="text-red-500">*</span></span>
            <div className="flex flex-wrap gap-2">
              {subsidiaryOptions.map((subsidiary) => {
                const checked = (formData.subsidiaryIds || []).includes(subsidiary.id);
                return (
                  <button
                    key={subsidiary.id}
                    type="button"
                    onClick={() => handleSubsidiaryToggle(subsidiary.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      checked
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    <span className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                      checked ? 'border-white bg-white' : 'border-gray-400'
                    }`}>
                      {checked && (
                        <svg className="h-2.5 w-2.5 text-blue-600" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      )}
                    </span>
                    {formatSubsidiaryLabel(subsidiary)}
                  </button>
                );
              })}
            </div>
            {(formData.subsidiaryIds || []).length === 0 && (
              <span className="mt-1 block text-xs text-red-500">Please select at least one subsidiary.</span>
            )}
          </div>

          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Status</span>
            <select
              name="status"
              value={formData.status}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          {formData.customerType === 'ORGANIZATION' ? (
            <>
              <label className="text-sm md:col-span-2">
                <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Company Name</span>
                <input
                  name="companyName"
                  required
                  value={formData.companyName}
                  onChange={handleFormChange}
                  className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
                  placeholder="Corporate organization legal name"
                />
              </label>
              <label className="text-sm">
                <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Contact Person</span>
                <input
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleFormChange}
                  className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
                />
              </label>
              <label className="text-sm">
                <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Contact Position</span>
                <input
                  name="contactPosition"
                  value={formData.contactPosition}
                  onChange={handleFormChange}
                  className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="text-sm">
                <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>First Name</span>
                <input
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleFormChange}
                  className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
                />
              </label>
              <label className="text-sm">
                <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Last Name</span>
                <input
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleFormChange}
                  className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
                />
              </label>
            </>
          )}

          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Email</span>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
            />
          </label>

          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Phone</span>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
            />
          </label>

          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Alternative Phone</span>
            <input
              name="alternativePhone"
              value={formData.alternativePhone}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
            />
          </label>

          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Country</span>
            <select
              name="country"
              value={formData.country}
              onChange={handleFormChange}
              disabled={countryLoading}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 disabled:bg-slate-600`)}
            >
              {countryLoading ? (
                <option value="">Loading countries...</option>
              ) : (
                countryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))
              )}
            </select>
          </label>

          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>State</span>
            <select
              name="state"
              value={formData.state}
              onChange={handleFormChange}
              disabled={stateLoading || stateOptions.length === 0}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 disabled:bg-slate-600`)}
            >
              <option value="">{stateLoading ? 'Loading states...' : 'Select state'}</option>
              {stateOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>City</span>
            <input
              name="city"
              value={formData.city}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Address</span>
            <textarea
              name="address"
              rows={2}
              value={formData.address}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
            />
          </label>

          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Tax ID</span>
            <input
              name="taxId"
              value={formData.taxId}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
            />
          </label>

          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Registration Number</span>
            <input
              name="registrationNumber"
              value={formData.registrationNumber}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
            />
          </label>

          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Credit Limit</span>
            <input
              name="creditLimit"
              type="number"
              min="0"
              step="0.01"
              value={formData.creditLimit}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
            />
          </label>

          <label className="text-sm">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Payment Terms</span>
            <input
              name="paymentTerms"
              value={formData.paymentTerms}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
              placeholder="Example: Net 30"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className={c(`mb-1 block text-gray-700`,`mb-1 block text-slate-200`)}>Notes</span>
            <textarea
              name="notes"
              rows={2}
              value={formData.notes}
              onChange={handleFormChange}
              className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100`)}
            />
          </label>

          <div className="md:col-span-2 flex items-center justify-end">
            {editingCustomerId && (
              <button
                type="button"
                onClick={resetForm}
                className="mr-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel Edit
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              {saving ? 'Saving...' : editingCustomerId ? 'Update Customer' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>

      <div className={c(`rounded-lg bg-white p-6 shadow`,`rounded-lg bg-slate-800 p-6 shadow border border-slate-700`)}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <p className={c('mb-1 text-xs text-gray-500','mb-1 text-xs text-slate-400')}>Search</p>
            <input name="search" value={filters.search} onChange={handleFilterChange} className={c(`rounded-lg border border-gray-300 px-3 py-2 text-sm`,`rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-400`)} placeholder="Name, email, phone" />
          </div>
          <div>
            <p className={c('mb-1 text-xs text-gray-500','mb-1 text-xs text-slate-400')}>Type</p>
            <select name="type" value={filters.type} onChange={handleFilterChange} className={c(`rounded-lg border border-gray-300 px-3 py-2 text-sm`,`rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100`)}>
              <option value="">All</option>
              {CUSTOMER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs text-gray-500">Subsidiary</p>
            <select
              name="subsidiaryId"
              value={filters.subsidiaryId}
              onChange={handleFilterChange}
              className={c(`rounded-lg border border-gray-300 px-3 py-2 text-sm`,`rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100`)}
            >
              <option value="">All</option>
              {subsidiaryOptions.map((subsidiary) => (
                <option key={subsidiary.id} value={subsidiary.id}>{formatSubsidiaryLabel(subsidiary)}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs text-gray-500">Status</p>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className={c(`rounded-lg border border-gray-300 px-3 py-2 text-sm`,`rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100`)}
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <button onClick={() => loadCustomers(filters)} className={c(`rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50`,`rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700`)}>
            Apply Filters
          </button>
        </div>

        {loading ? (
          <div className={c('py-8 text-center text-gray-500','py-8 text-center text-slate-400')}>Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className={c('py-8 text-center text-gray-500','py-8 text-center text-slate-400')}>No customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-red-600">
                <tr className={c('border-b text-left text-white','border-b border-slate-700 text-left text-white')}>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Subsidiaries</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Total Income</th>
                  <th className="py-2 pr-4">Outstanding</th>
                  <th className="py-2 pr-4">Assigned Staff</th>
                  <th className="py-2 pr-4">Created At</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className={c('border-b','border-b border-slate-700')}>
                    <td className={c('py-2 pr-4','py-2 pr-4 text-slate-100')}>{getCustomerDisplayName(customer)}</td>
                    <td className={c('py-2 pr-4','py-2 pr-4 text-slate-200')}>{getCustomerSubsidiaryLabels(customer)}</td>
                    <td className={c('py-2 pr-4','py-2 pr-4 text-slate-200')}>{customer.customerType}</td>
                    <td className={c('py-2 pr-4','py-2 pr-4 text-slate-200')}>{customer.email || '-'}</td>
                    <td className={c('py-2 pr-4','py-2 pr-4 text-slate-200')}>{customer.phone || '-'}</td>
                    <td className={c('py-2 pr-4','py-2 pr-4 text-slate-200')}>{customer.status}</td>
                    <td className={c('py-2 pr-4','py-2 pr-4 text-slate-200')}>{Number(customer.totalIncome || 0).toLocaleString()}</td>
                    <td className={c('py-2 pr-4','py-2 pr-4 text-slate-200')}>{Number(customer.outstandingBalance || 0).toLocaleString()}</td>
                    <td className={c('py-2 pr-4','py-2 pr-4 text-slate-200')}>{customer.assignedStaff?.fullName || (customer.assignedStaffId ? customer.assignedStaffId.slice(0, 8) : 'Unassigned')}</td>
                    <td className={c('py-2 pr-4','py-2 pr-4 text-slate-200')}>{customer.createdAt ? new Date(customer.createdAt).toLocaleString() : '-'}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditCustomer(customer)} className={c('rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50','rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20')}>Edit</button>
                        {canTransfer && (
                          <button onClick={() => openTransferModal(customer)} className={c('rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50','rounded border border-blue-500/40 px-2 py-1 text-xs text-blue-300 hover:bg-blue-500/20')} title="Transfer">
                            <ArrowLeftRight className="h-3 w-3 inline mr-0.5" />Transfer
                          </button>
                        )}
                        <button onClick={() => handleSoftDeleteCustomer(customer)} disabled={customer.status === 'INACTIVE'} className={c('rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50','rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-50')}>Soft Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer Customer Modal */}
      {transferModal.open && transferModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className={c('w-full max-w-md rounded-lg bg-white p-6 shadow-xl','w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-xl border border-slate-700')}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={c('text-lg font-semibold text-gray-800 flex items-center gap-2','text-lg font-semibold text-slate-100 flex items-center gap-2')}><ArrowLeftRight className="h-5 w-5 text-blue-600" />Transfer Customer</h2>
              <button onClick={() => setTransferModal({ open: false, customer: null })} className={c('rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600','rounded-full p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200')}><X className="h-5 w-5" /></button>
            </div>
            <div className={c('mb-4 rounded-lg bg-blue-50 p-3','mb-4 rounded-lg bg-blue-500/10 p-3 border border-blue-500/30')}>
              <p className={c('text-sm text-blue-800','text-sm text-blue-200')}>Transferring: <strong>{getCustomerDisplayName(transferModal.customer)}</strong></p>
              {transferModal.customer.assignedStaff && (<p className={c('text-xs text-blue-600 mt-1','text-xs text-blue-300 mt-1')}>Currently assigned to: {transferModal.customer.assignedStaff.fullName}</p>)}
            </div>
            <div className="space-y-4">
              <label className="block text-sm"><span className={c('mb-1 block text-gray-700','mb-1 block text-slate-200')}>Transfer to Staff <span className="text-red-500">*</span></span>
                <select value={transferForm.toStaffId} onChange={(e) => setTransferForm((prev) => ({ ...prev, toStaffId: e.target.value }))} className={c('w-full rounded-lg border border-gray-300 px-3 py-2','w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100')} disabled={staffLoading}>
                  <option value="">{staffLoading ? 'Loading staff...' : 'Select staff member'}</option>
                  {staffList.map((staff) => (<option key={staff.id} value={staff.id}>{staff.fullName} ({staff.role})</option>))}
                </select>
              </label>
              <label className="block text-sm"><span className={c('mb-1 block text-gray-700','mb-1 block text-slate-200')}>Reason</span>
                <textarea value={transferForm.reason} onChange={(e) => setTransferForm((prev) => ({ ...prev, reason: e.target.value }))} className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400`)} rows={2} placeholder="Reason for transfer (optional)" />
              </label>
              <label className="block text-sm"><span className={c('mb-1 block text-gray-700','mb-1 block text-slate-200')}>Notes</span>
                <textarea value={transferForm.notes} onChange={(e) => setTransferForm((prev) => ({ ...prev, notes: e.target.value }))} className={c(`w-full rounded-lg border border-gray-300 px-3 py-2`,`w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400`)} rows={2} placeholder="Additional notes (optional)" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setTransferModal({ open: false, customer: null })} className={c('rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50','rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-700')}>Cancel</button>
              <button onClick={handleTransfer} disabled={transferring || !transferForm.toStaffId} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">{transferring && <RefreshCw className="h-4 w-4 animate-spin" />}{transferring ? 'Transferring...' : 'Confirm Transfer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerEntry;


import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, PlusCircle, RefreshCw, UserCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Customer Entry</h1>
          <p className="text-sm text-gray-600">
            Register Individual or Corporate Organization customer records using your CUSTOMER MANAGEMENT process.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-700 text-sm">
          <UserCircle className="h-4 w-4" />
          Signed in as {user?.role || 'USER'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-sm text-red-700">Total Customers</p>
          <p className="mt-1 text-xl font-semibold text-red-900">{stats.total}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">Corporate Organizations</p>
          <p className="mt-1 text-xl font-semibold text-emerald-900">{stats.organizations}</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-4">
          <p className="text-sm text-amber-700">Individuals</p>
          <p className="mt-1 text-xl font-semibold text-amber-900">{stats.individuals}</p>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
          <PlusCircle className="h-5 w-5 text-red-600" />
          {editingCustomerId ? 'Edit Customer' : 'New Customer Registration'}
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Customer Type</span>
            <select
              name="customerType"
              value={formData.customerType}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {CUSTOMER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="text-sm">
            <span className="mb-1 block text-gray-700">Subsidiaries <span className="text-red-500">*</span></span>
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
            <span className="mb-1 block text-gray-700">Status</span>
            <select
              name="status"
              value={formData.status}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          {formData.customerType === 'ORGANIZATION' ? (
            <>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-gray-700">Company Name</span>
                <input
                  name="companyName"
                  required
                  value={formData.companyName}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Corporate organization legal name"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Contact Person</span>
                <input
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Contact Position</span>
                <input
                  name="contactPosition"
                  value={formData.contactPosition}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
            </>
          ) : (
            <>
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">First Name</span>
                <input
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Last Name</span>
                <input
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
            </>
          )}

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Email</span>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Phone</span>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Alternative Phone</span>
            <input
              name="alternativePhone"
              value={formData.alternativePhone}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Country</span>
            <select
              name="country"
              value={formData.country}
              onChange={handleFormChange}
              disabled={countryLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
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
            <span className="mb-1 block text-gray-700">State</span>
            <select
              name="state"
              value={formData.state}
              onChange={handleFormChange}
              disabled={stateLoading || stateOptions.length === 0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
            >
              <option value="">{stateLoading ? 'Loading states...' : 'Select state'}</option>
              {stateOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">City</span>
            <input
              name="city"
              value={formData.city}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-gray-700">Address</span>
            <textarea
              name="address"
              rows={2}
              value={formData.address}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Tax ID</span>
            <input
              name="taxId"
              value={formData.taxId}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Registration Number</span>
            <input
              name="registrationNumber"
              value={formData.registrationNumber}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Credit Limit</span>
            <input
              name="creditLimit"
              type="number"
              min="0"
              step="0.01"
              value={formData.creditLimit}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Payment Terms</span>
            <input
              name="paymentTerms"
              value={formData.paymentTerms}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Example: Net 30"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-gray-700">Notes</span>
            <textarea
              name="notes"
              rows={2}
              value={formData.notes}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
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

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs text-gray-500">Search</p>
            <input
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Name, email, phone"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-gray-500">Type</p>
            <select
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
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
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => loadCustomers(filters)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Apply Filters
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-red-600">
                <tr className="border-b text-left text-white">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Subsidiaries</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Total Income</th>
                  <th className="py-2 pr-4">Outstanding</th>
                  <th className="py-2 pr-4">Created At</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b">
                    <td className="py-2 pr-4">{getCustomerDisplayName(customer)}</td>
                    <td className="py-2 pr-4">{getCustomerSubsidiaryLabels(customer)}</td>
                    <td className="py-2 pr-4">{customer.customerType}</td>
                    <td className="py-2 pr-4">{customer.email || '-'}</td>
                    <td className="py-2 pr-4">{customer.phone || '-'}</td>
                    <td className="py-2 pr-4">{customer.status}</td>
                    <td className="py-2 pr-4">{Number(customer.totalIncome || 0).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(customer.outstandingBalance || 0).toLocaleString()}</td>
                    <td className="py-2 pr-4">{customer.createdAt ? new Date(customer.createdAt).toLocaleString() : '-'}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditCustomer(customer)}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleSoftDeleteCustomer(customer)}
                          disabled={customer.status === 'INACTIVE'}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Soft Delete
                        </button>
                      </div>
                    </td>
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

export default CustomerEntry;


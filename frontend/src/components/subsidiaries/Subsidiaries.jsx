// frontend/src/components/subsidiaries/Subsidiaries.jsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Users,
  Truck,
  DollarSign,
  MapPin,
  Phone,
  Mail,
  Globe,
  MoreVertical,
  Download,
  Upload,
  BarChart3
} from 'lucide-react';
import apiService from '../../services/api';
import { useToast } from '../../context/ToastContext';
import tempMainLogo from '../../assets/temp-main-company-logo.svg';

const DEFAULT_COUNTRY = 'Nigeria';

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

const formatCurrency = (value) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const Subsidiaries = () => {
  const location = useLocation();
  const { showToast } = useToast();
  const isMainCompanyMode = location.pathname.startsWith('/company-setup/main-company');
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [, setSelectedSubsidiary] = useState(null);
  const [editingSubsidiaryId, setEditingSubsidiaryId] = useState(null);
  const [countryOptions, setCountryOptions] = useState([DEFAULT_COUNTRY]);
  const [stateOptions, setStateOptions] = useState([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [stateLoading, setStateLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationForm, setLocationForm] = useState({
    country: DEFAULT_COUNTRY,
    state: '',
  });
  const [sameAsMainLocation, setSameAsMainLocation] = useState(false);
  const [, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [monthlyIncomeBySubsidiary, setMonthlyIncomeBySubsidiary] = useState({});
  const [formValues, setFormValues] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    postalCode: '',
    status: 'Active',
    phone: '',
    email: '',
    website: '',
    description: '',
  });

  useEffect(() => {
    fetchSubsidiaries();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  useEffect(() => {
    if (showAddModal) {
      setSubmitError('');
      initializeLocationData(locationForm.country || DEFAULT_COUNTRY);
    }
  }, [showAddModal]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSubsidiaries = async () => {
    setLoading(true);
    try {
      const response = await apiService.getSubsidiaries();
      const data = response?.data || [];
      const rows = Array.isArray(data) ? data : [];
      setSubsidiaries(rows);
      await loadMonthlyIncomeBySubsidiary(rows);
    } catch (error) {
      console.error('Error fetching subsidiaries:', error);
      setSubsidiaries([]);
      setMonthlyIncomeBySubsidiary({});
      showToast('Failed to load subsidiaries.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyIncomeBySubsidiary = async (subsidiaryRows = []) => {
    if (!Array.isArray(subsidiaryRows) || subsidiaryRows.length === 0) {
      setMonthlyIncomeBySubsidiary({});
      return;
    }

    const { startDate, endDate } = getCurrentMonthRange();
    try {
      const response = await apiService.getIncomes({
        page: 1,
        limit: 5000,
        startDate,
        endDate,
      });

      const rows = Array.isArray(response?.data) ? response.data : [];
      const totals = rows.reduce((acc, income) => {
        const subsidiaryId = income?.subsidiaryId;
        if (!subsidiaryId) return acc;
        acc[subsidiaryId] = (acc[subsidiaryId] || 0) + Number(income.amount || 0);
        return acc;
      }, {});

      setMonthlyIncomeBySubsidiary(totals);
    } catch (_error) {
      setMonthlyIncomeBySubsidiary({});
    }
  };

  const resolveLogoUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;

    const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';
    const origin = apiBase.replace(/\/api(\/v1)?\/?$/i, '');
    return `${origin}${url}`;
  };

  const filteredSubsidiaries = subsidiaries.filter(s => {
    if (isMainCompanyMode && String(s.code || '').toUpperCase() !== 'MAIN') {
      return false;
    }

    const name = s.name || '';
    const city = s.city || '';
    const country = s.country || '';
    const matchesSearch = 
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCountry = selectedCountry === 'all' || country === selectedCountry;
    return matchesSearch && matchesCountry;
  });

  const mainCompany = subsidiaries.find((item) => String(item.code || '').toUpperCase() === 'MAIN') || null;
  const subsidiaryUnits = subsidiaries.filter((item) => String(item.code || '').toUpperCase() !== 'MAIN');

  const totalEmployeesAll = subsidiaries.reduce((sum, item) => sum + (item.employeeCount || 0), 0);
  const mainMonthlyIncome = mainCompany ? Number(monthlyIncomeBySubsidiary[mainCompany.id] || 0) : 0;

  const countries = [...new Set(subsidiaries.map((s) => s.country).filter(Boolean))];

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleOpenAddModal = () => {
    if (isMainCompanyMode) {
      const existingMain = subsidiaries.find((item) => String(item.code || '').toUpperCase() === 'MAIN');
      if (existingMain) {
        handleOpenEditModal(existingMain);
        return;
      }
    }

    setEditingSubsidiaryId(null);
    setSubmitError('');
    setFormValues({
      name: '',
      code: isMainCompanyMode ? 'MAIN' : '',
      address: '',
      city: '',
      postalCode: '',
      status: 'Active',
      phone: '',
      email: '',
      website: '',
      description: '',
    });
    setLocationForm({
      country: DEFAULT_COUNTRY,
      state: '',
    });
    setSameAsMainLocation(false);
    setLogoFile(null);
    setLogoPreview('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (subsidiary) => {
    setEditingSubsidiaryId(subsidiary.id);
    setSubmitError('');
    setFormValues({
      name: subsidiary.name || '',
      code: subsidiary.code || '',
      address: subsidiary.address || '',
      city: subsidiary.city || '',
      postalCode: subsidiary.postalCode || '',
      status: resolveStatus(subsidiary) === 'inactive' ? 'Inactive' : 'Active',
      phone: subsidiary.phone || '',
      email: subsidiary.email || '',
      website: subsidiary.website || '',
      description: subsidiary.description || '',
    });
    setLocationForm({
      country: subsidiary.country || DEFAULT_COUNTRY,
      state: subsidiary.state || '',
    });
    setSameAsMainLocation(Boolean(subsidiary.sameAsMainLocation));
    setLogoFile(null);
    setLogoPreview(resolveLogoUrl(subsidiary.logoUrl));
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingSubsidiaryId(null);
    setLogoFile(null);
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoPreview('');
  };

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0] || null;
    setLogoFile(file);

    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview);
    }

    setLogoPreview(file ? URL.createObjectURL(file) : '');
  };

  const handleSubmitSubsidiary = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    const payload = {
      name: formValues.name.trim(),
      code: (isMainCompanyMode ? 'MAIN' : formValues.code).trim(),
      description: formValues.description.trim(),
      status: formValues.status,
      country: locationForm.country,
      state: locationForm.state,
      city: formValues.city.trim(),
      address: formValues.address.trim(),
      postalCode: formValues.postalCode.trim(),
      phone: formValues.phone.trim(),
      email: formValues.email.trim(),
      website: formValues.website.trim(),
      sameAsMainLocation: isMainCompanyMode ? false : sameAsMainLocation,
    };

    if (!payload.name || !payload.code) {
      const message = 'Subsidiary name and code are required.';
      setSubmitError(message);
      showToast(message, 'error');
      setSubmitting(false);
      return;
    }

    try {
      const submissionPayload = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        submissionPayload.append(key, value ?? '');
      });
      if (logoFile) {
        submissionPayload.append('logo', logoFile);
      }

      if (editingSubsidiaryId) {
        await apiService.updateSubsidiary(editingSubsidiaryId, submissionPayload);
        showToast('Subsidiary updated successfully.', 'success');
      } else {
        await apiService.createSubsidiary(submissionPayload);
        showToast('Subsidiary created successfully.', 'success');
      }

      closeModal();
      await fetchSubsidiaries();
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to save subsidiary. Please try again.';
      setSubmitError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const resolveStatus = (subsidiary) => {
    if (subsidiary?.status) return String(subsidiary.status).toLowerCase();
    if (typeof subsidiary?.isActive === 'boolean') return subsidiary.isActive ? 'active' : 'inactive';
    return 'inactive';
  };

  const getMainLocationCandidate = () => {
    const byCodeMain = subsidiaries.find((item) => String(item.code || '').toUpperCase() === 'MAIN');
    if (byCodeMain) return byCodeMain;

    return subsidiaries.find((item) => Boolean(item.address || item.city || item.state || item.postalCode));
  };

  const handleSameAsMainLocationChange = async (event) => {
    const checked = event.target.checked;
    setSameAsMainLocation(checked);

    if (!checked) {
      return;
    }

    const mainLocation = getMainLocationCandidate();
    if (!mainLocation) {
      const nextCode = String(formValues.code || '').trim().toUpperCase();
      if (nextCode === 'MAIN') {
        setSubmitError('You are setting up MAIN. Enter its location manually; "Same as main location" is for other subsidiaries.');
      } else {
        setSubmitError('Main location not found. Create or update a subsidiary with code MAIN and location details first.');
      }
      setSameAsMainLocation(false);
      return;
    }

    const mainCountry = mainLocation.country || DEFAULT_COUNTRY;
    setFormValues((prev) => ({
      ...prev,
      address: mainLocation.address || '',
      city: mainLocation.city || '',
      postalCode: mainLocation.postalCode || '',
    }));

    setLocationForm((prev) => ({
      ...prev,
      country: mainCountry,
      state: mainLocation.state || '',
    }));

    await fetchStatesByCountry(mainCountry);
  };

  const fetchCountries = async () => {
    setCountryLoading(true);
    try {
      const response = await fetch('https://restcountries.com/v3.1/all?fields=name');
      if (!response.ok) throw new Error('Failed to fetch countries');

      const countriesData = await response.json();
      const names = countriesData
        .map((country) => country?.name?.common)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      if (!names.includes(DEFAULT_COUNTRY)) {
        names.unshift(DEFAULT_COUNTRY);
      }

      setCountryOptions([...new Set(names)]);
      return names;
    } catch (error) {
      setCountryOptions([DEFAULT_COUNTRY]);
      setLocationError('Unable to load country list. Using Nigeria only.');
      return [DEFAULT_COUNTRY];
    } finally {
      setCountryLoading(false);
    }
  };

  const fetchStatesByCountry = async (countryName) => {
    setStateLoading(true);
    try {
      const response = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ country: countryName }),
      });

      if (!response.ok) throw new Error('Failed to fetch states');

      const payload = await response.json();
      const states = (payload?.data?.states || [])
        .map((item) => item?.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      setStateOptions(states);
      setLocationForm((prev) => ({
        ...prev,
        state: states.includes(prev.state) ? prev.state : (states[0] || ''),
      }));
    } catch (error) {
      setStateOptions([]);
      setLocationForm((prev) => ({
        ...prev,
        state: '',
      }));
      setLocationError(`Unable to load states for ${countryName}.`);
    } finally {
      setStateLoading(false);
    }
  };

  const initializeLocationData = async (initialCountry = DEFAULT_COUNTRY) => {
    setLocationError('');
    await fetchCountries();
    await fetchStatesByCountry(initialCountry);
    setLocationForm((prev) => ({
      ...prev,
      country: initialCountry,
    }));
  };

  const handleCountryChange = async (event) => {
    const nextCountry = event.target.value;
    setLocationError('');
    setLocationForm((prev) => ({
      ...prev,
      country: nextCountry,
      state: '',
    }));

    await fetchStatesByCountry(nextCountry);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">{isMainCompanyMode ? 'Main Company Setup' : 'Subsidiaries'}</h1>
        <div className="flex items-center space-x-3">
          <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </button>
          <button
            onClick={handleOpenAddModal}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isMainCompanyMode ? 'Setup Main Company' : 'Add Subsidiary'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Main Company</p>
              <p className="text-2xl font-bold text-gray-800">{mainCompany ? '1' : '0'}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <Building2 className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Subsidiary Units</p>
              <p className="text-2xl font-bold text-gray-800">{subsidiaryUnits.length}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Truck className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Employees (All Units)</p>
              <p className="text-2xl font-bold text-gray-800">
                {totalEmployeesAll}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Main Monthly Income</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatCurrency(mainMonthlyIncome)}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-yellow-600" />
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
              placeholder="Search subsidiaries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Countries</option>
            {countries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>

          <button
            onClick={fetchSubsidiaries}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Subsidiaries Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubsidiaries.map((subsidiary) => (
            <div
              key={subsidiary.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{subsidiary.name}</h3>
                      <p className="text-sm text-gray-500">{subsidiary.code}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    {[subsidiary.address, subsidiary.city, subsidiary.country].filter(Boolean).join(', ') || 'No location set'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="h-4 w-4 mr-2" />
                    {subsidiary.phone}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="h-4 w-4 mr-2" />
                    {subsidiary.email}
                  </div>
                  {subsidiary.website && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Globe className="h-4 w-4 mr-2" />
                      <a href={subsidiary.website} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">
                        {subsidiary.website}
                      </a>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(resolveStatus(subsidiary))}`}>
                    {resolveStatus(subsidiary)}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {subsidiary.vehicleCount || 0} vehicles
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500">Employees</p>
                    <p className="text-lg font-semibold text-gray-900">{subsidiary.employeeCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Monthly Income</p>
                    <p className="text-lg font-semibold text-green-600">
                      {formatCurrency(monthlyIncomeBySubsidiary[subsidiary.id] || 0)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => setSelectedSubsidiary(subsidiary)}
                    className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 flex items-center justify-center"
                  >
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Analytics
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(subsidiary)}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredSubsidiaries.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-lg">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{isMainCompanyMode ? 'Main company not set' : 'No subsidiaries found'}</h3>
              <p className="text-gray-500 mb-4">{isMainCompanyMode ? 'Create your MAIN company record to enable location inheritance.' : 'Get started by adding your first subsidiary'}</p>
              <button
                onClick={handleOpenAddModal}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 inline-flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isMainCompanyMode ? 'Setup Main Company' : 'Add Subsidiary'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">
                {editingSubsidiaryId ? (isMainCompanyMode ? 'Edit Main Company' : 'Edit Subsidiary') : (isMainCompanyMode ? 'Setup Main Company' : 'Add New Subsidiary')}
              </h2>
            </div>
            <form className="p-6 space-y-4" onSubmit={handleSubmitSubsidiary}>
              {isMainCompanyMode && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={logoPreview || tempMainLogo}
                      alt="Main company logo preview"
                      className="h-16 w-16 rounded-lg border border-red-200 bg-white object-contain p-1"
                    />
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Main Company Logo</label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleLogoChange}
                        className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-2 file:text-white hover:file:bg-red-700"
                      />
                      <p className="mt-1 text-xs text-gray-600">
                        Upload logo during Main Company setup. If none is uploaded, a temporary logo is used.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subsidiary Name *
                  </label>
                  <input
                    name="name"
                    type="text"
                    value={formValues.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="e.g., MAPSI North America"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code *
                  </label>
                  <input
                    name="code"
                    type="text"
                    value={formValues.code}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="e.g., MAPSI-NA"
                    disabled={isMainCompanyMode}
                    required
                  />
                  {isMainCompanyMode && (
                    <p className="text-xs text-gray-500 mt-1">Main Company setup uses fixed code MAIN.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  name="description"
                  type="text"
                  value={formValues.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Optional short description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <input
                  name="address"
                  type="text"
                  value={formValues.address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Street address"
                  disabled={sameAsMainLocation}
                />
              </div>

              {!isMainCompanyMode && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={sameAsMainLocation}
                    onChange={handleSameAsMainLocationChange}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Same as main location
                  </span>
                </label>
              )}

              {!isMainCompanyMode && sameAsMainLocation && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  Location fields are synced from the main subsidiary location.
                </p>
              )}

              {(!sameAsMainLocation || isMainCompanyMode) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country
                  </label>
                  <select
                    value={locationForm.country}
                    onChange={handleCountryChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={countryLoading}
                  >
                    {countryLoading ? (
                      <option value="">Loading countries...</option>
                    ) : (
                      countryOptions.map((countryName) => (
                        <option key={countryName} value={countryName}>{countryName}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State/Province
                  </label>
                  <select
                    value={locationForm.state}
                    onChange={(event) => setLocationForm((prev) => ({ ...prev, state: event.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={stateLoading}
                  >
                    {stateLoading ? (
                      <option value="">Loading states...</option>
                    ) : (
                      <>
                        <option value="">Select state</option>
                        {stateOptions.map((stateName) => (
                          <option key={stateName} value={stateName}>{stateName}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City/Town
                  </label>
                  <input
                    name="city"
                    type="text"
                    value={formValues.city}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP/Postal Code
                  </label>
                  <input
                    name="postalCode"
                    type="text"
                    value={formValues.postalCode}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formValues.status}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>

              {locationError && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {locationError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    value={formValues.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={formValues.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <input
                  name="website"
                  type="url"
                  value={formValues.website}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="https://"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  {isMainCompanyMode
                    ? (submitting ? 'Saving...' : 'Save')
                    : (submitting ? (editingSubsidiaryId ? 'Saving...' : 'Adding...') : (editingSubsidiaryId ? 'Save Changes' : 'Add Subsidiary'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subsidiaries;
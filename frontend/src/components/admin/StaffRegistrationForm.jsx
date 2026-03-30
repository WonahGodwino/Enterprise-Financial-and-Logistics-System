import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Building2, Calendar, Loader2, Mail, Phone, PlusCircle, ShieldCheck, UserPlus } from 'lucide-react';
import api from '../../services/api';
import RichTextEditor from '../common/RichTextEditor';
import { useAuth } from '../../context/AuthContext';

const ROLE_OPTIONS = ['EMPLOYEE', 'SUPERVISOR', 'MANAGER', 'ACCOUNTANT', 'AUDITOR', 'HR', 'VIEWER', 'DRIVER', 'CHIEF_DRIVER', 'ADMIN', 'CEO', 'SUPER_ADMIN'];

const initialFormState = {
  fullName: '',
  email: '',
  password: '',
  role: 'EMPLOYEE',
  department: '',
  employeeId: '',
  phoneNumber: '',
  employmentDate: '',
  subsidiaryId: '',
  subsidiaryAccess: [],
  positionId: '',
  isActive: true,
};

const initialPositionState = {
  name: '',
  jobDescription: '',
  subsidiaryIds: [],
};

const formatSubsidiaryLabel = (subsidiary) => {
  if (!subsidiary) return 'Unknown subsidiary';
  if (String(subsidiary.code || '').toUpperCase() === 'MAIN') {
    return `${subsidiary.name} (Main)`;
  }
  return subsidiary.code ? `${subsidiary.name} (${subsidiary.code})` : subsidiary.name;
};

const formatDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const StaffRegistrationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const isEditMode = Boolean(id);
  const positionResetRef = useRef(false);

  const [formData, setFormData] = useState(initialFormState);
  const [positionForm, setPositionForm] = useState(initialPositionState);
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loadingSubsidiaries, setLoadingSubsidiaries] = useState(true);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [loadingUser, setLoadingUser] = useState(isEditMode);
  const [savingUser, setSavingUser] = useState(false);
  const [savingPosition, setSavingPosition] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const selectedSubsidiary = useMemo(
    () => subsidiaries.find((subsidiary) => subsidiary.id === formData.subsidiaryId) || null,
    [subsidiaries, formData.subsidiaryId],
  );

  const roleOptions = useMemo(() => {
    if (String(currentUser?.role || '').toUpperCase() === 'ADMIN') {
      return ROLE_OPTIONS.filter((role) => !['CEO', 'SUPER_ADMIN'].includes(role));
    }
    return ROLE_OPTIONS;
  }, [currentUser?.role]);

  const pageTitle = isEditMode ? 'Edit Staff Account' : 'Staff Onboarding';
  const pageDescription = isEditMode
    ? 'Update the staff subsidiary assignment and keep the selected position valid for that subsidiary scope.'
    : 'Assign a subsidiary first, then select only the positions that are available within that subsidiary scope.';

  const loadSubsidiaries = async () => {
    setLoadingSubsidiaries(true);
    try {
      const response = await api.getSubsidiaries();
      const rows = Array.isArray(response?.data) ? response.data : [];
      setSubsidiaries(rows);
      return rows;
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load subsidiaries.');
      return [];
    } finally {
      setLoadingSubsidiaries(false);
    }
  };

  const loadPositions = async (subsidiaryId) => {
    if (!subsidiaryId) {
      setPositions([]);
      return [];
    }

    setLoadingPositions(true);
    try {
      const response = await api.getPositions({ subsidiaryId });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setPositions(rows);
      return rows;
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load positions for the selected subsidiary.');
      setPositions([]);
      return [];
    } finally {
      setLoadingPositions(false);
    }
  };

  const loadUser = async () => {
    if (!isEditMode || !id) return;

    setLoadingUser(true);
    try {
      const response = await api.getUserById(id);
      const user = response?.data;
      if (!user) {
        setError('Staff record not found.');
        return;
      }

      const nextSubsidiaryId = user.subsidiary?.id || '';
      const nextPositionId = user.positionRecord?.id || user.positionId || '';

      positionResetRef.current = true;
      setFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        password: '',
        role: user.role || 'EMPLOYEE',
        department: user.department || '',
        employeeId: user.employeeId || '',
        phoneNumber: user.phoneNumber || '',
        employmentDate: formatDateInput(user.employmentDate),
        subsidiaryId: nextSubsidiaryId,
        subsidiaryAccess: Array.isArray(user.subsidiaryAccess)
          ? Array.from(new Set([...(user.subsidiaryAccess || []), ...(nextSubsidiaryId ? [nextSubsidiaryId] : [])]))
          : (nextSubsidiaryId ? [nextSubsidiaryId] : []),
        positionId: nextPositionId,
        isActive: Boolean(user.isActive),
      });

      if (nextSubsidiaryId) {
        const availablePositions = await loadPositions(nextSubsidiaryId);
        if (nextPositionId && !availablePositions.some((position) => position.id === nextPositionId)) {
          setFormData((current) => ({ ...current, positionId: '' }));
        }
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load staff record.');
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      const rows = await loadSubsidiaries();
      if (!isEditMode && rows.length > 0) {
        positionResetRef.current = true;
        setFormData((current) => ({
          ...current,
          subsidiaryId: current.subsidiaryId || rows[0].id,
          subsidiaryAccess: current.subsidiaryAccess.length > 0
            ? current.subsidiaryAccess
            : [rows[0].id],
        }));
      }
    };

    run();
  }, [isEditMode]);

  useEffect(() => {
    loadUser();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const currentSubsidiaryId = formData.subsidiaryId;
    if (!currentSubsidiaryId) {
      setPositions([]);
      return;
    }

    const run = async () => {
      const availablePositions = await loadPositions(currentSubsidiaryId);
      setPositionForm((current) => ({
        ...current,
        subsidiaryIds: current.subsidiaryIds.length > 0 ? current.subsidiaryIds : [currentSubsidiaryId],
      }));

      if (positionResetRef.current) {
        positionResetRef.current = false;
        return;
      }

      if (formData.positionId && !availablePositions.some((position) => position.id === formData.positionId)) {
        setFormData((current) => ({ ...current, positionId: '' }));
      }
    };

    run();
  }, [formData.subsidiaryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    positionResetRef.current = name !== 'subsidiaryId';
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
    setSuccessMessage('');
  };

  const handleSubsidiaryAccessToggle = (subsidiaryId) => {
    setFormData((current) => {
      const selected = Array.isArray(current.subsidiaryAccess) ? current.subsidiaryAccess : [];
      const exists = selected.includes(subsidiaryId);
      let nextAccess = exists
        ? selected.filter((idValue) => idValue !== subsidiaryId)
        : [...selected, subsidiaryId];

      if (current.subsidiaryId && !nextAccess.includes(current.subsidiaryId)) {
        nextAccess = [...nextAccess, current.subsidiaryId];
      }

      return {
        ...current,
        subsidiaryAccess: Array.from(new Set(nextAccess)),
      };
    });
  };

  const handleOpenPositionModal = () => {
    if (!formData.subsidiaryId) {
      setError('Select a subsidiary first so the new position can be scoped correctly.');
      return;
    }

    setPositionForm({
      name: '',
      jobDescription: '',
      subsidiaryIds: [formData.subsidiaryId],
    });
    setShowPositionModal(true);
    setError('');
  };

  const handleTogglePositionSubsidiary = (subsidiaryId) => {
    setPositionForm((current) => {
      const exists = current.subsidiaryIds.includes(subsidiaryId);
      return {
        ...current,
        subsidiaryIds: exists
          ? current.subsidiaryIds.filter((itemId) => itemId !== subsidiaryId)
          : [...current.subsidiaryIds, subsidiaryId],
      };
    });
  };

  const handleCreatePosition = async (event) => {
    event.preventDefault();

    if (!positionForm.name.trim()) {
      setError('Position name is required.');
      return;
    }

    if (positionForm.subsidiaryIds.length === 0) {
      setError('Select at least one subsidiary for the position.');
      return;
    }

    setSavingPosition(true);
    try {
      const response = await api.createPosition({
        name: positionForm.name.trim(),
        jobDescription: positionForm.jobDescription.trim(),
        subsidiaryIds: positionForm.subsidiaryIds,
        archived: 0,
      });
      const createdPosition = response?.data;
      const refreshedPositions = await loadPositions(formData.subsidiaryId);
      if (createdPosition?.id && refreshedPositions.some((position) => position.id === createdPosition.id)) {
        positionResetRef.current = true;
        setFormData((current) => ({ ...current, positionId: createdPosition.id }));
      }
      setShowPositionModal(false);
      setSuccessMessage('Position saved and linked to the selected subsidiary scope.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to save position.');
    } finally {
      setSavingPosition(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.subsidiaryId) {
      setError('Full name, email, and subsidiary are required.');
      return;
    }

    if (!isEditMode && !formData.password.trim()) {
      setError('Password is required when creating a staff account.');
      return;
    }

    setSavingUser(true);
    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        role: formData.role,
        department: formData.department.trim(),
        employeeId: formData.employeeId.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        employmentDate: formData.employmentDate || undefined,
        subsidiaryId: formData.subsidiaryId,
        subsidiaryAccess: Array.from(new Set([
          ...(Array.isArray(formData.subsidiaryAccess) ? formData.subsidiaryAccess : []),
          ...(formData.subsidiaryId ? [formData.subsidiaryId] : []),
        ])),
        positionId: formData.positionId || null,
        isActive: formData.isActive,
      };

      if (formData.password.trim()) {
        payload.password = formData.password;
      }

      if (isEditMode && id) {
        await api.updateUser(id, payload);
        setSuccessMessage('Staff account updated successfully.');
      } else {
        await api.createUser(payload);
        setSuccessMessage('Staff member onboarded successfully.');
      }

      navigate('/admin/users');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || (isEditMode ? 'Failed to update staff member.' : 'Failed to onboard staff member.'));
    } finally {
      setSavingUser(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <div className="inline-flex items-center text-sm text-gray-600">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading staff record...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-red-600">Administration</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="mt-1 text-sm text-gray-600">{pageDescription}</p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/admin/users')}
          className="inline-flex items-center rounded-lg border border-amber-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-amber-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </button>
      </div>

      {(error || successMessage) && (
        <div className={`rounded-xl px-4 py-3 text-sm ${error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Full Name</span>
              <div className="relative">
                <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Enter staff full name"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="staff@mapsigroup.com"
                />
              </div>
            </label>

            {!isEditMode && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Password</span>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Temporary password"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Role</span>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Department</span>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder="Department"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Employee ID</span>
              <input
                type="text"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder="MAPSI-EMP-001"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Phone Number</span>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="0800 000 0000"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Employment Date</span>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  name="employmentDate"
                  value={formData.employmentDate}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700">Subsidiary</span>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  name="subsidiaryId"
                  value={formData.subsidiaryId}
                  onChange={(event) => {
                    const nextSubsidiaryId = event.target.value;
                    positionResetRef.current = false;
                    setFormData((current) => {
                      const access = Array.isArray(current.subsidiaryAccess) ? current.subsidiaryAccess : [];
                      return {
                        ...current,
                        subsidiaryId: nextSubsidiaryId,
                        subsidiaryAccess: nextSubsidiaryId
                          ? Array.from(new Set([...access, nextSubsidiaryId]))
                          : access,
                      };
                    });
                    setError('');
                    setSuccessMessage('');
                  }}
                  disabled={loadingSubsidiaries}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">Select subsidiary</option>
                  {subsidiaries.map((subsidiary) => (
                    <option key={subsidiary.id} value={subsidiary.id}>{formatSubsidiaryLabel(subsidiary)}</option>
                  ))}
                </select>
              </div>
            </label>

            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-medium text-gray-700">Additional Subsidiary Access</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {subsidiaries.map((subsidiary) => {
                  const checked = Array.isArray(formData.subsidiaryAccess) && formData.subsidiaryAccess.includes(subsidiary.id);
                  return (
                    <label key={subsidiary.id} className="flex items-center gap-3 rounded-lg border border-amber-200 px-3 py-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleSubsidiaryAccessToggle(subsidiary.id)}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-400"
                      />
                      <span>{formatSubsidiaryLabel(subsidiary)}</span>
                      {formData.subsidiaryId === subsidiary.id ? (
                        <span className="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">Primary</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">One staff can belong to multiple subsidiaries. Primary subsidiary is always included automatically.</p>
            </div>

            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-700">Position</span>
                <button
                  type="button"
                  onClick={handleOpenPositionModal}
                  className="inline-flex items-center rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <PlusCircle className="mr-1.5 h-4 w-4" />
                  Add Position
                </button>
              </div>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  name="positionId"
                  value={formData.positionId}
                  onChange={handleChange}
                  disabled={!formData.subsidiaryId || loadingPositions}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">Select available position</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>{position.name}</option>
                  ))}
                </select>
              </div>
              {!formData.subsidiaryId && (
                <p className="mt-2 text-xs text-gray-500">Select a subsidiary before choosing or adding a position.</p>
              )}
              {formData.subsidiaryId && !loadingPositions && positions.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">No active position is currently available in this subsidiary. Use Add Position to register one.</p>
              )}
            </div>

            {isEditMode && (
              <label className="flex items-center gap-3 rounded-lg border border-amber-200 px-3 py-3 text-sm text-gray-700 md:col-span-2">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-400"
                />
                <span>Keep this staff account active</span>
              </label>
            )}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={savingUser || loadingSubsidiaries || loadingUser}
              className="inline-flex items-center rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {isEditMode ? 'Save Staff Account' : 'Create Staff Account'}
            </button>
          </div>
        </div>

        <aside className="space-y-4 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Onboarding Scope</h2>
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">Selected Subsidiary</p>
            <p className="mt-1">{selectedSubsidiary ? formatSubsidiaryLabel(selectedSubsidiary) : 'None selected yet'}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">Available Positions</p>
            <p className="mt-1">{loadingPositions ? 'Loading scoped positions...' : `${positions.length} active position(s) in this subsidiary.`}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">Role Access</p>
            <p className="mt-1">Only ADMIN, SUPER_ADMIN, and CEO can register staff or manage position availability.</p>
          </div>
        </aside>
      </form>

      {showPositionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Register Position</h2>
                <p className="mt-1 text-sm text-gray-600">Create a position and map it to one or more subsidiaries, including Main if needed.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPositionModal(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreatePosition} className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Position Name</span>
                <input
                  type="text"
                  value={positionForm.name}
                  onChange={(event) => setPositionForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Strategic Growth & Market Development"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Job Description</span>
                <RichTextEditor
                  value={positionForm.jobDescription}
                  onChange={(value) => setPositionForm((current) => ({ ...current, jobDescription: value }))}
                  placeholder="Describe the role, responsibility, and reporting expectation."
                />
              </label>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Subsidiary Availability</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {subsidiaries.map((subsidiary) => {
                    const checked = positionForm.subsidiaryIds.includes(subsidiary.id);
                    return (
                      <label key={subsidiary.id} className="flex items-center gap-3 rounded-lg border border-amber-200 px-3 py-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleTogglePositionSubsidiary(subsidiary.id)}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-400"
                        />
                        <span>{formatSubsidiaryLabel(subsidiary)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPositionModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPosition}
                  className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingPosition ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Save Position
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffRegistrationForm;
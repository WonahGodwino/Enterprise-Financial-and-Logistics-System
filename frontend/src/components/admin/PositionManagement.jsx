import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Building2, Edit3, Loader2, PlusCircle, RefreshCcw } from 'lucide-react';
import api from '../../services/api';
import RichTextEditor from '../common/RichTextEditor';
import RichTextContent from '../common/RichTextContent';

const initialFormState = {
  id: null,
  name: '',
  jobDescription: '',
  archived: 0,
  subsidiaryIds: [],
};

const formatSubsidiaryLabel = (subsidiary) => {
  if (!subsidiary) return 'Unknown subsidiary';
  if (String(subsidiary.code || '').toUpperCase() === 'MAIN') {
    return `${subsidiary.name} (Main)`;
  }
  return subsidiary.code ? `${subsidiary.name} (${subsidiary.code})` : subsidiary.name;
};

const PositionManagement = () => {
  const [formData, setFormData] = useState(initialFormState);
  const [positions, setPositions] = useState([]);
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [filterSubsidiaryId, setFilterSubsidiaryId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadSubsidiaries = async () => {
    const response = await api.getSubsidiaries();
    setSubsidiaries(Array.isArray(response?.data) ? response.data : []);
  };

  const loadPositions = async (subsidiaryId = filterSubsidiaryId) => {
    const response = await api.getPositions({
      includeArchived: true,
      subsidiaryId: subsidiaryId !== 'all' ? subsidiaryId : undefined,
    });
    setPositions(Array.isArray(response?.data) ? response.data : []);
  };

  const refreshData = async (subsidiaryId = filterSubsidiaryId) => {
    setLoading(true);
    try {
      setError('');
      await Promise.all([loadSubsidiaries(), loadPositions(subsidiaryId)]);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load position registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        setError('');
        const [subsidiaryResponse, positionResponse] = await Promise.all([
          api.getSubsidiaries(),
          api.getPositions({ includeArchived: true }),
        ]);
        setSubsidiaries(Array.isArray(subsidiaryResponse?.data) ? subsidiaryResponse.data : []);
        setPositions(Array.isArray(positionResponse?.data) ? positionResponse.data : []);
      } catch (requestError) {
        setError(requestError?.response?.data?.message || 'Failed to load position registry.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  useEffect(() => {
    if (loading) return;

    const run = async () => {
      try {
        const response = await api.getPositions({
          includeArchived: true,
          subsidiaryId: filterSubsidiaryId !== 'all' ? filterSubsidiaryId : undefined,
        });
        setPositions(Array.isArray(response?.data) ? response.data : []);
      } catch (requestError) {
        setError(requestError?.response?.data?.message || 'Failed to load position registry.');
      }
    };

    run();
  }, [filterSubsidiaryId, loading]);

  const selectedCountLabel = useMemo(() => {
    const activeCount = positions.filter((position) => Number(position.archived) === 0).length;
    return `${activeCount} active / ${positions.length} total`;
  }, [positions]);

  const handleToggleSubsidiary = (subsidiaryId) => {
    setFormData((current) => {
      const exists = current.subsidiaryIds.includes(subsidiaryId);
      return {
        ...current,
        subsidiaryIds: exists
          ? current.subsidiaryIds.filter((id) => id !== subsidiaryId)
          : [...current.subsidiaryIds, subsidiaryId],
      };
    });
  };

  const handleEdit = (position) => {
    setFormData({
      id: position.id,
      name: position.name || '',
      jobDescription: position.jobDescription || '',
      archived: Number(position.archived) === 1 ? 1 : 0,
      subsidiaryIds: Array.isArray(position.subsidiaries) ? position.subsidiaries.map((item) => item.subsidiaryId) : [],
    });
    setError('');
    setSuccessMessage('');
  };

  const handleReset = () => {
    setFormData(initialFormState);
    setError('');
    setSuccessMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      setError('Position name is required.');
      return;
    }

    if (formData.subsidiaryIds.length === 0) {
      setError('Select at least one subsidiary for this position.');
      return;
    }

    setSaving(true);
    try {
      const isEditing = Boolean(formData.id);
      const positionName = formData.name.trim();
      const payload = {
        name: positionName,
        jobDescription: formData.jobDescription.trim(),
        archived: formData.archived,
        subsidiaryIds: formData.subsidiaryIds,
      };

      if (isEditing) {
        await api.updatePosition(formData.id, payload);
      } else {
        await api.createPosition(payload);
      }

      await refreshData();
      setFormData(initialFormState);
      setError('');
      setSuccessMessage(
        isEditing
          ? `Position "${positionName}" updated successfully.`
          : `Position "${positionName}" created successfully.`
      );
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to save position.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePosition = async (position) => {
    const positionName = String(position?.name || 'this position');
    const confirmed = window.confirm(`Delete "${positionName}"? This will be a soft delete and can be restored later.`);
    if (!confirmed) return;

    try {
      await api.updatePosition(position.id, {
        archived: 1,
        subsidiaryIds: Array.isArray(position.subsidiaries) ? position.subsidiaries.map((item) => item.subsidiaryId) : [],
      });
      await refreshData();
      setError('');
      setSuccessMessage(`Position "${positionName}" deleted successfully.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to delete position.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-red-600">Administration</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Position Registry</h1>
          <p className="mt-1 text-sm text-gray-600">Define positions once, then map them to Main and any subsidiaries where they are available for staff onboarding.</p>
        </div>

        <button
          type="button"
          onClick={() => refreshData()}
          className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh Registry
        </button>
      </div>

      {(error || successMessage) && (
        <div className={`rounded-xl px-4 py-3 text-sm ${error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || successMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">{formData.id ? 'Edit Position' : 'Register Position'}</h2>
            {formData.id && (
              <button type="button" onClick={handleReset} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                Clear
              </button>
            )}
          </div>

          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Position Name</span>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder="Operational Support"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Job Description</span>
              <RichTextEditor
                value={formData.jobDescription}
                onChange={(value) => setFormData((current) => ({ ...current, jobDescription: value }))}
                placeholder="Describe the remit, outputs, and accountability for this position."
              />
            </label>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Availability Scope</p>
              <div className="space-y-2">
                {subsidiaries.map((subsidiary) => (
                  <label key={subsidiary.id} className="flex items-center gap-3 rounded-lg border border-amber-200 px-3 py-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.subsidiaryIds.includes(subsidiary.id)}
                      onChange={() => handleToggleSubsidiary(subsidiary.id)}
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-400"
                    />
                    <span>{formatSubsidiaryLabel(subsidiary)}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-amber-200 px-3 py-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Number(formData.archived) === 1}
                onChange={(event) => setFormData((current) => ({ ...current, archived: event.target.checked ? 1 : 0 }))}
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-400"
              />
              <span>Archive this position</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              {formData.id ? 'Save Position' : 'Register Position'}
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Registered Positions</h2>
              <p className="mt-1 text-sm text-gray-600">{selectedCountLabel}</p>
            </div>

            <select
              value={filterSubsidiaryId}
              onChange={(event) => setFilterSubsidiaryId(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
            >
              <option value="all">All accessible subsidiaries</option>
              {subsidiaries.map((subsidiary) => (
                <option key={subsidiary.id} value={subsidiary.id}>{formatSubsidiaryLabel(subsidiary)}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center px-6 py-16 text-sm text-gray-500">Loading positions...</div>
          ) : positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-gray-500">
              <Briefcase className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-base font-medium text-gray-700">No positions available</p>
              <p className="mt-1 text-sm">Register the first scoped position from the form on the left.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {positions.map((position) => {
                const isArchived = Number(position.archived) === 1;
                return (
                  <article key={position.id} className="rounded-xl border border-amber-200 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900">{position.name}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isArchived ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700'}`}>
                            {isArchived ? 'Inactive' : 'Active'}
                          </span>
                        </div>
                        <div className="mt-2">
                          <RichTextContent html={position.jobDescription} />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {position.subsidiaries?.map((entry) => (
                            <span key={`${position.id}-${entry.subsidiaryId}`} className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-gray-700">
                              <Building2 className="mr-1.5 h-3.5 w-3.5 text-gray-400" />
                              {formatSubsidiaryLabel(entry.subsidiary)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => handleEdit(position)}
                          className="inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                        >
                          <Edit3 className="mr-2 h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePosition(position)}
                          disabled={isArchived}
                          className="inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isArchived ? 'Deleted' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PositionManagement;
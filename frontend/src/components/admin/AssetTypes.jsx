import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';

const ASSET_TYPE_MANAGER_ROLES = new Set(['ADMIN', 'CEO', 'SUPER_ADMIN']);

const AssetTypes = () => {
  const { user } = useAuth();
  const { mode } = useTheme();
  const { showToast } = useToast();
  const [assetTypes, setAssetTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '' });

  const canManage = ASSET_TYPE_MANAGER_ROLES.has(String(user?.role || '').toUpperCase());

  useEffect(() => { fetchAssetTypes(); }, []);

  const fetchAssetTypes = async () => {
    setLoading(true);
    try {
      const response = await api.getAssetTypes({ includeInactive: true });
      setAssetTypes(response?.data || []);
    } catch (err) {
      console.error('Error fetching asset types:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingType(null);
    setForm({ name: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (assetType) => {
    setEditingType(assetType);
    setForm({ name: assetType.name });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingType(null);
    setForm({ name: '' });
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = String(form.name || '').trim();
    if (!trimmedName) {
      setError('Asset type name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (editingType) {
        await api.updateAssetType(editingType.id, { name: trimmedName });
        showToast('Asset type updated successfully.', 'success');
      } else {
        await api.createAssetType({ name: trimmedName });
        showToast('Asset type created successfully.', 'success');
      }
      closeModal();
      await fetchAssetTypes();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save asset type.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (assetType) => {
    try {
      await api.updateAssetType(assetType.id, { isActive: !assetType.isActive });
      showToast(`Asset type ${assetType.isActive ? 'deactivated' : 'activated'}.`, 'success');
      await fetchAssetTypes();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update status.', 'error');
    }
  };

  if (!canManage) {
    return (
      <div className={`rounded-lg p-8 text-center shadow ${mode === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-white text-gray-500'}`}>
        <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="mt-1 text-sm">Only ADMIN, CEO, and SUPER_ADMIN can manage vehicle asset types.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>Setup Car Model</h1>
          <p className={`mt-1 text-sm ${mode === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Manage car models (asset types) available during vehicle registration.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Add New Car Model
        </button>
      </div>

      <div className={`rounded-lg shadow overflow-hidden ${mode === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
        {loading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-red-600" />
          </div>
        ) : assetTypes.length === 0 ? (
          <div className={`px-6 py-16 text-center ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
            <p className="text-lg font-medium">No car models defined</p>
            <p className="mt-1 text-sm">Add car models like "SIENNA", "COROLLA", "HILUX", etc.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-red-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${mode === 'dark' ? 'divide-slate-700' : 'divide-gray-200'}`}>
                {assetTypes.map((at) => (
                  <tr key={at.id} className={mode === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}>
                    <td className={`px-6 py-4 font-medium ${mode === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>{at.name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${at.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {at.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                      {at.createdAt ? new Date(at.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(at)}
                          className="rounded p-1 text-blue-600 hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(at)}
                          className={`rounded p-1 ${at.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                          title={at.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {at.isActive ? <X className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`w-full max-w-md rounded-xl shadow-2xl ${mode === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`flex items-center justify-between border-b px-6 py-4 ${mode === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <h2 className={`text-lg font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {editingType ? 'Edit Car Model' : 'Add New Car Model'}
              </h2>
              <button type="button" onClick={closeModal} className={`rounded p-1 ${mode === 'dark' ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <label className={`block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                Car Model Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-700 text-white placeholder:text-slate-400' : 'border-gray-300 text-gray-900'}`}
                  placeholder="e.g. HILUX, CAMRY, SIENNA"
                  required
                />
              </label>

              {error && (
                <p className={`rounded-md px-3 py-2 text-sm ${mode === 'dark' ? 'bg-red-900/60 text-red-200' : 'bg-red-50 text-red-700'}`}>{error}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={closeModal} className={`rounded-lg border px-4 py-2 text-sm ${mode === 'dark' ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : editingType ? 'Update' : 'Add Car Model'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetTypes;
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../../services/api';

const IncomeMyRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'PENDING_APPROVAL').length;
    const approved = requests.filter((r) => r.status === 'APPROVED').length;
    const rejected = requests.filter((r) => r.status === 'REJECTED').length;
    return { pending, approved, rejected };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (pendingOnly && req.status !== 'PENDING_APPROVAL') return false;

      if (startDate || endDate) {
        if (!req.requestedAt) return false;
        const requested = new Date(req.requestedAt);

        if (startDate) {
          const start = new Date(`${startDate}T00:00:00`);
          if (requested < start) return false;
        }

        if (endDate) {
          const end = new Date(`${endDate}T23:59:59`);
          if (requested > end) return false;
        }
      }

      return true;
    });
  }, [requests, pendingOnly, startDate, endDate]);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getMyIncomeModificationRequests();
      setRequests(response?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load your modification requests');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">My Income Modification</h1>
        <button
          onClick={loadRequests}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg bg-amber-50 p-4">
          <p className="text-sm text-amber-700">Pending</p>
          <p className="text-xl font-semibold text-amber-900">{stats.pending}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">Approved</p>
          <p className="text-xl font-semibold text-emerald-900">{stats.approved}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-sm text-red-700">Rejected</p>
          <p className="text-xl font-semibold text-red-900">{stats.rejected}</p>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
              className="h-4 w-4"
            />
            Pending only
          </label>

          <div>
            <p className="mb-1 text-xs text-gray-500">Start date</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <p className="mb-1 text-xs text-gray-500">End date</p>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setPendingOnly(false);
              setStartDate('');
              setEndDate('');
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Request History</h2>
        <p className="mb-3 text-sm text-gray-500">
          Showing {filteredRequests.length} of {requests.length} request(s)
        </p>

        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No modification requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-red-600">
                <tr className="border-b text-left text-white">
                  <th className="py-2 pr-4">Requested At</th>
                  <th className="py-2 pr-4">Income ID</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Request Reason</th>
                  <th className="py-2 pr-4">Decision By</th>
                  <th className="py-2 pr-4">Decision Role</th>
                  <th className="py-2 pr-4">Decision Reason</th>
                  <th className="py-2 pr-4">Decision At</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="border-b align-top">
                    <td className="py-2 pr-4">{req.requestedAt ? new Date(req.requestedAt).toLocaleString() : '-'}</td>
                    <td className="py-2 pr-4">{req.incomeId}</td>
                    <td className="py-2 pr-4">{req.status}</td>
                    <td className="py-2 pr-4">{req.modificationReason || '-'}</td>
                    <td className="py-2 pr-4">{req.decidedBy?.fullName || '-'}</td>
                    <td className="py-2 pr-4">{req.decidedBy?.role || '-'}</td>
                    <td className="py-2 pr-4">{req.decisionReason || '-'}</td>
                    <td className="py-2 pr-4">{req.decidedAt ? new Date(req.decidedAt).toLocaleString() : '-'}</td>
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

export default IncomeMyRequests;


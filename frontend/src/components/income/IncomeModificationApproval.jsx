import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

const IncomeModificationApproval = () => {
  const { showToast } = useToast();
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState({});
  const [submittingId, setSubmittingId] = useState('');

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.getPendingIncomeModifications(),
        api.getIncomeModificationHistory(),
      ]);
      setPending(pendingRes?.data || []);
      setHistory(historyRes?.data || []);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to load modification requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitDecision = async (requestId, decision) => {
    const approvalReason = notes[requestId]?.trim();
    if (!approvalReason) {
      showToast('Approval/rejection reason is required', 'error');
      return;
    }

    setSubmittingId(requestId);

    try {
      await api.approveIncomeModification(requestId, {
        decision,
        approvalReason,
      });
      showToast(`Request ${decision === 'APPROVE' ? 'approved' : 'rejected'} successfully.`, 'success');
      setNotes((prev) => ({ ...prev, [requestId]: '' }));
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to submit decision', 'error');
    } finally {
      setSubmittingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Income Modification Approval</h1>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Pending Requests</h2>

        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading pending requests...</div>
        ) : pending.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No pending modification requests.</div>
        ) : (
          <div className="space-y-4">
            {pending.map((item) => {
              const payload = item.newValue || {};
              const requestedBy = payload.requestedBy?.fullName || 'Unknown user';
              const requestedAt = payload.requestedAt ? new Date(payload.requestedAt).toLocaleString() : '-';
              const changes = payload.changes || {};

              return (
                <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">Income ID:</span> {item.entityId}
                  </div>
                  <div className="mb-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">Requested By:</span> {requestedBy}
                  </div>
                  <div className="mb-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">Requested At:</span> {requestedAt}
                  </div>
                  <div className="mb-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">Reason:</span> {payload.modificationReason || '-'}
                  </div>

                  <div className="mb-3 rounded bg-gray-50 p-3 text-xs text-gray-700 overflow-auto">
                    <pre>{JSON.stringify(changes, null, 2)}</pre>
                  </div>

                  <textarea
                    value={notes[item.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="State reason for approval or rejection"
                    className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    rows={2}
                  />

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => submitDecision(item.id, 'APPROVE')}
                      disabled={submittingId === item.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => submitDecision(item.id, 'REJECT')}
                      disabled={submittingId === item.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Approval History</h2>

        {history.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No approval history yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-red-600">
                <tr className="border-b text-left text-white">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Income ID</th>
                  <th className="py-2 pr-4">Decision</th>
                  <th className="py-2 pr-4">By</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const meta = entry.newValue || {};
                  const person = meta.approvedBy || meta.rejectedBy || {};
                  const decision = meta.decision || (entry.action.includes('APPROVED') ? 'APPROVE' : 'REJECT');

                  return (
                    <tr key={entry.id} className="border-b">
                      <td className="py-2 pr-4">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}</td>
                      <td className="py-2 pr-4">{entry.entityId}</td>
                      <td className="py-2 pr-4">{decision}</td>
                      <td className="py-2 pr-4">{person.fullName || '-'}</td>
                      <td className="py-2 pr-4">{person.role || '-'}</td>
                      <td className="py-2 pr-4">{meta.approvalReason || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default IncomeModificationApproval;


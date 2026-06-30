import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Filter, Search, ChevronLeft, ChevronRight, User, FileText } from 'lucide-react';
import apiService from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const ACTION_COLORS_LIGHT = {
  CREATE: 'bg-blue-100 text-blue-800',
  UPDATE: 'bg-amber-100 text-amber-800',
  APPROVE: 'bg-green-100 text-green-800',
  REJECT: 'bg-red-100 text-red-800',
  COMPLETE: 'bg-emerald-100 text-emerald-800',
  DELETE: 'bg-red-100 text-red-800',
  SOFT_DELETE: 'bg-orange-100 text-orange-800',
  EXPENSE_MODIFICATION_REQUEST: 'bg-indigo-100 text-indigo-800',
  EXPENSE_MODIFICATION_APPROVED: 'bg-green-100 text-green-800',
  EXPENSE_MODIFICATION_REJECTED: 'bg-red-100 text-red-800',
};

const ACTION_COLORS_DARK = {
  CREATE: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  UPDATE: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  APPROVE: 'bg-green-500/20 text-green-300 border border-green-500/30',
  REJECT: 'bg-red-500/20 text-red-300 border border-red-500/30',
  COMPLETE: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  DELETE: 'bg-red-500/20 text-red-300 border border-red-500/30',
  SOFT_DELETE: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  EXPENSE_MODIFICATION_REQUEST: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  EXPENSE_MODIFICATION_APPROVED: 'bg-green-500/20 text-green-300 border border-green-500/30',
  EXPENSE_MODIFICATION_REJECTED: 'bg-red-500/20 text-red-300 border border-red-500/30',
};

const getActionColor = (action, mode) => {
  const palette = mode === 'dark' ? ACTION_COLORS_DARK : ACTION_COLORS_LIGHT;
  return palette[action] || (mode === 'dark' ? 'bg-slate-600/50 text-slate-200' : 'bg-gray-100 text-gray-800');
};

const TYPE_LABELS = {
  EXPENSE_COMPLETED_WITHOUT_RECEIPT: 'Expense Approved without Receipt',
  EXPENSE_COMPLETED_WITH_RECEIPT: 'Expense Approved with Receipt',
  EXPENSE_MODIFICATION_REQUEST: 'Expense Modification Requested',
  EXPENSE_MODIFICATION_APPROVED: 'Expense Modification Approved',
  EXPENSE_MODIFICATION_REJECTED: 'Expense Modification Rejected',
  EXPENSE_REJECTED: 'Expense Rejected',
  INCOME_CREATED: 'Income Recorded',
  CUSTOMER_CREATED: 'Customer Created',
  USER_CREATED: 'User Created',
};

const FRIENDLY_FIELD_LABELS = {
  item: 'Item',
  amount: 'Amount',
  type: 'Transaction Type',
  message: 'System Message',
  actorMessage: 'Actor Message',
  requestedBy: 'Requested By',
  approvedBy: 'Approved By',
  rejectedBy: 'Rejected By',
  completedBy: 'Completed By',
  modifiedBy: 'Modified By',
  createdAt: 'Created On',
  updatedAt: 'Updated On',
  operationDate: 'Operation Date',
  description: 'Description',
  reason: 'Reason',
  status: 'Status',
  entityId: 'Reference ID',
};

const formatActorName = (actor) => {
  if (!actor) return 'System';
  if (actor.fullName) return actor.fullName;
  const composed = [actor.firstName, actor.lastName].filter(Boolean).join(' ');
  return composed || actor.email || 'Unknown User';
};

const formatRoleLabel = (role) => {
  if (!role) return '';
  return String(role).replaceAll('_', ' ');
};

const safeString = (value) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch (_err) {
    return '-';
  }
};

const parseStructuredValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;

  try {
    return JSON.parse(value);
  } catch (_err) {
    return null;
  }
};

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || amount === '') return '-';
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return String(amount);
  return numeric.toLocaleString('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  });
};

const humanizeKey = (key) => {
  if (!key) return '-';
  if (FRIENDLY_FIELD_LABELS[key]) return FRIENDLY_FIELD_LABELS[key];
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
};

const formatEventType = (type) => {
  if (!type) return '-';
  return TYPE_LABELS[type] || String(type).replaceAll('_', ' ');
};

const isDateLikeKey = (key) => /date|time|at$/i.test(key || '');
const isCurrencyLikeKey = (key) => /amount|total|cost|price|paid|balance|value/i.test(key || '');

const formatFieldValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '-';

  if (typeof value === 'number' && isCurrencyLikeKey(key)) {
    return formatCurrency(value);
  }

  if (typeof value === 'string') {
    if (/type$/i.test(key) || key === 'type') {
      return formatEventType(value);
    }

    if (/status$/i.test(key)) {
      return value.replaceAll('_', ' ');
    }

    if (isCurrencyLikeKey(key) && !Number.isNaN(Number(value))) {
      return formatCurrency(value);
    }

    if (isDateLikeKey(key)) {
      const parsedDate = new Date(value);
      if (!Number.isNaN(parsedDate.getTime())) return parsedDate.toLocaleString();
    }

    return value;
  }

  if (typeof value === 'object') {
    if (value.fullName || value.name || value.email) {
      return value.fullName || value.name || value.email;
    }

    if (Array.isArray(value)) {
      return value.map((item) => formatFieldValue(key, item)).join(', ');
    }

    return safeString(value);
  }

  return String(value);
};

const buildChangeRows = (oldValue, newValue) => {
  const oldStructured = parseStructuredValue(oldValue);
  const newStructured = parseStructuredValue(newValue);

  if (!oldStructured && !newStructured) return [];

  const oldObj = oldStructured && typeof oldStructured === 'object' ? oldStructured : {};
  const newObj = newStructured && typeof newStructured === 'object' ? newStructured : {};
  const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

  return keys
    .map((key) => {
      const before = oldObj[key];
      const after = newObj[key];
      const changed = JSON.stringify(before) !== JSON.stringify(after);

      return {
        key,
        label: humanizeKey(key),
        before: formatFieldValue(key, before),
        after: formatFieldValue(key, after),
        changed,
      };
    })
    .filter((row) => row.changed)
    .sort((a, b) => a.label.localeCompare(b.label));
};

const TransactionLog = () => {
  const { mode } = useTheme();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({
    entity: '',
    action: '',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
  });

  const availableActions = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.action).filter(Boolean)));
  }, [records]);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const response = await apiService.getTransactionLog({
        page: pagination.page,
        limit: pagination.limit,
        entity: filters.entity || undefined,
        action: filters.action || undefined,
        search: filters.search || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });

      setRecords(response?.data || []);
      setPagination((prev) => ({
        ...prev,
        total: response?.pagination?.total || 0,
        pages: response?.pagination?.pages || 0,
      }));
    } catch (error) {
      console.error('Error fetching transaction log:', error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLog();
  }, [pagination.page]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchLog();
  };

  return (
    <div className="space-y-6 transaction-log-page pt-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>Transaction Log</h1>
          <p className={mode === 'dark' ? 'text-sm text-slate-400' : 'text-sm text-gray-500'}>Detailed financial activity trail with actor, requester, modifier and approver context.</p>
        </div>
      </div>

      <div className={`rounded-lg shadow p-4 ${mode === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            value={filters.entity}
            onChange={(e) => setFilters((prev) => ({ ...prev, entity: e.target.value }))}
            className={`rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${mode === 'dark' ? 'bg-slate-900 text-slate-100 border border-slate-600' : 'border border-gray-300'}`}
          >
            <option value="">All Entities</option>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
            <option value="CUSTOMER">Customer</option>
          </select>

          <select
            value={filters.action}
            onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
            className={`rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${mode === 'dark' ? 'bg-slate-900 text-slate-100 border border-slate-600' : 'border border-gray-300'}`}
          >
            <option value="">All Actions</option>
            {availableActions.map((action) => (
              <option key={action} value={action}>{action.replaceAll('_', ' ')}</option>
            ))}
          </select>

          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Search by entity ID"
              className={`w-full pl-10 pr-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${mode === 'dark' ? 'bg-slate-900 text-slate-100 border border-slate-600 placeholder-slate-400' : 'border border-gray-300'}`}
            />
          </div>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            className={`rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${mode === 'dark' ? 'bg-slate-900 text-slate-100 border border-slate-600' : 'border border-gray-300'}`}
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            className={`rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${mode === 'dark' ? 'bg-slate-900 text-slate-100 border border-slate-600' : 'border border-gray-300'}`}
          />
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={applyFilters}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center"
          >
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
          </button>
        </div>
      </div>

      <div className={`rounded-lg shadow overflow-hidden ${mode === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-red-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Date/Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Responsible Persons</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Details</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${mode === 'dark' ? 'divide-slate-700' : 'divide-gray-200'}`}>
              {records.map((row) => {
                const isExpanded = expandedId === row.id;
                const actorName = formatActorName(row.actor);
                const requesterName = row?.meta?.requestedBy?.fullName || row?.meta?.requestedBy?.name || '-';
                const approverName = row?.meta?.approvedBy?.fullName || row?.meta?.approvedByName || '-';
                const rejectorName = row?.meta?.rejectedBy?.fullName || row?.meta?.rejectedByName || '-';
                const actorRole = row?.actor?.role || '';
                const requesterRole = row?.meta?.requestedBy?.role || '';
                const approverRole = row?.meta?.approvedBy?.role || row?.meta?.approvedByRole || '';
                const rejectorRole = row?.meta?.rejectedBy?.role || row?.meta?.rejectedByRole || '';
                const changeRows = buildChangeRows(row.oldValue, row.newValue);
                const parsedNewValue = parseStructuredValue(row.newValue);
                const summaryItem = parsedNewValue?.item || parsedNewValue?.description || row?.meta?.item;
                const summaryAmount = parsedNewValue?.amount ?? row?.meta?.amount;
                const summaryMessage = parsedNewValue?.message || row?.meta?.message;
                const summaryType = parsedNewValue?.type || row?.meta?.type;

                return (
                  <React.Fragment key={row.id}>
                    <tr className={mode === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          {new Date(row.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        <div className="font-medium">{row.entity || '-'}</div>
                        <div className="text-xs text-gray-500">ID: {row.entityId || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getActionColor(row.action, mode)}`}>
                          {(row.action || '').replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs text-gray-500">Actor:</span>
                            <span className="font-medium">{actorName}</span>
                            {actorRole && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${mode === 'dark' ? 'bg-red-900/30 border border-red-700/40 text-red-300' : 'bg-red-50 border border-red-100 text-red-700'}`}>
                                {formatRoleLabel(actorRole)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs flex items-center gap-2">
                            <span className="text-gray-500">Requester:</span>
                            <span>{requesterName}</span>
                            {requesterRole && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${mode === 'dark' ? 'bg-slate-600 text-slate-200' : 'bg-gray-100 text-gray-700'}`}>
                                {formatRoleLabel(requesterRole)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs flex items-center gap-2">
                            <span className="text-gray-500">Approver:</span>
                            <span>{approverName}</span>
                            {approverRole && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${mode === 'dark' ? 'bg-emerald-900/30 border border-emerald-700/40 text-emerald-300' : 'bg-emerald-50 border border-emerald-100 text-emerald-700'}`}>
                                {formatRoleLabel(approverRole)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs flex items-center gap-2">
                            <span className="text-gray-500">Rejector:</span>
                            <span>{rejectorName}</span>
                            {rejectorRole && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${mode === 'dark' ? 'bg-amber-900/30 border border-amber-700/40 text-amber-300' : 'bg-amber-50 border border-amber-100 text-amber-700'}`}>
                                {formatRoleLabel(rejectorRole)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                          className="text-red-600 hover:text-red-800 inline-flex items-center gap-1"
                        >
                          <FileText className="h-4 w-4" />
                          {isExpanded ? 'Hide changes' : 'View changes'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className={`px-4 py-4 ${mode === 'dark' ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                          <div className="space-y-4">
                            <div className={`rounded-xl border p-4 ${mode === 'dark' ? 'border-red-900/30 bg-slate-800' : 'border-red-100 bg-gradient-to-r from-red-50 to-white'}`}>
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className={`rounded-full px-2.5 py-1 font-semibold border ${mode === 'dark' ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-white text-gray-700 border-gray-200'}`}>
                                  {(row.entity || 'ENTITY').replaceAll('_', ' ')}
                                </span>
                                <span className={`rounded-full px-2.5 py-1 font-semibold ${getActionColor(row.action, mode)}`}>
                                  {(row.action || 'ACTION').replaceAll('_', ' ')}
                                </span>
                                <span className={`rounded-full px-2.5 py-1 font-medium ${mode === 'dark' ? 'bg-slate-600 text-slate-200' : 'bg-gray-100 text-gray-700'}`}>
                                  Ref: {row.entityId || '-'}
                                </span>
                              </div>

                              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className={`rounded-lg border p-3 ${mode === 'dark' ? 'border-slate-600 bg-slate-700' : 'border-gray-200 bg-white'}`}>
                                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Actor</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <p className={`text-sm font-semibold ${mode === 'dark' ? 'text-slate-100' : 'text-gray-800'}`}>{actorName}</p>
                                    {actorRole && (
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${mode === 'dark' ? 'bg-red-900/30 border border-red-700/40 text-red-300' : 'bg-red-50 border border-red-100 text-red-700'}`}>
                                        {formatRoleLabel(actorRole)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className={`rounded-lg border p-3 ${mode === 'dark' ? 'border-slate-600 bg-slate-700' : 'border-gray-200 bg-white'}`}>
                                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Date and time</p>
                                  <p className={`mt-1 text-sm font-semibold ${mode === 'dark' ? 'text-slate-100' : 'text-gray-800'}`}>{new Date(row.createdAt).toLocaleString()}</p>
                                </div>
                                <div className={`rounded-lg border p-3 ${mode === 'dark' ? 'border-slate-600 bg-slate-700' : 'border-gray-200 bg-white'}`}>
                                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Amount</p>
                                  <p className={`mt-1 text-sm font-semibold ${mode === 'dark' ? 'text-slate-100' : 'text-gray-800'}`}>{formatCurrency(summaryAmount)}</p>
                                </div>
                              </div>

                              {(summaryItem || summaryMessage) && (
                                <div className={`mt-3 rounded-lg border p-3 ${mode === 'dark' ? 'border-slate-600 bg-slate-700' : 'border-gray-200 bg-white'}`}>
                                  {summaryType && (
                                    <p className={`text-sm ${mode === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                                      <span className={`font-semibold ${mode === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>Transaction:</span> {formatEventType(summaryType)}
                                    </p>
                                  )}
                                  {summaryItem && (
                                    <p className={`text-sm ${mode === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                                      <span className={`font-semibold ${mode === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>Item:</span> {summaryItem}
                                    </p>
                                  )}
                                  {summaryMessage && (
                                    <p className={`mt-1 text-sm ${mode === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                                      <span className={`font-semibold ${mode === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>Message:</span> {summaryMessage}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {changeRows.length > 0 ? (
                              <div className={`rounded-xl border overflow-hidden ${mode === 'dark' ? 'border-slate-600 bg-slate-800' : 'border-gray-200 bg-white'}`}>
                                <div className={`border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wide ${mode === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-300' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                                  Field Changes ({changeRows.length})
                                </div>
                                <div className={`divide-y ${mode === 'dark' ? 'divide-slate-700' : 'divide-gray-100'}`}>
                                  {changeRows.map((change) => (
                                    <div key={change.key} className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 py-3">
                                      <div>
                                        <p className="text-[11px] uppercase tracking-wide text-gray-400">Field</p>
                                        <p className={`text-sm font-semibold ${mode === 'dark' ? 'text-slate-100' : 'text-gray-800'}`}>{change.label}</p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] uppercase tracking-wide text-gray-400">Before</p>
                                        <p className={`text-sm break-words ${mode === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{change.before}</p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] uppercase tracking-wide text-gray-400">After</p>
                                        <p className={`text-sm font-semibold break-words ${mode === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>{change.after}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className={`rounded-xl border p-4 ${mode === 'dark' ? 'border-slate-600 bg-slate-800' : 'border-gray-200 bg-white'}`}>
                                <p className={`text-sm ${mode === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Structured field differences are not available for this record. Raw values are shown below.</p>
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h3 className={`text-sm font-semibold mb-2 ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Raw Old Value</h3>
                                <pre className={`text-xs border rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words ${mode === 'dark' ? 'bg-slate-900 border-slate-600 text-slate-300' : 'bg-white border-gray-200'}`}>
                                  {safeString(row.oldValue)}
                                </pre>
                              </div>
                              <div>
                                <h3 className={`text-sm font-semibold mb-2 ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Raw New Value</h3>
                                <pre className={`text-xs border rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words ${mode === 'dark' ? 'bg-slate-900 border-slate-600 text-slate-300' : 'bg-white border-gray-200'}`}>
                                  {safeString(row.newValue)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && records.length === 0 && (
          <div className={`py-10 text-center ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>No transaction records found for the selected criteria.</div>
        )}

        {loading && (
          <div className="py-10 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto" />
          </div>
        )}

        {records.length > 0 && (
          <div className={`px-4 py-3 border-t flex items-center justify-between ${mode === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className={`text-sm ${mode === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className={`p-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300'}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className={`text-sm ${mode === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Page {pagination.page} of {Math.max(1, pagination.pages || 1)}</span>
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(Math.max(1, prev.pages || 1), prev.page + 1) }))}
                disabled={pagination.page >= Math.max(1, pagination.pages || 1)}
                className={`p-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300'}`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionLog;



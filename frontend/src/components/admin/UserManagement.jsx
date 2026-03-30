import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Users, RefreshCcw, ShieldCheck, Building2, Briefcase, Edit3 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const ROLE_OPTIONS = ['ALL', 'SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'AUDITOR', 'HR', 'VIEWER', 'EMPLOYEE', 'SUPERVISOR', 'DRIVER', 'CHIEF_DRIVER'];

const UserManagement = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [error, setError] = useState('');

  const roleOptions = useMemo(() => {
    if (String(currentUser?.role || '').toUpperCase() === 'ADMIN') {
      return ROLE_OPTIONS.filter((role) => !['CEO', 'SUPER_ADMIN'].includes(role));
    }
    return ROLE_OPTIONS;
  }, [currentUser?.role]);

  const fetchUsers = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setError('');
      const response = await api.getUsers();
      setUsers(Array.isArray(response?.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const query = searchTerm.trim().toLowerCase();
      const fullName = String(user.fullName || '').toLowerCase();
      const email = String(user.email || '').toLowerCase();
      const employeeId = String(user.employeeId || '').toLowerCase();
      const matchesSearch = !query || fullName.includes(query) || email.includes(query) || employeeId.includes(query);
      const matchesRole = selectedRole === 'ALL' || user.role === selectedRole;
      const matchesStatus = selectedStatus === 'all'
        || (selectedStatus === 'active' && user.isActive)
        || (selectedStatus === 'inactive' && !user.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, selectedRole, selectedStatus]);

  const handleStatusToggle = async (userId, currentStatus) => {
    try {
      await api.updateUser(userId, { isActive: !currentStatus });
      setUsers((currentUsers) => currentUsers.map((user) => (
        user.id === userId ? { ...user, isActive: !currentStatus } : user
      )));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update user status.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-red-600">Administration</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-600">Review staff accounts, their subsidiary assignment, and the position linked to onboarding.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => fetchUsers({ silent: true })}
            className="inline-flex items-center rounded-lg border border-amber-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-amber-50"
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/users/new')}
            className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Staff Onboarding
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{users.filter((user) => user.isActive).length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Assigned Positions</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{users.filter((user) => user.positionId || user.position).length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Subsidiaries Covered</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{new Set(users.map((user) => user.subsidiary?.id).filter(Boolean)).size}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, email, employee ID"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </label>

          <select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>{role === 'ALL' ? 'All Roles' : role}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            type="button"
            onClick={() => navigate('/admin/positions')}
            className="rounded-lg border border-amber-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-amber-50"
          >
            Manage Positions
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center px-6 py-16 text-sm text-gray-500">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-gray-500">
            <Users className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-base font-medium text-gray-700">No users found</p>
            <p className="mt-1 text-sm">Try adjusting the filters or onboard a new staff member.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-amber-100">
              <thead className="bg-red-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-white">Staff</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-white">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-white">Subsidiary</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-white">Position</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-white">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {filteredUsers.map((user) => {
                  const positionName = user.positionRecord?.name || user.position || 'Unassigned';
                  return (
                    <tr key={user.id} className="hover:bg-amber-50/40">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{user.fullName || 'Unnamed user'}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                          {user.employeeId && <p className="mt-1 text-xs text-gray-500">ID: {user.employeeId}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="inline-flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span>{user.subsidiary?.name || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="inline-flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-gray-400" />
                          <span>{positionName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(user.id, user.isActive)}
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/users/edit/${user.id}`)}
                          className="inline-flex items-center rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-amber-50"
                        >
                          <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
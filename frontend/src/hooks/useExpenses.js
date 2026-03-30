import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { expenseService } from '../services/expense.service';

export const useExpenses = (initialFilters = {}) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  
  // Additional state from enhanced version
  const [stats, setStats] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);

  const { showToast } = useToast();

  // Fetch expenses with filters
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      };
      
      // Using the api service from existing code
      const response = await api.getExpenses(params);
      
      setExpenses(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0,
        pages: response.pagination?.pages || Math.ceil((response.pagination?.total || 0) / pagination.limit)
      }));
    } catch (err) {
      setError(err.message);
      showToast('Failed to fetch expenses', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit, showToast]);

  // Fetch statistics (from enhanced version)
  const fetchStats = useCallback(async () => {
    try {
      const response = await expenseService.getStats(filters);
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [filters]);

  // Fetch pending approvals (from enhanced version)
  const fetchPendingApprovals = useCallback(async () => {
    try {
      const response = await expenseService.getPendingApprovals();
      setPendingApprovals(response.data || []);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    }
  }, []);

  // Fetch recurring expenses (from enhanced version)
  const fetchRecurringExpenses = useCallback(async () => {
    try {
      const response = await expenseService.getRecurringExpenses();
      setRecurringExpenses(response.data || []);
    } catch (err) {
      console.error('Error fetching recurring expenses:', err);
    }
  }, []);

  // Initial data fetching
  useEffect(() => {
    fetchExpenses();
    fetchStats();
    fetchPendingApprovals();
    fetchRecurringExpenses();
  }, [fetchExpenses, fetchStats, fetchPendingApprovals, fetchRecurringExpenses]);

  // Create expense (from existing)
  const createExpense = async (data) => {
    try {
      const response = await api.createExpense(data);
      showToast('Expense added successfully', 'success');
      await fetchExpenses();
      await fetchStats();
      return response;
    } catch (err) {
      showToast(err.message || 'Failed to create expense', 'error');
      throw err;
    }
  };

  // Update expense (from enhanced)
  const updateExpense = async (id, data) => {
    try {
      const response = await expenseService.updateExpense(id, data);
      showToast('Expense updated successfully', 'success');
      await fetchExpenses();
      await fetchStats();
      return response;
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update expense', 'error');
      throw err;
    }
  };

  // Delete expense (from enhanced)
  const deleteExpense = async (id, permanent = false) => {
    try {
      await expenseService.deleteExpense(id, permanent);
      showToast(permanent ? 'Expense permanently deleted' : 'Expense moved to trash', 'success');
      await fetchExpenses();
      await fetchStats();
      await fetchPendingApprovals();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete expense', 'error');
      throw err;
    }
  };

  // Approve expense (from existing - enhanced)
  const approveExpense = async (id, comments = '') => {
    try {
      const response = await api.approveExpense(id, { comments });
      showToast('Expense approved successfully', 'success');
      await fetchExpenses();
      await fetchStats();
      await fetchPendingApprovals();
      return response;
    } catch (err) {
      showToast(err.message || 'Failed to approve expense', 'error');
      throw err;
    }
  };

  // Reject expense (from enhanced)
  const rejectExpense = async (id, reason) => {
    try {
      const response = await expenseService.rejectExpense(id, reason);
      showToast('Expense rejected', 'success');
      await fetchExpenses();
      await fetchStats();
      await fetchPendingApprovals();
      return response;
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to reject expense', 'error');
      throw err;
    }
  };

  // Mark as paid (from enhanced)
  const markAsPaid = async (id, paymentData) => {
    try {
      const response = await expenseService.markAsPaid(id, paymentData);
      showToast('Expense marked as paid', 'success');
      await fetchExpenses();
      await fetchStats();
      return response;
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to mark as paid', 'error');
      throw err;
    }
  };

  // Bulk upload (from enhanced)
  const bulkUpload = async (formData) => {
    try {
      const response = await expenseService.bulkUpload(formData);
      showToast(`Successfully uploaded ${response.data?.successful?.length || 0} expenses`, 'success');
      await fetchExpenses();
      await fetchStats();
      return response;
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to upload expenses', 'error');
      throw err;
    }
  };

  // Export expenses (from enhanced)
  const exportExpenses = async (format = 'excel') => {
    try {
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      };
      const blob = await expenseService.exportExpenses(params, format);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expenses-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast('Export completed successfully', 'success');
    } catch (err) {
      showToast('Failed to export expenses', 'error');
      throw err;
    }
  };

  // Update filters (from existing)
  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Reset filters (from enhanced)
  const resetFilters = () => {
    setFilters(initialFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Select expense for editing/viewing (from enhanced)
  const selectExpense = (expense) => {
    setSelectedExpense(expense);
  };

  // Clear selected expense
  const clearSelectedExpense = () => {
    setSelectedExpense(null);
  };

  // Change page
  const goToPage = (page) => {
    setPagination(prev => ({ ...prev, page }));
  };

  // Change limit
  const changeLimit = (limit) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  };

  return {
    // Data
    expenses,
    loading,
    error,
    filters,
    pagination,
    stats,
    selectedExpense,
    pendingApprovals,
    recurringExpenses,

    // Pagination controls
    setPagination,
    goToPage,
    changeLimit,

    // Filter controls
    updateFilters,
    resetFilters,

    // Selection controls
    selectExpense,
    clearSelectedExpense,

    // CRUD operations
    createExpense,
    updateExpense,
    deleteExpense,

    // Approval operations
    approveExpense,
    rejectExpense,

    // Payment operations
    markAsPaid,

    // Bulk operations
    bulkUpload,
    exportExpenses,

    // Refresh
    refresh: fetchExpenses,
    refreshStats: fetchStats,
    refreshPending: fetchPendingApprovals,
    refreshRecurring: fetchRecurringExpenses
  };
};
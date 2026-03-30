import api from './api';

export const expenseService = {
  // Get all expenses with filters
  getExpenses: async (params) => {
    const response = await api.get('/expenses', { params });
    return response.data;
  },

  // Get single expense by ID
  getExpenseById: async (id) => {
    const response = await api.get(`/expenses/${id}`);
    return response.data;
  },

  // Create new expense
  createExpense: async (data) => {
    const response = await api.post('/expenses', data);
    return response.data;
  },

  // Update expense
  updateExpense: async (id, data) => {
    const response = await api.put(`/expenses/${id}`, data);
    return response.data;
  },

  // Delete expense
  deleteExpense: async (id) => {
    const response = await api.delete(`/expenses/${id}`);
    return response.data;
  },

  // Approve expense
  approveExpense: async (id, comments) => {
    const response = await api.put(`/expenses/${id}/approve`, { comments });
    return response.data;
  },

  // Reject expense
  rejectExpense: async (id, reason) => {
    const response = await api.put(`/expenses/${id}/reject`, { reason });
    return response.data;
  },

  // Mark as paid
  markAsPaid: async (id, paymentData) => {
    const response = await api.put(`/expenses/${id}/mark-paid`, paymentData);
    return response.data;
  },

  // Get expense analytics
  getAnalytics: async (params) => {
    const response = await api.get('/expenses/analytics', { params });
    return response.data;
  },

  // Get expense stats
  getStats: async (params) => {
    const response = await api.get('/expenses/stats', { params });
    return response.data;
  },

  // Bulk upload
  bulkUpload: async (formData) => {
    const response = await api.post('/expenses/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Get pending approvals
  getPendingApprovals: async () => {
    const response = await api.get('/expenses/pending-approvals');
    return response.data;
  },

  // Get recurring expenses
  getRecurringExpenses: async () => {
    const response = await api.get('/expenses/recurring');
    return response.data;
  },

  // Export expenses
  exportExpenses: async (params, format = 'excel') => {
    const response = await api.get(`/expenses/export/${format}`, {
      params,
      responseType: 'blob'
    });
    return response.data;
  }
};
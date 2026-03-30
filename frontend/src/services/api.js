import axios from 'axios';

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const requestUrl = String(originalRequest?.url || '');
        const isRefreshRequest = requestUrl.includes('/auth/refresh-token');
        const isPublicAuthRequest = [
          '/auth/login',
          '/auth/register',
          '/auth/forgot-password',
          '/auth/reset-password',
        ].some((endpoint) => requestUrl.includes(endpoint));

        if (error.response?.status === 401 && !originalRequest._retry && !isRefreshRequest && !isPublicAuthRequest) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');

            if (!refreshToken) {
              this.logout();
              window.location.href = '/login';
              return Promise.reject(error);
            }

            const response = await this.api.post('/auth/refresh-token', {
              refreshToken,
            });

            const refreshPayload = response.data?.data || response.data || {};
            const nextAccessToken = refreshPayload.accessToken || response.data?.accessToken;

            if (!nextAccessToken) {
              throw new Error('No access token returned from refresh endpoint');
            }

            localStorage.setItem('accessToken', nextAccessToken);
            sessionStorage.setItem('accessToken', nextAccessToken);
            this.api.defaults.headers.common['Authorization'] = 
              `Bearer ${nextAccessToken}`;

            return this.api(originalRequest);
          } catch (refreshError) {
            // Redirect to login
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(email, password) {
    const response = await this.api.post('/auth/login', { email, password });
    const payload = response.data?.data || response.data || {};

    // Support backend returning either { accessToken, refreshToken } or { token }
    const accessToken = payload.accessToken || payload.token || response.data?.accessToken || response.data?.token;
    const refreshToken = payload.refreshToken || response.data?.refreshToken || null;
    const user = payload.user || response.data?.user || null;

    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }
    }

    return {
      ...response.data,
      ...payload,
      accessToken,
      refreshToken,
      user,
    };
  }

  logout() {
    try {
      const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
      if (refreshToken) {
        this.api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('user');
    }
  }

  async createExpense(data) {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const response = await this.api.post('/expenses', data, isFormData ? {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    } : undefined);
    return response.data;
  }

  async getExpenses(params) {
    const response = await this.api.get('/expenses', { params });
    return response.data;
  }

  async getExpenseById(id) {
    const response = await this.api.get(`/expenses/${id}`);
    return response.data;
  }

  async updateExpense(id, data) {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const response = await this.api.put(`/expenses/${id}`, data, isFormData ? {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    } : undefined);
    return response.data;
  }

  async approveExpense(id, data) {
    const response = await this.api.put(`/expenses/${id}/approve`, data);
    return response.data;
  }

  async rejectExpense(id, data) {
    const response = await this.api.put(`/expenses/${id}/reject`, data);
    return response.data;
  }

  async getPendingExpenseModifications() {
    const response = await this.api.get('/expenses/modifications/pending');
    return response.data;
  }

  async getExpenseModificationHistory() {
    const response = await this.api.get('/expenses/modifications/history');
    return response.data;
  }

  async approveExpenseModification(requestId, data) {
    const response = await this.api.post(`/expenses/modifications/${requestId}/approve`, data);
    return response.data;
  }

  async completeExpense(id, data) {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const response = await this.api.put(`/expenses/${id}/complete`, data, isFormData ? {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    } : undefined);
    return response.data;
  }

  async uploadExpenseReceipt(id, data) {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const response = await this.api.put(`/expenses/${id}/upload-receipt`, data, isFormData ? {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    } : undefined);
    return response.data;
  }

  async deleteExpense(id) {
    const response = await this.api.delete(`/expenses/${id}`);
    return response.data;
  }

  async getExpenseAnalytics(params) {
    const response = await this.api.get('/expenses/analytics', { params });
    return response.data;
  }

  // Operations
  async getOperations(params) {
    const response = await this.api.get('/operations', { params });
    return response.data;
  }

  async createOperation(data) {
    const response = await this.api.post('/operations', data);
    return response.data;
  }

  async getVehicleOperations(vehicleId, params) {
    const response = await this.api.get(`/operations/vehicle/${vehicleId}`, { params });
    return response.data;
  }

  async getVehicles(params) {
    const response = await this.api.get('/vehicles', { params });
    return response.data;
  }

  async getMyProfile() {
    const response = await this.api.get('/users/me');
    return response.data;
  }

  async getAssignableVehicleStaff(params) {
    const response = await this.api.get('/vehicles/assignable-staff', { params });
    return response.data;
  }

  async assignVehicle(vehicleId, data) {
    const response = await this.api.post(`/vehicles/${vehicleId}/assign`, data);
    return response.data;
  }

  async deassignVehicle(vehicleId) {
    const response = await this.api.delete(`/vehicles/${vehicleId}/assign`);
    return response.data;
  }

  async createVehicleLog(data) {
    const response = await this.api.post('/vehicles/logs', data);
    return response.data;
  }

  async getMyVehicleLogs(params) {
    const response = await this.api.get('/vehicles/logs/mine', { params });
    return response.data;
  }

  async getVehicleDetail(vehicleId) {
    const response = await this.api.get(`/vehicles/${vehicleId}/detail`);
    return response.data;
  }

  async getVehicleLogs(vehicleId, params) {
    const response = await this.api.get(`/vehicles/${vehicleId}/logs`, { params });
    return response.data;
  }

  async updateVehicleStatus(vehicleId, data) {
    const response = await this.api.patch(`/vehicles/${vehicleId}/status`, data);
    return response.data;
  }

  async requestVehicleStatusChange(vehicleId, data) {
    const response = await this.api.post(`/vehicles/${vehicleId}/status-request`, data);
    return response.data;
  }

  async getVehicleStatusRequests(params) {
    const response = await this.api.get('/vehicles/status-requests', { params });
    return response.data;
  }

  async reviewVehicleStatusRequest(requestId, stage, data) {
    // stage: 'chief-review' | 'executive-review'
    const response = await this.api.post(`/vehicles/status-requests/${requestId}/${stage}`, data);
    return response.data;
  }

  async createVehicle(data) {
    try {
      const response = await this.api.post('/vehicles', data);
      return response.data;
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }

      const configuredBase = this.api.defaults.baseURL || '';
      let fallbackUrl = '/api/vehicles';

      try {
        const parsed = new URL(configuredBase, window.location.origin);
        fallbackUrl = `${parsed.origin}/api/vehicles`;
      } catch (_parseError) {
        fallbackUrl = '/api/vehicles';
      }

      const fallbackResponse = await axios.post(fallbackUrl, data, {
        headers: {
          ...this.api.defaults.headers.common,
          Authorization: this.api.defaults.headers.common?.Authorization,
          'Content-Type': 'application/json',
        },
      });

      return fallbackResponse.data;
    }
  }
  
  async getSubsidiaries(params) {
    const response = await this.api.get('/subsidiaries', { params });
    return response.data;
  }

  async createSubsidiary(data) {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const response = await this.api.post('/subsidiaries', data, isFormData ? {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    } : undefined);
    return response.data;
  }

  async updateSubsidiary(id, data) {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const response = await this.api.put(`/subsidiaries/${id}`, data, isFormData ? {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    } : undefined);
    return response.data;
  }

  // Profit & Distributions
  async calculateMonthlyProfit(year, month) {
    const response = await this.api.get(`/profit/monthly/${year}/${month}`);
    return response.data;
  }

  async getProfitAnalytics(year) {
    const response = await this.api.get(`/profit/analytics/${year}`);
    return response.data;
  }

  async processDistribution(distributionId, data) {
    const response = await this.api.post(`/profit/distributions/${distributionId}/process`, data);
    return response.data;
  }

  // Income
  async createIncome(data) {
    const response = await this.api.post('/income', data);
    return response.data;
  }

  async getIncomes(params) {
    const response = await this.api.get('/income', { params });
    return response.data;
  }

  async getIncomeAnalytics(params) {
    const response = await this.api.get('/income/analytics', { params });
    return response.data;
  }

  async requestIncomeModification(id, data) {
    const response = await this.api.put(`/income/${id}`, data);
    return response.data;
  }

  async getPendingIncomeModifications() {
    const response = await this.api.get('/income/modifications/pending');
    return response.data;
  }

  async getMyIncomeModificationRequests() {
    const response = await this.api.get('/income/modifications/mine');
    return response.data;
  }

  async getIncomeModificationHistory() {
    const response = await this.api.get('/income/modifications/history');
    return response.data;
  }

  async approveIncomeModification(requestId, data) {
    const response = await this.api.post(`/income/modifications/${requestId}/approve`, data);
    return response.data;
  }

  async getIncomeInvoice(id) {
    const response = await this.api.get(`/income/${id}/invoice`);
    return response.data;
  }

  async downloadIncomeInvoicePdf(id) {
    const response = await this.api.get(`/income/${id}/invoice`, {
      params: { format: 'pdf' },
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const disposition = response.headers['content-disposition'] || '';
    const filenameMatch = disposition.match(/filename=([^;]+)/i);
    const filename = filenameMatch ? filenameMatch[1].replace(/"/g, '') : `invoice-${id}.pdf`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  async printIncomeInvoice(id) {
    const response = await this.api.get(`/income/${id}/invoice`, {
      params: { format: 'pdf' },
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const viewUrl = window.URL.createObjectURL(blob);
    const printWindow = window.open(viewUrl, '_blank', 'noopener,noreferrer');

    if (printWindow) {
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (error) {
          // If browser blocks direct print, opening the PDF still allows manual print.
        }
      }, 400);
    }

    setTimeout(() => window.URL.revokeObjectURL(viewUrl), 60000);
  }

  async getCustomers(params) {
    const response = await this.api.get('/customers', { params });
    return response.data;
  }

  async createCustomer(data) {
    const response = await this.api.post('/customers', data);
    return response.data;
  }

  async updateCustomer(id, data) {
    const response = await this.api.put(`/customers/${id}`, data);
    return response.data;
  }

  async softDeleteCustomer(id) {
    const response = await this.api.delete(`/customers/${id}`);
    return response.data;
  }

  // Reports
  async generateReport(params) {
    const response = await this.api.get('/reports/generate', { params });
    return response.data;
  }

  async exportReport(format, params) {
    const response = await this.api.get(`/reports/export/${format}`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  // Dashboard
  async getDashboardKPI(params) {
    const response = await this.api.get('/dashboard/kpi', { params });
    return response.data;
  }

  async getDashboardCharts(params) {
    const response = await this.api.get('/dashboard/charts', { params });
    return response.data;
  }

  async getDashboardDrilldown(params) {
    const response = await this.api.get('/dashboard/drilldown', { params });
    return response.data;
  }

  async getAlerts() {
    const response = await this.api.get('/dashboard/alerts');
    return response.data;
  }

  // Notifications
  async getNotifications() {
    const response = await this.api.get('/notifications');
    return response.data;
  }

  async markNotificationAsRead(id) {
    const response = await this.api.patch(`/notifications/${id}/read`);
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await this.api.patch('/notifications/read-all');
    return response.data;
  }

  async deleteNotification(id) {
    const response = await this.api.delete(`/notifications/${id}`);
    return response.data;
  }

  async deleteReadNotifications() {
    const response = await this.api.delete('/notifications/read');
    return response.data;
  }

  // Admin
  async getUsers(params) {
    const response = await this.api.get('/admin/users', { params });
    return response.data;
  }

  async getUserById(id) {
    const response = await this.api.get(`/admin/users/${id}`);
    return response.data;
  }

  async createUser(data) {
    const response = await this.api.post('/admin/users', data);
    return response.data;
  }

  async updateUser(id, data) {
    const response = await this.api.put(`/admin/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id) {
    const response = await this.api.delete(`/admin/users/${id}`);
    return response.data;
  }

  async getPositions(params) {
    const response = await this.api.get('/admin/positions', { params });
    return response.data;
  }

  async createPosition(data) {
    const response = await this.api.post('/admin/positions', data);
    return response.data;
  }

  async updatePosition(id, data) {
    const response = await this.api.put(`/admin/positions/${id}`, data);
    return response.data;
  }

  async getAuditLogs(params) {
    const response = await this.api.get('/admin/audit-logs', { params });
    return response.data;
  }

  async getTransactionLog(params) {
    const response = await this.api.get('/admin/transaction-log', { params });
    return response.data;
  }

  async getCacheHealth() {
    try {
      const response = await this.api.get('/cache/health');
      return response.data;
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }

      const fallback = await this.api.get('/admin/system-health');
      const cache = fallback?.data?.data?.services?.cache || {};

      return {
        success: true,
        data: {
          enabled: Boolean(cache.enabled),
          totalKeys: Number(cache.totalKeys || 0),
          hasError: cache.status === 'degraded' || Boolean(cache.error),
          error: cache.error || null,
          status: cache.status || 'unknown',
          source: 'admin/system-health',
        },
      };
    }
  }
}

const apiService = new ApiService();

export default apiService;
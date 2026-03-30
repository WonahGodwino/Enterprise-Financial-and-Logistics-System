import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { useAuth } from './context/AuthContext';
import PrivateRoute from './components/common/PrivateRoute';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/error/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';
import { DASHBOARD_ALLOWED_ROLES, getDefaultAuthenticatedRoute } from './utils/routeAccess';

// Lazy load components for code splitting
const Login = lazy(() => import('./components/auth/Login'));
const ForgotPassword = lazy(() => import('./components/auth/ForgotPassword'));
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const Vehicles = lazy(() => import('./components/vehicles/Vehicles'));
const DriverProfile = lazy(() => import('./components/drivers/DriverProfile'));
const Expenses = lazy(() => import('./components/expenses/Expenses'));
const Reports = lazy(() => import('./components/reports/Reports'));
const ProfitDashboard = lazy(() => import('./components/profit/ProfitDashboard'));
const IncomeEntry = lazy(() => import('./components/income/IncomeEntry'));
const IncomeModificationApproval = lazy(() => import('./components/income/IncomeModificationApproval'));
const IncomeMyRequests = lazy(() => import('./components/income/IncomeMyRequests'));
const CustomerEntry = lazy(() => import('./components/customers/CustomerEntry'));
const Subsidiaries = lazy(() => import('./components/subsidiaries/Subsidiaries'));
const Notifications = lazy(() => import('./components/notifications/Notifications'));
const Settings = lazy(() => import('./components/settings/Settings'));
const Documentation = lazy(() => import('./components/docs/Documentation'));
const HelpCenter = lazy(() => import('./components/help/HelpCenter'));
const NotFound = lazy(() => import('./components/error/NotFound'));

// Admin components
const UserManagement = lazy(() => import('./components/admin/UserManagement'));
const StaffRegistrationForm = lazy(() => import('./components/admin/StaffRegistrationForm'));
const PositionManagement = lazy(() => import('./components/admin/PositionManagement'));
const AuditLogs = lazy(() => import('./components/admin/AuditLogs'));
const TransactionLog = lazy(() => import('./components/admin/TransactionLog'));
const BackupRestore = lazy(() => import('./components/admin/BackupRestore'));
const ApiSettings = lazy(() => import('./components/admin/ApiSettings'));

const AuthenticatedIndexRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={getDefaultAuthenticatedRoute(user?.role)} replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <ToastProvider>
              <Router>
                <Suspense fallback={<LoadingSpinner fullScreen />}>
                  <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Navigate to="/login" replace />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  
                  {/* Protected Routes with Layout */}
                  <Route path="/" element={
                    <PrivateRoute>
                      <Layout />
                    </PrivateRoute>
                  }>
                    {/* Dashboard */}
                    <Route index element={<AuthenticatedIndexRedirect />} />
                    <Route path="dashboard" element={
                      <PrivateRoute requiredRoles={DASHBOARD_ALLOWED_ROLES}>
                        <Dashboard />
                      </PrivateRoute>
                    } />
                    
                    {/* Vehicle Management */}
                    <Route path="vehicles">
                      <Route index element={<Vehicles />} />
                      <Route path=":id" element={<Vehicles />} />
                      <Route path="new" element={<Vehicles />} />
                      <Route path="edit/:id" element={<Vehicles />} />
                    </Route>

                    {/* Driver Profile */}
                    <Route path="driver-profile" element={
                      <PrivateRoute requiredRoles={['DRIVER', 'CHIEF_DRIVER']}>
                        <DriverProfile />
                      </PrivateRoute>
                    } />
                    
                    {/* Expense Management */}
                    <Route path="expenses">
                      <Route index element={<Expenses />} />
                      <Route path=":id" element={<Expenses />} />
                      <Route path="new" element={<Expenses />} />
                      <Route path="edit/:id" element={<Expenses />} />
                      <Route path="categories" element={<Expenses />} />
                      <Route path="approvals" element={<Expenses />} />
                    </Route>

                    {/* Income Entry */}
                    <Route path="income" element={
                      <PrivateRoute requiredRoles={['ADMIN', 'CEO', 'SUPER_ADMIN', 'ACCOUNTANT']}>
                        <IncomeEntry />
                      </PrivateRoute>
                    } />
                    <Route path="income/modifications" element={
                      <PrivateRoute requiredRoles={['CEO', 'ACCOUNTANT']}>
                        <IncomeModificationApproval />
                      </PrivateRoute>
                    } />
                    <Route path="income/my-requests" element={
                      <PrivateRoute requiredRoles={['ADMIN', 'MANAGER']}>
                        <IncomeMyRequests />
                      </PrivateRoute>
                    } />

                    {/* Customer Management */}
                    <Route path="customers" element={
                      <PrivateRoute requiredRoles={['ADMIN', 'CEO', 'ACCOUNTANT']}>
                        <CustomerEntry />
                      </PrivateRoute>
                    } />
                    
                    {/* Reports & Analytics */}
                    <Route path="reports">
                      <Route index element={<Reports />} />
                      <Route path="expense" element={<Reports />} />
                      <Route path="fuel" element={<Reports />} />
                      <Route path="maintenance" element={<Reports />} />
                      <Route path="driver-performance" element={<Reports />} />
                      <Route path="custom" element={<Reports />} />
                      <Route path="scheduled" element={<Reports />} />
                    </Route>
                    
                    {/* Profit & Loss */}
                    <Route path="profit">
                      <Route index element={
                        <PrivateRoute requiredRoles={['ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN']}>
                          <ProfitDashboard />
                        </PrivateRoute>
                      } />
                      <Route path="analytics" element={
                        <PrivateRoute requiredRoles={['ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN']}>
                          <ProfitDashboard />
                        </PrivateRoute>
                      } />
                      <Route path="forecast" element={
                        <PrivateRoute requiredRoles={['ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN']}>
                          <ProfitDashboard />
                        </PrivateRoute>
                      } />
                    </Route>
                    
                    {/* Subsidiaries */}
                    <Route path="subsidiaries">
                      <Route index element={<Subsidiaries />} />
                      <Route path=":id" element={<Subsidiaries />} />
                      <Route path="new" element={<Subsidiaries />} />
                      <Route path="edit/:id" element={<Subsidiaries />} />
                    </Route>

                    {/* Company Setup */}
                    <Route path="company-setup" element={
                      <PrivateRoute requiredRoles={['ADMIN', 'CEO', 'SUPER_ADMIN']}>
                        <Navigate to="/company-setup/main-company" replace />
                      </PrivateRoute>
                    } />
                    <Route path="company-setup/main-company" element={
                      <PrivateRoute requiredRoles={['ADMIN', 'CEO', 'SUPER_ADMIN']}>
                        <Subsidiaries />
                      </PrivateRoute>
                    } />
                    <Route path="company-setup/subsidiary" element={
                      <PrivateRoute requiredRoles={['ADMIN', 'CEO', 'SUPER_ADMIN']}>
                        <Subsidiaries />
                      </PrivateRoute>
                    } />
                    
                    {/* Notifications */}
                    <Route path="notifications">
                      <Route index element={<Notifications />} />
                      <Route path="settings" element={<Notifications />} />
                    </Route>
                    
                    {/* Settings */}
                    <Route path="settings">
                      <Route index element={<Settings />} />
                      <Route path="general" element={<Settings />} />
                      <Route path="appearance" element={<Settings />} />
                      <Route path="notifications" element={<Settings />} />
                      <Route path="privacy" element={<Settings />} />
                      <Route path="email" element={<Settings />} />
                      <Route path="localization" element={<Settings />} />
                      <Route path="system" element={<Settings />} />
                    </Route>
                    
                    {/* Admin Routes */}
                    <Route path="admin">
                      <Route index element={<Navigate to="/admin/users" replace />} />
                      <Route path="users">
                        <Route index element={
                          <PrivateRoute requiredRoles={['ADMIN', 'CEO', 'SUPER_ADMIN']}>
                            <UserManagement />
                          </PrivateRoute>
                        } />
                        <Route path="new" element={
                          <PrivateRoute requiredRoles={['ADMIN', 'CEO', 'SUPER_ADMIN']}>
                            <StaffRegistrationForm />
                          </PrivateRoute>
                        } />
                        <Route path="edit/:id" element={
                          <PrivateRoute requiredRoles={['ADMIN', 'CEO', 'SUPER_ADMIN']}>
                            <StaffRegistrationForm />
                          </PrivateRoute>
                        } />
                        <Route path="roles" element={<UserManagement />} />
                      </Route>
                      <Route path="positions" element={
                        <PrivateRoute requiredRoles={['ADMIN', 'CEO', 'SUPER_ADMIN']}>
                          <PositionManagement />
                        </PrivateRoute>
                      } />
                      <Route path="audit-logs" element={<AuditLogs />} />
                      <Route
                        path="transaction-log"
                        element={
                          <PrivateRoute requiredRoles={['CEO', 'SUPER_ADMIN']}>
                            <TransactionLog />
                          </PrivateRoute>
                        }
                      />
                      <Route path="backups" element={<BackupRestore />} />
                      <Route path="api-settings" element={<ApiSettings />} />
                    </Route>
                    
                    {/* Documentation & Help */}
                    <Route path="docs">
                      <Route index element={<Documentation />} />
                      <Route path="api" element={<Documentation />} />
                      <Route path="user-guide" element={<Documentation />} />
                      <Route path="admin-guide" element={<Documentation />} />
                    </Route>
                    
                    <Route path="help">
                      <Route index element={<HelpCenter />} />
                      <Route path="faq" element={<HelpCenter />} />
                      <Route path="contact" element={<HelpCenter />} />
                      <Route path="tutorials" element={<HelpCenter />} />
                    </Route>
                    
                    {/* Catch-all for protected routes */}
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  
                  {/* 404 for public routes */}
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </Router>
            </ToastProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
export const DASHBOARD_ALLOWED_ROLES = ['ADMIN', 'CEO', 'SUPER_ADMIN'];

export const canAccessDashboard = (role) => {
  return DASHBOARD_ALLOWED_ROLES.includes(String(role || '').toUpperCase());
};

export const getDefaultAuthenticatedRoute = (role) => {
  return canAccessDashboard(role) ? '/dashboard' : '/notifications';
};

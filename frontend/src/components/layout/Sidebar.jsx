import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Building,
  Building2,
  CarFront,
  ChevronDown,
  FileBarChart2,
  GitCompareArrows,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  TrendingUp,
  UserCircle2,
  UserPlus,
  UsersRound,
  Wallet,
  Bell,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DASHBOARD_ALLOWED_ROLES } from '../../utils/routeAccess';

const Sidebar = ({ open, onClose, variant = 'permanent' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const { mode } = useTheme();

  const [companySetupOpen, setCompanySetupOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [administrationOpen, setAdministrationOpen] = useState(false);

  const canManageCompanySetup = ['ADMIN', 'SUPER_ADMIN', 'CEO'].includes(user?.role);

  useEffect(() => {
    if (location.pathname.startsWith('/company-setup')) {
      setCompanySetupOpen(true);
    }

    if (
      location.pathname.startsWith('/expenses') ||
      location.pathname.startsWith('/income') ||
      location.pathname === '/profit'
    ) {
      setFinanceOpen(true);
    }

    if (
      location.pathname.startsWith('/admin/users') ||
      location.pathname.startsWith('/admin/positions')
    ) {
      setAdministrationOpen(true);
    }
  }, [location.pathname]);

  const handleNavigation = (path) => {
    navigate(path);
    if (variant === 'temporary' && onClose) onClose();
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isDriverFinanceRole = ['DRIVER', 'CHIEF_DRIVER'].includes(String(user?.role || '').toUpperCase());

  const menuItems = [
    { text: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: DASHBOARD_ALLOWED_ROLES },
    { text: 'Vehicles', path: '/vehicles', icon: CarFront },
    { text: 'My Profile', path: '/driver-profile', icon: UserCircle2, roles: ['DRIVER', 'CHIEF_DRIVER'] },
    { text: 'Customer Entry', path: '/customers', icon: Handshake, roles: ['ADMIN', 'CEO', 'ACCOUNTANT'] },
    { text: 'Income Approvals', path: '/income/modifications', icon: GitCompareArrows, roles: ['CEO', 'ACCOUNTANT'] },
    { text: 'Reports', path: '/reports', icon: FileBarChart2 },
    { text: 'Transaction Log', path: '/admin/transaction-log', icon: Receipt, roles: ['CEO', 'SUPER_ADMIN'] },
    { text: 'Notifications', path: '/notifications', icon: Bell },
    { text: 'Documentation', path: '/docs', icon: BookOpen },
  ];

  const financeItems = isDriverFinanceRole
    ? [
        { text: 'Vehicle Finance', path: '/expenses', icon: Wallet, roles: ['DRIVER', 'CHIEF_DRIVER'] },
      ]
    : [
        { text: 'Expenses', path: '/expenses', icon: Wallet },
        { text: 'Expense Approvals', path: '/expenses/approvals', icon: BadgeCheck, roles: ['CEO', 'SUPER_ADMIN'] },
        { text: 'Income Entry', path: '/income', icon: TrendingUp, roles: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'ACCOUNTANT'] },
        { text: 'My Income Modification Request', path: '/income/my-requests', icon: GitCompareArrows, roles: ['ADMIN', 'MANAGER'] },
        { text: 'Profit', path: '/profit', icon: TrendingUp, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN'] },
      ];

  const administrationItems = [
    { text: 'User Management', path: '/admin/users', icon: UsersRound, roles: ['ADMIN', 'CEO', 'SUPER_ADMIN'] },
    { text: 'Staff Onboarding', path: '/admin/users/new', icon: UserPlus, roles: ['ADMIN', 'CEO', 'SUPER_ADMIN'] },
    { text: 'Position Registry', path: '/admin/positions', icon: BriefcaseBusiness, roles: ['ADMIN', 'CEO', 'SUPER_ADMIN'] },
  ];

  const hasVisibleFinanceItem = financeItems.some((item) => !item.roles || item.roles.includes(user?.role));
  const financeSectionActive = financeItems.some((item) => {
    if (item.path === '/income') {
      return location.pathname === '/income' || location.pathname.startsWith('/income/');
    }
    return isActive(item.path);
  });

  const hasVisibleAdministrationItem = administrationItems.some((item) => !item.roles || item.roles.includes(user?.role));
  const administrationSectionActive = administrationItems.some((item) => isActive(item.path));

  const renderItem = (item, nested = false) => {
    if (item.roles && !item.roles.includes(user?.role)) return null;
    if (item.permission && !hasPermission(item.permission)) return null;

    const active = item.path === '/income'
      ? (location.pathname === '/income' || location.pathname.startsWith('/income/'))
      : isActive(item.path);
    const Icon = item.icon;

    return (
      <button
        key={item.path}
        onClick={() => handleNavigation(item.path)}
        className={`w-full text-left flex items-center gap-3 rounded-md transition-colors ${
          nested ? 'px-3 py-2 text-sm' : 'px-3 py-2.5 text-sm'
        } ${active
          ? (mode === 'dark' ? 'bg-slate-700 text-red-300 font-semibold' : 'bg-red-50 text-red-700 font-semibold')
          : (mode === 'dark' ? 'text-slate-200 hover:bg-slate-700/70' : 'text-gray-700 hover:bg-amber-100')}`}
      >
        <Icon className={`h-4 w-4 ${active ? 'text-red-500' : (mode === 'dark' ? 'text-slate-400' : 'text-gray-500')}`} />
        <span className="truncate">{item.text}</span>
      </button>
    );
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r shadow-sm transition-transform duration-200 ${mode === 'dark' ? 'border-slate-700 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800' : 'border-amber-100 bg-gradient-to-b from-amber-50 via-amber-50/95 to-white'} ${
        open || variant === 'permanent' ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-full flex-col">
        <div className={`flex items-center border-b bg-gradient-to-r px-4 py-5 ${mode === 'dark' ? 'border-slate-700 from-slate-800 to-slate-700 text-red-300' : 'border-amber-200 from-amber-100 to-amber-50 text-red-700'}`}>
          <div className="text-lg font-bold tracking-wide">MAPSI GROUP</div>
          <div className={`ml-2 text-sm font-semibold ${mode === 'dark' ? 'text-red-400' : 'text-red-500'}`}>EFMS</div>
        </div>

        <div className={`border-b px-4 py-3 ${mode === 'dark' ? 'border-slate-700 bg-slate-800/80' : 'border-amber-200 bg-amber-50/70'}`}>
          <div className="flex items-center">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full border font-semibold ${mode === 'dark' ? 'border-red-500/60 bg-red-500/20 text-red-300' : 'border-red-200 bg-red-100 text-red-700'}`}>
              {(user?.fullName || 'U').charAt(0)}
            </div>
            <div className="ml-3">
              <div className={`text-sm font-bold ${mode === 'dark' ? 'text-slate-100' : 'text-gray-800'}`}>{user?.fullName || 'User'}</div>
              <div className={`text-xs font-medium ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{user?.role || ''}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1.5 px-2">
            {menuItems.map((item) => (
              <li key={item.path}>{renderItem(item)}</li>
            ))}

            {hasVisibleFinanceItem && (
              <li>
                <button
                  onClick={() => setFinanceOpen((prev) => !prev)}
                  className={`w-full text-left flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                    financeSectionActive
                      ? (mode === 'dark' ? 'bg-slate-700 text-red-300' : 'bg-red-50 text-red-700')
                      : (mode === 'dark' ? 'text-slate-200 hover:bg-slate-700/70' : 'text-gray-700 hover:bg-amber-100')
                  }`}
                >
                  <Wallet className={`h-4 w-4 ${financeSectionActive ? 'text-red-500' : (mode === 'dark' ? 'text-slate-400' : 'text-gray-500')}`} />
                  <span className="truncate text-sm font-semibold tracking-wide">Finance</span>
                  <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${financeOpen ? 'rotate-180' : ''}`} />
                </button>

                {financeOpen && (
                  <div className={`mt-1 ml-4 space-y-1 border-l pl-3 ${mode === 'dark' ? 'border-slate-700' : 'border-amber-200'}`}>
                    {financeItems.map((item) => renderItem(item, true))}
                  </div>
                )}
              </li>
            )}

            {hasVisibleAdministrationItem && (
              <li>
                <button
                  onClick={() => setAdministrationOpen((prev) => !prev)}
                  className={`w-full text-left flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                    administrationSectionActive
                      ? (mode === 'dark' ? 'bg-slate-700 text-red-300' : 'bg-red-50 text-red-700')
                      : (mode === 'dark' ? 'text-slate-200 hover:bg-slate-700/70' : 'text-gray-700 hover:bg-amber-100')
                  }`}
                >
                  <ShieldCheck className={`h-4 w-4 ${administrationSectionActive ? 'text-red-500' : (mode === 'dark' ? 'text-slate-400' : 'text-gray-500')}`} />
                  <span className="truncate text-sm font-semibold tracking-wide">Administration</span>
                  <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${administrationOpen ? 'rotate-180' : ''}`} />
                </button>

                {administrationOpen && (
                  <div className={`mt-1 ml-4 space-y-1 border-l pl-3 ${mode === 'dark' ? 'border-slate-700' : 'border-amber-200'}`}>
                    {administrationItems.map((item) => renderItem(item, true))}
                  </div>
                )}
              </li>
            )}

            {canManageCompanySetup && (
              <li>
                <button
                  onClick={() => setCompanySetupOpen((prev) => !prev)}
                  className={`w-full text-left flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                    location.pathname.startsWith('/company-setup')
                      ? (mode === 'dark' ? 'bg-slate-700 text-red-300 font-semibold' : 'bg-red-50 text-red-700 font-semibold')
                      : (mode === 'dark' ? 'text-slate-200 hover:bg-slate-700/70' : 'text-gray-700 hover:bg-amber-100')
                  }`}
                >
                  <Building2 className={`h-4 w-4 ${location.pathname.startsWith('/company-setup') ? 'text-red-500' : (mode === 'dark' ? 'text-slate-400' : 'text-gray-500')}`} />
                  <span className="truncate">Company Setup</span>
                  <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${companySetupOpen ? 'rotate-180' : ''}`} />
                </button>

                {companySetupOpen && (
                  <div className={`mt-1 ml-4 space-y-1 border-l pl-3 ${mode === 'dark' ? 'border-slate-700' : 'border-amber-200'}`}>
                    <button
                      onClick={() => handleNavigation('/company-setup/main-company')}
                      className={`w-full text-left flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive('/company-setup/main-company')
                          ? (mode === 'dark' ? 'bg-slate-700 text-red-300 font-semibold' : 'bg-red-50 text-red-700 font-semibold')
                          : (mode === 'dark' ? 'text-slate-200 hover:bg-slate-700/70' : 'text-gray-700 hover:bg-amber-100')
                      }`}
                    >
                      <Building className={`h-4 w-4 ${isActive('/company-setup/main-company') ? 'text-red-500' : (mode === 'dark' ? 'text-slate-400' : 'text-gray-500')}`} />
                      <span>Main Company</span>
                    </button>
                    <button
                      onClick={() => handleNavigation('/company-setup/subsidiary')}
                      className={`w-full text-left flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive('/company-setup/subsidiary')
                          ? (mode === 'dark' ? 'bg-slate-700 text-red-300 font-semibold' : 'bg-red-50 text-red-700 font-semibold')
                          : (mode === 'dark' ? 'text-slate-200 hover:bg-slate-700/70' : 'text-gray-700 hover:bg-amber-100')
                      }`}
                    >
                      <Building2 className={`h-4 w-4 ${isActive('/company-setup/subsidiary') ? 'text-red-500' : (mode === 'dark' ? 'text-slate-400' : 'text-gray-500')}`} />
                      <span>Subsidiary</span>
                    </button>
                  </div>
                )}
              </li>
            )}
          </ul>
        </nav>

        <div className="px-3 pb-4">
          <button
            onClick={() => window.open('mailto:support@mapsigroup.com')}
            className={`w-full text-left flex items-center gap-3 rounded-md px-3 py-2 text-sm ${mode === 'dark' ? 'text-slate-200 hover:bg-slate-700/70' : 'text-gray-700 hover:bg-amber-100'}`}
          >
            <LifeBuoy className={`h-4 w-4 ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`} />
            <span>Help and Support</span>
          </button>
          <button
            onClick={logout}
            className={`mt-2 w-full text-left flex items-center gap-3 rounded-md px-3 py-2 text-sm ${mode === 'dark' ? 'text-slate-200 hover:bg-slate-700/70' : 'text-gray-700 hover:bg-amber-100'}`}
          >
            <LogOut className={`h-4 w-4 ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`} />
            <span>Logout</span>
          </button>
          <div className={`mt-3 text-xs ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Version 2.0.0</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

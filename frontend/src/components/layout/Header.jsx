// frontend/src/components/layout/Header.jsx
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, User, Menu, X } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const Header = ({ sidebarOpen, setSidebarOpen }) => {
  const { user } = useAuth();
  const { unreadCount } = useNotification ? useNotification() : { unreadCount: 0 };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="h-16 bg-red-600 border-b border-red-700 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-red-700 lg:hidden transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5 text-white" />
        </button>

        {/* Logo on mobile */}
        <div className="lg:hidden font-bold text-white text-lg">
          MAPSI<span className="text-red-200">EFMS</span>
        </div>

        <div className="flex-1 hidden lg:block"></div>

        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Notifications button */}
          <button className="p-2 rounded-lg hover:bg-red-700 relative transition-colors">
            <Bell className="h-5 w-5 text-white" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-yellow-400 text-red-600 text-xs font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User menu - mobile friendly */}
          <div className="relative">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center space-x-2 md:space-x-3 p-1 rounded-lg hover:bg-red-700 transition-colors"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white truncate max-w-[120px]">
                  {user?.fullName?.split(' ')[0] || user?.fullName || 'User'}
                </p>
                <p className="text-xs text-red-100 capitalize">{user?.role?.toLowerCase() || ''}</p>
              </div>
              <div className="h-8 w-8 md:h-10 md:w-10 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
            </button>

            {/* Dropdown menu for mobile */}
            {mobileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50">
                <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">
                  Profile
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">
                  Settings
                </button>
                <hr className="my-1" />
                <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
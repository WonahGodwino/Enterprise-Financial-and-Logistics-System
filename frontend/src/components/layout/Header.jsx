// frontend/src/components/layout/Header.jsx
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, User, Menu } from 'lucide-react';

const Header = ({ sidebarOpen, setSidebarOpen }) => {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-red-600 border-b border-red-700 flex items-center justify-between px-6">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="p-2 rounded-lg hover:bg-red-700 lg:hidden"
      >
        <Menu className="h-5 w-5 text-white" />
      </button>

      <div className="flex-1"></div>

      <div className="flex items-center space-x-4">
        <button className="p-2 rounded-lg hover:bg-red-700 relative">
          <Bell className="h-5 w-5 text-white" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs text-red-100 capitalize">{user?.role}</p>
          </div>
          <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
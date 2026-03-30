import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { mode, toggleTheme } = useTheme();
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    isPanelOpen,
    setIsPanelOpen,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotification();
  const currentYear = new Date().getFullYear();

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const recentNotifications = notifications.slice(0, 8);

  const formatNotificationTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${mode === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-amber-50/40 text-gray-900'}`}>
      {/* Sidebar (Tailwind) */}
      <Sidebar open={mobileOpen} onClose={handleDrawerToggle} variant={mobileOpen ? 'temporary' : 'permanent'} />

      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 h-16 border-b shadow-sm flex items-center z-30 transition-colors duration-300 ${mode === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-red-600 border-red-700'}`}>
        <div className={`w-full px-5 md:ml-72 md:px-6 flex items-center justify-between`}> {/* offset for sidebar */}
          <div className="flex items-center gap-3">
            <button onClick={handleDrawerToggle} className={`p-2 rounded-md md:hidden ${mode === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-red-700'}`}>
              <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M3 6h14M3 10h14M3 14h14" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <h1 className="text-lg font-semibold text-white">
              Welcome, {user?.fullName}
              {user?.role ? (
                <span className="ml-2 text-sm font-medium uppercase tracking-wide text-red-100">({user.role})</span>
              ) : null}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className={`px-3 py-1.5 rounded-md text-white text-sm font-bold tracking-wide border border-white/30 ${mode === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-red-700'}`}>
              {mode === 'dark' ? 'Light' : 'Dark'}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className={`relative p-2 rounded-md ${mode === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-red-700'}`}
              >
                <Bell className="h-7 w-7 text-white" strokeWidth={2.5} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] rounded-full bg-white px-1 text-center text-[11px] font-extrabold text-red-600 flex items-center justify-center shadow">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isPanelOpen && (
                <div className={`absolute right-0 mt-2 w-[380px] rounded-xl border shadow-xl z-50 transition-colors duration-300 ${mode === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-amber-100 bg-white'}`}>
                  <div className={`flex items-center justify-between border-b px-4 py-3 ${mode === 'dark' ? 'border-slate-700' : 'border-gray-100'}`}>
                    <h3 className={`text-sm font-semibold ${mode === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>Notifications</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className={`rounded-md p-1 ${mode === 'dark' ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'}`}
                        title="Mark all as read"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {recentNotifications.length === 0 ? (
                    <div className={`px-4 py-8 text-center text-sm ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>No notifications yet.</div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                      {recentNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => {
                            if (!notification.read) {
                              markAsRead(notification.id);
                            }
                          }}
                          className={`w-full border-b px-4 py-3 text-left ${mode === 'dark' ? 'border-slate-700 hover:bg-slate-700/70' : 'border-gray-100 hover:bg-amber-50'} ${
                            notification.read
                              ? (mode === 'dark' ? 'bg-slate-800' : 'bg-white')
                              : (mode === 'dark' ? 'bg-slate-700/70' : 'bg-red-50/70')
                          }`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              if (!notification.read) {
                                markAsRead(notification.id);
                              }
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-sm font-medium ${mode === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>{notification.title}</p>
                              <p className={`mt-1 text-xs line-clamp-2 ${mode === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>{notification.message}</p>
                              <p className={`mt-1 text-[11px] ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{formatNotificationTime(notification.createdAt)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeNotification(notification.id);
                              }}
                              className={`rounded p-1 ${mode === 'dark' ? 'text-slate-400 hover:bg-slate-600 hover:text-red-400' : 'text-gray-400 hover:bg-gray-100 hover:text-red-600'}`}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={`border-t px-4 py-2 ${mode === 'dark' ? 'border-slate-700' : 'border-gray-100'}`}>
                    <a href="/notifications" className="text-xs font-medium text-red-600 hover:text-red-700">
                      Open Notification Center
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className={`pt-16 p-6 flex-1 md:ml-72 transition-colors duration-300 ${mode === 'dark' ? 'bg-slate-900' : 'bg-amber-50/40'}`}>
        <Outlet />
      </main>

      {/* Global footer */}
      <footer className={`border-t px-6 py-4 text-xs md:ml-72 transition-colors duration-300 ${mode === 'dark' ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-gray-200 bg-white text-gray-600'}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={`font-medium ${mode === 'dark' ? 'text-slate-100' : 'text-gray-700'}`}>© {currentYear} MAPSI-EFMS. All rights reserved.</p>
            <p className={`mt-1 ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Enterprise Financial Management System</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a href="mailto:support@mapsi-efms.com" className="hover:text-red-600">
              Support
            </a>
            <a href="/privacy" className="hover:text-red-600">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-red-600">
              Terms of Service
            </a>
            <a href="/contact" className="hover:text-red-600">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
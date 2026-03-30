import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Filter, RefreshCw, Trash2 } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import NotificationCard from './NotificationCard';

const FILTERS = ['all', 'unread', 'read'];

const Notifications = () => {
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  } = useNotification();

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const loadNotifications = async () => {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    };

    loadNotifications();
  }, [fetchNotifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (filter === 'unread') return !notification.read;
      if (filter === 'read') return notification.read;
      return true;
    });
  }, [notifications, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
              {unreadCount} unread
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="flex items-center rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark All Read
          </button>

          <button
            onClick={clearAll}
            className="flex items-center rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Read
          </button>

          <button
            onClick={fetchNotifications}
            className="rounded-lg p-2 text-gray-600 hover:bg-red-50 hover:text-red-600"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            {FILTERS.map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors ${
                  filter === option
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading notifications...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <Bell className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p>No notifications found</p>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {filteredNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                isRead={notification.read}
                onMarkAsRead={markAsRead}
                onDelete={removeNotification}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;

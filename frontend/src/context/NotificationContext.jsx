// frontend/src/context/NotificationContext.jsx
import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import api from '../services/api';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const previousTopNotificationIdRef = useRef(null);

  const playNotificationSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.24);

      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 300);
    } catch (_error) {
      // Ignore sound errors on unsupported browsers or autoplay restrictions.
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (!accessToken) {
      setNotifications([]);
      previousTopNotificationIdRef.current = null;
      return;
    }

    try {
      const response = await api.getNotifications();
      const next = Array.isArray(response?.data) ? response.data : [];

      const nextTopId = next[0]?.id || null;
      const previousTopId = previousTopNotificationIdRef.current;
      const hasNewTopNotification = Boolean(previousTopId && nextTopId && previousTopId !== nextTopId);
      const hasUnread = next.some((item) => !item.read);

      if (hasNewTopNotification && hasUnread) {
        playNotificationSound();
      }

      previousTopNotificationIdRef.current = nextTopId;
      setNotifications(next);
    } catch (error) {
      // Skip noisy logging for expired/invalid sessions; auth interceptor handles redirects.
      if (error?.response?.status !== 401) {
        console.error('Error fetching notifications:', error);
      }
    }
  }, [playNotificationSound]);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 15000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev].slice(0, 50));
    if (!notification?.read) {
      playNotificationSound();
    }
  }, [playNotificationSound]);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    api.deleteNotification(id).catch((error) => {
      console.error('Error deleting notification:', error);
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications((prev) => prev.filter((n) => !n.read));
    api.deleteReadNotifications().catch((error) => {
      console.error('Error clearing read notifications:', error);
    });
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    api.markNotificationAsRead(id).catch((error) => {
      console.error('Error marking notification as read:', error);
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api.markAllNotificationsAsRead().catch((error) => {
      console.error('Error marking all notifications as read:', error);
    });
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = {
    notifications,
    unreadCount,
    addNotification,
    removeNotification,
    clearAll,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
    isPanelOpen,
    setIsPanelOpen,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
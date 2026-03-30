import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (token && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      // Fetch permissions
      await loadPermissions(parsedUser);
    }
    setLoading(false);
  };

  const loadPermissions = async (userData = user) => {
    // Load user permissions based on role
    const rolePermissions = {
      ADMIN: ['view_all', 'create', 'edit', 'delete', 'manage_users', 'export'],
      CEO: ['view_all', 'export'],
      MANAGER: ['view_own', 'create', 'edit'],
      ACCOUNTANT: ['view_all', 'approve', 'export'],
      VIEWER: ['view_own'],
    };

    if (userData) {
      setPermissions(rolePermissions[userData.role] || []);
    }
  };

  const login = async (email, password, rememberMe = false) => {
    const response = await api.login(email, password);

    if (!response?.accessToken || !response?.user) {
      return false;
    }

    setUser(response.user);
    await loadPermissions(response.user);

    if (!rememberMe) {
      sessionStorage.setItem('accessToken', response.accessToken);
      localStorage.removeItem('accessToken');

      if (response.refreshToken) {
        sessionStorage.setItem('refreshToken', response.refreshToken);
        localStorage.removeItem('refreshToken');
      }

      sessionStorage.setItem('user', JSON.stringify(response.user));
      localStorage.removeItem('user');
    }

    return true;
  };

  const logout = () => {
    api.logout();
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    setUser(null);
    setPermissions([]);
  };

  const hasPermission = (permission) => {
    return permissions.includes(permission);
  };

  const value = {
    user,
    login,
    logout,
    loading,
    hasPermission,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isCEO: user?.role === 'CEO',
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
// frontend/src/components/settings/Settings.jsx
import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Palette,
  Globe,
  Mail,
  Database,
  Save,
  RefreshCw,
  Moon,
  Sun,
  Monitor
} from 'lucide-react';

const Settings = () => {
  const [settings, setSettings] = useState({
    general: {
      companyName: 'MAPSI-EFMS',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      language: 'en',
      currency: 'NGN'
    },
    appearance: {
      theme: 'light',
      primaryColor: '#2563eb',
      sidebarCollapsed: false,
      denseMode: false,
      animations: true
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      desktopNotifications: false,
      expenseAlerts: true,
      maintenanceAlerts: true,
      reportReady: true,
      systemUpdates: false
    },
    privacy: {
      shareAnalytics: true,
      autoLogout: 30,
      sessionTimeout: 60,
      twoFactorAuth: false,
      ipWhitelist: []
    },
    email: {
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      fromEmail: '',
      fromName: '',
      encryption: 'tls'
    },
    localization: {
      country: 'US',
      unitSystem: 'metric',
      distanceUnit: 'km',
      volumeUnit: 'L',
      weightUnit: 'kg',
      temperatureUnit: 'C'
    }
  });

  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'localization', label: 'Localization', icon: Globe },
    { id: 'system', label: 'System', icon: Database }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <div className="flex items-center space-x-4">
          {saved && (
            <span className="text-green-600 flex items-center">
              <Save className="h-4 w-4 mr-1" />
              Saved successfully
            </span>
          )}
          <button
            onClick={saveSettings}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex space-x-6">
        {/* Sidebar */}
        <div className="w-64 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-4 py-3 text-sm rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-red-50 text-red-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-lg shadow p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">General Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={settings.general.companyName}
                    onChange={(e) => handleChange('general', 'companyName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timezone
                    </label>
                    <select
                      value={settings.general.timezone}
                      onChange={(e) => handleChange('general', 'timezone', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Language
                    </label>
                    <select
                      value={settings.general.language}
                      onChange={(e) => handleChange('general', 'language', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Format
                    </label>
                    <select
                      value={settings.general.dateFormat}
                      onChange={(e) => handleChange('general', 'dateFormat', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency
                    </label>
                    <select
                      value={settings.general.currency}
                      onChange={(e) => handleChange('general', 'currency', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="NGN">NGN (₦)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="JPY">JPY (¥)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Appearance</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Theme
                  </label>
                  <div className="flex space-x-4">
                    {[
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'system', label: 'System', icon: Monitor }
                    ].map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => handleChange('appearance', 'theme', theme.id)}
                        className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 border rounded-lg ${
                          settings.appearance.theme === theme.id
                            ? 'border-red-500 bg-red-50 text-red-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <theme.icon className="h-4 w-4" />
                        <span>{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="color"
                      value={settings.appearance.primaryColor}
                      onChange={(e) => handleChange('appearance', 'primaryColor', e.target.value)}
                      className="h-10 w-20"
                    />
                    <input
                      type="text"
                      value={settings.appearance.primaryColor}
                      onChange={(e) => handleChange('appearance', 'primaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.appearance.sidebarCollapsed}
                    onChange={(e) => handleChange('appearance', 'sidebarCollapsed', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Collapse Sidebar by Default</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.appearance.denseMode}
                    onChange={(e) => handleChange('appearance', 'denseMode', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Dense Mode (compact interface)</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.appearance.animations}
                    onChange={(e) => handleChange('appearance', 'animations', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable Animations</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Notification Settings</h2>
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">Channels</h3>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications.emailNotifications}
                    onChange={(e) => handleChange('notifications', 'emailNotifications', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Email Notifications</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications.pushNotifications}
                    onChange={(e) => handleChange('notifications', 'pushNotifications', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Push Notifications</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications.desktopNotifications}
                    onChange={(e) => handleChange('notifications', 'desktopNotifications', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Desktop Notifications</span>
                </label>

                <h3 className="text-sm font-medium text-gray-700 mt-4">Alert Types</h3>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications.expenseAlerts}
                    onChange={(e) => handleChange('notifications', 'expenseAlerts', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Expense Alerts</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications.maintenanceAlerts}
                    onChange={(e) => handleChange('notifications', 'maintenanceAlerts', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Maintenance Alerts</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications.reportReady}
                    onChange={(e) => handleChange('notifications', 'reportReady', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Report Ready Notifications</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications.systemUpdates}
                    onChange={(e) => handleChange('notifications', 'systemUpdates', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">System Updates</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Privacy & Security</h2>
              
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.privacy.shareAnalytics}
                    onChange={(e) => handleChange('privacy', 'shareAnalytics', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Share Anonymous Usage Analytics</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.privacy.twoFactorAuth}
                    onChange={(e) => handleChange('privacy', 'twoFactorAuth', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable Two-Factor Authentication</span>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Auto Logout (minutes)
                    </label>
                    <input
                      type="number"
                      value={settings.privacy.autoLogout}
                      onChange={(e) => handleChange('privacy', 'autoLogout', parseInt(e.target.value))}
                      min="1"
                      max="1440"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      value={settings.privacy.sessionTimeout}
                      onChange={(e) => handleChange('privacy', 'sessionTimeout', parseInt(e.target.value))}
                      min="5"
                      max="480"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IP Whitelist (one per line)
                  </label>
                  <textarea
                    value={settings.privacy.ipWhitelist.join('\n')}
                    onChange={(e) => handleChange('privacy', 'ipWhitelist', e.target.value.split('\n').filter(ip => ip.trim()))}
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="192.168.1.1&#10;10.0.0.0/24"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Email Configuration</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={settings.email.smtpHost}
                      onChange={(e) => handleChange('email', 'smtpHost', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="smtp.gmail.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      value={settings.email.smtpPort}
                      onChange={(e) => handleChange('email', 'smtpPort', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="587"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SMTP Username
                    </label>
                    <input
                      type="text"
                      value={settings.email.smtpUser}
                      onChange={(e) => handleChange('email', 'smtpUser', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SMTP Password
                    </label>
                    <input
                      type="password"
                      value={settings.email.smtpPassword}
                      onChange={(e) => handleChange('email', 'smtpPassword', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      From Email
                    </label>
                    <input
                      type="email"
                      value={settings.email.fromEmail}
                      onChange={(e) => handleChange('email', 'fromEmail', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="noreply@mapsi-efms.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={settings.email.fromName}
                      onChange={(e) => handleChange('email', 'fromName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="MAPSI-EFMS"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Encryption
                  </label>
                  <select
                    value={settings.email.encryption}
                    onChange={(e) => handleChange('email', 'encryption', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="none">None</option>
                    <option value="tls">TLS</option>
                    <option value="ssl">SSL</option>
                  </select>
                </div>

                <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                  Test Email Configuration
                </button>
              </div>
            </div>
          )}

          {activeTab === 'localization' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Localization</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country
                  </label>
                  <select
                    value={settings.localization.country}
                    onChange={(e) => handleChange('localization', 'country', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit System
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="unitSystem"
                        value="metric"
                        checked={settings.localization.unitSystem === 'metric'}
                        onChange={(e) => handleChange('localization', 'unitSystem', e.target.value)}
                        className="h-4 w-4 text-red-600 focus:ring-red-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Metric</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="unitSystem"
                        value="imperial"
                        checked={settings.localization.unitSystem === 'imperial'}
                        onChange={(e) => handleChange('localization', 'unitSystem', e.target.value)}
                        className="h-4 w-4 text-red-600 focus:ring-red-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Imperial</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Distance Unit
                    </label>
                    <select
                      value={settings.localization.distanceUnit}
                      onChange={(e) => handleChange('localization', 'distanceUnit', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="km">Kilometers</option>
                      <option value="mi">Miles</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Volume Unit
                    </label>
                    <select
                      value={settings.localization.volumeUnit}
                      onChange={(e) => handleChange('localization', 'volumeUnit', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="L">Liters</option>
                      <option value="gal">Gallons</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Weight Unit
                    </label>
                    <select
                      value={settings.localization.weightUnit}
                      onChange={(e) => handleChange('localization', 'weightUnit', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="kg">Kilograms</option>
                      <option value="lbs">Pounds</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Temperature Unit
                    </label>
                    <select
                      value={settings.localization.temperatureUnit}
                      onChange={(e) => handleChange('localization', 'temperatureUnit', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="C">Celsius</option>
                      <option value="F">Fahrenheit</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">System Settings</h2>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">System Information</h3>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Version</dt>
                      <dd className="text-sm font-medium">2.1.0</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Last Updated</dt>
                      <dd className="text-sm font-medium">March 10, 2026</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Environment</dt>
                      <dd className="text-sm font-medium">Production</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Database</dt>
                      <dd className="text-sm font-medium">PostgreSQL 14</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Maintenance</h3>
                  <div className="space-y-2">
                    <button className="w-full text-left px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      Clear System Cache
                    </button>
                    <button className="w-full text-left px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      Run Database Optimization
                    </button>
                    <button className="w-full text-left px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-red-600">
                      Factory Reset (All Data)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
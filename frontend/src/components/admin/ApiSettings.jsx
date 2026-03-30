// frontend/src/components/admin/ApiSettings.jsx
import React, { useState, useEffect } from 'react';
import {
  Key,
  Globe,
  Shield,
  Clock,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  Lock,
  Activity
} from 'lucide-react';

const ApiSettings = () => {
  const [settings, setSettings] = useState({
    apiKeys: [],
    rateLimits: {
      enabled: true,
      maxRequests: 1000,
      timeWindow: 3600,
      burstSize: 50
    },
    security: {
      requireHttps: true,
      enableCors: true,
      allowedOrigins: ['*'],
      jwtExpiry: 86400,
      refreshTokenExpiry: 604800
    },
    endpoints: {
      enabled: true,
      baseUrl: '/api/v1',
      version: 'v1',
      documentation: true
    },
    monitoring: {
      enableLogging: true,
      logLevel: 'info',
      enableMetrics: true,
      retentionDays: 30
    }
  });

  const [newApiKey, setNewApiKey] = useState({
    name: '',
    permissions: [],
    expiryDays: 30
  });

  const [showKey, setShowKey] = useState({});
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    fetchApiSettings();
  }, []);

  const fetchApiSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/api-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching API settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    try {
      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newApiKey)
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({
          ...prev,
          apiKeys: [...prev.apiKeys, data]
        }));
        setNewApiKey({ name: '', permissions: [], expiryDays: 30 });
      }
    } catch (error) {
      console.error('Error generating API key:', error);
    }
  };

  const revokeApiKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to revoke this API key?')) return;

    try {
      const response = await fetch(`/api/admin/api-keys/${keyId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSettings(prev => ({
          ...prev,
          apiKeys: prev.apiKeys.filter(key => key.id !== keyId)
        }));
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/api-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        alert('Settings saved successfully');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">API Settings</h1>
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'general', label: 'General', icon: Globe },
            { id: 'keys', label: 'API Keys', icon: Key },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'rateLimits', label: 'Rate Limits', icon: Clock },
            { id: 'monitoring', label: 'Monitoring', icon: Activity }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">General Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={settings.endpoints.baseUrl}
                  onChange={(e) => setSettings({
                    ...settings,
                    endpoints: { ...settings.endpoints, baseUrl: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Version
                </label>
                <select
                  value={settings.endpoints.version}
                  onChange={(e) => setSettings({
                    ...settings,
                    endpoints: { ...settings.endpoints, version: e.target.value }
                  })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="v1">v1</option>
                  <option value="v2">v2</option>
                  <option value="v3">v3</option>
                </select>
              </div>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.endpoints.enabled}
                  onChange={(e) => setSettings({
                    ...settings,
                    endpoints: { ...settings.endpoints, enabled: e.target.checked }
                  })}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable API Access</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.endpoints.documentation}
                  onChange={(e) => setSettings({
                    ...settings,
                    endpoints: { ...settings.endpoints, documentation: e.target.checked }
                  })}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable API Documentation</span>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'keys' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">API Keys</h2>
              <button
                onClick={generateApiKey}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
              >
                <Key className="h-4 w-4 mr-2" />
                Generate New Key
              </button>
            </div>

            {/* New Key Form */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Generate New API Key</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Key Name</label>
                  <input
                    type="text"
                    value={newApiKey.name}
                    onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })}
                    placeholder="e.g., Mobile App Key"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Expiry (days)</label>
                  <input
                    type="number"
                    value={newApiKey.expiryDays}
                    onChange={(e) => setNewApiKey({ ...newApiKey, expiryDays: parseInt(e.target.value) })}
                    min="1"
                    max="365"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Permissions</label>
                  <select
                    multiple
                    value={newApiKey.permissions}
                    onChange={(e) => setNewApiKey({
                      ...newApiKey,
                      permissions: Array.from(e.target.selectedOptions, option => option.value)
                    })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="read">Read</option>
                    <option value="write">Write</option>
                    <option value="delete">Delete</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            </div>

            {/* API Keys List */}
            <div className="space-y-4">
              {settings.apiKeys.map((key) => (
                <div key={key.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{key.name}</h4>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                        <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                        <span>Expires: {new Date(key.expiresAt).toLocaleDateString()}</span>
                        <span>Last Used: {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                          {showKey[key.id] ? key.key : '••••••••••••••••'}
                        </code>
                        <button
                          onClick={() => setShowKey({ ...showKey, [key.id]: !showKey[key.id] })}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        >
                          {showKey[key.id] ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <button
                        onClick={() => copyToClipboard(key.key)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        {copied ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => revokeApiKey(key.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Lock className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-gray-500">Permissions: </span>
                    {key.permissions.map(perm => (
                      <span key={perm} className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded ml-1">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {settings.apiKeys.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Key className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p>No API keys generated yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Security Settings</h2>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.security.requireHttps}
                  onChange={(e) => setSettings({
                    ...settings,
                    security: { ...settings.security, requireHttps: e.target.checked }
                  })}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Require HTTPS</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.security.enableCors}
                  onChange={(e) => setSettings({
                    ...settings,
                    security: { ...settings.security, enableCors: e.target.checked }
                  })}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable CORS</span>
              </label>

              {settings.security.enableCors && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Allowed Origins
                  </label>
                  <textarea
                    value={settings.security.allowedOrigins.join('\n')}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: {
                        ...settings.security,
                        allowedOrigins: e.target.value.split('\n').filter(origin => origin.trim())
                      }
                    })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Enter allowed origins (one per line)"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    JWT Expiry (seconds)
                  </label>
                  <input
                    type="number"
                    value={settings.security.jwtExpiry}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, jwtExpiry: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Refresh Token Expiry (seconds)
                  </label>
                  <input
                    type="number"
                    value={settings.security.refreshTokenExpiry}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, refreshTokenExpiry: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rateLimits' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Rate Limiting</h2>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.rateLimits.enabled}
                  onChange={(e) => setSettings({
                    ...settings,
                    rateLimits: { ...settings.rateLimits, enabled: e.target.checked }
                  })}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable Rate Limiting</span>
              </label>

              {settings.rateLimits.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Requests
                    </label>
                    <input
                      type="number"
                      value={settings.rateLimits.maxRequests}
                      onChange={(e) => setSettings({
                        ...settings,
                        rateLimits: { ...settings.rateLimits, maxRequests: parseInt(e.target.value) }
                      })}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time Window (seconds)
                    </label>
                    <input
                      type="number"
                      value={settings.rateLimits.timeWindow}
                      onChange={(e) => setSettings({
                        ...settings,
                        rateLimits: { ...settings.rateLimits, timeWindow: parseInt(e.target.value) }
                      })}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Burst Size
                    </label>
                    <input
                      type="number"
                      value={settings.rateLimits.burstSize}
                      onChange={(e) => setSettings({
                        ...settings,
                        rateLimits: { ...settings.rateLimits, burstSize: parseInt(e.target.value) }
                      })}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Monitoring & Logging</h2>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.monitoring.enableLogging}
                  onChange={(e) => setSettings({
                    ...settings,
                    monitoring: { ...settings.monitoring, enableLogging: e.target.checked }
                  })}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable API Logging</span>
              </label>

              {settings.monitoring.enableLogging && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Log Level
                  </label>
                  <select
                    value={settings.monitoring.logLevel}
                    onChange={(e) => setSettings({
                      ...settings,
                      monitoring: { ...settings.monitoring, logLevel: e.target.value }
                    })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              )}

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.monitoring.enableMetrics}
                  onChange={(e) => setSettings({
                    ...settings,
                    monitoring: { ...settings.monitoring, enableMetrics: e.target.checked }
                  })}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable Metrics Collection</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Log Retention (days)
                </label>
                <input
                  type="number"
                  value={settings.monitoring.retentionDays}
                  onChange={(e) => setSettings({
                    ...settings,
                    monitoring: { ...settings.monitoring, retentionDays: parseInt(e.target.value) }
                  })}
                  min="1"
                  max="365"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiSettings;
// frontend/src/components/admin/BackupRestore.jsx
import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Clock,
  HardDrive,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Archive
} from 'lucide-react';

const BackupRestore = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupConfig, setBackupConfig] = useState({
    schedule: 'daily',
    retentionDays: 30,
    includeFiles: true,
    includeDatabase: true,
    compression: true,
    encryption: true
  });

  useEffect(() => {
    fetchBackups();
    fetchBackupConfig();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/backups');
      if (response.ok) {
        const data = await response.json();
        setBackups(data);
      }
    } catch (error) {
      console.error('Error fetching backups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackupConfig = async () => {
    try {
      const response = await fetch('/api/admin/backups/config');
      if (response.ok) {
        const data = await response.json();
        setBackupConfig(data);
      }
    } catch (error) {
      console.error('Error fetching backup config:', error);
    }
  };

  const createBackup = async () => {
    setCreatingBackup(true);
    try {
      const response = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupConfig)
      });

      if (response.ok) {
        await fetchBackups();
      }
    } catch (error) {
      console.error('Error creating backup:', error);
    } finally {
      setCreatingBackup(false);
    }
  };

  const downloadBackup = async (backupId) => {
    try {
      const response = await fetch(`/api/admin/backups/${backupId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${backupId}.zip`;
        a.click();
      }
    } catch (error) {
      console.error('Error downloading backup:', error);
    }
  };

  const restoreBackup = async (backupId) => {
    if (!window.confirm('Are you sure you want to restore this backup? This will overwrite current data.')) {
      return;
    }

    setRestoring(true);
    try {
      const response = await fetch(`/api/admin/backups/${backupId}/restore`, {
        method: 'POST'
      });

      if (response.ok) {
        alert('Backup restored successfully');
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      alert('Failed to restore backup');
    } finally {
      setRestoring(false);
    }
  };

  const deleteBackup = async (backupId) => {
    if (!window.confirm('Are you sure you want to delete this backup?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/backups/${backupId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setBackups(backups.filter(b => b.id !== backupId));
      }
    } catch (error) {
      console.error('Error deleting backup:', error);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Backup & Restore</h1>
        <button
          onClick={createBackup}
          disabled={creatingBackup}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
        >
          {creatingBackup ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Creating Backup...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Create Backup Now
            </>
          )}
        </button>
      </div>

      {/* Backup Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Backup Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule
            </label>
            <select
              value={backupConfig.schedule}
              onChange={(e) => setBackupConfig({ ...backupConfig, schedule: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Retention Period (days)
            </label>
            <input
              type="number"
              value={backupConfig.retentionDays}
              onChange={(e) => setBackupConfig({ ...backupConfig, retentionDays: parseInt(e.target.value) })}
              min="1"
              max="365"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={backupConfig.includeDatabase}
                onChange={(e) => setBackupConfig({ ...backupConfig, includeDatabase: e.target.checked })}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Include Database</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={backupConfig.includeFiles}
                onChange={(e) => setBackupConfig({ ...backupConfig, includeFiles: e.target.checked })}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Include Uploaded Files</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={backupConfig.compression}
                onChange={(e) => setBackupConfig({ ...backupConfig, compression: e.target.checked })}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Compress Backup</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={backupConfig.encryption}
                onChange={(e) => setBackupConfig({ ...backupConfig, encryption: e.target.checked })}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Encrypt Backup</span>
            </label>
          </div>
        </div>
      </div>

      {/* Backup Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Backups</p>
              <p className="text-2xl font-bold text-gray-800">{backups.length}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <Archive className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Size</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatFileSize(backups.reduce((sum, b) => sum + b.size, 0))}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <HardDrive className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Last Backup</p>
              <p className="text-lg font-bold text-gray-800">
                {backups[0] ? new Date(backups[0].createdAt).toLocaleDateString() : 'Never'}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Available Backups</h2>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 text-red-600 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {backups.map((backup) => (
              <div key={backup.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${
                      backup.status === 'completed' ? 'bg-green-100' :
                      backup.status === 'failed' ? 'bg-red-100' :
                      'bg-yellow-100'
                    }`}>
                      {backup.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : backup.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        Backup {new Date(backup.createdAt).toLocaleString()}
                      </h3>
                      <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center">
                          <HardDrive className="h-3 w-3 mr-1" />
                          {formatFileSize(backup.size)}
                        </span>
                        <span className="flex items-center">
                          <Database className="h-3 w-3 mr-1" />
                          {backup.type}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {backup.duration}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => downloadBackup(backup.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => restoreBackup(backup.id)}
                      disabled={restoring}
                      className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg"
                      title="Restore"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteBackup(backup.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {backup.status === 'failed' && backup.error && (
                  <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                    Error: {backup.error}
                  </div>
                )}
              </div>
            ))}

            {backups.length === 0 && (
              <div className="text-center py-8">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No backups available</p>
                <button
                  onClick={createBackup}
                  className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  Create First Backup
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupRestore;
// frontend/src/components/drivers/DriverProfile.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Truck,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  ClipboardList,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  Activity,
  Route,
} from 'lucide-react';
import api from '../../services/api';

const statusBadge = (status) => {
  const map = {
    ACTIVE: 'bg-green-100 text-green-800',
    MAINTENANCE: 'bg-yellow-100 text-yellow-800',
    INACTIVE: 'bg-red-100 text-red-800',
    SOLD: 'bg-gray-100 text-gray-800',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};

const requestTargetStatusBadge = (status) => {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'ACTIVE') {
    return 'bg-green-100 text-green-800';
  }

  if (['OUT_OF_SERVICE', 'MAINTENANCE', 'INACTIVE'].includes(normalized)) {
    return 'bg-red-100 text-red-700';
  }

  return 'bg-gray-100 text-gray-700';
};

const requestStatusIcon = (status) => {
  if (status === 'APPROVED') return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === 'REJECTED') return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === 'PENDING_EXECUTIVE_REVIEW') return <AlertCircle className="h-4 w-4 text-blue-500" />;
  return <Clock className="h-4 w-4 text-amber-500" />;
};

const requestStatusLabel = (status) => {
  const map = {
    PENDING_CHIEF_REVIEW: 'Pending Chief Review',
    PENDING_EXECUTIVE_REVIEW: 'Pending Exec Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  };
  return map[status] || status;
};

const parseDateTimeValue = (value) => {
  if (!value) return null;

  // datetime-local value (e.g. 2026-03-22T11:41)
  const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
  if (localDateTimePattern.test(value)) {
    const [datePart, timePart] = value.split('T');
    const [year, month, day] = datePart.split('-').map((part) => Number(part));
    const [hours, minutes, seconds = 0] = timePart.split(':').map((part) => Number(part));
    const parsedLocal = new Date(year, month - 1, day, hours, minutes, seconds, 0);
    return Number.isNaN(parsedLocal.getTime()) ? null : parsedLocal;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatFriendlyDateTime = (value) => {
  const parsed = parseDateTimeValue(value);
  if (!parsed) return String(value || '');
  return parsed.toLocaleString('en-NG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatTripDuration = (departureAt, arrivalAt) => {
  const departure = parseDateTimeValue(departureAt);
  const arrival = parseDateTimeValue(arrivalAt);

  if (!departure || !arrival) return '—';

  const totalMinutes = Math.max(0, Math.round((arrival.getTime() - departure.getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
};

const DriverProfile = () => {
  const [profile, setProfile] = useState(null);
  const [vehicleLogs, setVehicleLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [vehicleDetail, setVehicleDetail] = useState(null);
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logError, setLogError] = useState('');
  const [logSuccess, setLogSuccess] = useState('');
  const [logForm, setLogForm] = useState({
    startPoint: '',
    destination: '',
    departureAt: '',
    arrivalAt: '',
    initialOdometer: '',
    destinationOdometer: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getMyProfile();
      setProfile(response?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVehicleLogs = useCallback(async (vehicleId) => {
    if (!vehicleId) {
      setVehicleLogs([]);
      return;
    }

    setLoadingLogs(true);
    try {
      const response = await api.getMyVehicleLogs({ vehicleId, limit: 20 });
      setVehicleLogs(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setLogError(err?.response?.data?.message || 'Failed to load vehicle logs.');
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const fetchVehicleDetail = useCallback(async (vehicleId) => {
    if (!vehicleId) { setVehicleDetail(null); return; }
    try {
      const response = await api.getVehicleDetail(vehicleId);
      setVehicleDetail(response?.data || null);
    } catch (_err) {
      setVehicleDetail(null);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const vehicleId = profile?.assignedVehicles?.[0]?.vehicle?.id;
    if (vehicleId) {
      fetchVehicleLogs(vehicleId);
    } else {
      setVehicleLogs([]);
    }
  }, [profile, fetchVehicleLogs]);

  useEffect(() => {
    const vehicleId = profile?.assignedVehicles?.[0]?.vehicle?.id;
    fetchVehicleDetail(vehicleId || null);
  }, [profile, fetchVehicleDetail]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 px-6 py-8 text-center text-red-700">
        <AlertCircle className="h-8 w-8 mx-auto mb-3" />
        <p>{error}</p>
        <button onClick={fetchProfile} className="mt-4 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  if (!profile) return null;

  const assignedVehicle = profile.assignedVehicles?.[0]?.vehicle ?? null;
  const assignedAt = profile.assignedVehicles?.[0]?.assignedAt ?? null;
  const recentRequests = profile.requestedVehicleStatusChanges || [];
  const roleName = String(profile.role || '').replace('_', ' ');

  const calculatedDistanceKm = (() => {
    const start = Number(logForm.initialOdometer);
    const end = Number(logForm.destinationOdometer);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (end < start) return null;
    return end - start;
  })();

  const handleVehicleLogChange = (event) => {
    const { name, value } = event.target;
    setLogForm((current) => ({ ...current, [name]: value }));
    setLogError('');
    setLogSuccess('');
  };

  const handleSubmitVehicleLog = async (event) => {
    event.preventDefault();
    if (!assignedVehicle?.id) {
      setLogError('No assigned vehicle found for this driver.');
      return;
    }

    const payload = {
      vehicleId: assignedVehicle.id,
      startPoint: logForm.startPoint.trim(),
      destination: logForm.destination.trim(),
      departureAt: logForm.departureAt || null,
      arrivalAt: logForm.arrivalAt || null,
      initialOdometer: Number(logForm.initialOdometer),
      destinationOdometer: Number(logForm.destinationOdometer),
    };

    if (!payload.startPoint || !payload.destination || !payload.departureAt || !payload.arrivalAt) {
      setLogError('Start point, destination, departure date-time and arrival date-time are required.');
      return;
    }

    if (!Number.isFinite(payload.initialOdometer) || !Number.isFinite(payload.destinationOdometer)) {
      setLogError('Initial and destination odometer values are required.');
      return;
    }

    const departureTime = parseDateTimeValue(payload.departureAt);
    const arrivalTime = parseDateTimeValue(payload.arrivalAt);
    if (
      !departureTime || Number.isNaN(departureTime.getTime()) ||
      !arrivalTime || Number.isNaN(arrivalTime.getTime())
    ) {
      setLogError('Please enter valid departure and arrival date-time values.');
      return;
    }

    if (arrivalTime < departureTime) {
      const departureLabel = formatFriendlyDateTime(payload.departureAt);
      const arrivalLabel = formatFriendlyDateTime(payload.arrivalAt);
      setLogError(
        `Arrival date-time must be greater than or equal to departure date-time. Selected departure: ${departureLabel}. Selected arrival: ${arrivalLabel}. If you intended afternoon time, switch AM to PM.`
      );
      return;
    }

    if (payload.destinationOdometer < payload.initialOdometer) {
      setLogError('Destination odometer must be greater than or equal to initial odometer.');
      return;
    }

    setSubmittingLog(true);
    try {
      await api.createVehicleLog(payload);
      setLogSuccess('Vehicle log submitted successfully.');
      setLogForm({
        startPoint: '',
        destination: '',
        departureAt: '',
        arrivalAt: '',
        initialOdometer: '',
        destinationOdometer: '',
      });
      await fetchVehicleLogs(assignedVehicle.id);
    } catch (err) {
      setLogError(err?.response?.data?.message || 'Failed to submit vehicle log.');
    } finally {
      setSubmittingLog(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 pt-6 pb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-100">Driver Profile</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white truncate">{profile.fullName}</h1>
          <p className="mt-1 text-sm font-medium text-red-100">Professional driver account overview</p>
        </div>
        <div className="px-6 pb-6 -mt-8 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="h-20 w-20 rounded-full bg-white shadow-md border-4 border-white flex items-center justify-center flex-shrink-0">
            {profile.profileImage ? (
              <img src={profile.profileImage} alt="Profile" className="h-full w-full rounded-full object-cover" />
            ) : (
              <User className="h-10 w-10 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-0.5 text-xs font-semibold text-red-700">
                <Shield className="h-3 w-3" /> {roleName}
              </span>
              {profile.isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">
                  <Activity className="h-3 w-3" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-0.5 text-xs font-semibold text-gray-600">
                  Inactive
                </span>
              )}
              {profile.employeeId ? (
                <span className="text-xs text-gray-500">ID: {profile.employeeId}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Contact & Work Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Contact Information</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500">Email</dt>
                  <dd className="text-sm font-medium text-gray-800 break-all">{profile.email}</dd>
                </div>
              </div>
              {profile.phoneNumber ? (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-500">Phone</dt>
                    <dd className="text-sm font-medium text-gray-800">{profile.phoneNumber}</dd>
                  </div>
                </div>
              ) : null}
              {profile.address ? (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-500">Address</dt>
                    <dd className="text-sm font-medium text-gray-800">{profile.address}</dd>
                  </div>
                </div>
              ) : null}
            </dl>
          </div>

          {/* Employment Details */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Employment Details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500">Unit / Subsidiary</dt>
                  <dd className="text-sm font-medium text-gray-800">
                    {profile.subsidiary?.name ?? '—'} {profile.subsidiary?.code ? `(${profile.subsidiary.code})` : ''}
                  </dd>
                </div>
              </div>
              {(profile.positionRecord?.name || profile.position) ? (
                <div className="flex items-start gap-3">
                  <Briefcase className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-500">Position</dt>
                    <dd className="text-sm font-medium text-gray-800">{profile.positionRecord?.name || profile.position}</dd>
                  </div>
                </div>
              ) : null}
              {profile.department ? (
                <div className="flex items-start gap-3">
                  <Briefcase className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-500">Department</dt>
                    <dd className="text-sm font-medium text-gray-800">{profile.department}</dd>
                  </div>
                </div>
              ) : null}
              {profile.employmentDate ? (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-500">Employment Date</dt>
                    <dd className="text-sm font-medium text-gray-800">
                      {new Date(profile.employmentDate).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </dd>
                  </div>
                </div>
              ) : null}
              {profile.lastLogin ? (
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-500">Last Login</dt>
                    <dd className="text-sm font-medium text-gray-800">
                      {new Date(profile.lastLogin).toLocaleString('en-NG')}
                    </dd>
                  </div>
                </div>
              ) : null}
            </dl>

            {/* Emergency Contact */}
            {profile.emergencyContact ? (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Emergency Contact</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {profile.emergencyContact.name ? (
                    <div><span className="text-gray-500 text-xs">Name</span><br /><span className="font-medium text-gray-800">{profile.emergencyContact.name}</span></div>
                  ) : null}
                  {profile.emergencyContact.phone ? (
                    <div><span className="text-gray-500 text-xs">Phone</span><br /><span className="font-medium text-gray-800">{profile.emergencyContact.phone}</span></div>
                  ) : null}
                  {profile.emergencyContact.relationship ? (
                    <div><span className="text-gray-500 text-xs">Relationship</span><br /><span className="font-medium text-gray-800">{profile.emergencyContact.relationship}</span></div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Recent Status Requests */}
          {recentRequests.length > 0 ? (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> My Status Change Requests
              </h2>
              <div className="space-y-3">
                {recentRequests.map((req) => (
                  <div key={req.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{req.vehicle?.registrationNumber}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{req.reason}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${requestTargetStatusBadge(req.targetStatus)}`}>
                        → {req.targetStatus}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        {requestStatusIcon(req.status)} {requestStatusLabel(req.status)}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right column: Assigned Vehicle */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Truck className="h-4 w-4" /> Assigned Vehicle
            </h2>
            {assignedVehicle ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Truck className="h-6 w-6 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{assignedVehicle.model}</p>
                    <p className="text-sm font-mono text-gray-600">{assignedVehicle.registrationNumber}</p>
                  </div>
                </div>

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Type</dt>
                    <dd className="font-medium text-gray-800">{assignedVehicle.assetType}</dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-gray-500">Status</dt>
                    <dd>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(assignedVehicle.status)}`}>
                        {assignedVehicle.status}
                      </span>
                    </dd>
                  </div>
                  {assignedAt ? (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Assigned On</dt>
                      <dd className="font-medium text-gray-800">{new Date(assignedAt).toLocaleDateString('en-NG')}</dd>

                                    {/* Odometer stats */}
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Odometer</h3>
                                      <dl className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <dt className="text-gray-500">At Registration</dt>
                                          <dd className="font-medium text-gray-800">
                                            {assignedVehicle.initialOdometer != null ? `${assignedVehicle.initialOdometer.toLocaleString()} km` : '—'}
                                          </dd>
                                        </div>
                                        <div className="flex justify-between">
                                          <dt className="text-gray-500">Total Distance</dt>
                                          <dd className="font-medium text-gray-800">
                                            {vehicleDetail != null ? `${vehicleDetail.totalDistanceCoveredKm.toLocaleString()} km` : '—'}
                                          </dd>
                                        </div>
                                        <div className="flex justify-between">
                                          <dt className="text-gray-500">Current Odometer</dt>
                                          <dd className="font-semibold text-red-700">
                                            {vehicleDetail != null ? `${vehicleDetail.currentOdometer.toLocaleString()} km` : '—'}
                                          </dd>
                                        </div>
                                        <div className="flex justify-between">
                                          <dt className="text-gray-500">Total Trips</dt>
                                          <dd className="font-medium text-gray-800">
                                            {vehicleDetail != null ? vehicleDetail.totalTrips : '—'}
                                          </dd>
                                        </div>
                                      </dl>
                                    </div>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : (
              <div className="text-center py-6">
                <Truck className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No vehicle currently assigned</p>
              </div>
            )}
          </div>

          {/* Vehicle Log Entry */}
          {assignedVehicle ? (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Route className="h-4 w-4" /> Log Vehicle Trip
              </h2>
              <form onSubmit={handleSubmitVehicleLog} className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <input
                    type="text"
                    name="startPoint"
                    value={logForm.startPoint}
                    onChange={handleVehicleLogChange}
                    placeholder="Starting point"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                    required
                  />
                  <input
                    type="text"
                    name="destination"
                    value={logForm.destination}
                    onChange={handleVehicleLogChange}
                    placeholder="Destination"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">Departure date/time</span>
                    <input
                      type="datetime-local"
                      name="departureAt"
                      value={logForm.departureAt}
                      onChange={handleVehicleLogChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">Arrival date/time</span>
                    <input
                      type="datetime-local"
                      name="arrivalAt"
                      value={logForm.arrivalAt}
                      onChange={handleVehicleLogChange}
                      min={logForm.departureAt || undefined}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                      required
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">Initial odometer</span>
                    <input
                      type="number"
                      name="initialOdometer"
                      value={logForm.initialOdometer}
                      onChange={handleVehicleLogChange}
                      min="0"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">Odometer at destination</span>
                    <input
                      type="number"
                      name="destinationOdometer"
                      value={logForm.destinationOdometer}
                      onChange={handleVehicleLogChange}
                      min="0"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                      required
                    />
                  </label>
                </div>

                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Distance Covered: <span className="font-semibold">{calculatedDistanceKm ?? 0} KM</span>
                </div>

                {logError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{logError}</p> : null}
                {logSuccess ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{logSuccess}</p> : null}

                <button
                  type="submit"
                  disabled={submittingLog}
                  className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {submittingLog ? 'Submitting…' : 'Submit Vehicle Log'}
                </button>
              </form>
            </div>
          ) : null}

          {/* Recent Vehicle Logs */}
          {assignedVehicle ? (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Recent Vehicle Logs</h2>
              {loadingLogs ? (
                <p className="text-sm text-gray-500">Loading logs...</p>
              ) : vehicleLogs.length === 0 ? (
                <p className="text-sm text-gray-500">No vehicle logs yet.</p>
              ) : (
                <div className="space-y-3">
                  {vehicleLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-gray-100 px-3 py-2">
                      <p className="text-sm font-semibold text-gray-800">{log.startPoint} to {log.destination}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Departure: {new Date(log.departureAt).toLocaleString('en-NG')} | Arrival: {new Date(log.arrivalAt).toLocaleString('en-NG')}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Time Taken: <span className="font-semibold">{formatTripDuration(log.departureAt, log.arrivalAt)}</span> |
                        {' '}
                        Odometer: {log.initialOdometer} to {log.destinationOdometer} | Distance: <span className="font-semibold">{log.distanceCoveredKm} KM</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Stats */}
          {profile._count ? (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Activity Summary</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <dd className="text-2xl font-bold text-blue-700">{profile._count.createdOperations ?? 0}</dd>
                  <dt className="text-xs text-blue-600 mt-1">Operations</dt>
                </div>
                <div className="rounded-lg bg-orange-50 p-3 text-center">
                  <dd className="text-2xl font-bold text-orange-700">{profile._count.createdExpenses ?? 0}</dd>
                  <dt className="text-xs text-orange-600 mt-1">Expenses</dt>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DriverProfile;

// frontend/src/components/vehicles/Vehicles.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Wrench,
  AlertTriangle,
  Download,
  Filter,
  X,
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
  Route,
  Gauge,
  ArrowRightLeft,
  BarChart3,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const VEHICLE_ASSIGNER_ROLES = new Set(['CEO', 'SUPER_ADMIN']);
const DRIVER_ROLES = new Set(['DRIVER', 'CHIEF_DRIVER']);
const VEHICLE_REGISTRAR_ROLES = new Set(['CHIEF_DRIVER', 'CEO', 'SUPER_ADMIN']);
const STAFF_ROLE_OPTIONS = [
  { value: 'ALL', label: 'All Driver Roles' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'CHIEF_DRIVER', label: 'Chief Driver' },
];

const Vehicles = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mode } = useTheme();
  const dm = mode === 'dark';
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSubsidiaries, setLoadingSubsidiaries] = useState(false);
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [error, setError] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningVehicle, setAssigningVehicle] = useState(false);
  const [loadingAssignableStaff, setLoadingAssignableStaff] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentForm, setAssignmentForm] = useState({
    vehicleId: '',
    subsidiaryId: '',
    role: 'ALL',
    staffId: '',
  });
  // Transfer vehicle state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferringVehicle, setTransferringVehicle] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferForm, setTransferForm] = useState({
    registrationNumber: '',
    model: '',
    assetType: 'OTHER',
    status: '',
    initialOdometer: '',
    subsidiaryIds: [],
  });
  const [form, setForm] = useState({
    registrationNumber: '',
    model: '',
    assetType: 'OTHER',
    initialOdometer: '',
    subsidiaryIds: [],
  });

  const canAssignVehicles = VEHICLE_ASSIGNER_ROLES.has(String(user?.role || '').toUpperCase());
  const canTransferVehicles = canAssignVehicles; // CEO and SUPER_ADMIN only
  const canRegisterVehicle = VEHICLE_REGISTRAR_ROLES.has(String(user?.role || '').toUpperCase());
  const isDriver = String(user?.role || '').toUpperCase() === 'DRIVER';
  const isChiefDriver = String(user?.role || '').toUpperCase() === 'CHIEF_DRIVER';
  const isExec = new Set(['CEO', 'SUPER_ADMIN']).has(String(user?.role || '').toUpperCase());
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';
  const canViewStatusRequests = canAssignVehicles || DRIVER_ROLES.has(String(user?.role || '').toUpperCase()) || isAdmin;
  const canViewDetails = new Set(['ADMIN', 'MANAGER', 'CEO', 'SUPER_ADMIN', 'CHIEF_DRIVER']).has(String(user?.role || '').toUpperCase());

  // Status request state
  const [statusRequests, setStatusRequests] = useState([]);

    // Vehicle detail modal state
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailVehicle, setDetailVehicle] = useState(null);
    const [vehicleDetail, setVehicleDetail] = useState(null);
    const [vehicleDetailLogs, setVehicleDetailLogs] = useState([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [loadingDetailLogs, setLoadingDetailLogs] = useState(false);

    const openDetailModal = async (vehicle) => {
      setDetailVehicle(vehicle);
      setVehicleDetail(null);
      setVehicleDetailLogs([]);
      setShowDetailModal(true);
      setLoadingDetail(true);
      setLoadingDetailLogs(true);
      try {
        const detailRes = await api.getVehicleDetail(vehicle.id);
        setVehicleDetail(detailRes?.data || null);
      } catch (_e) {
        setVehicleDetail(null);
      } finally {
        setLoadingDetail(false);
      }
      try {
        const logsRes = await api.getVehicleLogs(vehicle.id, { limit: 50 });
        setVehicleDetailLogs(Array.isArray(logsRes?.data) ? logsRes.data : []);
      } catch (_e) {
        setVehicleDetailLogs([]);
      } finally {
        setLoadingDetailLogs(false);
      }
    };

    const closeDetailModal = () => {
      setShowDetailModal(false);
      setDetailVehicle(null);
      setVehicleDetail(null);
      setVehicleDetailLogs([]);
    };

  const formatTripDuration = (departureAt, arrivalAt) => {
    const departure = new Date(departureAt);
    const arrival = new Date(arrivalAt);

    if (Number.isNaN(departure.getTime()) || Number.isNaN(arrival.getTime())) {
      return '—';
    }

    const totalMinutes = Math.max(0, Math.round((arrival.getTime() - departure.getTime()) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} hr`;
    return `${hours} hr ${minutes} min`;
  };

  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  const [showStatusRequestModal, setShowStatusRequestModal] = useState(false);
  const [statusRequestForm, setStatusRequestForm] = useState({ vehicleId: '', sourceStatus: '', targetStatus: 'MAINTENANCE', reason: '' });
  const [submittingStatusRequest, setSubmittingStatusRequest] = useState(false);
  const [statusRequestError, setStatusRequestError] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [reviewForm, setReviewForm] = useState({ decision: 'APPROVE', reason: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Financial date filter state (CEO / SUPER_ADMIN)
  const [finStartDate, setFinStartDate] = useState('');
  const [finEndDate, setFinEndDate] = useState('');
  const [appliedFinStart, setAppliedFinStart] = useState('');
  const [appliedFinEnd, setAppliedFinEnd] = useState('');

  // Vehicle Financial Breakdown state
  const [showFinBreakdown, setShowFinBreakdown] = useState(false);
  const [finVehicleFilter, setFinVehicleFilter] = useState('ALL');

  useEffect(() => {
    fetchVehicles();
    fetchAssetTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch vehicles when financial date filters are applied
  useEffect(() => {
    if (isExec && (appliedFinStart || appliedFinEnd)) {
      fetchVehicles();
    } else if (isExec && !appliedFinStart && !appliedFinEnd) {
      // Reset to all-time when both are cleared (handled by the clear button)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFinStart, appliedFinEnd]);

  const fetchVehicles = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { includeInactive: true };
      if (appliedFinStart) params.startDate = appliedFinStart;
      if (appliedFinEnd) params.endDate = appliedFinEnd;
      const response = await api.getVehicles(params);
      setVehicles(response?.data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setError(error?.response?.data?.message || 'Unable to load vehicles.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      registrationNumber: '',
      model: '',
      assetType: 'OTHER',
      initialOdometer: '',
      subsidiaryIds: [],
    });
  };

  const fetchAssetTypes = async () => {
    try {
      const response = await api.getAssetTypes();
      setAssetTypes(response?.data || []);
    } catch (err) {
      console.error('Error fetching asset types:', err);
    }
  };

  const fetchSubsidiaries = async () => {
    setLoadingSubsidiaries(true);

    try {
      const response = await api.getSubsidiaries();
      const rows = response?.data || [];
      setSubsidiaries(rows);
      return rows;
    } catch (loadError) {
      setSubsidiaries([]);
      setError(loadError?.response?.data?.message || 'Unable to load subsidiaries.');
      return [];
    } finally {
      setLoadingSubsidiaries(false);
    }
  };

  const openModal = async () => {
    if (!canRegisterVehicle) return;
    setError('');
    setShowAddModal(true);
    const rows = await fetchSubsidiaries();
    if (rows.length > 0) {
      setForm((prev) => ({
        ...prev,
        subsidiaryIds: prev.subsidiaryIds.length > 0 ? prev.subsidiaryIds : [rows[0].id],
      }));
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setSubmitting(false);
    resetForm();
  };

  const handleRegisterVehicle = async (event) => {
    event.preventDefault();

    if (!form.registrationNumber.trim() || !form.model.trim()) {
      setError('Registration number and model are required.');
      return;
    }

    if (form.subsidiaryIds.length === 0) {
      setError('Please select at least one subsidiary.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.createVehicle({
        registrationNumber: form.registrationNumber.trim(),
        model: form.model.trim(),
        assetType: form.assetType,
        initialOdometer: form.initialOdometer ? Number(form.initialOdometer) : undefined,
        subsidiaryIds: form.subsidiaryIds,
      });

      closeModal();
      await fetchVehicles();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || 'Vehicle registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const loadAssignableStaff = async (subsidiaryId, role) => {
    if (!subsidiaryId) return;

    setLoadingAssignableStaff(true);
    setAssignmentError('');
    try {
      const response = await api.getAssignableVehicleStaff({
        subsidiaryId,
        role: role && role !== 'ALL' ? role : undefined,
      });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setAssignableStaff(rows);
      setAssignmentForm((prev) => ({
        ...prev,
        staffId: rows.some((staff) => staff.id === prev.staffId) ? prev.staffId : (rows[0]?.id || ''),
      }));
    } catch (staffError) {
      setAssignableStaff([]);
      setAssignmentError(staffError?.response?.data?.message || 'Unable to load staff for assignment.');
    } finally {
      setLoadingAssignableStaff(false);
    }
  };

  const openAssignModal = async (vehicle) => {
    if (!canAssignVehicles) return;

    const rows = subsidiaries.length > 0 ? subsidiaries : await fetchSubsidiaries();
    const defaultSubsidiaryId = vehicle?.subsidiaryId || rows[0]?.id || '';

    setAssignmentError('');
    setAssignableStaff([]);
    setShowAssignModal(true);
    setAssignmentForm({
      vehicleId: vehicle.id,
      subsidiaryId: defaultSubsidiaryId,
      role: 'ALL',
      staffId: vehicle?.assignment?.staff?.id || '',
    });

    if (defaultSubsidiaryId) {
      await loadAssignableStaff(defaultSubsidiaryId, 'ALL');
    }
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setAssigningVehicle(false);
    setLoadingAssignableStaff(false);
    setAssignableStaff([]);
    setAssignmentError('');
    setAssignmentForm({
      vehicleId: '',
      subsidiaryId: '',
      role: 'ALL',
      staffId: '',
    });
  };

  const handleAssignVehicle = async (event) => {
    event.preventDefault();

    if (!assignmentForm.vehicleId || !assignmentForm.staffId) {
      setAssignmentError('Select a staff member to assign this vehicle.');
      return;
    }

    setAssigningVehicle(true);
    setAssignmentError('');
    try {
      await api.assignVehicle(assignmentForm.vehicleId, {
        staffId: assignmentForm.staffId,
        role: assignmentForm.role !== 'ALL' ? assignmentForm.role : undefined,
        subsidiaryId: assignmentForm.subsidiaryId,
      });
      closeAssignModal();
      await fetchVehicles();
    } catch (assignError) {
      setAssignmentError(assignError?.response?.data?.message || 'Vehicle assignment failed.');
    } finally {
      setAssigningVehicle(false);
    }
  };

  const handleDeassignVehicle = async (vehicleId) => {
    if (!vehicleId) return;
    setAssignmentError('');
    try {
      await api.deassignVehicle(vehicleId);
      await fetchVehicles();
    } catch (deassignError) {
      setAssignmentError(deassignError?.response?.data?.message || 'Vehicle de-assignment failed.');
    }
  };

  // Transfer vehicle handlers
  const openTransferModal = async (vehicle) => {
    if (!canTransferVehicles) return;
    setTransferError('');

    // Load subsidiaries for the transfer form
    if (subsidiaries.length === 0) {
      await fetchSubsidiaries();
    }

    // Build current subsidiary IDs from the vehicle data
    const currentSubsidiaryIds = (vehicle.vehicleSubsidiaries || [])
      .map((vs) => vs.subsidiaryId)
      .filter(Boolean);

    setTransferringVehicle(vehicle);
    setTransferForm({
      registrationNumber: vehicle.registrationNumber || '',
      model: vehicle.model || '',
      assetType: vehicle.assetType || 'OTHER',
      status: vehicle.status || 'ACTIVE',
      initialOdometer: vehicle.initialOdometer != null ? String(vehicle.initialOdometer) : '',
      subsidiaryIds: currentSubsidiaryIds.length > 0 ? currentSubsidiaryIds : [vehicle.subsidiaryId].filter(Boolean),
    });
    setShowTransferModal(true);
  };

  const closeTransferModal = () => {
    setShowTransferModal(false);
    setTransferringVehicle(null);
    setTransferring(false);
    setTransferError('');
    setTransferForm({
      registrationNumber: '',
      model: '',
      assetType: 'OTHER',
      status: '',
      initialOdometer: '',
      subsidiaryIds: [],
    });
  };

  const handleTransferVehicle = async (event) => {
    event.preventDefault();

    if (!transferringVehicle) return;

    if (transferForm.subsidiaryIds.length === 0) {
      setTransferError('Please select at least one subsidiary.');
      return;
    }

    setTransferring(true);
    setTransferError('');

    try {
      await api.updateVehicle(transferringVehicle.id, {
        registrationNumber: transferForm.registrationNumber.trim(),
        model: transferForm.model.trim(),
        assetType: transferForm.assetType,
        status: transferForm.status,
        initialOdometer: transferForm.initialOdometer ? Number(transferForm.initialOdometer) : undefined,
        subsidiaryId: transferForm.subsidiaryIds[0],
        subsidiaryIds: transferForm.subsidiaryIds,
      });

      closeTransferModal();
      await fetchVehicles();
    } catch (err) {
      setTransferError(err?.response?.data?.message || 'Vehicle transfer failed.');
    } finally {
      setTransferring(false);
    }
  };

  useEffect(() => {
    if (!showAssignModal || !assignmentForm.subsidiaryId) return;
    loadAssignableStaff(assignmentForm.subsidiaryId, assignmentForm.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentForm.subsidiaryId, assignmentForm.role, showAssignModal]);

  const fetchStatusRequests = useCallback(async () => {
    if (!canViewStatusRequests) return;
    setLoadingRequests(true);
    try {
      const response = await api.getVehicleStatusRequests({ limit: 50 });
      setStatusRequests(response?.data || []);
    } catch (err) {
      console.error('Error fetching status requests', err);
    } finally {
      setLoadingRequests(false);
    }
  }, [canViewStatusRequests]);

  useEffect(() => {
    if (showRequestsPanel) fetchStatusRequests();
  }, [showRequestsPanel, fetchStatusRequests]);

  const getTargetStatusOptions = (sourceStatus) => {
    const current = String(sourceStatus || '').toUpperCase();
    if (current === 'ACTIVE') {
      return [
        { value: 'MAINTENANCE', label: 'MAINTENANCE' },
        { value: 'INACTIVE', label: 'INACTIVE (Out of Service)' },
      ];
    }

    if (current === 'MAINTENANCE' || current === 'INACTIVE') {
      return [{ value: 'ACTIVE', label: 'ACTIVE (Activation)' }];
    }

    return [];
  };

  const canRequestStatusChange = (vehicle) => {
    if (!vehicle) return false;
    const role = String(user?.role || '').toUpperCase();
    const currentStatus = String(vehicle.status || '').toUpperCase();

    if (currentStatus === 'SOLD') return false;

    if (role === 'DRIVER') {
      return vehicle.assignment?.staff?.id === user?.id;
    }

    return role === 'CHIEF_DRIVER' || role === 'CEO' || role === 'SUPER_ADMIN';
  };

  const getStatusRequestActionMeta = (vehicle) => {
    const currentStatus = String(vehicle?.status || '').toUpperCase();
    const isActivation = currentStatus === 'MAINTENANCE' || currentStatus === 'INACTIVE';

    if (isActivation) {
      return {
        label: 'Activate Vehicle',
        className: 'rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100',
      };
    }

    return {
      label: 'Request Status Change',
      className: 'rounded-lg border border-red-700 bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-red-700',
    };
  };

  const openStatusRequestModal = (vehicle) => {
    const options = getTargetStatusOptions(vehicle.status);
    if (options.length === 0) {
      setStatusRequestError('This vehicle status cannot be changed using status request.');
      return;
    }

    setStatusRequestError('');
    setStatusRequestForm({
      vehicleId: vehicle.id,
      sourceStatus: String(vehicle.status || '').toUpperCase(),
      targetStatus: options[0].value,
      reason: '',
    });
    setShowStatusRequestModal(true);
  };

  const closeStatusRequestModal = () => {
    setShowStatusRequestModal(false);
    setSubmittingStatusRequest(false);
    setStatusRequestError('');
    setStatusRequestForm({ vehicleId: '', sourceStatus: '', targetStatus: 'MAINTENANCE', reason: '' });
  };

  const handleSubmitStatusRequest = async (event) => {
    event.preventDefault();
    if (!statusRequestForm.reason.trim()) {
      setStatusRequestError('A reason is required.');
      return;
    }
    setSubmittingStatusRequest(true);
    setStatusRequestError('');
    try {
      await api.requestVehicleStatusChange(statusRequestForm.vehicleId, {
        targetStatus: statusRequestForm.targetStatus,
        reason: statusRequestForm.reason.trim(),
      });
      closeStatusRequestModal();
      await fetchStatusRequests();
    } catch (err) {
      setStatusRequestError(err?.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmittingStatusRequest(false);
    }
  };

  const openReviewModal = (request) => {
    setReviewingRequest(request);
    setReviewForm({ decision: 'APPROVE', reason: '' });
    setReviewError('');
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setReviewingRequest(null);
    setSubmittingReview(false);
    setReviewError('');
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!reviewingRequest) return;
    setSubmittingReview(true);
    setReviewError('');
    const stage = isChiefDriver ? 'chief-review' : 'executive-review';
    try {
      await api.reviewVehicleStatusRequest(reviewingRequest.id, stage, {
        decision: reviewForm.decision,
        reason: reviewForm.reason.trim() || undefined,
      });
      closeReviewModal();
      await fetchStatusRequests();
      await fetchVehicles();
    } catch (err) {
      setReviewError(err?.response?.data?.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleRequestExpenseFromApproval = (statusRequest) => {
    if (!isAdmin || !statusRequest) return;

    const vehicle = statusRequest.vehicle || {};
    const requester = statusRequest.requester || {};
    const targetStatus = String(statusRequest.targetStatus || '').toUpperCase();
    const requestedDateSource = statusRequest.finalDecisionAt || statusRequest.createdAt || new Date().toISOString();
    const requestedDate = new Date(requestedDateSource).toISOString().slice(0, 10);
    const approvedAmount = statusRequest.approvedAmount ?? statusRequest.estimatedAmount ?? statusRequest.amount ?? '';

    const suggestedCategory = targetStatus === 'MAINTENANCE' ? 'MAINTENANCE' : 'REPAIRS';
    const descriptor = [
      vehicle.registrationNumber ? `Vehicle ${vehicle.registrationNumber}` : 'Vehicle',
      vehicle.model ? `(${vehicle.model})` : '',
    ].join(' ').trim();

    navigate('/expenses', {
      state: {
        prefillExpense: {
          source: 'vehicle-status-approval',
          requestId: statusRequest.id,
          expenseType: 'OPERATIONAL',
          expenseCategory: suggestedCategory,
          amount: approvedAmount ? String(approvedAmount) : '',
          requestedDate,
          expenseDate: '',
          subsidiaryId: vehicle.subsidiaryId || '',
          vehicleId: vehicle.id || '',
          description: `${descriptor} - ${suggestedCategory.replace(/_/g, ' ')}`,
          details: [
            `Vehicle status request ID: ${statusRequest.id}`,
            `Initial status: ${statusRequest.initialStatus || '-'}`,
            `Requested by: ${requester.fullName || requester.id || 'Unknown driver'}`,
            `Requester role: ${requester.role || 'DRIVER'}`,
            `Request date: ${statusRequest.createdAt ? new Date(statusRequest.createdAt).toLocaleString() : '-'}`,
            `Vehicle: ${vehicle.registrationNumber || '-'} ${vehicle.model ? `(${vehicle.model})` : ''}`.trim(),
            `Target status approved: ${targetStatus || '-'}`,
            `Original request reason: ${statusRequest.reason || '-'}`,
            `Chief review note: ${statusRequest.chiefDecisionReason || '-'}`,
            `Final approval by: ${statusRequest.finalDecisionBy?.fullName || 'CEO/SUPER_ADMIN'}`,
            `Final approval date: ${statusRequest.finalDecisionAt ? new Date(statusRequest.finalDecisionAt).toLocaleString() : '-'}`,
            `Final approval note: ${statusRequest.finalDecisionReason || '-'}`,
            'Select the actual expense date before submitting.',
          ].join('\n'),
        },
      },
    });
  };

  const getExpenseStageLabel = (expense) => {
    if (!expense) return '';

    const processStatus = String(expense.processStatus || '').toUpperCase();
    const approvalStatus = String(expense.approvalStatus || '').toUpperCase();

    if (processStatus === 'COMPLETED') return 'Completed';
    if (processStatus === 'IN_PROGRESS') return 'Ready / In Progress';
    if (approvalStatus === 'REJECTED') return 'Rejected';
    if (approvalStatus === 'APPROVED') return 'Approved';
    return 'Pending Approval';
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const registration = String(vehicle.registrationNumber || '').toLowerCase();
    const model = String(vehicle.model || '').toLowerCase();
    const type = String(vehicle.assetType || '').toLowerCase();

    const matchesSearch = 
      registration.includes(searchTerm.toLowerCase()) ||
      model.includes(searchTerm.toLowerCase()) ||
      type.includes(searchTerm.toLowerCase());
    
    if (filter === 'ALL') return matchesSearch;
    return matchesSearch && vehicle.status === filter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800';
      case 'INACTIVE':
      case 'SOLD':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Financial breakdown aggregation
  const finBreakdownData = useMemo(() => {
    const filtered = finVehicleFilter === 'ALL'
      ? vehicles
      : vehicles.filter((v) => v.id === finVehicleFilter);

    let totalRevenue = 0;
    let totalFuel = 0;
    let totalExpenses = 0;

    filtered.forEach((v) => {
      if (v._finance) {
        totalRevenue += v._finance.revenue || 0;
        totalFuel += v._finance.fuel || 0;
        totalExpenses += v._finance.totalExpenses || 0;
      }
    });

    return {
      totalRevenue,
      totalFuel,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      vehicleCount: filtered.length,
      labels: filtered.map((v) => v.registrationNumber),
      datasets: [
        {
          label: 'Revenue',
          data: filtered.map((v) => v._finance?.revenue || 0),
          backgroundColor: 'rgba(37, 99, 235, 0.85)',
          borderColor: '#1d4ed8',
          borderWidth: 1,
        },
        {
          label: 'Fuel',
          data: filtered.map((v) => v._finance?.fuel || 0),
          backgroundColor: 'rgba(245, 158, 11, 0.85)',
          borderColor: '#d97706',
          borderWidth: 1,
        },
        {
          label: 'Total Expenses',
          data: filtered.map((v) => v._finance?.totalExpenses || 0),
          backgroundColor: 'rgba(220, 38, 38, 0.80)',
          borderColor: '#b91c1c',
          borderWidth: 1,
        },
      ],
    };
  }, [vehicles, finVehicleFilter]);

  const formatNaira = (value) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  return (
    <div className="pt-16 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${dm ? 'text-white' : 'text-gray-800'}`}>Vehicle Fleet</h1>
        <div className="flex items-center space-x-3">
          {canViewStatusRequests ? (
            <button
              onClick={() => setShowRequestsPanel((v) => !v)}
              className={`px-4 py-2 rounded-lg flex items-center border border-red-700 text-sm font-semibold shadow-sm transition-colors ${
                showRequestsPanel
                  ? 'bg-red-700 text-white hover:bg-red-800'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Status Requests
              {showRequestsPanel ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </button>
          ) : null}
          <button className={`px-4 py-2 rounded-lg flex items-center ${dm ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          {canRegisterVehicle ? (
            <button
              onClick={openModal}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </button>
          ) : null}
        </div>
      </div>

      {/* Status Requests Panel */}
      {showRequestsPanel ? (
        <div className={`rounded-lg shadow overflow-hidden ${dm ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
          <div className={`flex items-center justify-between px-6 py-4 border-b ${dm ? 'border-slate-700' : 'border-gray-200'}`}>
            <h2 className={`text-base font-semibold ${dm ? 'text-slate-100' : 'text-gray-800'}`}>Vehicle Status Requests</h2>
            {loadingRequests ? (
              <span className={`text-sm ${dm ? 'text-slate-400' : 'text-gray-500'}`}>Loading…</span>
            ) : (
              <button onClick={fetchStatusRequests} className="text-sm text-red-600 hover:underline">Refresh</button>
            )}
          </div>
          {statusRequests.length === 0 && !loadingRequests ? (
            <div className={`px-6 py-8 text-center text-sm ${dm ? 'text-slate-400' : 'text-gray-500'}`}>No status requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-600 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-white uppercase">Vehicle</th>
                    <th className="px-4 py-3 text-xs font-medium text-white uppercase">Requested By</th>
                    <th className="px-4 py-3 text-xs font-medium text-white uppercase">Target Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-white uppercase">Stage</th>
                    <th className="px-4 py-3 text-xs font-medium text-white uppercase">Reason</th>
                    <th className="px-4 py-3 text-xs font-medium text-white uppercase">Date</th>
                    {(isChiefDriver || isExec || isAdmin) ? (
                      <th className="px-4 py-3 text-xs font-medium text-white uppercase">Action</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statusRequests.map((req) => {
                    const canChiefReview = isChiefDriver && req.status === 'PENDING_CHIEF_REVIEW';
                    const canExecReview = isExec && req.status === 'PENDING_EXECUTIVE_REVIEW';
                    const canAdminRequestExpense = isAdmin && req.status === 'APPROVED';
                    const hasLinkedExpense = Boolean(req.expense?.id);
                    const expenseStageLabel = getExpenseStageLabel(req.expense);
                    return (
                      <tr key={req.id} className={`${dm ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`}>
                        <td className={`px-4 py-3 font-mono font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>{req.vehicle?.registrationNumber}</td>
                        <td className={`px-4 py-3 ${dm ? 'text-slate-300' : 'text-gray-700'}`}>{req.requester?.fullName}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${req.targetStatus === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                            {req.targetStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {req.status === 'PENDING_CHIEF_REVIEW' && <span className="flex items-center gap-1 text-amber-600"><Clock className="h-3 w-3" /> Chief Review</span>}
                          {req.status === 'PENDING_EXECUTIVE_REVIEW' && <span className="flex items-center gap-1 text-blue-600"><Clock className="h-3 w-3" /> Exec Review</span>}
                          {req.status === 'APPROVED' && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" /> Approved</span>}
                          {req.status === 'REJECTED' && <span className="flex items-center gap-1 text-red-600"><XCircle className="h-3 w-3" /> Rejected</span>}
                        </td>
                        <td className={`px-4 py-3 max-w-xs truncate ${dm ? 'text-slate-300' : 'text-gray-600'}`}>{req.reason}</td>
                        <td className={`px-4 py-3 ${dm ? 'text-slate-400' : 'text-gray-500'}`}>{new Date(req.createdAt).toLocaleDateString()}</td>
                        {(isChiefDriver || isExec || isAdmin) ? (
                          <td className="px-4 py-3">
                            {(canChiefReview || canExecReview) ? (
                              <button
                                onClick={() => openReviewModal(req)}
                                className="rounded border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                              >
                                Review
                              </button>
                            ) : (canAdminRequestExpense && !hasLinkedExpense) ? (
                              <button
                                onClick={() => handleRequestExpenseFromApproval(req)}
                                className="rounded border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                              >
                                Execute Expense
                              </button>
                            ) : hasLinkedExpense ? (
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                  Expense: {expenseStageLabel}
                                </span>
                                <button
                                  onClick={() => navigate('/expenses', {
                                    state: {
                                      viewExpenseId: req.expense.id,
                                      source: 'vehicle-status-request',
                                      requestId: req.id,
                                    },
                                  })}
                                  className={`rounded border px-2 py-1 text-xs font-medium ${dm ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                                >
                                  View Expense
                                </button>
                              </div>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className={`rounded-lg shadow p-6 ${dm ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${dm ? 'text-slate-400' : 'text-gray-600'}`}>Total Vehicles</p>
              <p className={`text-2xl font-bold ${dm ? 'text-white' : 'text-gray-800'}`}>{vehicles.length}</p>
            </div>
            <div className={`p-3 rounded-full ${dm ? 'bg-red-900/40' : 'bg-red-100'}`}>
              <Truck className={`h-6 w-6 ${dm ? 'text-red-400' : 'text-red-600'}`} />
            </div>
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${dm ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${dm ? 'text-slate-400' : 'text-gray-600'}`}>Active</p>
              <p className="text-2xl font-bold text-green-600">
                {vehicles.filter(v => v.status === 'ACTIVE').length}
              </p>
            </div>
            <div className={`p-3 rounded-full ${dm ? 'bg-green-900/40' : 'bg-green-100'}`}>
              <Truck className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${dm ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${dm ? 'text-slate-400' : 'text-gray-600'}`}>In Maintenance</p>
              <p className="text-2xl font-bold text-yellow-600">
                {vehicles.filter(v => v.status === 'MAINTENANCE').length}
              </p>
            </div>
            <div className={`p-3 rounded-full ${dm ? 'bg-yellow-900/40' : 'bg-yellow-100'}`}>
              <Wrench className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${dm ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${dm ? 'text-slate-400' : 'text-gray-600'}`}>Out of Service</p>
              <p className="text-2xl font-bold text-red-600">
                {vehicles.filter(v => v.status === 'INACTIVE' || v.status === 'SOLD').length}
              </p>
            </div>
            <div className={`p-3 rounded-full ${dm ? 'bg-red-900/40' : 'bg-red-100'}`}>
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-lg shadow p-4 ${dm ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search vehicles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${dm ? 'bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400' : 'border border-gray-300 text-gray-900'}`}
            />
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={`rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${dm ? 'bg-slate-700 border border-slate-600 text-white' : 'border border-gray-300 text-gray-900'}`}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SOLD">Sold</option>
          </select>

          <button className={`px-4 py-2 rounded-lg flex items-center ${dm ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <Filter className="h-4 w-4 mr-2" />
            More Filters
          </button>

          {isExec ? (
            <>
              <div className={`border-l pl-4 flex items-center gap-2 ${dm ? 'border-slate-600' : 'border-gray-300'}`}>
                <span className="text-xs text-gray-500 font-medium">Financial:</span>
                <input
                  type="date"
                  value={finStartDate}
                  onChange={(e) => setFinStartDate(e.target.value)}
                  onBlur={() => setAppliedFinStart(finStartDate)}
                  className={`rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${dm ? 'bg-slate-700 border border-slate-600 text-white' : 'border border-gray-300 text-gray-700'}`}
                  title="Finance start date"
                />
                <span className="text-gray-400 text-xs">to</span>
                <input
                  type="date"
                  value={finEndDate}
                  onChange={(e) => setFinEndDate(e.target.value)}
                  onBlur={() => setAppliedFinEnd(finEndDate)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  title="Finance end date"
                />
                {(finStartDate || finEndDate) ? (
                  <button
                    type="button"
                    onClick={() => { setFinStartDate(''); setFinEndDate(''); setAppliedFinStart(''); setAppliedFinEnd(''); fetchVehicles(); }}
                    className="rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
                    title="Clear finance dates"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Vehicle Financial Breakdown — CEO & SUPER_ADMIN */}
      {isExec ? (
        <div className={`rounded-lg shadow overflow-hidden ${dm ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
          <button
            type="button"
            onClick={() => setShowFinBreakdown((v) => !v)}
            className={`w-full flex items-center justify-between px-6 py-4 border-b ${dm ? 'border-slate-700 hover:bg-slate-700/50' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className={`h-5 w-5 ${dm ? 'text-purple-400' : 'text-purple-600'}`} />
              <h2 className={`text-base font-semibold ${dm ? 'text-slate-100' : 'text-gray-800'}`}>Vehicle Financial Breakdown</h2>
            </div>
            {showFinBreakdown ? <ChevronUp className={`h-5 w-5 ${dm ? 'text-slate-400' : 'text-gray-500'}`} /> : <ChevronDown className={`h-5 w-5 ${dm ? 'text-slate-400' : 'text-gray-500'}`} />}
          </button>

          {showFinBreakdown ? (
            <div className="px-6 py-5 space-y-6">
              {/* Vehicle Filter */}
              <div className="flex flex-wrap items-center gap-4">
                <label className={`text-sm font-medium ${dm ? 'text-slate-200' : 'text-gray-700'}`}>Filter by Vehicle:</label>
                <select
                  value={finVehicleFilter}
                  onChange={(e) => setFinVehicleFilter(e.target.value)}
                  className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${dm ? 'border-slate-600 bg-slate-700 text-white' : 'border-gray-300 text-gray-900'}`}
                >
                  <option value="ALL">All Vehicles</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} — {v.model}</option>
                  ))}
                </select>
                <span className={`text-xs ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                  Showing {finBreakdownData.vehicleCount} vehicle{finBreakdownData.vehicleCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`rounded-lg p-4 ${dm ? 'bg-slate-700/50 border border-slate-600' : 'bg-blue-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className={`h-4 w-4 ${dm ? 'text-blue-400' : 'text-blue-600'}`} />
                    <p className={`text-xs font-medium ${dm ? 'text-slate-300' : 'text-gray-600'}`}>Revenue</p>
                  </div>
                  <p className={`text-xl font-bold ${dm ? 'text-blue-400' : 'text-blue-700'}`}>{formatNaira(finBreakdownData.totalRevenue)}</p>
                </div>
                <div className={`rounded-lg p-4 ${dm ? 'bg-slate-700/50 border border-slate-600' : 'bg-amber-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className={`h-4 w-4 ${dm ? 'text-amber-400' : 'text-amber-600'}`} />
                    <p className={`text-xs font-medium ${dm ? 'text-slate-300' : 'text-gray-600'}`}>Fuel</p>
                  </div>
                  <p className={`text-xl font-bold ${dm ? 'text-amber-400' : 'text-amber-700'}`}>{formatNaira(finBreakdownData.totalFuel)}</p>
                </div>
                <div className={`rounded-lg p-4 ${dm ? 'bg-slate-700/50 border border-slate-600' : 'bg-red-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className={`h-4 w-4 ${dm ? 'text-red-400' : 'text-red-600'}`} />
                    <p className={`text-xs font-medium ${dm ? 'text-slate-300' : 'text-gray-600'}`}>Total Expenses</p>
                  </div>
                  <p className={`text-xl font-bold ${dm ? 'text-red-400' : 'text-red-700'}`}>{formatNaira(finBreakdownData.totalExpenses)}</p>
                </div>
                <div className={`rounded-lg p-4 ${finBreakdownData.netIncome >= 0 ? (dm ? 'bg-slate-700/50 border border-green-600' : 'bg-green-50') : (dm ? 'bg-slate-700/50 border border-red-600' : 'bg-red-50')}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className={`h-4 w-4 ${finBreakdownData.netIncome >= 0 ? (dm ? 'text-green-400' : 'text-green-600') : (dm ? 'text-red-400' : 'text-red-600')}`} />
                    <p className={`text-xs font-medium ${dm ? 'text-slate-300' : 'text-gray-600'}`}>Net Income</p>
                  </div>
                  <p className={`text-xl font-bold ${finBreakdownData.netIncome >= 0 ? (dm ? 'text-green-400' : 'text-green-700') : (dm ? 'text-red-400' : 'text-red-700')}`}>{formatNaira(finBreakdownData.netIncome)}</p>
                </div>
              </div>

              {/* Bar Chart */}
              <div className={`rounded-lg p-4 ${dm ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
                <div className="h-80">
                  {finBreakdownData.labels.length > 0 ? (
                    <Bar
                      data={{ labels: finBreakdownData.labels, datasets: finBreakdownData.datasets }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              color: dm ? '#94a3b8' : '#374151',
                              usePointStyle: true,
                              padding: 20,
                              font: { size: 12 },
                            },
                          },
                          tooltip: {
                            backgroundColor: dm ? '#1e293b' : '#fff',
                            titleColor: dm ? '#e2e8f0' : '#111',
                            bodyColor: dm ? '#cbd5e1' : '#374151',
                            borderColor: dm ? '#334155' : '#e5e7eb',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                              label: (ctx) => ` ${ctx.dataset.label}: ${formatNaira(ctx.parsed.y)}`,
                            },
                          },
                        },
                        scales: {
                          x: {
                            grid: { color: dm ? '#334155' : '#e5e7eb' },
                            ticks: { color: dm ? '#94a3b8' : '#6b7280', font: { size: 11 } },
                          },
                          y: {
                            grid: { color: dm ? '#334155' : '#e5e7eb' },
                            ticks: {
                              color: dm ? '#94a3b8' : '#6b7280',
                              callback: (v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v),
                            },
                            beginAtZero: true,
                          },
                        },
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className={`text-sm ${dm ? 'text-slate-400' : 'text-gray-500'}`}>No financial data available for the selected vehicles.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Vehicles Table */}
      <div className={`rounded-lg shadow overflow-hidden ${dm ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-red-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Registration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Asset Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Assigned Staff
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Created
                  </th>
                  {isExec ? (
                    <>
                      <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Revenue</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Fuel</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Total Expenses</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Net Income</th>
                    </>
                  ) : null}
                  {(canAssignVehicles || isDriver || canViewDetails) ? (
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Action
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className={`divide-y ${dm ? 'divide-slate-700' : 'divide-gray-200'}`}>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className={`hover:bg-opacity-50 ${dm ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Truck className="h-5 w-5 text-gray-600" />
                        </div>
                        <div className="ml-4">
                          <div className={`text-sm font-medium ${dm ? 'text-slate-100' : 'text-gray-900'}`}>
                            {vehicle.model}
                          </div>
                          <div className={`text-sm ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                            {vehicle.assetType}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-mono px-2 py-1 rounded ${mode === 'dark' ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-900'}`}>
                        {vehicle.registrationNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(vehicle.status)}`}>
                        {String(vehicle.status || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {vehicle.assetType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vehicle.assignment?.staff ? (
                        <div className="text-sm">
                          <div className={`font-medium ${dm ? 'text-slate-100' : 'text-gray-900'}`}>{vehicle.assignment.staff.fullName}</div>
                          <div className={`${dm ? 'text-slate-400' : 'text-gray-500'}`}>{vehicle.assignment.staff.role}</div>
                        </div>
                      ) : (
                        <span className={`text-sm ${dm ? 'text-slate-500' : 'text-gray-500'}`}>Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${dm ? 'text-slate-300' : 'text-gray-900'}`}>
                        {vehicle.createdAt ? new Date(vehicle.createdAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    {isExec ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-gray-900">
                          {vehicle._finance ? `₦${vehicle._finance.revenue.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-amber-700">
                          {vehicle._finance ? `₦${vehicle._finance.fuel.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-red-700">
                          {vehicle._finance ? `₦${vehicle._finance.totalExpenses.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-semibold">
                          {vehicle._finance ? (
                            <span className={vehicle._finance.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}>
                              ₦{vehicle._finance.netIncome.toLocaleString()}
                            </span>
                          ) : '—'}
                        </td>
                      </>
                    ) : null}
                    {(canAssignVehicles || isDriver || canViewDetails) ? (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-2">
                          {canAssignVehicles ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openAssignModal(vehicle)}
                                className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                {vehicle.assignment?.staff ? 'Reassign' : 'Assign'}
                              </button>
                              {vehicle.assignment?.staff ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeassignVehicle(vehicle.id)}
                                  className={`rounded-lg border px-3 py-1 text-xs font-medium ${dm ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                >
                                  Deassign
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openTransferModal(vehicle)}
                                className="rounded-lg border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 inline-flex items-center gap-1"
                              >
                                <ArrowRightLeft className="h-3 w-3" /> Transfer
                              </button>
                            </>
                          ) : null}

                          {canRequestStatusChange(vehicle) ? (() => {
                            const actionMeta = getStatusRequestActionMeta(vehicle);
                            return (
                              <button
                                type="button"
                                onClick={() => openStatusRequestModal(vehicle)}
                                className={actionMeta.className}
                              >
                                {actionMeta.label}
                              </button>
                            );
                          })() : null}

                          {canViewDetails ? (
                            <button
                              type="button"
                              onClick={() => openDetailModal(vehicle)}
                              className="rounded-lg border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1"
                            >
                              <Info className="h-3 w-3" /> Details
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}

                {filteredVehicles.length === 0 && (
                  <tr>
                    <td colSpan={isExec ? 11 : ((canAssignVehicles || isDriver || canViewDetails) ? 7 : 6)} className={`px-6 py-12 text-center ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                      <Truck className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>No vehicles found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`w-full max-w-xl rounded-lg shadow-xl ${mode === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`flex items-center justify-between border-b px-6 py-4 ${mode === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <h2 className={`text-lg font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-900'}`}>Register Vehicle</h2>
              <button
                type="button"
                onClick={closeModal}
                className={`rounded p-1 ${mode === 'dark' ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterVehicle} className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={`mb-1 block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Registration Number</label>
                  <input
                    type="text"
                    value={form.registrationNumber}
                    onChange={(e) => setForm((prev) => ({ ...prev, registrationNumber: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-700 text-white placeholder:text-slate-400' : 'border-gray-300 text-gray-900'}`}
                    placeholder="ABC-123XY"
                    required
                  />
                </div>

                <div>
                  <label className={`mb-1 block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Model</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-700 text-white placeholder:text-slate-400' : 'border-gray-300 text-gray-900'}`}
                    placeholder="Toyota Corolla"
                    required
                  />
                </div>

                <div>
                  <label className={`mb-1 block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Asset Type</label>
                  <select
                    value={form.assetType}
                    onChange={(e) => setForm((prev) => ({ ...prev, assetType: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-700 text-white' : 'border-gray-300 text-gray-900'}`}
                  >
                    {assetTypes.length > 0 ? assetTypes.map((at) => (
                      <option key={at.id} value={at.name}>{at.name}</option>
                    )) : (
                      <>
                        <option value="SIENNA">SIENNA</option>
                        <option value="COROLLA">COROLLA</option>
                        <option value="OTHER">OTHER</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className={`mb-1 block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Subsidiaries (Units)</label>
                  {loadingSubsidiaries ? (
                    <p className={`text-sm ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Loading subsidiaries...</p>
                  ) : subsidiaries.length === 0 ? null : (
                    <div className={`max-h-36 overflow-y-auto rounded-lg border px-3 py-2 space-y-1 ${mode === 'dark' ? 'border-slate-600 bg-slate-700' : 'border-gray-300'}`}>
                      {subsidiaries.map((subsidiary) => (
                        <label key={subsidiary.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className={`h-4 w-4 rounded text-red-600 focus:ring-red-500 ${mode === 'dark' ? 'border-slate-500 bg-slate-600' : 'border-gray-300'}`}
                            checked={form.subsidiaryIds.includes(subsidiary.id)}
                            onChange={(e) => {
                              setForm((prev) => ({
                                ...prev,
                                subsidiaryIds: e.target.checked
                                  ? [...prev.subsidiaryIds, subsidiary.id]
                                  : prev.subsidiaryIds.filter((id) => id !== subsidiary.id),
                              }));
                            }}
                          />
                          <span className={`text-sm ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{subsidiary.name} ({subsidiary.code})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className={`mb-1 block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Initial Odometer (optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.initialOdometer}
                    onChange={(e) => setForm((prev) => ({ ...prev, initialOdometer: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-700 text-white placeholder:text-slate-400' : 'border-gray-300 text-gray-900'}`}
                    placeholder="0"
                  />
                </div>
              </div>

              {!loadingSubsidiaries && subsidiaries.length === 0 ? (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <p className="font-medium">No subsidiary (unit) is available yet.</p>
                  <p className="mt-1">Create a subsidiary first from the Subsidiaries module, then return to register this vehicle.</p>
                  <button
                    type="button"
                    onClick={() => {
                      closeModal();
                      navigate('/subsidiaries');
                    }}
                    className="mt-3 rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
                  >
                    Go to Subsidiaries
                  </button>
                </div>
              ) : null}

              {error ? (
                <p className={`rounded-md px-3 py-2 text-sm ${mode === 'dark' ? 'bg-red-900/60 text-red-200' : 'bg-red-50 text-red-700'}`}>{error}</p>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className={`rounded-lg border px-4 py-2 ${mode === 'dark' ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || loadingSubsidiaries || subsidiaries.length === 0}
                  className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Registering...' : 'Register Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showAssignModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Assign Vehicle to Staff</h2>
              <button
                type="button"
                onClick={closeAssignModal}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignVehicle} className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Subsidiary Scope</label>
                  <select
                    value={assignmentForm.subsidiaryId}
                    onChange={(e) => setAssignmentForm((prev) => ({ ...prev, subsidiaryId: e.target.value, staffId: '' }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={loadingSubsidiaries || subsidiaries.length === 0}
                  >
                    {subsidiaries.map((subsidiary) => (
                      <option key={subsidiary.id} value={subsidiary.id}>
                        {subsidiary.code === 'MAIN' ? `Main (${subsidiary.name})` : `${subsidiary.name} (${subsidiary.code})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Staff Role</label>
                  <select
                    value={assignmentForm.role}
                    onChange={(e) => setAssignmentForm((prev) => ({ ...prev, role: e.target.value, staffId: '' }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {STAFF_ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Staff</label>
                  <select
                    value={assignmentForm.staffId}
                    onChange={(e) => setAssignmentForm((prev) => ({ ...prev, staffId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={loadingAssignableStaff || assignableStaff.length === 0}
                    required
                  >
                    {assignableStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.fullName} ({staff.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingAssignableStaff ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Loading assignable staff...</p>
              ) : null}

              {!loadingAssignableStaff && assignableStaff.length === 0 ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No active staff found for the selected subsidiary and role.
                </p>
              ) : null}

              {assignmentError ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{assignmentError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className={`rounded-lg border px-4 py-2 ${dm ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningVehicle || loadingAssignableStaff || assignableStaff.length === 0}
                  className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assigningVehicle ? 'Assigning...' : 'Assign Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Request Status Change Modal */}
      {showStatusRequestModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Request Vehicle Status Change</h2>
              <button type="button" onClick={closeStatusRequestModal} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitStatusRequest} className="space-y-4 px-6 py-5">
              <div>
                <p className="text-sm text-gray-600">
                  Current status: <span className="font-medium text-gray-900">{statusRequestForm.sourceStatus || '-'}</span>
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Target Status</label>
                <select
                  value={statusRequestForm.targetStatus}
                  onChange={(e) => setStatusRequestForm((prev) => ({ ...prev, targetStatus: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {getTargetStatusOptions(statusRequestForm.sourceStatus).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Reason <span className="text-red-500">*</span></label>
                <textarea
                  value={statusRequestForm.reason}
                  onChange={(e) => setStatusRequestForm((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Explain why the vehicle status should change…"
                  required
                />
              </div>

              {statusRequestError ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{statusRequestError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={closeStatusRequestModal} className={`rounded-lg border px-4 py-2 ${dm ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStatusRequest}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingStatusRequest ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Chief Driver / Exec: Review Modal */}
      {showReviewModal && reviewingRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {isChiefDriver ? 'Chief Review' : 'Executive Review'} — {reviewingRequest.vehicle?.registrationNumber}
              </h2>
              <button type="button" onClick={closeReviewModal} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 pt-4 space-y-2 text-sm text-gray-700">
              <p><span className="font-medium">Requested by:</span> {reviewingRequest.requester?.fullName}</p>
              <p><span className="font-medium">Target status:</span> {reviewingRequest.targetStatus}</p>
              <p><span className="font-medium">Reason:</span> {reviewingRequest.reason}</p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4 px-6 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Decision</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="APPROVE" checked={reviewForm.decision === 'APPROVE'} onChange={() => setReviewForm((p) => ({ ...p, decision: 'APPROVE' }))} />
                    <CheckCircle className="h-4 w-4 text-green-600" /> Approve
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="REJECT" checked={reviewForm.decision === 'REJECT'} onChange={() => setReviewForm((p) => ({ ...p, decision: 'REJECT' }))} />
                    <XCircle className="h-4 w-4 text-red-600" /> Reject
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Remarks (optional)</label>
                <textarea
                  value={reviewForm.reason}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional remarks…"
                />
              </div>

              {reviewError ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{reviewError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={closeReviewModal} className={`rounded-lg border px-4 py-2 ${dm ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className={`rounded-lg px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60 ${reviewForm.decision === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {submittingReview ? 'Submitting…' : reviewForm.decision === 'APPROVE' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Vehicle Detail Modal */}
      {showDetailModal && detailVehicle ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <div className="flex min-h-full items-start justify-center">
            <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Truck className="h-5 w-5 text-gray-600" />
                    {detailVehicle.model}
                    <span className="font-mono text-sm text-gray-500">{detailVehicle.registrationNumber}</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">{detailVehicle.subsidiary?.name} ({detailVehicle.subsidiary?.code})</p>
                </div>
                <button type="button" onClick={closeDetailModal} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className={`px-6 py-5 space-y-6 ${dm ? 'text-slate-200' : ''}`}>
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  </div>
                ) : (
                  <div>
                    <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                      <Gauge className="h-4 w-4" /> Odometer Summary
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className={`rounded-lg p-4 text-center ${dm ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                        <p className={`text-xs mb-1 ${dm ? 'text-slate-400' : 'text-gray-500'}`}>At Registration</p>
                        <p className={`text-xl font-bold ${dm ? 'text-white' : 'text-gray-800'}`}>
                          {vehicleDetail?.initialOdometer != null ? vehicleDetail.initialOdometer.toLocaleString() : '—'}
                        </p>
                        <p className={`text-xs ${dm ? 'text-slate-500' : 'text-gray-400'}`}>km</p>
                      </div>
                      <div className={`rounded-lg p-4 text-center ${dm ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                        <p className="text-xs text-blue-600 mb-1">Total Distance</p>
                        <p className={`text-xl font-bold ${dm ? 'text-blue-400' : 'text-blue-700'}`}>
                          {vehicleDetail ? vehicleDetail.totalDistanceCoveredKm.toLocaleString() : '—'}
                        </p>
                        <p className="text-xs text-blue-400">km covered</p>
                      </div>
                      <div className={`rounded-lg p-4 text-center ${dm ? 'bg-red-900/30' : 'bg-red-50'}`}>
                        <p className="text-xs text-red-600 mb-1">Current Odometer</p>
                        <p className={`text-xl font-bold ${dm ? 'text-red-400' : 'text-red-700'}`}>
                          {vehicleDetail ? vehicleDetail.currentOdometer.toLocaleString() : '—'}
                        </p>
                        <p className="text-xs text-red-400">km total</p>
                      </div>
                      <div className={`rounded-lg p-4 text-center ${dm ? 'bg-green-900/30' : 'bg-green-50'}`}>
                        <p className="text-xs text-green-600 mb-1">Total Trips</p>
                        <p className={`text-xl font-bold ${dm ? 'text-green-400' : 'text-green-700'}`}>
                          {vehicleDetail ? vehicleDetail.totalTrips : '—'}
                        </p>
                        <p className="text-xs text-green-400">logged trips</p>
                      </div>
                    </div>
                    {vehicleDetail?.assignment?.staff ? (
                      <div className={`mt-4 rounded-lg border px-4 py-3 flex items-center gap-3 ${dm ? 'border-slate-600 bg-slate-700/50' : 'border-gray-200'}`}>
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${dm ? 'bg-slate-600' : 'bg-gray-100'}`}>
                          <Truck className={`h-4 w-4 ${dm ? 'text-slate-300' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${dm ? 'text-slate-100' : 'text-gray-800'}`}>Assigned to {vehicleDetail.assignment.staff.fullName}</p>
                          <p className={`text-xs ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                            {vehicleDetail.assignment.staff.role} · Since {vehicleDetail.assignment.assignedAt ? new Date(vehicleDetail.assignment.assignedAt).toLocaleDateString('en-NG') : '—'}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                <div>
                  <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                    <Route className="h-4 w-4" /> Trip Log History
                  </h3>
                  {loadingDetailLogs ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    </div>
                  ) : vehicleDetailLogs.length === 0 ? (
                    <p className={`text-sm text-center py-6 ${dm ? 'text-slate-400' : 'text-gray-500'}`}>No trip logs recorded for this vehicle.</p>
                  ) : (
                    <div className={`overflow-x-auto rounded-lg border ${dm ? 'border-slate-600' : 'border-gray-200'}`}>
                      <table className="w-full text-sm">
                        <thead className="bg-red-600">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-white uppercase">Driver</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-white uppercase">Route</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-white uppercase">Departure</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-white uppercase">Arrival</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-white uppercase">Time Taken</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-white uppercase">Distance</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-white uppercase">Odometer</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${dm ? 'divide-slate-700' : 'divide-gray-100'}`}>
                          {vehicleDetailLogs.map((log) => (
                            <tr key={log.id} className={`${dm ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`}>
                              <td className={`px-3 py-2 font-medium ${dm ? 'text-slate-100' : 'text-gray-800'}`}>{log.driver?.fullName ?? '—'}</td>
                              <td className={`px-3 py-2 ${dm ? 'text-slate-300' : 'text-gray-700'}`}>
                                {log.startPoint} <span className="text-gray-400">→</span> {log.destination}
                              </td>
                              <td className={`px-3 py-2 whitespace-nowrap ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                                {new Date(log.departureAt).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td className={`px-3 py-2 whitespace-nowrap ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                                {new Date(log.arrivalAt).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td className={`px-3 py-2 whitespace-nowrap ${dm ? 'text-slate-300' : 'text-gray-700'}`}>
                                {formatTripDuration(log.departureAt, log.arrivalAt)}
                              </td>
                              <td className="px-3 py-2 text-right text-blue-700">
                                {log.distanceCoveredKm.toLocaleString()} km
                              </td>
                              <td className={`px-3 py-2 text-right ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                                {log.initialOdometer.toLocaleString()} → {log.destinationOdometer.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end border-t border-gray-200 px-6 py-4">
                <button type="button" onClick={closeDetailModal} className={`rounded-lg border px-4 py-2 text-sm ${dm ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Transfer Vehicle Modal — CEO & SUPER_ADMIN only */}
      {showTransferModal && transferringVehicle ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`w-full max-w-xl rounded-lg shadow-xl ${mode === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`flex items-center justify-between border-b px-6 py-4 ${mode === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <h2 className={`text-lg font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Transfer Vehicle — {transferringVehicle.registrationNumber}
              </h2>
              <button
                type="button"
                onClick={closeTransferModal}
                className={`rounded p-1 ${mode === 'dark' ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleTransferVehicle} className="space-y-4 px-6 py-5">
              <div className="rounded-md bg-purple-50 px-3 py-2 text-sm text-purple-800">
                <p className="font-medium">Current subsidiary: {transferringVehicle.subsidiary?.name || 'N/A'} ({transferringVehicle.subsidiary?.code || '—'})</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={`mb-1 block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Registration Number</label>
                  <input
                    type="text"
                    value={transferForm.registrationNumber}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, registrationNumber: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-700 text-white placeholder:text-slate-400' : 'border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`mb-1 block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Model</label>
                  <input
                    type="text"
                    value={transferForm.model}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, model: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-700 text-white placeholder:text-slate-400' : 'border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`mb-1 block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Asset Type</label>
                  <select
                    value={transferForm.assetType}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, assetType: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-700 text-white' : 'border-gray-300 text-gray-900'}`}
                  >
                    {assetTypes.length > 0 ? assetTypes.map((at) => (
                      <option key={at.id} value={at.name}>{at.name}</option>
                    )) : (
                      <>
                        <option value="SIENNA">SIENNA</option>
                        <option value="COROLLA">COROLLA</option>
                        <option value="OTHER">OTHER</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className={`mb-1 block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Status</label>
                  <select
                    value={transferForm.status}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, status: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-700 text-white' : 'border-gray-300 text-gray-900'}`}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SOLD">SOLD</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className={`mb-1 block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                    Transfer to Subsidiaries (Units) <span className="text-red-500">*</span>
                  </label>
                  {loadingSubsidiaries ? (
                    <p className={`text-sm ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Loading subsidiaries...</p>
                  ) : subsidiaries.length === 0 ? (
                    <p className={`text-sm ${mode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>No subsidiaries available.</p>
                  ) : (
                    <div className={`max-h-36 overflow-y-auto rounded-lg border px-3 py-2 space-y-1 ${mode === 'dark' ? 'border-slate-600 bg-slate-700' : 'border-gray-300'}`}>
                      {subsidiaries.map((subsidiary) => (
                        <label key={subsidiary.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className={`h-4 w-4 rounded text-purple-600 focus:ring-purple-500 ${mode === 'dark' ? 'border-slate-500 bg-slate-600' : 'border-gray-300'}`}
                            checked={transferForm.subsidiaryIds.includes(subsidiary.id)}
                            onChange={(e) => {
                              setTransferForm((prev) => ({
                                ...prev,
                                subsidiaryIds: e.target.checked
                                  ? [...prev.subsidiaryIds, subsidiary.id]
                                  : prev.subsidiaryIds.filter((id) => id !== subsidiary.id),
                              }));
                            }}
                          />
                          <span className={`text-sm ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                            {subsidiary.name} ({subsidiary.code})
                            {subsidiary.id === transferringVehicle.subsidiaryId ? (
                              <span className="ml-1 text-xs text-purple-600 font-medium">(current)</span>
                            ) : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className={`mb-1 block text-sm font-medium ${mode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Initial Odometer (optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={transferForm.initialOdometer}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, initialOdometer: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 ${mode === 'dark' ? 'border-slate-600 bg-slate-700 text-white placeholder:text-slate-400' : 'border-gray-300 text-gray-900'}`}
                    placeholder="0"
                  />
                </div>
              </div>

              {transferError ? (
                <p className={`rounded-md px-3 py-2 text-sm ${mode === 'dark' ? 'bg-red-900/60 text-red-200' : 'bg-red-50 text-red-700'}`}>{transferError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeTransferModal}
                  className={`rounded-lg border px-4 py-2 ${mode === 'dark' ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring || loadingSubsidiaries || subsidiaries.length === 0}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {transferring ? 'Transferring...' : 'Transfer Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Vehicles;


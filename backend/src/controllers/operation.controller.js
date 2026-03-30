import { OperationRepository } from '../repositories/operation.repository.js';
import { validateDailyOperation } from '../validators/operation.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../config/database.js';
import NotificationService from '../services/notification.service.js';
import {
  hasGlobalSubsidiaryAccess,
  resolveMainSubsidiaryId,
  resolveScopedSubsidiaryId,
} from '../utils/subsidiaryScope.js';

const VEHICLE_ASSIGNER_ROLES = new Set(['CEO', 'SUPER_ADMIN']);
const ASSIGNABLE_STAFF_ROLES = new Set([
  'DRIVER',
  'CHIEF_DRIVER',
]);
const ASSIGNABLE_STAFF_POSITION_NAMES = ['Driver', 'Chief Driver'];
const VEHICLE_LOGGER_ROLES = new Set(['DRIVER', 'CHIEF_DRIVER']);

const normalizeInput = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const parseDateTimeInput = (value) => {
  const normalized = normalizeInput(value);
  if (!normalized) return null;

  // Handle datetime-local values without timezone (e.g. 2026-03-22T11:41)
  const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
  if (localDateTimePattern.test(normalized)) {
    const [datePart, timePart] = normalized.split('T');
    const [year, month, day] = datePart.split('-').map((part) => Number(part));
    const [hours, minutes, seconds = 0] = timePart.split(':').map((part) => Number(part));

    const localDate = new Date(year, month - 1, day, hours, minutes, seconds, 0);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildDriverPositionFilter = () => ({
  OR: [
    { position: { equals: 'Driver', mode: 'insensitive' } },
    { position: { equals: 'Chief Driver', mode: 'insensitive' } },
    {
      positionRecord: {
        is: {
          name: { equals: 'Driver', mode: 'insensitive' },
        },
      },
    },
    {
      positionRecord: {
        is: {
          name: { equals: 'Chief Driver', mode: 'insensitive' },
        },
      },
    },
  ],
});

export class OperationController {
  constructor() {
    this.operationRepository = new OperationRepository();
  }

  createVehicle = asyncHandler(async (req, res) => {
    const {
      registrationNumber,
      model,
      assetType,
      status,
      initialOdometer,
      subsidiaryId,
      subsidiaryIds,
    } = req.body;

    if (!registrationNumber || !model || !assetType) {
      return res.status(400).json({
        success: false,
        message: 'registrationNumber, model and assetType are required',
      });
    }

    const normalizedAssetType = String(assetType).toUpperCase();
    const normalizedStatus = status ? String(status).toUpperCase() : 'ACTIVE';

    const allowedAssetTypes = new Set(['SIENNA', 'COROLLA', 'OTHER']);
    const allowedStatuses = new Set(['ACTIVE', 'MAINTENANCE', 'INACTIVE', 'SOLD']);

    if (!allowedAssetTypes.has(normalizedAssetType)) {
      return res.status(400).json({
        success: false,
        message: 'assetType must be one of SIENNA, COROLLA, OTHER',
      });
    }

    if (!allowedStatuses.has(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'status must be one of ACTIVE, MAINTENANCE, INACTIVE, SOLD',
      });
    }

    const currentRole = String(req.user?.role || '').toUpperCase();
    if (currentRole !== 'CHIEF_DRIVER') {
      return res.status(403).json({
        success: false,
        message: 'Only chief drivers can register vehicles',
      });
    }

    // Resolve list of subsidiary IDs (multi-select or fallback to single)
    const rawIdList = Array.isArray(subsidiaryIds) && subsidiaryIds.length > 0
      ? subsidiaryIds
      : (subsidiaryId ? [subsidiaryId] : []);

    if (rawIdList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one subsidiary must be selected',
      });
    }

    // Resolve each requested subsidiary within the user's access scope
    const resolvedIds = await Promise.all(
      rawIdList.map((sid) =>
        resolveScopedSubsidiaryId({
          requestedSubsidiaryId: sid,
          userSubsidiaryId: req.user?.subsidiaryId,
          userSubsidiaryAccess: req.user?.subsidiaryAccess,
        })
      )
    );
    const uniqueResolvedIds = [...new Set(resolvedIds.filter(Boolean))];

    const allowedSubsidiaryIds = [
      req.user?.subsidiaryId,
      ...(Array.isArray(req.user?.subsidiaryAccess) ? req.user.subsidiaryAccess : []),
    ].filter(Boolean);
    const uniqueAllowedSubsidiaryIds = [...new Set(allowedSubsidiaryIds)];

    if (uniqueAllowedSubsidiaryIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No subsidiary access is assigned to this chief driver',
      });
    }

    const hasOutOfScopeSubsidiary = uniqueResolvedIds.some((sid) => !uniqueAllowedSubsidiaryIds.includes(sid));
    if (hasOutOfScopeSubsidiary) {
      return res.status(403).json({
        success: false,
        message: 'Vehicle can only be registered into subsidiaries assigned to this chief driver',
      });
    }

    if (uniqueResolvedIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid subsidiaries resolved for this user',
      });
    }

    // Primary subsidiary is the first in the list (used for the Vehicle.subsidiaryId FK)
    const primarySubsidiaryId = uniqueResolvedIds[0];

    try {
      const vehicle = await prisma.vehicle.create({
        data: {
          registrationNumber: String(registrationNumber).trim(),
          model: String(model).trim(),
          assetType: normalizedAssetType,
          status: normalizedStatus,
          initialOdometer: initialOdometer !== undefined && initialOdometer !== null && initialOdometer !== ''
            ? Number(initialOdometer)
            : null,
          subsidiaryId: primarySubsidiaryId,
          vehicleSubsidiaries: {
            create: uniqueResolvedIds.map((sid) => ({ subsidiaryId: sid })),
          },
        },
        select: {
          id: true,
          registrationNumber: true,
          model: true,
          assetType: true,
          status: true,
          subsidiaryId: true,
          vehicleSubsidiaries: {
            select: { subsidiaryId: true },
          },
          createdAt: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Vehicle registered successfully',
        data: vehicle,
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'A vehicle with this registration number already exists',
        });
      }

      throw error;
    }
  });

  createOperation = asyncHandler(async (req, res) => {
    const { error } = validateDailyOperation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const operation = await this.operationRepository.create({
      ...req.body,
      operationDate: new Date(req.body.operationDate),
      distanceCovered: req.body.closeOdometer - req.body.openOdometer,
      createdById: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Operation created successfully',
      data: operation,
    });
  });

  getOperations = asyncHandler(async (req, res) => {
    const {
      vehicleId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const where = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (startDate || endDate) {
      where.operationDate = {};
      if (startDate) where.operationDate.gte = new Date(startDate);
      if (endDate) where.operationDate.lte = new Date(endDate);
    }

    const operations = await this.operationRepository.findMany(
      where,
      {
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            model: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      { operationDate: 'desc' },
      (parseInt(page) - 1) * parseInt(limit),
      parseInt(limit)
    );

    const total = await this.operationRepository.count(where);

    res.status(200).json({
      success: true,
      data: operations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  });

  updateOperation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await this.operationRepository.findById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Operation not found',
      });
    }

    const updatePayload = { ...req.body };
    if (updatePayload.openOdometer !== undefined || updatePayload.closeOdometer !== undefined) {
      const openOdometer = updatePayload.openOdometer ?? existing.openOdometer;
      const closeOdometer = updatePayload.closeOdometer ?? existing.closeOdometer;
      updatePayload.distanceCovered = closeOdometer - openOdometer;
    }
    if (updatePayload.operationDate) {
      updatePayload.operationDate = new Date(updatePayload.operationDate);
    }

    const updated = await this.operationRepository.update(id, updatePayload);

    res.status(200).json({
      success: true,
      message: 'Operation updated successfully',
      data: updated,
    });
  });

  getVehicleOperations = asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    const { startDate, endDate } = req.query;

    const operations = await this.operationRepository.findMany(
      {
        vehicleId,
        ...(startDate || endDate
          ? {
              operationDate: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      null,
      { operationDate: 'desc' }
    );

    res.status(200).json({
      success: true,
      data: operations,
    });
  });

  getVehicles = asyncHandler(async (req, res) => {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const requestedSubsidiaryId = normalizeInput(req.query.subsidiaryId);
    const currentRole = String(req.user?.role || '').toUpperCase();

    const primaryId = req.user?.subsidiaryId;
    const accessArr = Array.isArray(req.user?.subsidiaryAccess) ? req.user.subsidiaryAccess : [];
    const userScope = primaryId ? [...new Set([primaryId, ...accessArr])] : accessArr;
    const canAccessAllSubsidiaries = hasGlobalSubsidiaryAccess(req.user?.role);

    if (currentRole === 'DRIVER') {
      const assignments = await prisma.vehicleAssignment.findMany({
        where: { staffId: req.user.id },
        select: { vehicleId: true },
      });
      const assignedVehicleIds = [...new Set(assignments.map((row) => row.vehicleId).filter(Boolean))];

      const where = {
        id: assignedVehicleIds.length > 0 ? { in: assignedVehicleIds } : '__no_vehicle_match__',
        ...(includeInactive ? {} : { status: 'ACTIVE' }),
        ...(requestedSubsidiaryId ? { subsidiaryId: requestedSubsidiaryId } : {}),
      };

      const vehicles = await prisma.vehicle.findMany({
        where,
        select: {
          id: true,
          registrationNumber: true,
          model: true,
          assetType: true,
          status: true,
          subsidiaryId: true,
          initialOdometer: true,
          createdAt: true,
          subsidiary: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          assignment: {
            select: {
              id: true,
              assignedAt: true,
              staff: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                },
              },
              assignedBy: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              subsidiary: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: {
          registrationNumber: 'asc',
        },
      });

      return res.status(200).json({
        success: true,
        data: vehicles,
        count: vehicles.length,
      });
    }

    if (requestedSubsidiaryId && !canAccessAllSubsidiaries && !userScope.includes(requestedSubsidiaryId)) {
      return res.status(403).json({
        success: false,
        message: 'Access to this subsidiary denied',
      });
    }

    const where = {
      ...(includeInactive ? {} : { status: 'ACTIVE' }),
      ...(requestedSubsidiaryId ? { subsidiaryId: requestedSubsidiaryId } : {}),
    };

    if (!canAccessAllSubsidiaries && !requestedSubsidiaryId) {
      where.subsidiaryId = {
        in: userScope,
      };
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      select: {
        id: true,
        registrationNumber: true,
        model: true,
        assetType: true,
        status: true,
        subsidiaryId: true,
        initialOdometer: true,
        createdAt: true,
        subsidiary: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        assignment: {
          select: {
            id: true,
            assignedAt: true,
            staff: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
            assignedBy: {
              select: {
                id: true,
                fullName: true,
              },
            },
            subsidiary: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: {
        registrationNumber: 'asc',
      },
    });

    res.status(200).json({
      success: true,
      data: vehicles,
    });
  });

  getAssignableStaff = asyncHandler(async (req, res) => {
    if (!VEHICLE_ASSIGNER_ROLES.has(String(req.user?.role || '').toUpperCase())) {
      return res.status(403).json({
        success: false,
        message: 'Only CEO and SUPER_ADMIN can assign vehicles',
      });
    }

    const search = normalizeInput(req.query.search);
    const requestedRole = normalizeInput(req.query.role)?.toUpperCase();
    const requestedSubsidiary = normalizeInput(req.query.subsidiaryId);

    if (requestedRole && !ASSIGNABLE_STAFF_ROLES.has(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff role supplied for assignment',
      });
    }

    const resolvedSubsidiaryId = requestedSubsidiary?.toUpperCase() === 'MAIN'
      ? await resolveMainSubsidiaryId()
      : (requestedSubsidiary || req.user?.subsidiaryId);

    const subsidiary = await prisma.subsidiary.findUnique({
      where: { id: resolvedSubsidiaryId },
      select: { id: true, code: true, name: true, isActive: true },
    });

    if (!subsidiary || !subsidiary.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Selected subsidiary is invalid or inactive',
      });
    }

    const canAccessAllSubsidiaries = hasGlobalSubsidiaryAccess(req.user?.role);
    const scope = Array.isArray(req.user?.subsidiaryAccess) ? req.user.subsidiaryAccess : [];

    if (!canAccessAllSubsidiaries && !scope.includes(subsidiary.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access to this subsidiary denied',
      });
    }

    const staffRows = await prisma.user.findMany({
      where: {
        isActive: true,
        AND: [
          buildDriverPositionFilter(),
          {
            OR: [
              { subsidiaryId: subsidiary.id },
              { subsidiaryAccess: { has: subsidiary.id } },
            ],
          },
          ...(search
            ? [
                {
                  OR: [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { employeeId: { contains: search, mode: 'insensitive' } },
                  ],
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        employeeId: true,
        role: true,
        position: true,
        positionRecord: {
          select: {
            id: true,
            name: true,
          },
        },
        subsidiaryId: true,
        subsidiary: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        fullName: 'asc',
      },
      take: 100,
    });

    const staff = staffRows.filter((row) => {
      if (!ASSIGNABLE_STAFF_ROLES.has(row.role)) return false;
      if (requestedRole && row.role !== requestedRole) return false;
      return true;
    });

    res.status(200).json({
      success: true,
      data: staff,
      meta: {
        subsidiary,
      },
    });
  });

  assignVehicle = asyncHandler(async (req, res) => {
    if (!VEHICLE_ASSIGNER_ROLES.has(String(req.user?.role || '').toUpperCase())) {
      return res.status(403).json({
        success: false,
        message: 'Only CEO and SUPER_ADMIN can assign vehicles',
      });
    }

    const { vehicleId } = req.params;
    const staffId = normalizeInput(req.body?.staffId);
    const requestedRole = normalizeInput(req.body?.role)?.toUpperCase();
    const requestedSubsidiary = normalizeInput(req.body?.subsidiaryId);

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: 'staffId is required',
      });
    }

    if (requestedRole && !ASSIGNABLE_STAFF_ROLES.has(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff role supplied for assignment',
      });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        subsidiaryId: true,
      },
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found',
      });
    }

    const resolvedSubsidiaryId = requestedSubsidiary?.toUpperCase() === 'MAIN'
      ? await resolveMainSubsidiaryId()
      : (requestedSubsidiary || vehicle.subsidiaryId);

    const targetSubsidiary = await prisma.subsidiary.findUnique({
      where: { id: resolvedSubsidiaryId },
      select: { id: true, code: true, name: true, isActive: true },
    });

    if (!targetSubsidiary || !targetSubsidiary.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Selected subsidiary is invalid or inactive',
      });
    }

    const canAccessAllSubsidiaries = hasGlobalSubsidiaryAccess(req.user?.role);
    const scope = Array.isArray(req.user?.subsidiaryAccess) ? req.user.subsidiaryAccess : [];

    if (!canAccessAllSubsidiaries && !scope.includes(targetSubsidiary.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access to this subsidiary denied',
      });
    }

    const staff = await prisma.user.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        position: true,
        positionRecord: {
          select: {
            id: true,
            name: true,
          },
        },
        isActive: true,
        subsidiaryId: true,
        subsidiaryAccess: true,
      },
    });

    if (!staff || !staff.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Selected staff not found or inactive',
      });
    }

    if (requestedRole && staff.role !== requestedRole) {
      return res.status(400).json({
        success: false,
        message: `Selected staff does not match role ${requestedRole}`,
      });
    }

    const resolvedPositionNames = [staff.position, staff.positionRecord?.name]
      .map((value) => normalizeInput(value)?.toLowerCase())
      .filter(Boolean);
    const allowedPositionNames = ASSIGNABLE_STAFF_POSITION_NAMES.map((name) => name.toLowerCase());

    if (!ASSIGNABLE_STAFF_ROLES.has(staff.role) || !resolvedPositionNames.some((name) => allowedPositionNames.includes(name))) {
      return res.status(400).json({
        success: false,
        message: 'Staff must have role DRIVER or CHIEF_DRIVER and position Driver or Chief Driver',
      });
    }

    const staffScope = Array.isArray(staff.subsidiaryAccess) ? staff.subsidiaryAccess : [];
    if (staff.subsidiaryId !== targetSubsidiary.id && !staffScope.includes(targetSubsidiary.id)) {
      return res.status(400).json({
        success: false,
        message: 'Selected staff does not belong to the vehicle subsidiary',
      });
    }

    const assignment = await prisma.vehicleAssignment.upsert({
      where: { vehicleId: vehicle.id },
      create: {
        vehicleId: vehicle.id,
        staffId: staff.id,
        assignedById: req.user.id,
        subsidiaryId: targetSubsidiary.id,
      },
      update: {
        staffId: staff.id,
        assignedById: req.user.id,
        subsidiaryId: targetSubsidiary.id,
        assignedAt: new Date(),
      },
      select: {
        id: true,
        assignedAt: true,
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            model: true,
          },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
        subsidiary: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Vehicle assigned successfully',
      data: assignment,
    });
  });

  deassignVehicle = asyncHandler(async (req, res) => {
    if (!VEHICLE_ASSIGNER_ROLES.has(String(req.user?.role || '').toUpperCase())) {
      return res.status(403).json({
        success: false,
        message: 'Only CEO and SUPER_ADMIN can de-assign vehicles',
      });
    }

    const { vehicleId } = req.params;

    const assignment = await prisma.vehicleAssignment.findUnique({
      where: { vehicleId },
      select: {
        id: true,
        vehicleId: true,
        subsidiaryId: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'No assignment found for this vehicle',
      });
    }

    const canAccessAllSubsidiaries = hasGlobalSubsidiaryAccess(req.user?.role);
    const scope = Array.isArray(req.user?.subsidiaryAccess) ? req.user.subsidiaryAccess : [];
    if (!canAccessAllSubsidiaries && !scope.includes(assignment.subsidiaryId)) {
      return res.status(403).json({
        success: false,
        message: 'Access to this subsidiary denied',
      });
    }

    await prisma.vehicleAssignment.delete({
      where: { id: assignment.id },
    });

    return res.status(200).json({
      success: true,
      message: 'Vehicle de-assigned successfully',
    });
  });

  createVehicleLog = asyncHandler(async (req, res) => {
    const requesterRole = String(req.user?.role || '').toUpperCase();
    if (!VEHICLE_LOGGER_ROLES.has(requesterRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only drivers can submit vehicle logs',
      });
    }

    const {
      vehicleId,
      startPoint,
      destination,
      departureAt,
      arrivalAt,
      initialOdometer,
      destinationOdometer,
    } = req.body || {};

    const normalizedVehicleId = normalizeInput(vehicleId);
    const normalizedStartPoint = normalizeInput(startPoint);
    const normalizedDestination = normalizeInput(destination);

    const parsedDepartureAt = parseDateTimeInput(departureAt);
    const parsedArrivalAt = parseDateTimeInput(arrivalAt);

    const openOdometer = Number(initialOdometer);
    const closeOdometer = Number(destinationOdometer);

    if (!normalizedVehicleId || !normalizedStartPoint || !normalizedDestination) {
      return res.status(400).json({
        success: false,
        message: 'vehicleId, startPoint, and destination are required',
      });
    }

    if (!parsedDepartureAt || Number.isNaN(parsedDepartureAt.getTime()) || !parsedArrivalAt || Number.isNaN(parsedArrivalAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Valid departureAt and arrivalAt date-time are required',
      });
    }

    if (parsedArrivalAt < parsedDepartureAt) {
      return res.status(400).json({
        success: false,
        message: 'Arrival date-time must be greater than or equal to departure date-time',
      });
    }

    if (!Number.isFinite(openOdometer) || !Number.isFinite(closeOdometer) || openOdometer < 0 || closeOdometer < 0) {
      return res.status(400).json({
        success: false,
        message: 'initialOdometer and destinationOdometer must be valid non-negative numbers',
      });
    }

    if (closeOdometer < openOdometer) {
      return res.status(400).json({
        success: false,
        message: 'destinationOdometer must be greater than or equal to initialOdometer',
      });
    }

    const assignment = await prisma.vehicleAssignment.findUnique({
      where: { vehicleId: normalizedVehicleId },
      select: {
        id: true,
        staffId: true,
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            model: true,
          },
        },
      },
    });

    if (!assignment) {
      return res.status(400).json({
        success: false,
        message: 'This vehicle is not currently assigned to any driver',
      });
    }

    if (assignment.staffId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit logs for your assigned vehicle',
      });
    }

    const distanceCoveredKm = closeOdometer - openOdometer;

    const createdLog = await prisma.vehicleLog.create({
      data: {
        vehicleId: normalizedVehicleId,
        driverId: req.user.id,
        startPoint: normalizedStartPoint,
        destination: normalizedDestination,
        departureAt: parsedDepartureAt,
        arrivalAt: parsedArrivalAt,
        initialOdometer: openOdometer,
        destinationOdometer: closeOdometer,
        distanceCoveredKm,
      },
      select: {
        id: true,
        startPoint: true,
        destination: true,
        departureAt: true,
        arrivalAt: true,
        initialOdometer: true,
        destinationOdometer: true,
        distanceCoveredKm: true,
        createdAt: true,
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            model: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Vehicle log submitted successfully',
      data: createdLog,
    });
  });

  getMyVehicleLogs = asyncHandler(async (req, res) => {
    const requesterRole = String(req.user?.role || '').toUpperCase();
    if (!VEHICLE_LOGGER_ROLES.has(requesterRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only drivers can view vehicle logs',
      });
    }

    const { vehicleId, limit = 50 } = req.query;
    const normalizedVehicleId = normalizeInput(vehicleId);

    if (normalizedVehicleId) {
      const assignment = await prisma.vehicleAssignment.findUnique({
        where: { vehicleId: normalizedVehicleId },
        select: { staffId: true },
      });
      if (!assignment || assignment.staffId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only view logs for your assigned vehicle',
        });
      }
    }

    const logs = await prisma.vehicleLog.findMany({
      where: {
        driverId: req.user.id,
        ...(normalizedVehicleId ? { vehicleId: normalizedVehicleId } : {}),
      },
      orderBy: { departureAt: 'desc' },
      take: Math.min(100, Math.max(1, Number(limit) || 50)),
      select: {
        id: true,
        startPoint: true,
        destination: true,
        departureAt: true,
        arrivalAt: true,
        initialOdometer: true,
        destinationOdometer: true,
        distanceCoveredKm: true,
        createdAt: true,
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            model: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: logs,
    });
  });

  // ── Vehicle detail with odometer stats ─────────────────────────────────────
  getVehicleDetail = asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    const requesterRole = String(req.user?.role || '').toUpperCase();
    const isGlobal = hasGlobalSubsidiaryAccess(requesterRole);
    const primaryId = req.user?.subsidiaryId;
    const accessArr = Array.isArray(req.user?.subsidiaryAccess) ? req.user.subsidiaryAccess : [];
    const userScope = primaryId ? [...new Set([primaryId, ...accessArr])] : accessArr;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        registrationNumber: true,
        model: true,
        assetType: true,
        status: true,
        initialOdometer: true,
        subsidiaryId: true,
        createdAt: true,
        subsidiary: { select: { id: true, name: true, code: true } },
        assignment: {
          select: {
            id: true,
            assignedAt: true,
            staff: { select: { id: true, fullName: true, email: true, role: true } },
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    // Access control
    if (requesterRole === 'DRIVER') {
      if (vehicle.assignment?.staff?.id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only view your assigned vehicle' });
      }
    } else if (requesterRole === 'CHIEF_DRIVER') {
      if (!userScope.includes(vehicle.subsidiaryId)) {
        return res.status(403).json({ success: false, message: 'Vehicle is outside your subsidiary' });
      }
    } else if (!isGlobal) {
      if (!userScope.includes(vehicle.subsidiaryId)) {
        return res.status(403).json({ success: false, message: 'Vehicle is outside your subsidiary scope' });
      }
    }

    const agg = await prisma.vehicleLog.aggregate({
      where: { vehicleId },
      _sum: { distanceCoveredKm: true },
      _count: { id: true },
    });

    const totalDistanceCoveredKm = agg._sum.distanceCoveredKm ?? 0;
    const totalTrips = agg._count.id;
    const currentOdometer = (vehicle.initialOdometer ?? 0) + totalDistanceCoveredKm;

    return res.status(200).json({
      success: true,
      data: {
        ...vehicle,
        totalDistanceCoveredKm,
        currentOdometer,
        totalTrips,
      },
    });
  });

  // ── Vehicle logs for a specific vehicle (admin / chief / driver) ────────────
  getVehicleLogs = asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    const requesterRole = String(req.user?.role || '').toUpperCase();
    const isGlobal = hasGlobalSubsidiaryAccess(requesterRole);
    const primaryId = req.user?.subsidiaryId;
    const accessArr = Array.isArray(req.user?.subsidiaryAccess) ? req.user.subsidiaryAccess : [];
    const userScope = primaryId ? [...new Set([primaryId, ...accessArr])] : accessArr;

    const { limit = 50, offset = 0 } = req.query;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        subsidiaryId: true,
        assignment: { select: { staffId: true } },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    if (requesterRole === 'DRIVER') {
      if (vehicle.assignment?.staffId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only view logs for your assigned vehicle' });
      }
    } else if (requesterRole === 'CHIEF_DRIVER') {
      if (!userScope.includes(vehicle.subsidiaryId)) {
        return res.status(403).json({ success: false, message: 'Vehicle is outside your subsidiary' });
      }
    } else if (!isGlobal) {
      if (!userScope.includes(vehicle.subsidiaryId)) {
        return res.status(403).json({ success: false, message: 'Vehicle is outside your subsidiary scope' });
      }
    }

    const logs = await prisma.vehicleLog.findMany({
      where: { vehicleId },
      orderBy: { departureAt: 'desc' },
      take: Math.min(100, Math.max(1, Number(limit) || 50)),
      skip: Math.max(0, Number(offset) || 0),
      select: {
        id: true,
        startPoint: true,
        destination: true,
        departureAt: true,
        arrivalAt: true,
        initialOdometer: true,
        destinationOdometer: true,
        distanceCoveredKm: true,
        createdAt: true,
        driver: { select: { id: true, fullName: true, role: true } },
      },
    });

    return res.status(200).json({
      success: true,
      data: logs,
    });
  });

  // ── Direct status edit (ADMIN / CEO / SUPER_ADMIN) ──────────────────────────
  updateVehicleStatus = asyncHandler(async (req, res) => {
    const DIRECT_EDITORS = new Set(['ADMIN', 'CEO', 'SUPER_ADMIN']);
    if (!DIRECT_EDITORS.has(String(req.user?.role || '').toUpperCase())) {
      return res.status(403).json({ success: false, message: 'Not authorised to directly update vehicle status' });
    }

    const { id } = req.params;
    const VALID_STATUSES = new Set(['ACTIVE', 'MAINTENANCE', 'INACTIVE', 'SOLD']);
    const newStatus = normalizeInput(req.body?.status)?.toUpperCase();

    if (!newStatus || !VALID_STATUSES.has(newStatus)) {
      return res.status(400).json({ success: false, message: 'status must be one of ACTIVE, MAINTENANCE, INACTIVE, SOLD' });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id }, select: { id: true, status: true, registrationNumber: true } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    const updated = await prisma.vehicle.update({
      where: { id },
      data: { status: newStatus },
      select: { id: true, registrationNumber: true, model: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'VEHICLE_STATUS_UPDATED',
        entity: 'VEHICLE',
        entityId: id,
        newValue: { from: vehicle.status, to: newStatus, updatedBy: req.user.id },
      },
    });

    return res.status(200).json({ success: true, message: 'Vehicle status updated', data: updated });
  });

  // ── Driver submits status change request ────────────────────────────────────
  requestVehicleStatusChange = asyncHandler(async (req, res) => {
    const requesterRole = String(req.user?.role || '').toUpperCase();
    const REQUESTER_ROLES = new Set(['DRIVER', 'CHIEF_DRIVER', 'CEO', 'SUPER_ADMIN']);
    if (!REQUESTER_ROLES.has(requesterRole)) {
      return res.status(403).json({ success: false, message: 'Only DRIVER, CHIEF_DRIVER, CEO, and SUPER_ADMIN can submit status change requests' });
    }

    const { vehicleId } = req.params;
    const TARGET_STATUSES = new Set(['ACTIVE', 'MAINTENANCE', 'INACTIVE']);
    const targetStatus = normalizeInput(req.body?.targetStatus)?.toUpperCase();
    const reason = normalizeInput(req.body?.reason);

    if (!targetStatus || !TARGET_STATUSES.has(targetStatus)) {
      return res.status(400).json({ success: false, message: 'targetStatus must be ACTIVE, MAINTENANCE, or INACTIVE' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, message: 'reason is required' });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, status: true, registrationNumber: true, subsidiaryId: true },
    });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    if (targetStatus === 'ACTIVE') {
      if (vehicle.status === 'SOLD') {
        return res.status(409).json({ success: false, message: 'Sold vehicles cannot be activated' });
      }
      if (!['MAINTENANCE', 'INACTIVE'].includes(vehicle.status)) {
        return res.status(409).json({ success: false, message: `Vehicle can only be activated from MAINTENANCE or INACTIVE (current: ${vehicle.status})` });
      }
    } else if (vehicle.status !== 'ACTIVE') {
      return res.status(409).json({ success: false, message: `Vehicle must be ACTIVE before moving to ${targetStatus} (current: ${vehicle.status})` });
    }

    // DRIVER must be assigned to request status changes.
    if (requesterRole === 'DRIVER') {
      const assignment = await prisma.vehicleAssignment.findUnique({
        where: { vehicleId },
        select: { staffId: true },
      });
      if (!assignment || assignment.staffId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this vehicle' });
      }
    }

    // CHIEF_DRIVER can only request within their subsidiary scope.
    if (requesterRole === 'CHIEF_DRIVER' && req.user?.subsidiaryId && vehicle.subsidiaryId !== req.user.subsidiaryId) {
      return res.status(403).json({ success: false, message: 'You can only request status changes for vehicles in your subsidiary' });
    }

    // Check no pending request already exists
    const existing = await prisma.vehicleStatusRequest.findFirst({
      where: {
        vehicleId,
        requesterId: req.user.id,
        status: { in: ['PENDING_CHIEF_REVIEW', 'PENDING_EXECUTIVE_REVIEW'] },
      },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You already have a pending status request for this vehicle' });
    }

    const initialRequestStatus = requesterRole === 'CHIEF_DRIVER'
      ? 'PENDING_EXECUTIVE_REVIEW'
      : (requesterRole === 'CEO' || requesterRole === 'SUPER_ADMIN')
        ? 'APPROVED'
        : 'PENDING_CHIEF_REVIEW';

    const request = await prisma.vehicleStatusRequest.create({
      data: {
        vehicleId,
        requesterId: req.user.id,
        initialStatus: vehicle.status,
        targetStatus,
        reason,
        status: initialRequestStatus,
        finalDecisionById: initialRequestStatus === 'APPROVED' ? req.user.id : null,
        finalDecisionReason: initialRequestStatus === 'APPROVED' ? reason : null,
        finalDecisionAt: initialRequestStatus === 'APPROVED' ? new Date() : null,
      },
      select: {
        id: true,
        targetStatus: true,
        reason: true,
        status: true,
        createdAt: true,
        vehicle: { select: { id: true, registrationNumber: true } },
      },
    });

    if (initialRequestStatus === 'APPROVED') {
      await prisma.$transaction(async (tx) => {
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { status: targetStatus },
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'VEHICLE_STATUS_UPDATED_VIA_REQUEST',
            entity: 'VEHICLE',
            entityId: vehicleId,
            newValue: {
              requestId: request.id,
              from: vehicle.status,
              to: targetStatus,
              approvedBy: req.user.id,
            },
          },
        });
      });

      await NotificationService.sendVehicleStatusNotification(req.user.id, {
        title: 'Vehicle Status Updated',
        message: `Vehicle ${vehicle.registrationNumber} status has been updated to ${targetStatus}.`,
        type: 'VEHICLE_STATUS_REQUEST_APPROVED',
        requestId: request.id,
        vehicleId: vehicle.id,
        vehicleReg: vehicle.registrationNumber,
        targetStatus,
        requestedBy: req.user.fullName || req.user.email,
        reviewedBy: req.user.fullName || req.user.email,
        reason,
      });

      return res.status(201).json({ success: true, message: 'Vehicle status updated successfully', data: request });
    }

    if (initialRequestStatus === 'PENDING_EXECUTIVE_REVIEW') {
      const executives = await prisma.user.findMany({
        where: { isActive: true, role: { in: ['CEO', 'SUPER_ADMIN'] } },
        select: { id: true },
      });

      const execIds = executives.map((u) => u.id);
      if (execIds.length > 0) {
        await NotificationService.sendVehicleStatusNotification(execIds, {
          title: 'Vehicle Status Request — Executive Approval Needed',
          message: `${req.user.fullName || 'Chief Driver'} requested to change ${vehicle.registrationNumber} to ${targetStatus}. Final approval required. Reason: ${reason}`,
          type: 'VEHICLE_STATUS_REQUEST_EXEC_REVIEW',
          requestId: request.id,
          vehicleId: vehicle.id,
          vehicleReg: vehicle.registrationNumber,
          targetStatus,
          requestedBy: req.user.fullName || req.user.email,
          reason,
        });
      }

      return res.status(201).json({ success: true, message: 'Status change request submitted for executive approval', data: request });
    }

    // Notify all active CHIEF_DRIVERs in the same subsidiary
    const chiefDrivers = await prisma.user.findMany({
      where: { isActive: true, role: 'CHIEF_DRIVER', subsidiaryId: vehicle.subsidiaryId },
      select: { id: true },
    });

    const chiefIds = chiefDrivers.map((u) => u.id);
    if (chiefIds.length > 0) {
      await NotificationService.sendVehicleStatusNotification(chiefIds, {
        title: 'Vehicle Status Request',
        message: `${req.user.fullName || 'A driver'} has requested to change ${vehicle.registrationNumber} to ${targetStatus}. Reason: ${reason}`,
        type: 'VEHICLE_STATUS_REQUEST_CHIEF_REVIEW',
        requestId: request.id,
        vehicleId: vehicle.id,
        vehicleReg: vehicle.registrationNumber,
        targetStatus,
        requestedBy: req.user.fullName || req.user.email,
        reason,
      });
    }

    return res.status(201).json({ success: true, message: 'Status change request submitted', data: request });
  });

  // ── Chief Driver reviews the request ────────────────────────────────────────
  chiefReviewStatusRequest = asyncHandler(async (req, res) => {
    if (String(req.user?.role || '').toUpperCase() !== 'CHIEF_DRIVER') {
      return res.status(403).json({ success: false, message: 'Only CHIEF_DRIVERs can perform this review' });
    }

    const { requestId } = req.params;
    const decision = normalizeInput(req.body?.decision)?.toUpperCase(); // APPROVE or REJECT
    const chiefReason = normalizeInput(req.body?.reason);

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'decision must be APPROVE or REJECT' });
    }

    const statusRequest = await prisma.vehicleStatusRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        vehicleId: true,
        requesterId: true,
        targetStatus: true,
        reason: true,
        vehicle: { select: { id: true, registrationNumber: true, subsidiaryId: true } },
        requester: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!statusRequest) return res.status(404).json({ success: false, message: 'Request not found' });
    if (statusRequest.status !== 'PENDING_CHIEF_REVIEW') {
      return res.status(409).json({ success: false, message: `Request is not pending chief review (current: ${statusRequest.status})` });
    }

    const isApproved = decision === 'APPROVE';
    const newStatus = isApproved ? 'PENDING_EXECUTIVE_REVIEW' : 'REJECTED';

    const updated = await prisma.vehicleStatusRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        chiefDecisionById: req.user.id,
        chiefDecisionReason: chiefReason,
        chiefDecisionAt: new Date(),
      },
      select: { id: true, status: true, targetStatus: true, vehicleId: true },
    });

    const driverId = statusRequest.requesterId;
    const vehicleReg = statusRequest.vehicle.registrationNumber;
    const reviewerName = req.user.fullName || req.user.email;

    if (isApproved) {
      // Escalate — notify CEO / SUPER_ADMIN
      const executives = await prisma.user.findMany({
        where: { isActive: true, role: { in: ['CEO', 'SUPER_ADMIN'] } },
        select: { id: true },
      });
      const execIds = executives.map((u) => u.id);
      if (execIds.length > 0) {
        await NotificationService.sendVehicleStatusNotification(execIds, {
          title: 'Vehicle Status Request — Executive Approval Needed',
          message: `Chief Driver ${reviewerName} approved a request to change ${vehicleReg} to ${statusRequest.targetStatus}. Final approval required.`,
          type: 'VEHICLE_STATUS_REQUEST_EXEC_REVIEW',
          requestId,
          vehicleId: statusRequest.vehicleId,
          vehicleReg,
          targetStatus: statusRequest.targetStatus,
          requestedBy: statusRequest.requester?.fullName || statusRequest.requester?.email,
          reviewedBy: reviewerName,
          reason: chiefReason,
        });
      }

      // Also notify the driver that it escalated
      await NotificationService.sendVehicleStatusNotification(driverId, {
        title: 'Status Request Escalated',
        message: `Your request to change ${vehicleReg} to ${statusRequest.targetStatus} was approved by the Chief Driver and is now awaiting executive approval.`,
        type: 'VEHICLE_STATUS_REQUEST_ESCALATED',
        requestId,
        vehicleId: statusRequest.vehicleId,
        vehicleReg,
        targetStatus: statusRequest.targetStatus,
        reviewedBy: reviewerName,
      });
    } else {
      // Rejected — notify driver
      await NotificationService.sendVehicleStatusNotification(driverId, {
        title: 'Status Request Rejected',
        message: `Your request to change ${vehicleReg} to ${statusRequest.targetStatus} was rejected by the Chief Driver. ${chiefReason ? 'Reason: ' + chiefReason : ''}`.trim(),
        type: 'VEHICLE_STATUS_REQUEST_REJECTED',
        requestId,
        vehicleId: statusRequest.vehicleId,
        vehicleReg,
        targetStatus: statusRequest.targetStatus,
        reviewedBy: reviewerName,
        reason: chiefReason,
      });
    }

    return res.status(200).json({ success: true, message: `Request ${isApproved ? 'escalated to executives' : 'rejected'}`, data: updated });
  });

  // ── CEO / SUPER_ADMIN gives final decision ──────────────────────────────────
  executiveReviewStatusRequest = asyncHandler(async (req, res) => {
    const EXEC_ROLES = new Set(['CEO', 'SUPER_ADMIN']);
    if (!EXEC_ROLES.has(String(req.user?.role || '').toUpperCase())) {
      return res.status(403).json({ success: false, message: 'Only CEO or SUPER_ADMIN can perform this review' });
    }

    const { requestId } = req.params;
    const decision = normalizeInput(req.body?.decision)?.toUpperCase();
    const execReason = normalizeInput(req.body?.reason);

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'decision must be APPROVE or REJECT' });
    }

    const statusRequest = await prisma.vehicleStatusRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        vehicleId: true,
        requesterId: true,
        chiefDecisionById: true,
        targetStatus: true,
        reason: true,
        vehicle: { select: { id: true, registrationNumber: true, status: true } },
        requester: { select: { id: true, fullName: true, email: true } },
        chiefDecisionBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!statusRequest) return res.status(404).json({ success: false, message: 'Request not found' });
    if (statusRequest.status !== 'PENDING_EXECUTIVE_REVIEW') {
      return res.status(409).json({ success: false, message: `Request is not pending executive review (current: ${statusRequest.status})` });
    }

    const isApproved = decision === 'APPROVE';
    const reviewerName = req.user.fullName || req.user.email;
    const vehicleReg = statusRequest.vehicle.registrationNumber;

    // Transactional: update request + optionally update vehicle
    await prisma.$transaction(async (tx) => {
      await tx.vehicleStatusRequest.update({
        where: { id: requestId },
        data: {
          status: isApproved ? 'APPROVED' : 'REJECTED',
          finalDecisionById: req.user.id,
          finalDecisionReason: execReason,
          finalDecisionAt: new Date(),
        },
      });

      if (isApproved) {
        await tx.vehicle.update({
          where: { id: statusRequest.vehicleId },
          data: { status: statusRequest.targetStatus },
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'VEHICLE_STATUS_UPDATED_VIA_REQUEST',
            entity: 'VEHICLE',
            entityId: statusRequest.vehicleId,
            newValue: {
              requestId,
              from: statusRequest.vehicle.status,
              to: statusRequest.targetStatus,
              approvedBy: req.user.id,
            },
          },
        });
      }
    });

    // Notify driver and chief driver
    const notifyIds = [
      statusRequest.requesterId,
      statusRequest.chiefDecisionById,
    ].filter(Boolean);

    const titleStr = isApproved ? 'Vehicle Status Change Approved' : 'Vehicle Status Change Rejected';
    const msgStr = isApproved
      ? `The request to change ${vehicleReg} to ${statusRequest.targetStatus} has been approved by ${reviewerName}. The vehicle status has been updated.`
      : `The request to change ${vehicleReg} to ${statusRequest.targetStatus} was rejected by ${reviewerName}. ${execReason ? 'Reason: ' + execReason : ''}`.trim();

    await NotificationService.sendVehicleStatusNotification(notifyIds, {
      title: titleStr,
      message: msgStr,
      type: isApproved ? 'VEHICLE_STATUS_REQUEST_APPROVED' : 'VEHICLE_STATUS_REQUEST_REJECTED',
      requestId,
      vehicleId: statusRequest.vehicleId,
      vehicleReg,
      targetStatus: statusRequest.targetStatus,
      reviewedBy: reviewerName,
      reason: execReason,
    });

    return res.status(200).json({ success: true, message: titleStr, data: { requestId, decision: isApproved ? 'APPROVED' : 'REJECTED' } });
  });

  // ── List status requests (scoped by role) ───────────────────────────────────
  getVehicleStatusRequests = asyncHandler(async (req, res) => {
    const role = String(req.user?.role || '').toUpperCase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    let where = {};

    if (role === 'DRIVER') {
      where = { requesterId: req.user.id };
    } else if (role === 'CHIEF_DRIVER') {
      where = {
        OR: [
          { requesterId: req.user.id },
          { status: 'PENDING_CHIEF_REVIEW', vehicle: { subsidiaryId: req.user.subsidiaryId } },
          { chiefDecisionById: req.user.id },
        ],
      };
    } else if (['CEO', 'SUPER_ADMIN', 'ADMIN'].includes(role)) {
      // All requests, optionally filtered
      const statusFilter = normalizeInput(req.query.status)?.toUpperCase();
      if (statusFilter) where = { status: statusFilter };
    } else {
      return res.status(403).json({ success: false, message: 'Not authorised to view status requests' });
    }

    const [total, requests] = await prisma.$transaction([
      prisma.vehicleStatusRequest.count({ where }),
      prisma.vehicleStatusRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          initialStatus: true,
          targetStatus: true,
          reason: true,
          createdAt: true,
          chiefDecisionAt: true,
          chiefDecisionReason: true,
          finalDecisionAt: true,
          finalDecisionReason: true,
          vehicle: { select: { id: true, registrationNumber: true, model: true, status: true, subsidiaryId: true } },
          requester: { select: { id: true, fullName: true, role: true } },
          chiefDecisionBy: { select: { id: true, fullName: true } },
          finalDecisionBy: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    const linkedExpenseMap = new Map();
    const approvedRequests = requests.filter((request) => request.status === 'APPROVED' && request.vehicle?.id);

    await Promise.all(
      approvedRequests.map(async (request) => {
        const requestToken = `Vehicle status request ID: ${request.id}`;
        const vehicleId = request.vehicle.id;

        const directMatch = await prisma.expense.findFirst({
          where: {
            isDeleted: false,
            vehicleId,
            OR: [
              { details: { contains: requestToken, mode: 'insensitive' } },
              { internalNotes: { contains: requestToken, mode: 'insensitive' } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            approvalStatus: true,
            processStatus: true,
            expenseCategory: true,
            createdAt: true,
          },
        });

        if (directMatch) {
          linkedExpenseMap.set(request.id, directMatch);
          return;
        }

        // Fallback: recent non-rejected expense for the same vehicle after request approval.
        const fallback = await prisma.expense.findFirst({
          where: {
            isDeleted: false,
            vehicleId,
            approvalStatus: { not: 'REJECTED' },
            createdAt: { gte: request.finalDecisionAt || request.createdAt },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            approvalStatus: true,
            processStatus: true,
            expenseCategory: true,
            createdAt: true,
          },
        });

        if (fallback) {
          linkedExpenseMap.set(request.id, fallback);
        }
      })
    );

    const requestsWithExpense = requests.map((request) => ({
      ...request,
      expense: linkedExpenseMap.get(request.id) || null,
    }));

    return res.status(200).json({
      success: true,
      data: requestsWithExpense,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  });

  getAnalytics = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const from = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const to = endDate ? new Date(endDate) : new Date();

    const revenueByVehicle = await this.operationRepository.getRevenueBySubsidiary(from, to);

    res.status(200).json({
      success: true,
      data: {
        startDate: from,
        endDate: to,
        revenueByVehicle,
      },
    });
  });
}

export default OperationController;

export const COLLAPSED_EXPENSE_CATEGORIES = [
  'ELECTRICITY',
  'INTERNET',
  'SECURITY_FEE',
  'AUDIT_AND_ACCOUNTANCY',
  'REPAIRS_AND_MAINTENANCE',
  'VEHICLE_REGISTRATION',
  'VEHICLE_PARTICULARS',
  'MEDICALS',
  'VEHICLE_HIRE',
  'AIRPORT_TICKETS_TOLLS',
  'STATIONERIES',
  'TOILETRIES',
  'CAPITAL_EXPENDITURE',
  'INSURANCE',
  'OFFICE_EQUIPMENT',
  'STAFF_SALARY',
  'LICENSE_AND_LEVIES',
  'BANK_CHARGES',
  'TRANSPORT_AND_TRAVELING',
  'ACCOMMODATION_AND_FEEDING',
  'TELEPHONE_AND_POSTAGES',
  'RENT',
  'FUEL',
  'FURNITURE_AND_FITTING',
  'CONSULTANCY',
  'ADVERTISEMENT_AND_SIGNAGE',
];

export const DEFAULT_EXPENSE_TYPE = 'ADMINISTRATIVE';

export const EXPENSE_TYPES = [
  { value: 'OPERATIONAL', label: 'Operational', color: '#2196f3' },
  { value: 'ADMINISTRATIVE', label: 'Administrative', color: '#9c27b0' },
  { value: 'MARKETING', label: 'Marketing', color: '#ff9800' },
  { value: 'CAPITAL', label: 'Capital', color: '#4caf50' },
  { value: 'SECURITY_SERVICES', label: 'Security Services', color: '#f44336' },
  { value: 'CONSTRUCTION', label: 'Construction', color: '#795548' },
  { value: 'OTHER', label: 'Other', color: '#9e9e9e' }
];

export const EXPENSE_CATEGORIES_BY_TYPE = Object.fromEntries(
  EXPENSE_TYPES.map(({ value }) => [
    value,
    COLLAPSED_EXPENSE_CATEGORIES.map((category) => ({
      value: category,
      label: formatExpenseCategoryLabel(category),
      icon: getExpenseCategoryIcon(category),
    })),
  ])
);

export const EXPENSE_CATEGORY_OPTIONS = COLLAPSED_EXPENSE_CATEGORIES.map((category) => ({
  value: category,
  label: formatExpenseCategoryLabel(category),
  icon: getExpenseCategoryIcon(category),
}));

export const VEHICLE_RELATED_EXPENSE_CATEGORIES = new Set([
  'FUEL',
  'INSURANCE',
  'VEHICLE_REGISTRATION',
  'VEHICLE_PARTICULARS',
  'VEHICLE_HIRE',
  'REPAIRS_AND_MAINTENANCE',
  'STATIONERIES',
  'TRANSPORT_AND_TRAVELING',
  'ACCOMMODATION_AND_FEEDING',
  'TELEPHONE_AND_POSTAGES',
  'LICENSE_AND_LEVIES',
]);

function formatExpenseCategoryLabel(value) {
  if (value === 'ADVERTISEMENT_AND_SIGNAGE') return 'Advertisement and Signage';
  if (value === 'AUDIT_AND_ACCOUNTANCY') return 'Audit and Accountancy';
  if (value === 'AIRPORT_TICKETS_TOLLS') return 'Airport Tickets/Tolls';
  return String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getExpenseCategoryIcon(category) {
  switch (category) {
    case 'FUEL':
      return 'LocalGasStation';
    case 'REPAIRS_AND_MAINTENANCE':
      return 'Build';
    case 'INSURANCE':
    case 'SECURITY_FEE':
      return 'Security';
    case 'INTERNET':
      return 'Wifi';
    case 'ELECTRICITY':
      return 'ElectricalServices';
    case 'VEHICLE_REGISTRATION':
    case 'VEHICLE_HIRE':
    case 'VEHICLE_PARTICULARS':
      return 'DirectionsCar';
    case 'MEDICALS':
      return 'MedicalServices';
    case 'AIRPORT_TICKETS_TOLLS':
    case 'TRANSPORT_AND_TRAVELING':
      return 'Flight';
    case 'STATIONERIES':
      return 'EditNote';
    case 'TOILETRIES':
      return 'Sanitizer';
    case 'CAPITAL_EXPENDITURE':
    case 'BANK_CHARGES':
      return 'AccountBalanceWallet';
    case 'OFFICE_EQUIPMENT':
      return 'Inventory2';
    case 'STAFF_SALARY':
      return 'People';
    case 'LICENSE_AND_LEVIES':
      return 'AssignmentTurnedIn';
    case 'ACCOMMODATION_AND_FEEDING':
      return 'Hotel';
    case 'TELEPHONE_AND_POSTAGES':
      return 'Call';
    case 'RENT':
      return 'Home';
    case 'FURNITURE_AND_FITTING':
      return 'Chair';
    case 'CONSULTANCY':
      return 'SupportAgent';
    case 'ADVERTISEMENT_AND_SIGNAGE':
      return 'Campaign';
    default:
      return 'ReceiptLong';
  }
}

export const EXPENSE_CATEGORIES = EXPENSE_CATEGORIES_BY_TYPE;

export const PAYMENT_STATUS = [
  { value: 'PAID', label: 'Paid', color: 'success' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid', color: 'info' },
  { value: 'PENDING', label: 'Pending', color: 'warning' },
  { value: 'UNPAID', label: 'Unpaid', color: 'error' },
  { value: 'OVERDUE', label: 'Overdue', color: 'error' }
];

export const APPROVAL_STATUS = [
  { value: 'APPROVED', label: 'Approved', color: 'success' },
  { value: 'PENDING', label: 'Pending', color: 'warning' },
  { value: 'REJECTED', label: 'Rejected', color: 'error' },
  { value: 'UNDER_REVIEW', label: 'Under Review', color: 'info' }
];
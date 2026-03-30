export const EXPENSE_CATEGORIES = {
  OPERATIONAL: [
    { value: 'FUEL', label: 'Fuel', icon: 'LocalGasStation' },
    { value: 'MAINTENANCE', label: 'Maintenance', icon: 'Build' },
    { value: 'REPAIRS', label: 'Repairs', icon: 'Build' },
    { value: 'TYRES', label: 'Tyres', icon: 'Circle' },
    { value: 'INSURANCE', label: 'Insurance', icon: 'Security' },
    { value: 'ROAD_TOLLS', label: 'Road Tolls', icon: 'Road' },
    { value: 'PARKING', label: 'Parking', icon: 'LocalParking' },
    { value: 'DRIVER_ALLOWANCE', label: 'Driver Allowance', icon: 'Person' }
  ],
  ADMINISTRATIVE: [
    { value: 'SALARIES', label: 'Salaries', icon: 'People' },
    { value: 'RENT', label: 'Rent', icon: 'Home' },
    { value: 'UTILITIES', label: 'Utilities', icon: 'ElectricalServices' },
    { value: 'OFFICE_SUPPLIES', label: 'Office Supplies', icon: 'Inventory' },
    { value: 'INTERNET', label: 'Internet', icon: 'Wifi' },
    { value: 'LEGAL', label: 'Legal Fees', icon: 'Gavel' }
  ],
  CAPITAL: [
    { value: 'VEHICLE_PURCHASE', label: 'Vehicle Purchase', icon: 'DirectionsCar' },
    { value: 'EQUIPMENT', label: 'Equipment', icon: 'PrecisionManufacturing' },
    { value: 'FURNITURE', label: 'Furniture', icon: 'Chair' },
    { value: 'COMPUTER', label: 'Computer', icon: 'Computer' },
    { value: 'SOFTWARE', label: 'Software', icon: 'Code' }
  ],
  SECURITY_SERVICES: [
    { value: 'UNIFORMS', label: 'Uniforms', icon: 'Checkroom' },
    { value: 'CCTV_CAMERAS', label: 'CCTV Cameras', icon: 'Videocam' },
    { value: 'ALARM_SYSTEMS', label: 'Alarm Systems', icon: 'Notifications' },
    { value: 'GUARD_TRAINING', label: 'Guard Training', icon: 'School' }
  ],
  CONSTRUCTION: [
    { value: 'MATERIALS', label: 'Construction Materials', icon: 'Construction' },
    { value: 'EQUIPMENT_RENTAL', label: 'Equipment Rental', icon: 'Handyman' },
    { value: 'SUBCONTRACTORS', label: 'Subcontractors', icon: 'Groups' },
    { value: 'PERMITS', label: 'Permits', icon: 'Assignment' }
  ]
};

export const EXPENSE_TYPES = [
  { value: 'OPERATIONAL', label: 'Operational', color: '#2196f3' },
  { value: 'ADMINISTRATIVE', label: 'Administrative', color: '#9c27b0' },
  { value: 'MARKETING', label: 'Marketing', color: '#ff9800' },
  { value: 'CAPITAL', label: 'Capital', color: '#4caf50' },
  { value: 'SECURITY_SERVICES', label: 'Security Services', color: '#f44336' },
  { value: 'CONSTRUCTION', label: 'Construction', color: '#795548' },
  { value: 'TRAVEL', label: 'Travel', color: '#607d8b' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous', color: '#9e9e9e' }
];

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
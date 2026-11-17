export type OdometerUnit = 'KM' | 'MILE';
export type OwnershipType = 'REGISTERED_CONTRACT' | 'POWER_OF_ATTORNEY';
export type FillType = 'FULL' | 'PARTIAL';
export type OdometerEntryType = 'INITIAL' | 'NORMAL' | 'CORRECTION';
export type ScheduleSource = 'OEM' | 'MANUAL' | 'INSPECTION_ONLY';
export type ConditionStatus = 'GOOD' | 'FOLLOW_UP' | 'NEEDS_REPLACEMENT' | 'NEEDS_REPAIR';
export type FaultStatus = 'UNREPAIRED' | 'DIAGNOSED_NOT_REPAIRED' | 'REPAIRED';
export type TaskPriority = 'URGENT' | 'NORMAL';
export type TaskStatus = 'PENDING' | 'COMPLETED';
export type AlertSeverity = 'RED' | 'YELLOW' | 'GREEN';
export type TirePosition = 'FL' | 'FR' | 'RL' | 'RR' | 'SPARE';
export type DocType = 'VEHICLE_LICENSE' | 'TECHNICAL_INSPECTION' | 'DRIVER_LICENSE';

export type MaintenanceTypeCode =
  | 'ENGINE_OIL'
  | 'OIL_FILTER'
  | 'AIR_FILTER'
  | 'AC_FILTER'
  | 'SPARK_PLUGS'
  | 'BRAKE_PADS'
  | 'TRANSMISSION_OIL'
  | 'BELTS'
  | 'COOLANT'
  | 'AC_FREON'
  | 'BATTERY'
  | 'SUSPENSION'
  | 'CUSTOM';

export type ExpenseSourceType =
  | 'FUEL'
  | 'MAINTENANCE'
  | 'OIL_FILTER'
  | 'FAULT_REPAIR'
  | 'SPARE_PART'
  | 'ADDITIONAL';

export type AdditionalExpenseCategory =
  | 'غسيل'
  | 'معطرات ومنظفات'
  | 'إكسسوارات ورفاهيات'
  | 'ركنة وجراج'
  | 'أخرى';

export type AppSection =
  | 'home'
  | 'vehicles'
  | 'odometer'
  | 'engine_oil'
  | 'maintenance'
  | 'fuel'
  | 'faults'
  | 'expenses'
  | 'parts'
  | 'tires'
  | 'documents'
  | 'reports'
  | 'backup'
  | 'about'
  | 'tests';

// 1. Vehicle
export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  plateRaw: string;
  plateNormalized: string;
  purchaseDate?: string;
  odometerUnit: OdometerUnit;
  currentOdometerKm: number;
  hasOdometerReading?: boolean;
  ownershipType: OwnershipType;
  poaRegisteredContractDone: boolean;
  poaStatusUpdatedAt?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// 2. OdometerEntry (includes correction history)
export interface OdometerEntry {
  id: string;
  vehicleId: string;
  readingKm: number;
  recordedAt: string;
  entryType: OdometerEntryType;
  previousReadingKm?: number;
  reason?: string;
  createdAt: string;
}

// 3. FuelEntry
export interface FuelEntry {
  id: string;
  vehicleId: string;
  dateTime: string;
  odometerKm: number;
  fuelType: string; // '80' | '92' | '95' | 'سولار' | custom
  liters: number;
  totalCostPiastres: number;
  pricePerLiterPiastres: number; // Historical frozen price
  fillType: FillType;
  notes?: string;
  createdAt: string;
}

// 4. MaintenanceType (per vehicleId to strictly isolate vehicle data)
export interface MaintenanceType {
  id: string;
  vehicleId: string;
  code: MaintenanceTypeCode;
  name: string;
  description?: string;
  isCustom: boolean;
  createdAt: string;
}

// 5. MaintenanceRecord
export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  maintenanceTypeId: string;
  typeCode: MaintenanceTypeCode;
  customName?: string;
  date: string;
  odometerKm: number;
  costPiastres: number;
  brandOrType?: string;
  viscosity?: string;
  quantity?: string;
  intervalKm?: number;
  intervalMonths?: number;
  nextDueKm?: number;
  nextDueDate?: string;
  scheduleSource: ScheduleSource;
  sourceLabel?: string; // e.g., OEM manual reference or user manual entry
  oilFilterChanged?: boolean;
  oilFilterCostPiastres?: number;
  beltKind?: string;
  conditionStatus?: ConditionStatus;
  batteryCapacityAh?: number;
  warrantyMonths?: number;
  warrantyExpiryDate?: string;
  suspensionPart?: string;
  mechanicOrCenter?: string;
  notes?: string;
  linkedOilRecordId?: string;
  createdAt: string;
}

// 6. FaultRecord
export interface FaultRecord {
  id: string;
  vehicleId: string;
  title: string;
  appearedAt: string;
  odometerKm: number;
  description: string;
  diagnosis?: string;
  repairPerformed?: string;
  partsCostPiastres: number;
  laborCostPiastres: number;
  totalCostPiastres: number;
  mechanicOrCenter?: string;
  status: FaultStatus;
  repairedAt?: string;
  createdAt: string;
}

// 7. PendingTask
export interface PendingTask {
  id: string;
  vehicleId: string;
  partOrIssue: string;
  description?: string;
  odometerKm: number;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  convertedFaultId?: string;
}

// 8. Expense (with unique source reference to prevent duplicates)
export interface Expense {
  id: string;
  vehicleId: string;
  sourceType: ExpenseSourceType;
  sourceId: string; // unique composite: vehicleId + sourceType + sourceId
  categoryLabel: string;
  date: string;
  amountPiastres: number;
  odometerKm?: number;
  notes?: string;
  isAutomatic: boolean;
  createdAt: string;
}

// 9. SparePart
export interface SparePart {
  id: string;
  vehicleId: string;
  partName: string;
  brand: string;
  purchaseDate: string;
  installDate: string;
  odometerKm: number;
  pricePiastres: number;
  vendorOrCenter?: string;
  notes?: string;
  linkedRecordType: 'MAINTENANCE' | 'FAULT' | 'STANDALONE';
  linkedRecordId?: string;
  includedInParentCost: boolean;
  createdAt: string;
}

// 10. TireRecord
export interface TireRecord {
  id: string;
  vehicleId: string;
  position: TirePosition;
  positionLabel: string;
  dotWeek: number | null;
  dotYear: number | null;
  installDate: string;
  installOdometerKm: number;
  brand: string;
  size: string;
  conditionNotes: string;
  treadStatus: ConditionStatus;
  isConfigured?: boolean;
  updatedAt: string;
}

// 11. DocumentRecord
export interface DocumentRenewalHistoryItem {
  expiryDate: string;
  renewedAt: string;
  notes?: string;
}

export interface DocumentRecord {
  id: string;
  vehicleId: string;
  docType: DocType;
  expiryDate: string;
  previousHistory: DocumentRenewalHistoryItem[];
  updatedAt: string;
}

// 12. Reminder
export interface Reminder {
  id: string;
  vehicleId: string;
  alertKey: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  targetSection: AppSection;
  redNotifiedExternally: boolean;
  lastEvaluatedAt: string;
  resolvedAt?: string;
}

// 13. EmergencyEquipment
export interface EmergencyEquipment {
  id: string;
  vehicleId: string;
  hasJack: boolean | null; // كوريك (null = لم يحدد بعد)
  hasLugWrench: boolean | null; // مفتاح عجل
  hasAirPump: boolean | null; // منفاخ كهربائي
  updatedAt: string;
}

// 14. BackupMetadata
export interface BackupMetadata {
  id: string;
  lastBackupAt?: string;
  fileName?: string;
  checksum?: string;
  vehicleCount?: number;
  recordCount?: number;
  lastRestoredChecksum?: string;
  lastRestoredAt?: string;
}

// Custom user additions to Egyptian Car Catalog
export interface CustomCatalogEntry {
  id: string;
  brand: string;
  model: string;
  year: number;
  createdAt: string;
}

export type ThemePreference = 'light' | 'dark' | 'system';

// Global App Settings (the only non-vehicle-scoped data)
export interface AppSettings {
  id: 'app_settings';
  activeVehicleId?: string;
  currencyCode: string; // Default 'EGP'
  currencySymbol: string; // Default 'ج.م'
  customFuelTypes: string[];
  notificationsEnabledByUser: boolean;
  theme?: ThemePreference;
  schemaVersion: number;
  updatedAt: string;
}

export interface EvaluatedAlert {
  alertKey: string;
  vehicleId: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  targetSection: AppSection;
  isResolved: boolean;
}

export interface FullBackupPayload {
  appName: 'عربيتي | MY CAR';
  schemaVersion: number;
  exportedAt: string;
  checksum: string;
  data: {
    appSettings: AppSettings;
    customCatalog: CustomCatalogEntry[];
    vehicles: Vehicle[];
    odometerEntries: OdometerEntry[];
    fuelEntries: FuelEntry[];
    maintenanceTypes: MaintenanceType[];
    maintenanceRecords: MaintenanceRecord[];
    faultRecords: FaultRecord[];
    pendingTasks: PendingTask[];
    expenses: Expense[];
    spareParts: SparePart[];
    tireRecords: TireRecord[];
    documentRecords: DocumentRecord[];
    reminders: Reminder[];
    emergencyEquipment: EmergencyEquipment[];
  };
}

import { evaluateVehicleAlerts, reconcileReminders } from '../domain/alertEngine';
import {
  createBackupPayload,
  inspectAndValidateBackup,
  type BackupPreviewSummary,
} from '../domain/backupEngine';
import { validateEgyptianPlate } from '../domain/plateValidator';
import type {
  AppSettings,
  BackupMetadata,
  CustomCatalogEntry,
  DocumentRecord,
  EmergencyEquipment,
  Expense,
  ExpenseSourceType,
  FaultRecord,
  FuelEntry,
  FullBackupPayload,
  MaintenanceRecord,
  MaintenanceType,
  MaintenanceTypeCode,
  OdometerEntry,
  OdometerUnit,
  OwnershipType,
  PendingTask,
  Reminder,
  SparePart,
  TirePosition,
  TireRecord,
  Vehicle,
} from '../domain/types';
import { generateId, nowIsoDateTime, todayIsoDate } from '../domain/units';

export interface VehicleBundle {
  vehicle: Vehicle;
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
  emergencyEquipment: EmergencyEquipment | null;
}

export interface StorageDriver {
  getAll<T>(storeName: string): Promise<T[]>;
  getById<T>(storeName: string, id: string): Promise<T | undefined>;
  put<T>(storeName: string, value: T): Promise<void>;
  putMany<T>(storeName: string, values: T[]): Promise<void>;
  deleteById(storeName: string, id: string): Promise<void>;
  clearStore(storeName: string): Promise<void>;
}

const STORE_NAMES = [
  'appSettings',
  'backupMetadata',
  'customCatalog',
  'vehicles',
  'odometerEntries',
  'fuelEntries',
  'maintenanceTypes',
  'maintenanceRecords',
  'faultRecords',
  'pendingTasks',
  'expenses',
  'spareParts',
  'tireRecords',
  'documentRecords',
  'reminders',
  'emergencyEquipment',
] as const;

const DB_NAME = 'my_car_arabety_db';
const DB_VERSION = 1;

export class IndexedDbStorageDriver implements StorageDriver {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORE_NAMES) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            if (
              name !== 'appSettings' &&
              name !== 'backupMetadata' &&
              name !== 'customCatalog' &&
              name !== 'vehicles'
            ) {
              store.createIndex('vehicleId', 'vehicleId', { unique: false });
            }
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  async getById<T>(storeName: string, id: string): Promise<T | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async putMany<T>(storeName: string, values: T[]): Promise<void> {
    if (values.length === 0) return;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const v of values) store.put(v);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteById(storeName: string, id: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearStore(storeName: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export class MemoryStorageDriver implements StorageDriver {
  private stores = new Map<string, Map<string, unknown>>();

  private getMap(name: string): Map<string, unknown> {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    return this.stores.get(name)!;
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    return Array.from(this.getMap(storeName).values()).map((item) => structuredClone(item) as T);
  }

  async getById<T>(storeName: string, id: string): Promise<T | undefined> {
    const item = this.getMap(storeName).get(id);
    return item ? (structuredClone(item) as T) : undefined;
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    const rec = value as { id: string };
    this.getMap(storeName).set(rec.id, structuredClone(value));
  }

  async putMany<T>(storeName: string, values: T[]): Promise<void> {
    for (const v of values) await this.put(storeName, v);
  }

  async deleteById(storeName: string, id: string): Promise<void> {
    this.getMap(storeName).delete(id);
  }

  async clearStore(storeName: string): Promise<void> {
    this.getMap(storeName).clear();
  }
}

const DEFAULT_MAINTENANCE_DEFINITIONS: Array<{
  code: MaintenanceTypeCode;
  name: string;
  description: string;
}> = [
  { code: 'ENGINE_OIL', name: 'زيت المحرك', description: 'تغيير زيت المحرك ومتابعة المسافة والزمن' },
  { code: 'OIL_FILTER', name: 'فلتر الزيت', description: 'يُحدث فقط عند تأكيد تغييره مع الزيت أو بشكل مستقل' },
  { code: 'AIR_FILTER', name: 'فلتر الهواء', description: 'تغيير فلتر هواء المحرك فقط' },
  { code: 'AC_FILTER', name: 'فلتر التكييف', description: 'تغيير فلتر هواء المقصورة/التكييف فقط' },
  { code: 'BRAKE_PADS', name: 'تيل الفرامل', description: 'متابعة حسب الفحص والحالة دون موعد ثابت' },
  { code: 'SPARK_PLUGS', name: 'البوجيهات', description: 'شمعات الإشعال وسجل تغييراتها' },
  { code: 'BATTERY', name: 'البطارية', description: 'التركيب والسعة Ah والعمر والضمان' },
  { code: 'BELTS', name: 'السيور', description: 'سير الكاتينة / مجموعة السيور / الدينامو وغيرها' },
  { code: 'SUSPENSION', name: 'العفشة والمساعدين', description: 'الفحص والإصلاح والحالة دون موعد ثابت' },
  { code: 'TRANSMISSION_OIL', name: 'زيت الفتيس', description: 'تغيير زيت ناقل الحركة وفق توصية الشركة أو إدخال يدوي' },
  { code: 'COOLANT', name: 'سائل التبريد', description: 'دورة التبريد ومواصفات السائل' },
  { code: 'AC_FREON', name: 'فريون التكييف', description: 'تسجيل الشحن عند الحدوث مع تنبيه التكرار خلال 30 يومًا' },
];

const DEFAULT_TIRE_POSITIONS: Array<{ position: TirePosition; label: string }> = [
  { position: 'FL', label: 'أمامي يسار' },
  { position: 'FR', label: 'أمامي يمين' },
  { position: 'RL', label: 'خلفي يسار' },
  { position: 'RR', label: 'خلفي يمين' },
  { position: 'SPARE', label: 'الإطار الاحتياطي (الاستبن)' },
];

export interface CreateVehicleInput {
  brand: string;
  model: string;
  year: number;
  plateRaw: string;
  purchaseDate?: string;
  vehicleLicenseExpiry: string;
  technicalInspectionDate: string;
  driverLicenseExpiry: string;
  odometerUnit: OdometerUnit;
  initialOdometerKm?: number;
  ownershipType: OwnershipType;
  poaRegisteredContractDone: boolean;
  saveToCustomCatalog?: boolean;
  emergencyEquipment?: {
    hasJack: boolean | null;
    hasLugWrench: boolean | null;
    hasAirPump: boolean | null;
  };
  tiresInput?: {
    configured: boolean;
    brand: string;
    size: string;
    dotWeek: number | null;
    dotYear: number | null;
    installDate?: string;
  };
}

export class MyCarRepository {
  constructor(private driver: StorageDriver) {}

  async getSettings(): Promise<AppSettings> {
    const existing = await this.driver.getById<AppSettings>('appSettings', 'app_settings');
    if (existing) return existing;
    const initial: AppSettings = {
      id: 'app_settings',
      currencyCode: 'EGP',
      currencySymbol: 'ج.م',
      customFuelTypes: [],
      notificationsEnabledByUser: true,
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
    };
    await this.driver.put('appSettings', initial);
    return initial;
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = {
      ...current,
      ...patch,
      id: 'app_settings',
      updatedAt: new Date().toISOString(),
    };
    await this.driver.put('appSettings', updated);
    return updated;
  }

  async getBackupMetadata(): Promise<BackupMetadata> {
    const existing = await this.driver.getById<BackupMetadata>('backupMetadata', 'backup_meta');
    if (existing) return existing;
    const empty: BackupMetadata = { id: 'backup_meta' };
    await this.driver.put('backupMetadata', empty);
    return empty;
  }

  async getCustomCatalog(): Promise<CustomCatalogEntry[]> {
    return this.driver.getAll<CustomCatalogEntry>('customCatalog');
  }

  async addCustomCatalogEntry(brand: string, model: string, year: number): Promise<CustomCatalogEntry> {
    const existing = await this.getCustomCatalog();
    const match = existing.find(
      (c) =>
        c.brand.trim().toLowerCase() === brand.trim().toLowerCase() &&
        c.model.trim().toLowerCase() === model.trim().toLowerCase() &&
        c.year === year
    );
    if (match) return match;
    const entry: CustomCatalogEntry = {
      id: generateId('cat'),
      brand: brand.trim(),
      model: model.trim(),
      year,
      createdAt: new Date().toISOString(),
    };
    await this.driver.put('customCatalog', entry);
    return entry;
  }

  async getVehicles(includeArchived = true): Promise<Vehicle[]> {
    const all = await this.driver.getAll<Vehicle>('vehicles');
    const filtered = includeArchived ? all : all.filter((v) => !v.isArchived);
    return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
    const plate = validateEgyptianPlate(input.plateRaw);
    if (!plate.valid) {
      throw new Error(plate.error || 'رقم اللوحة غير صالح.');
    }
    if (!input.brand.trim() || !input.model.trim()) {
      throw new Error('يرجى تحديد الماركة والموديل.');
    }

    const hasOdo =
      typeof input.initialOdometerKm === 'number' && Number.isFinite(input.initialOdometerKm);
    if (hasOdo && input.initialOdometerKm! < 0) {
      throw new Error('قراءة العداد الأولية غير صالحة.');
    }
    const startingOdoKm = hasOdo ? input.initialOdometerKm! : 0;

    const now = new Date().toISOString();
    const vehicleId = generateId('veh');

    const vehicle: Vehicle = {
      id: vehicleId,
      brand: input.brand.trim(),
      model: input.model.trim(),
      year: input.year,
      plateRaw: input.plateRaw.trim(),
      plateNormalized: plate.normalized,
      purchaseDate: input.purchaseDate?.trim() || undefined,
      odometerUnit: input.odometerUnit,
      currentOdometerKm: startingOdoKm,
      hasOdometerReading: hasOdo,
      ownershipType: input.ownershipType,
      poaRegisteredContractDone:
        input.ownershipType === 'REGISTERED_CONTRACT' ? true : input.poaRegisteredContractDone,
      poaStatusUpdatedAt: now,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    const maintTypes: MaintenanceType[] = DEFAULT_MAINTENANCE_DEFINITIONS.map((def) => ({
      id: `mt_${vehicleId}_${def.code}`,
      vehicleId,
      code: def.code,
      name: def.name,
      description: def.description,
      isCustom: false,
      createdAt: now,
    }));

    const docs: DocumentRecord[] = [
      {
        id: `doc_${vehicleId}_VEHICLE_LICENSE`,
        vehicleId,
        docType: 'VEHICLE_LICENSE',
        expiryDate: input.vehicleLicenseExpiry,
        previousHistory: [],
        updatedAt: now,
      },
      {
        id: `doc_${vehicleId}_TECHNICAL_INSPECTION`,
        vehicleId,
        docType: 'TECHNICAL_INSPECTION',
        expiryDate: input.technicalInspectionDate,
        previousHistory: [],
        updatedAt: now,
      },
      {
        id: `doc_${vehicleId}_DRIVER_LICENSE`,
        vehicleId,
        docType: 'DRIVER_LICENSE',
        expiryDate: input.driverLicenseExpiry,
        previousHistory: [],
        updatedAt: now,
      },
    ];

    const tireCfg = input.tiresInput;
    const tiresConfigured = Boolean(
      tireCfg?.configured &&
        tireCfg.brand.trim() &&
        tireCfg.dotWeek != null &&
        tireCfg.dotYear != null
    );
    const tires: TireRecord[] = DEFAULT_TIRE_POSITIONS.map((pos) => ({
      id: `tire_${vehicleId}_${pos.position}`,
      vehicleId,
      position: pos.position,
      positionLabel: pos.label,
      dotWeek: tiresConfigured ? tireCfg!.dotWeek : null,
      dotYear: tiresConfigured ? tireCfg!.dotYear : null,
      installDate: tiresConfigured ? tireCfg!.installDate || todayIsoDate() : '',
      installOdometerKm: startingOdoKm,
      brand: tiresConfigured ? tireCfg!.brand.trim() : '',
      size: tiresConfigured ? tireCfg!.size.trim() : '',
      conditionNotes: '',
      treadStatus: 'GOOD',
      isConfigured: tiresConfigured,
      updatedAt: now,
    }));

    const emergency: EmergencyEquipment = {
      id: `emerg_${vehicleId}`,
      vehicleId,
      hasJack: input.emergencyEquipment ? input.emergencyEquipment.hasJack : null,
      hasLugWrench: input.emergencyEquipment ? input.emergencyEquipment.hasLugWrench : null,
      hasAirPump: input.emergencyEquipment ? input.emergencyEquipment.hasAirPump : null,
      updatedAt: now,
    };

    await this.driver.put('vehicles', vehicle);
    if (hasOdo) {
      const initialOdometer: OdometerEntry = {
        id: generateId('odo'),
        vehicleId,
        readingKm: startingOdoKm,
        recordedAt: nowIsoDateTime(),
        entryType: 'INITIAL',
        reason: 'قراءة العداد عند إضافة السيارة',
        createdAt: now,
      };
      await this.driver.put('odometerEntries', initialOdometer);
    }
    await this.driver.putMany('maintenanceTypes', maintTypes);
    await this.driver.putMany('documentRecords', docs);
    await this.driver.putMany('tireRecords', tires);
    await this.driver.put('emergencyEquipment', emergency);

    if (input.saveToCustomCatalog) {
      await this.addCustomCatalogEntry(input.brand, input.model, input.year);
    }

    const settings = await this.getSettings();
    if (!settings.activeVehicleId) {
      await this.updateSettings({ activeVehicleId: vehicleId });
    }

    await this.recomputeVehicleReminders(vehicleId);
    return vehicle;
  }

  async updateVehicle(vehicle: Vehicle): Promise<Vehicle> {
    const plate = validateEgyptianPlate(vehicle.plateRaw);
    if (!plate.valid) throw new Error(plate.error || 'رقم اللوحة غير صالح.');
    const updated: Vehicle = {
      ...vehicle,
      plateNormalized: plate.normalized,
      updatedAt: new Date().toISOString(),
    };
    await this.driver.put('vehicles', updated);
    await this.recomputeVehicleReminders(updated.id);
    return updated;
  }

  async archiveVehicle(vehicleId: string, archived: boolean): Promise<void> {
    const v = await this.driver.getById<Vehicle>('vehicles', vehicleId);
    if (!v) return;
    await this.driver.put('vehicles', { ...v, isArchived: archived, updatedAt: new Date().toISOString() });
    if (archived) {
      const settings = await this.getSettings();
      if (settings.activeVehicleId === vehicleId) {
        const remaining = (await this.getVehicles(false)).filter((x) => x.id !== vehicleId);
        await this.updateSettings({ activeVehicleId: remaining[0]?.id });
      }
    }
  }

  async deleteVehiclePermanently(vehicleId: string): Promise<void> {
    const stores = [
      'odometerEntries',
      'fuelEntries',
      'maintenanceTypes',
      'maintenanceRecords',
      'faultRecords',
      'pendingTasks',
      'expenses',
      'spareParts',
      'tireRecords',
      'documentRecords',
      'reminders',
      'emergencyEquipment',
    ];
    for (const store of stores) {
      const all = await this.driver.getAll<{ id: string; vehicleId: string }>(store);
      for (const item of all) {
        if (item.vehicleId === vehicleId) {
          await this.driver.deleteById(store, item.id);
        }
      }
    }
    await this.driver.deleteById('vehicles', vehicleId);
    const settings = await this.getSettings();
    if (settings.activeVehicleId === vehicleId) {
      const remaining = await this.getVehicles(false);
      await this.updateSettings({ activeVehicleId: remaining[0]?.id });
    }
  }

  async getVehicleBundle(vehicleId: string): Promise<VehicleBundle | null> {
    const vehicle = await this.driver.getById<Vehicle>('vehicles', vehicleId);
    if (!vehicle) return null;

    const filterByVehicle = async <T extends { vehicleId: string }>(store: string): Promise<T[]> => {
      const all = await this.driver.getAll<T>(store);
      return all.filter((item) => item.vehicleId === vehicleId);
    };

    const [
      odometerEntries,
      fuelEntries,
      maintenanceTypes,
      maintenanceRecords,
      faultRecords,
      pendingTasks,
      expenses,
      spareParts,
      tireRecords,
      documentRecords,
      reminders,
      emergencyList,
    ] = await Promise.all([
      filterByVehicle<OdometerEntry>('odometerEntries'),
      filterByVehicle<FuelEntry>('fuelEntries'),
      filterByVehicle<MaintenanceType>('maintenanceTypes'),
      filterByVehicle<MaintenanceRecord>('maintenanceRecords'),
      filterByVehicle<FaultRecord>('faultRecords'),
      filterByVehicle<PendingTask>('pendingTasks'),
      filterByVehicle<Expense>('expenses'),
      filterByVehicle<SparePart>('spareParts'),
      filterByVehicle<TireRecord>('tireRecords'),
      filterByVehicle<DocumentRecord>('documentRecords'),
      filterByVehicle<Reminder>('reminders'),
      filterByVehicle<EmergencyEquipment>('emergencyEquipment'),
    ]);

    return {
      vehicle,
      odometerEntries: odometerEntries.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
      fuelEntries: fuelEntries.sort((a, b) => {
        if (b.odometerKm !== a.odometerKm) return b.odometerKm - a.odometerKm;
        return b.dateTime.localeCompare(a.dateTime);
      }),
      maintenanceTypes,
      maintenanceRecords: maintenanceRecords.sort((a, b) => b.date.localeCompare(a.date)),
      faultRecords: faultRecords.sort((a, b) => b.appearedAt.localeCompare(a.appearedAt)),
      pendingTasks: pendingTasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      expenses: expenses.sort((a, b) => b.date.localeCompare(a.date)),
      spareParts: spareParts.sort((a, b) => b.installDate.localeCompare(a.installDate)),
      tireRecords,
      documentRecords,
      reminders,
      emergencyEquipment: emergencyList[0] ?? null,
    };
  }

  /**
   * Normal odometer update: rejects readings lower than currentOdometerKm.
   */
  async updateOdometerNormal(vehicleId: string, newReadingKm: number, recordedAt = nowIsoDateTime()): Promise<OdometerEntry> {
    const vehicle = await this.driver.getById<Vehicle>('vehicles', vehicleId);
    if (!vehicle) throw new Error('السيارة غير موجودة.');
    if (!Number.isFinite(newReadingKm) || newReadingKm < 0) {
      throw new Error('قراءة العداد غير صالحة.');
    }
    const isFirstReading = vehicle.hasOdometerReading === false;
    if (!isFirstReading && newReadingKm < vehicle.currentOdometerKm) {
      throw new Error(
        'مرفوض: القراءة الجديدة أقل من آخر قراءة معتمدة للعداد. لتعديل قراءة خاطئة استخدم «تصحيح العداد» مع التأكيد.'
      );
    }

    const now = new Date().toISOString();
    const entry: OdometerEntry = {
      id: generateId('odo'),
      vehicleId,
      readingKm: newReadingKm,
      recordedAt,
      entryType: isFirstReading ? 'INITIAL' : 'NORMAL',
      previousReadingKm: isFirstReading ? undefined : vehicle.currentOdometerKm,
      reason: isFirstReading ? 'أول قراءة مسجلة للعداد' : undefined,
      createdAt: now,
    };

    await this.driver.put('odometerEntries', entry);
    await this.driver.put('vehicles', {
      ...vehicle,
      currentOdometerKm: newReadingKm,
      hasOdometerReading: true,
      updatedAt: now,
    });
    await this.recomputeVehicleReminders(vehicleId);
    return entry;
  }

  /**
   * Confirmed Odometer Correction (Spec Section 9 & 7.3):
   * - Preserves full audit trail (previousReadingKm, readingKm, reason, timestamp)
   * - Allows correcting current odometer OR correcting a target fuel entry odometer
   * - NEVER modifies or deletes original Expense amounts
   * - Recomputes vehicle reminders & maintenance status
   */
  async correctOdometer(params: {
    vehicleId: string;
    correctedReadingKm: number;
    reason: string;
    targetFuelEntryId?: string;
    recordedAt?: string;
  }): Promise<OdometerEntry> {
    const { vehicleId, correctedReadingKm, reason, targetFuelEntryId, recordedAt = nowIsoDateTime() } = params;
    const vehicle = await this.driver.getById<Vehicle>('vehicles', vehicleId);
    if (!vehicle) throw new Error('السيارة غير موجودة.');
    if (!Number.isFinite(correctedReadingKm) || correctedReadingKm < 0) {
      throw new Error('قيمة التصحيح غير صالحة.');
    }

    const now = new Date().toISOString();
    let previousReadingKm = vehicle.currentOdometerKm;

    if (targetFuelEntryId) {
      const fuel = await this.driver.getById<FuelEntry>('fuelEntries', targetFuelEntryId);
      if (!fuel || fuel.vehicleId !== vehicleId) {
        throw new Error('سجل الوقود المستهدف غير موجود لهذه السيارة.');
      }
      previousReadingKm = fuel.odometerKm;
      await this.driver.put('fuelEntries', { ...fuel, odometerKm: correctedReadingKm });
    }

    const correctionEntry: OdometerEntry = {
      id: generateId('odo_corr'),
      vehicleId,
      readingKm: correctedReadingKm,
      previousReadingKm,
      recordedAt,
      entryType: 'CORRECTION',
      reason: reason.trim() || 'تصحيح قراءة العداد',
      createdAt: now,
    };

    await this.driver.put('odometerEntries', correctionEntry);

    // If not targeting a past fuel entry, or if corrected reading is the latest reading, update vehicle odometer
    if (!targetFuelEntryId) {
      await this.driver.put('vehicles', {
        ...vehicle,
        currentOdometerKm: correctedReadingKm,
        updatedAt: now,
      });
    } else {
      // Re-evaluate max odometer across fuel + odometer entries if needed
      const allFuel = (await this.driver.getAll<FuelEntry>('fuelEntries')).filter(
        (f) => f.vehicleId === vehicleId
      );
      const maxFuelKm = allFuel.reduce((mx, f) => Math.max(mx, f.odometerKm), 0);
      if (maxFuelKm > vehicle.currentOdometerKm) {
        await this.driver.put('vehicles', {
          ...vehicle,
          currentOdometerKm: maxFuelKm,
          updatedAt: now,
        });
      }
    }

    // Notice: Original Expense records are NEVER touched or deleted!
    await this.recomputeVehicleReminders(vehicleId);
    return correctionEntry;
  }

  /**
   * Idempotent Expense Upsert (Spec Section 7.2 & 25):
   * Uses deterministic composite id `${vehicleId}_${sourceType}_${sourceId}` so an expense
   * can NEVER be duplicated for the same source operation.
   */
  private async upsertAutomaticExpense(params: {
    vehicleId: string;
    sourceType: ExpenseSourceType;
    sourceId: string;
    categoryLabel: string;
    date: string;
    amountPiastres: number;
    odometerKm?: number;
    notes?: string;
  }): Promise<void> {
    const compositeId = `exp_${params.vehicleId}_${params.sourceType}_${params.sourceId}`;
    const existing = await this.driver.getById<Expense>('expenses', compositeId);

    if (params.amountPiastres <= 0) {
      if (existing) await this.driver.deleteById('expenses', compositeId);
      return;
    }

    const expense: Expense = {
      id: compositeId,
      vehicleId: params.vehicleId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      categoryLabel: params.categoryLabel,
      date: params.date.slice(0, 10),
      amountPiastres: params.amountPiastres,
      odometerKm: params.odometerKm,
      notes: params.notes,
      isAutomatic: true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    await this.driver.put('expenses', expense);
  }

  async saveFuelEntry(input: Omit<FuelEntry, 'id' | 'pricePerLiterPiastres' | 'createdAt'> & { id?: string }): Promise<FuelEntry> {
    const vehicle = await this.driver.getById<Vehicle>('vehicles', input.vehicleId);
    if (!vehicle) throw new Error('السيارة غير موجودة.');
    if (input.liters <= 0) throw new Error('كمية اللترات يجب أن تكون أكبر من صفر.');
    if (input.totalCostPiastres < 0) throw new Error('المبلغ غير صالح.');

    const now = new Date().toISOString();
    const id = input.id ?? generateId('fuel');
    const existing = input.id ? await this.driver.getById<FuelEntry>('fuelEntries', input.id) : undefined;

    // Historical price per liter frozen at entry time
    const pricePerLiterPiastres = Math.round(input.totalCostPiastres / input.liters);

    const entry: FuelEntry = {
      id,
      vehicleId: input.vehicleId,
      dateTime: input.dateTime,
      odometerKm: input.odometerKm,
      fuelType: input.fuelType.trim(),
      liters: input.liters,
      totalCostPiastres: input.totalCostPiastres,
      pricePerLiterPiastres,
      fillType: input.fillType,
      notes: input.notes?.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
    };

    await this.driver.put('fuelEntries', entry);

    // Save custom fuel type if new
    const defaultTypes = ['80', '92', '95', 'سولار'];
    if (!defaultTypes.includes(entry.fuelType)) {
      const settings = await this.getSettings();
      if (!settings.customFuelTypes.includes(entry.fuelType)) {
        await this.updateSettings({
          customFuelTypes: [...settings.customFuelTypes, entry.fuelType],
        });
      }
    }

    // Atomic idempotent expense
    await this.upsertAutomaticExpense({
      vehicleId: input.vehicleId,
      sourceType: 'FUEL',
      sourceId: id,
      categoryLabel: `وقود (${entry.fuelType} - ${entry.fillType === 'FULL' ? 'تفويلة كاملة' : 'تعبئة جزئية'})`,
      date: entry.dateTime,
      amountPiastres: entry.totalCostPiastres,
      odometerKm: entry.odometerKm,
      notes: `${entry.liters} لتر`,
    });

    // Advance vehicle odometer if higher (or first reading)
    if (entry.odometerKm > vehicle.currentOdometerKm || vehicle.hasOdometerReading === false) {
      const isFirst = vehicle.hasOdometerReading === false;
      await this.driver.put('odometerEntries', {
        id: generateId('odo'),
        vehicleId: vehicle.id,
        readingKm: entry.odometerKm,
        recordedAt: entry.dateTime,
        entryType: isFirst ? 'INITIAL' : 'NORMAL',
        previousReadingKm: isFirst ? undefined : vehicle.currentOdometerKm,
        reason: 'قراءة مسجلة مع تعبئة الوقود',
        createdAt: now,
      } satisfies OdometerEntry);
      await this.driver.put('vehicles', {
        ...vehicle,
        currentOdometerKm: entry.odometerKm,
        hasOdometerReading: true,
        updatedAt: now,
      });
    }

    await this.recomputeVehicleReminders(vehicle.id);
    return entry;
  }

  async addCustomMaintenanceType(vehicleId: string, name: string, description?: string): Promise<MaintenanceType> {
    if (!name.trim()) throw new Error('يرجى إدخال اسم بند الصيانة المخصص.');
    const item: MaintenanceType = {
      id: generateId('mt_custom'),
      vehicleId,
      code: 'CUSTOM',
      name: name.trim(),
      description: description?.trim() || undefined,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };
    await this.driver.put('maintenanceTypes', item);
    return item;
  }

  async saveMaintenanceRecord(
    input: Omit<MaintenanceRecord, 'id' | 'createdAt'> & {
      id?: string;
      oilFilterIntervalKm?: number;
      oilFilterBrand?: string;
    }
  ): Promise<MaintenanceRecord> {
    const vehicle = await this.driver.getById<Vehicle>('vehicles', input.vehicleId);
    if (!vehicle) throw new Error('السيارة غير موجودة.');

    const now = new Date().toISOString();
    const id = input.id ?? generateId('maint');
    const existing = input.id
      ? await this.driver.getById<MaintenanceRecord>('maintenanceRecords', input.id)
      : undefined;

    const record: MaintenanceRecord = {
      ...input,
      id,
      createdAt: existing?.createdAt ?? now,
    };

    await this.driver.put('maintenanceRecords', record);

    const maintType = await this.driver.getById<MaintenanceType>('maintenanceTypes', record.maintenanceTypeId);
    const label = record.customName || maintType?.name || 'صيانة';

    // Atomic idempotent expense for the maintenance record itself
    await this.upsertAutomaticExpense({
      vehicleId: input.vehicleId,
      sourceType: 'MAINTENANCE',
      sourceId: id,
      categoryLabel: `صيانة: ${label}`,
      date: record.date,
      amountPiastres: record.costPiastres,
      odometerKm: record.odometerKm,
      notes: record.mechanicOrCenter ? `المركز/الميكانيكي: ${record.mechanicOrCenter}` : record.notes,
    });

    // Section 11: Engine oil + optional oil filter in same transaction, NO duplicate filter record
    if (record.typeCode === 'ENGINE_OIL') {
      const oilFilterTypeId = `mt_${input.vehicleId}_OIL_FILTER`;
      const allRecords = await this.driver.getAll<MaintenanceRecord>('maintenanceRecords');
      const existingLinkedFilter = allRecords.find(
        (r) => r.vehicleId === input.vehicleId && r.linkedOilRecordId === id
      );

      if (record.oilFilterChanged) {
        const filterCost = record.oilFilterCostPiastres ?? 0;
        const filterIntervalKm = input.oilFilterIntervalKm ?? record.intervalKm;
        const filterNextDueKm =
          typeof filterIntervalKm === 'number' && filterIntervalKm > 0
            ? record.odometerKm + filterIntervalKm
            : undefined;

        const filterRecord: MaintenanceRecord = {
          id: existingLinkedFilter?.id ?? generateId('maint_filter'),
          vehicleId: input.vehicleId,
          maintenanceTypeId: oilFilterTypeId,
          typeCode: 'OIL_FILTER',
          date: record.date,
          odometerKm: record.odometerKm,
          costPiastres: filterCost,
          brandOrType: undefined,
          intervalKm: filterIntervalKm,
          nextDueKm: filterNextDueKm,
          nextDueDate: record.nextDueDate,
          scheduleSource: record.scheduleSource,
          sourceLabel: record.sourceLabel,
          mechanicOrCenter: record.mechanicOrCenter,
          notes: 'تم التغيير مع زيت المحرك',
          linkedOilRecordId: id,
          createdAt: existingLinkedFilter?.createdAt ?? now,
        };
        await this.driver.put('maintenanceRecords', filterRecord);
        await this.upsertAutomaticExpense({
          vehicleId: input.vehicleId,
          sourceType: 'OIL_FILTER',
          sourceId: id,
          categoryLabel: 'صيانة: فلتر الزيت (مع تغيير الزيت)',
          date: record.date,
          amountPiastres: filterCost,
          odometerKm: record.odometerKm,
        });
      } else {
        // Do NOT update oil filter due date if not changed; remove linked filter only if user unchecked on edit
        if (existingLinkedFilter) {
          await this.driver.deleteById('maintenanceRecords', existingLinkedFilter.id);
          await this.upsertAutomaticExpense({
            vehicleId: input.vehicleId,
            sourceType: 'OIL_FILTER',
            sourceId: id,
            categoryLabel: 'فلتر الزيت',
            date: record.date,
            amountPiastres: 0,
          });
        }
      }
    }

    if (record.odometerKm > vehicle.currentOdometerKm || vehicle.hasOdometerReading === false) {
      await this.driver.put('vehicles', {
        ...vehicle,
        currentOdometerKm: record.odometerKm,
        hasOdometerReading: true,
        updatedAt: now,
      });
    }

    await this.recomputeVehicleReminders(input.vehicleId);
    return record;
  }

  async saveFaultRecord(input: Omit<FaultRecord, 'id' | 'createdAt'> & { id?: string }): Promise<FaultRecord> {
    const vehicle = await this.driver.getById<Vehicle>('vehicles', input.vehicleId);
    if (!vehicle) throw new Error('السيارة غير موجودة.');
    const now = new Date().toISOString();
    const id = input.id ?? generateId('fault');
    const existing = input.id ? await this.driver.getById<FaultRecord>('faultRecords', input.id) : undefined;

    const totalCostPiastres =
      input.totalCostPiastres > 0
        ? input.totalCostPiastres
        : input.partsCostPiastres + input.laborCostPiastres;

    const record: FaultRecord = {
      ...input,
      id,
      totalCostPiastres,
      createdAt: existing?.createdAt ?? now,
    };

    await this.driver.put('faultRecords', record);

    await this.upsertAutomaticExpense({
      vehicleId: input.vehicleId,
      sourceType: 'FAULT_REPAIR',
      sourceId: id,
      categoryLabel: `إصلاح عطل: ${record.title}`,
      date: record.repairedAt || record.appearedAt,
      amountPiastres: record.status === 'REPAIRED' ? record.totalCostPiastres : 0,
      odometerKm: record.odometerKm,
      notes: record.mechanicOrCenter,
    });

    await this.recomputeVehicleReminders(input.vehicleId);
    return record;
  }

  async addPendingTask(input: Omit<PendingTask, 'id' | 'status' | 'createdAt'>): Promise<PendingTask> {
    const task: PendingTask = {
      ...input,
      id: generateId('task'),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    await this.driver.put('pendingTasks', task);
    await this.recomputeVehicleReminders(input.vehicleId);
    return task;
  }

  /**
   * Section 24: Converts a PendingTask into a completed FaultRecord + single automatic Expense
   */
  async completePendingTask(params: {
    taskId: string;
    repairPerformed: string;
    partsCostPiastres: number;
    laborCostPiastres: number;
    mechanicOrCenter?: string;
    repairedAt?: string;
    odometerKm?: number;
  }): Promise<FaultRecord> {
    const task = await this.driver.getById<PendingTask>('pendingTasks', params.taskId);
    if (!task) throw new Error('العمل المطلوب غير موجود.');
    if (task.status === 'COMPLETED' && task.convertedFaultId) {
      const existingFault = await this.driver.getById<FaultRecord>('faultRecords', task.convertedFaultId);
      if (existingFault) return existingFault;
    }

    const totalCostPiastres = params.partsCostPiastres + params.laborCostPiastres;
    const repairedDate = params.repairedAt || todayIsoDate();

    const fault = await this.saveFaultRecord({
      vehicleId: task.vehicleId,
      title: task.partOrIssue,
      appearedAt: task.createdAt.slice(0, 10),
      odometerKm: params.odometerKm ?? task.odometerKm,
      description: task.description || 'عمل مطلوب تم تحويله لإصلاح مكتمل',
      repairPerformed: params.repairPerformed,
      partsCostPiastres: params.partsCostPiastres,
      laborCostPiastres: params.laborCostPiastres,
      totalCostPiastres,
      mechanicOrCenter: params.mechanicOrCenter,
      status: 'REPAIRED',
      repairedAt: repairedDate,
    });

    await this.driver.put('pendingTasks', {
      ...task,
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      convertedFaultId: fault.id,
    } satisfies PendingTask);

    await this.recomputeVehicleReminders(task.vehicleId);
    return fault;
  }

  async saveSparePart(input: Omit<SparePart, 'id' | 'createdAt'> & { id?: string }): Promise<SparePart> {
    const id = input.id ?? generateId('part');
    const existing = input.id ? await this.driver.getById<SparePart>('spareParts', input.id) : undefined;
    const part: SparePart = {
      ...input,
      id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    await this.driver.put('spareParts', part);

    // Prevent double counting if already included in parent maintenance/fault cost
    await this.upsertAutomaticExpense({
      vehicleId: part.vehicleId,
      sourceType: 'SPARE_PART',
      sourceId: id,
      categoryLabel: `قطعة غيار: ${part.partName}`,
      date: part.purchaseDate || part.installDate,
      amountPiastres: part.includedInParentCost ? 0 : part.pricePiastres,
      odometerKm: part.odometerKm,
      notes: part.vendorOrCenter,
    });

    return part;
  }

  async saveAdditionalExpense(params: {
    vehicleId: string;
    categoryLabel: string;
    date: string;
    amountPiastres: number;
    odometerKm?: number;
    notes?: string;
  }): Promise<Expense> {
    if (params.amountPiastres <= 0) throw new Error('مبلغ المصروف يجب أن يكون أكبر من صفر.');
    const id = generateId('exp_add');
    const expense: Expense = {
      id,
      vehicleId: params.vehicleId,
      sourceType: 'ADDITIONAL',
      sourceId: id,
      categoryLabel: params.categoryLabel,
      date: params.date,
      amountPiastres: params.amountPiastres,
      odometerKm: params.odometerKm,
      notes: params.notes?.trim() || undefined,
      isAutomatic: false,
      createdAt: new Date().toISOString(),
    };
    await this.driver.put('expenses', expense);
    return expense;
  }

  async saveTireRecord(tire: TireRecord): Promise<TireRecord> {
    const isConfigured = tire.dotWeek != null && tire.dotYear != null;
    const updated: TireRecord = {
      ...tire,
      isConfigured,
      updatedAt: new Date().toISOString(),
    };
    await this.driver.put('tireRecords', updated);
    await this.recomputeVehicleReminders(tire.vehicleId);
    return updated;
  }

  async saveEmergencyEquipment(equipment: EmergencyEquipment): Promise<EmergencyEquipment> {
    const updated: EmergencyEquipment = {
      ...equipment,
      updatedAt: new Date().toISOString(),
    };
    await this.driver.put('emergencyEquipment', updated);
    await this.recomputeVehicleReminders(equipment.vehicleId);
    return updated;
  }

  async renewDocument(params: {
    documentId: string;
    newExpiryDate: string;
    notes?: string;
  }): Promise<DocumentRecord> {
    const existing = await this.driver.getById<DocumentRecord>('documentRecords', params.documentId);
    if (!existing) throw new Error('سجل الوثيقة غير موجود.');

    const updatedHistory = [
      {
        expiryDate: existing.expiryDate,
        renewedAt: todayIsoDate(),
        notes: params.notes,
      },
      ...existing.previousHistory,
    ];

    const updated: DocumentRecord = {
      ...existing,
      expiryDate: params.newExpiryDate,
      previousHistory: updatedHistory,
      updatedAt: new Date().toISOString(),
    };

    await this.driver.put('documentRecords', updated);
    await this.recomputeVehicleReminders(existing.vehicleId);
    return updated;
  }

  async recomputeVehicleReminders(vehicleId: string, referenceDateIso = todayIsoDate()): Promise<{
    reminders: Reminder[];
    newlyTriggeredRedAlerts: Reminder[];
  }> {
    const bundle = await this.getVehicleBundle(vehicleId);
    if (!bundle) return { reminders: [], newlyTriggeredRedAlerts: [] };

    const evaluated = evaluateVehicleAlerts({
      vehicle: bundle.vehicle,
      maintenanceRecords: bundle.maintenanceRecords,
      pendingTasks: bundle.pendingTasks,
      tireRecords: bundle.tireRecords,
      documentRecords: bundle.documentRecords,
      emergencyEquipment: bundle.emergencyEquipment,
      referenceDateIso,
    });

    const { updatedReminders, newlyTriggeredRedAlerts } = reconcileReminders(
      vehicleId,
      evaluated,
      bundle.reminders,
      new Date().toISOString()
    );

    // Replace reminders for this vehicleId
    for (const old of bundle.reminders) {
      await this.driver.deleteById('reminders', old.id);
    }
    await this.driver.putMany('reminders', updatedReminders);

    return { reminders: updatedReminders, newlyTriggeredRedAlerts };
  }

  async createManualBackup(fileName?: string): Promise<FullBackupPayload> {
    const [
      appSettings,
      customCatalog,
      vehicles,
      odometerEntries,
      fuelEntries,
      maintenanceTypes,
      maintenanceRecords,
      faultRecords,
      pendingTasks,
      expenses,
      spareParts,
      tireRecords,
      documentRecords,
      reminders,
      emergencyEquipment,
    ] = await Promise.all([
      this.getSettings(),
      this.driver.getAll<CustomCatalogEntry>('customCatalog'),
      this.driver.getAll<Vehicle>('vehicles'),
      this.driver.getAll<OdometerEntry>('odometerEntries'),
      this.driver.getAll<FuelEntry>('fuelEntries'),
      this.driver.getAll<MaintenanceType>('maintenanceTypes'),
      this.driver.getAll<MaintenanceRecord>('maintenanceRecords'),
      this.driver.getAll<FaultRecord>('faultRecords'),
      this.driver.getAll<PendingTask>('pendingTasks'),
      this.driver.getAll<Expense>('expenses'),
      this.driver.getAll<SparePart>('spareParts'),
      this.driver.getAll<TireRecord>('tireRecords'),
      this.driver.getAll<DocumentRecord>('documentRecords'),
      this.driver.getAll<Reminder>('reminders'),
      this.driver.getAll<EmergencyEquipment>('emergencyEquipment'),
    ]);

    const payload = await createBackupPayload({
      appSettings,
      customCatalog,
      vehicles,
      odometerEntries,
      fuelEntries,
      maintenanceTypes,
      maintenanceRecords,
      faultRecords,
      pendingTasks,
      expenses,
      spareParts,
      tireRecords,
      documentRecords,
      reminders,
      emergencyEquipment,
    });

    const totalRecords =
      odometerEntries.length +
      fuelEntries.length +
      maintenanceRecords.length +
      faultRecords.length +
      pendingTasks.length +
      expenses.length +
      spareParts.length +
      tireRecords.length +
      documentRecords.length;

    const existingMeta = await this.getBackupMetadata();
    await this.driver.put('backupMetadata', {
      ...existingMeta,
      id: 'backup_meta',
      lastBackupAt: payload.exportedAt,
      fileName: fileName || `MyCar-Backup-${todayIsoDate()}.json`,
      checksum: payload.checksum,
      vehicleCount: vehicles.length,
      recordCount: totalRecords,
    } satisfies BackupMetadata);

    return payload;
  }

  async previewBackupFile(rawJsonText: string): Promise<BackupPreviewSummary> {
    const meta = await this.getBackupMetadata();
    return inspectAndValidateBackup(rawJsonText, meta);
  }

  async restoreFromValidatedBackup(payload: FullBackupPayload, allowDuplicate = false): Promise<void> {
    const meta = await this.getBackupMetadata();
    if (!allowDuplicate && meta.lastRestoredChecksum === payload.checksum) {
      throw new Error('تمت استعادة هذه النسخة الاحتياطية بالفعل مسبقًا. ألغِ الحماية أو اختر نسخة أحدث.');
    }

    const storeDataMap: Array<[string, unknown[]]> = [
      ['customCatalog', payload.data.customCatalog ?? []],
      ['vehicles', payload.data.vehicles],
      ['odometerEntries', payload.data.odometerEntries],
      ['fuelEntries', payload.data.fuelEntries],
      ['maintenanceTypes', payload.data.maintenanceTypes],
      ['maintenanceRecords', payload.data.maintenanceRecords],
      ['faultRecords', payload.data.faultRecords],
      ['pendingTasks', payload.data.pendingTasks],
      ['expenses', payload.data.expenses],
      ['spareParts', payload.data.spareParts],
      ['tireRecords', payload.data.tireRecords],
      ['documentRecords', payload.data.documentRecords],
      ['reminders', payload.data.reminders],
      ['emergencyEquipment', payload.data.emergencyEquipment],
    ];

    for (const [storeName, records] of storeDataMap) {
      await this.driver.clearStore(storeName);
      await this.driver.putMany(storeName, records);
    }

    await this.driver.clearStore('appSettings');
    await this.driver.put('appSettings', payload.data.appSettings);

    await this.driver.put('backupMetadata', {
      ...meta,
      id: 'backup_meta',
      lastRestoredChecksum: payload.checksum,
      lastRestoredAt: new Date().toISOString(),
    } satisfies BackupMetadata);
  }
}

export const defaultRepository = new MyCarRepository(
  typeof indexedDB !== 'undefined' ? new IndexedDbStorageDriver() : new MemoryStorageDriver()
);

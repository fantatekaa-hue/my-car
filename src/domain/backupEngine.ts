import type { BackupMetadata, FullBackupPayload } from './types';

export const CURRENT_BACKUP_SCHEMA_VERSION = 1;

export interface BackupPreviewSummary {
  valid: boolean;
  error?: string;
  payload?: FullBackupPayload;
  exportedAt?: string;
  vehicleCount?: number;
  odometerCount?: number;
  fuelCount?: number;
  maintenanceCount?: number;
  faultCount?: number;
  expenseCount?: number;
  sparePartCount?: number;
  tireCount?: number;
  documentCount?: number;
  isDuplicateRestore?: boolean;
}

/**
 * Deterministic SHA-256 hex digest with pure-JS fallback for environments without Web Crypto subtle
 */
export async function computeChecksum(dataObj: unknown): Promise<string> {
  const canonical = JSON.stringify(dataObj);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(canonical);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Deterministic FNV-1a 64-bit-like fallback for Node/unit test compatibility if subtle missing
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    const c = canonical.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x01000193);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export async function createBackupPayload(
  data: FullBackupPayload['data']
): Promise<FullBackupPayload> {
  const checksum = await computeChecksum(data);
  return {
    appName: 'عربيتي | MY CAR',
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    checksum,
    data,
  };
}

export async function inspectAndValidateBackup(
  rawJsonText: string,
  backupMeta?: BackupMetadata | null
): Promise<BackupPreviewSummary> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch {
    return {
      valid: false,
      error: 'الملف تالف أو ليس بصيغة JSON صالحة. تعذرت قراءة النسخة الاحتياطية.',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      valid: false,
      error: 'بنية ملف النسخة الاحتياطية غير صالحة.',
    };
  }

  const candidate = parsed as Partial<FullBackupPayload>;

  if (candidate.appName !== 'عربيتي | MY CAR') {
    return {
      valid: false,
      error: 'هذا الملف لا يخص تطبيق «عربيتي | MY CAR» أو غير متوافق.',
    };
  }

  if (
    typeof candidate.schemaVersion !== 'number' ||
    candidate.schemaVersion > CURRENT_BACKUP_SCHEMA_VERSION ||
    candidate.schemaVersion < 1
  ) {
    return {
      valid: false,
      error: `إصدار النسخة الاحتياطية (${String(candidate.schemaVersion)}) غير متوافق مع هذا الإصدار من التطبيق.`,
    };
  }

  if (!candidate.data || typeof candidate.data !== 'object') {
    return {
      valid: false,
      error: 'النسخة الاحتياطية تفتقر إلى قسم البيانات.',
    };
  }

  const requiredArrays: Array<keyof FullBackupPayload['data']> = [
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
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray(candidate.data[key])) {
      return {
        valid: false,
        error: `ملف النسخة الاحتياطية تالف: الحقل (${String(key)}) مفقود أو غير مكتمل.`,
      };
    }
  }

  if (!candidate.data.appSettings || typeof candidate.data.appSettings !== 'object') {
    return {
      valid: false,
      error: 'ملف النسخة الاحتياطية تالف: إعدادات التطبيق مفقودة.',
    };
  }

  const recomputedChecksum = await computeChecksum(candidate.data);
  if (!candidate.checksum || candidate.checksum !== recomputedChecksum) {
    return {
      valid: false,
      error: 'فشل فحص سلامة الملف (Checksum Mismatch): الملف تالف أو تم تعديله يدويًا.',
    };
  }

  const fullPayload = candidate as FullBackupPayload;
  const isDuplicateRestore = Boolean(
    backupMeta?.lastRestoredChecksum && backupMeta.lastRestoredChecksum === fullPayload.checksum
  );

  return {
    valid: true,
    payload: fullPayload,
    exportedAt: fullPayload.exportedAt,
    vehicleCount: fullPayload.data.vehicles.length,
    odometerCount: fullPayload.data.odometerEntries.length,
    fuelCount: fullPayload.data.fuelEntries.length,
    maintenanceCount: fullPayload.data.maintenanceRecords.length,
    faultCount: fullPayload.data.faultRecords.length,
    expenseCount: fullPayload.data.expenses.length,
    sparePartCount: fullPayload.data.spareParts.length,
    tireCount: fullPayload.data.tireRecords.length,
    documentCount: fullPayload.data.documentRecords.length,
    isDuplicateRestore,
  };
}

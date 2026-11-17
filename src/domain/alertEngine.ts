import type {
  AlertSeverity,
  AppSection,
  DocumentRecord,
  EmergencyEquipment,
  EvaluatedAlert,
  MaintenanceRecord,
  PendingTask,
  Reminder,
  TireRecord,
  Vehicle,
} from './types';
import { daysBetween, formatDistance, todayIsoDate } from './units';

export interface VehicleAlertInput {
  vehicle: Vehicle;
  maintenanceRecords: MaintenanceRecord[];
  pendingTasks: PendingTask[];
  tireRecords: TireRecord[];
  documentRecords: DocumentRecord[];
  emergencyEquipment: EmergencyEquipment | null;
  referenceDateIso?: string;
}

export function getTireAgeYearsFromDot(dotWeek: number, dotYear: number, referenceDateIso = todayIsoDate()): number {
  const ref = new Date(`${referenceDateIso.slice(0, 10)}T12:00:00Z`);
  // Approximate manufacturing date from ISO week & year
  const jan4 = new Date(Date.UTC(dotYear, 0, 4));
  const mfg = new Date(jan4.getTime() + (Math.max(1, dotWeek) - 1) * 7 * 24 * 60 * 60 * 1000);
  const diffMs = ref.getTime() - mfg.getTime();
  return Math.max(0, diffMs / (365.2425 * 24 * 60 * 60 * 1000));
}

export function evaluateVehicleAlerts(input: VehicleAlertInput): EvaluatedAlert[] {
  const {
    vehicle,
    maintenanceRecords,
    pendingTasks,
    tireRecords,
    documentRecords,
    emergencyEquipment,
    referenceDateIso = todayIsoDate(),
  } = input;

  const alerts: EvaluatedAlert[] = [];

  // 1. Documents & Licenses (Section 30 & Section 8.3)
  const docLabels: Record<string, string> = {
    VEHICLE_LICENSE: 'ترخيص السيارة',
    TECHNICAL_INSPECTION: 'الفحص الفني',
    DRIVER_LICENSE: 'رخصة القيادة الشخصية',
  };

  for (const doc of documentRecords) {
    if (!doc.expiryDate) continue;
    const daysLeft = daysBetween(referenceDateIso, doc.expiryDate);
    const label = docLabels[doc.docType] ?? doc.docType;

    if (daysLeft <= 0) {
      alerts.push({
        alertKey: `doc_${doc.docType}`,
        vehicleId: vehicle.id,
        severity: 'RED',
        title: `انتهى موعد ${label}`,
        message: `انتهى ${label} بتاريخ ${doc.expiryDate}. يرجى التجديد وتسجيل التاريخ الجديد.`,
        targetSection: 'documents',
        isResolved: false,
      });
    } else if (daysLeft <= 30) {
      alerts.push({
        alertKey: `doc_${doc.docType}`,
        vehicleId: vehicle.id,
        severity: 'RED',
        title: `قرب انتهاء ${label} (${daysLeft} يوم)`,
        message: `تنبيه الـ 30 يومًا: متبقي ${daysLeft} يومًا على موعد ${label} (${doc.expiryDate}).`,
        targetSection: 'documents',
        isResolved: false,
      });
    } else if (daysLeft <= 45) {
      alerts.push({
        alertKey: `doc_${doc.docType}`,
        vehicleId: vehicle.id,
        severity: 'YELLOW',
        title: `موعد ${label} قريب (${daysLeft} يوم)`,
        message: `تاريخ الاستحقاق: ${doc.expiryDate}.`,
        targetSection: 'documents',
        isResolved: false,
      });
    } else {
      alerts.push({
        alertKey: `doc_${doc.docType}`,
        vehicleId: vehicle.id,
        severity: 'GREEN',
        title: `${label} ساري`,
        message: `ساري حتى ${doc.expiryDate} (متبقي ${daysLeft} يومًا).`,
        targetSection: 'documents',
        isResolved: true,
      });
    }

    // Section 8.3: Power of Attorney without registered contract -> 60-day alert before vehicle license expiry
    if (
      doc.docType === 'VEHICLE_LICENSE' &&
      vehicle.ownershipType === 'POWER_OF_ATTORNEY' &&
      !vehicle.poaRegisteredContractDone
    ) {
      if (daysLeft <= 60) {
        alerts.push({
          alertKey: 'poa_registered_contract_60d',
          vehicleId: vehicle.id,
          severity: 'RED',
          title: 'ضرورة عمل عقد مسجل (شراء بتوكيل)',
          message:
            daysLeft <= 0
              ? 'انتهى ترخيص السيارة ولم يتم تأكيد عمل العقد المسجل بعد.'
              : `تنبيه الـ 60 يومًا: متبقي ${daysLeft} يومًا على انتهاء الترخيص ولم يتم عمل عقد مسجل للسيارة.`,
          targetSection: 'documents',
          isResolved: false,
        });
      } else if (daysLeft <= 90) {
        alerts.push({
          alertKey: 'poa_registered_contract_60d',
          vehicleId: vehicle.id,
          severity: 'YELLOW',
          title: 'متابعة العقد المسجل (شراء بتوكيل)',
          message: `يُنصح بإنهاء العقد المسجل قبل دخول مهلة الـ 60 يومًا (متبقي ${daysLeft} يومًا للترخيص).`,
          targetSection: 'documents',
          isResolved: false,
        });
      }
    }
  }

  // 2. Maintenance Alerts (Latest record per maintenanceTypeId)
  const latestByType = new Map<string, MaintenanceRecord>();
  const sortedMaint = [...maintenanceRecords].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.odometerKm - b.odometerKm;
  });
  for (const rec of sortedMaint) {
    latestByType.set(rec.maintenanceTypeId, rec);
  }

  for (const rec of latestByType.values()) {
    const itemName =
      rec.customName ||
      ({
        ENGINE_OIL: 'زيت المحرك',
        OIL_FILTER: 'فلتر الزيت',
        AIR_FILTER: 'فلتر الهواء',
        AC_FILTER: 'فلتر التكييف',
        SPARK_PLUGS: 'البوجيهات',
        BRAKE_PADS: 'تيل الفرامل',
        TRANSMISSION_OIL: 'زيت الفتيس',
        BELTS: 'السيور',
        COOLANT: 'سائل التبريد',
        AC_FREON: 'فريون التكييف',
        BATTERY: 'البطارية',
        SUSPENSION: 'العفشة والمساعدين',
        CUSTOM: 'صيانة مخصصة',
      }[rec.typeCode] ?? rec.typeCode);

    const maintTargetSection: AppSection =
      rec.typeCode === 'ENGINE_OIL' || rec.typeCode === 'OIL_FILTER' ? 'engine_oil' : 'maintenance';

    // Condition-based items (Brake pads, Suspension, Battery)
    if (rec.conditionStatus === 'NEEDS_REPLACEMENT' || rec.conditionStatus === 'NEEDS_REPAIR') {
      alerts.push({
        alertKey: `maint_cond_${rec.maintenanceTypeId}`,
        vehicleId: vehicle.id,
        severity: 'RED',
        title: `${itemName}: يحتاج تغيير/إصلاح`,
        message: `الحالة المسجلة بتاريخ ${rec.date} تتطلب التدخل.`,
        targetSection: maintTargetSection,
        isResolved: false,
      });
    } else if (rec.conditionStatus === 'FOLLOW_UP') {
      alerts.push({
        alertKey: `maint_cond_${rec.maintenanceTypeId}`,
        vehicleId: vehicle.id,
        severity: 'YELLOW',
        title: `${itemName}: يحتاج متابعة`,
        message: `تم تسجيل الحالة «يحتاج متابعة» بتاريخ ${rec.date}.`,
        targetSection: maintTargetSection,
        isResolved: false,
      });
    }

    // Battery warranty alert (Section 19)
    if (rec.typeCode === 'BATTERY' && rec.warrantyExpiryDate) {
      const wDays = daysBetween(referenceDateIso, rec.warrantyExpiryDate);
      if (wDays <= 0) {
        alerts.push({
          alertKey: 'battery_warranty',
          vehicleId: vehicle.id,
          severity: 'RED',
          title: 'انتهى ضمان البطارية',
          message: `انتهت فترة ضمان البطارية بتاريخ ${rec.warrantyExpiryDate}.`,
          targetSection: 'maintenance',
          isResolved: false,
        });
      } else if (wDays <= 30) {
        alerts.push({
          alertKey: 'battery_warranty',
          vehicleId: vehicle.id,
          severity: 'YELLOW',
          title: `قرب انتهاء ضمان البطارية (${wDays} يوم)`,
          message: `ينتهي ضمان البطارية بتاريخ ${rec.warrantyExpiryDate}.`,
          targetSection: 'maintenance',
          isResolved: false,
        });
      }
    }

    // Distance & Time due (Section 11: Engine oil 1000 km warning & closest between distance and time)
    const remainingKm =
      typeof rec.nextDueKm === 'number' ? rec.nextDueKm - vehicle.currentOdometerKm : null;
    const remainingDays = rec.nextDueDate ? daysBetween(referenceDateIso, rec.nextDueDate) : null;

    if (remainingKm !== null || remainingDays !== null) {
      const isOverdueKm = remainingKm !== null && remainingKm <= 0;
      const isOverdueDays = remainingDays !== null && remainingDays <= 0;
      const isSoonKm = remainingKm !== null && remainingKm > 0 && remainingKm <= 1000;
      const isSoonDays = remainingDays !== null && remainingDays > 0 && remainingDays <= 15;

      const sourceTxt = rec.scheduleSource === 'OEM' ? 'توصية الشركة المصنعة' : 'إدخال يدوي';

      if (isOverdueKm || isOverdueDays) {
        alerts.push({
          alertKey: `maint_due_${rec.maintenanceTypeId}`,
          vehicleId: vehicle.id,
          severity: 'RED',
          title: `تجاوز موعد ${itemName}`,
          message: `${isOverdueKm ? `تجاوز العداد بـ ${formatDistance(Math.abs(remainingKm!), vehicle.odometerUnit)}` : `انتهى الموعد الزمني (${rec.nextDueDate})`} · المصدر: ${sourceTxt}.`,
          targetSection: maintTargetSection,
          isResolved: false,
        });
      } else if (isSoonKm || isSoonDays) {
        alerts.push({
          alertKey: `maint_due_${rec.maintenanceTypeId}`,
          vehicleId: vehicle.id,
          severity: 'YELLOW',
          title: `موعد ${itemName} قريب`,
          message: `${isSoonKm ? `متبقي ${formatDistance(remainingKm!, vehicle.odometerUnit)}` : `متبقي ${remainingDays} يومًا`} · المصدر: ${sourceTxt}.`,
          targetSection: maintTargetSection,
          isResolved: false,
        });
      } else {
        alerts.push({
          alertKey: `maint_due_${rec.maintenanceTypeId}`,
          vehicleId: vehicle.id,
          severity: 'GREEN',
          title: `${itemName} في حالة سليمة`,
          message: `${remainingKm !== null ? `متبقي ${formatDistance(remainingKm, vehicle.odometerUnit)}` : ''}${remainingKm !== null && remainingDays !== null ? ' · ' : ''}${remainingDays !== null ? `متبقي ${remainingDays} يومًا` : ''}`,
          targetSection: maintTargetSection,
          isResolved: true,
        });
      }
    }
  }

  // 3. AC Freon Repeat Check within 30 days (Section 18)
  const freonRecords = sortedMaint.filter((r) => r.typeCode === 'AC_FREON');
  if (freonRecords.length >= 2) {
    const prev = freonRecords[freonRecords.length - 2];
    const latest = freonRecords[freonRecords.length - 1];
    const gap = daysBetween(prev.date, latest.date);
    if (gap >= 0 && gap <= 30) {
      alerts.push({
        alertKey: `freon_repeat_${latest.id}`,
        vehicleId: vehicle.id,
        severity: 'RED',
        title: 'تنبيه مراجعة فريون التكييف',
        message: `تكرر شحن الفريون خلال ${gap} يومًا (${prev.date} ثم ${latest.date}). يُوصى بفحص احتمال وجود تسريب (تنبيه مراجعة وليس تشخيصًا مؤكدًا).`,
        targetSection: 'maintenance',
        isResolved: false,
      });
    }
  }

  // 4. Pending Tasks (Section 24: Stay visible until "تم الإصلاح")
  for (const task of pendingTasks) {
    if (task.status === 'PENDING') {
      alerts.push({
        alertKey: `pending_task_${task.id}`,
        vehicleId: vehicle.id,
        severity: task.priority === 'URGENT' ? 'RED' : 'YELLOW',
        title: `عمل مطلوب: ${task.partOrIssue}`,
        message: `مسجل عند ${formatDistance(task.odometerKm, vehicle.odometerUnit)} — يظل ظاهرًا حتى تأكيد «تم الإصلاح».`,
        targetSection: 'faults',
        isResolved: false,
      });
    }
  }

  // 5. Tires (Section 28: Age strictly from DOT manufacturing date -> 5 yrs yellow, 6 yrs red)
  const unconfiguredTires: TireRecord[] = [];
  for (const tire of tireRecords) {
    if (tire.dotWeek == null || tire.dotYear == null || tire.isConfigured === false) {
      unconfiguredTires.push(tire);
      continue;
    }
    const ageYears = getTireAgeYearsFromDot(tire.dotWeek, tire.dotYear, referenceDateIso);
    const ageDisplay = ageYears.toFixed(1);

    if (ageYears >= 6 || tire.treadStatus === 'NEEDS_REPLACEMENT') {
      alerts.push({
        alertKey: `tire_${tire.position}`,
        vehicleId: vehicle.id,
        severity: 'RED',
        title: `إطار (${tire.positionLabel}): عمر 6 سنوات أو يحتاج تغيير`,
        message: `تاريخ التصنيع DOT (${tire.dotWeek}/${tire.dotYear} — العمر ${ageDisplay} سنة): يُوصى بالفحص والاستبدال حسب الحالة.`,
        targetSection: 'tires',
        isResolved: false,
      });
    } else if (ageYears >= 5 || tire.treadStatus === 'FOLLOW_UP') {
      alerts.push({
        alertKey: `tire_${tire.position}`,
        vehicleId: vehicle.id,
        severity: 'YELLOW',
        title: `إطار (${tire.positionLabel}): عمر 5 سنوات / متابعة`,
        message: `تاريخ التصنيع DOT (${tire.dotWeek}/${tire.dotYear} — العمر ${ageDisplay} سنة).`,
        targetSection: 'tires',
        isResolved: false,
      });
    } else {
      alerts.push({
        alertKey: `tire_${tire.position}`,
        vehicleId: vehicle.id,
        severity: 'GREEN',
        title: `إطار (${tire.positionLabel}) سليم`,
        message: `DOT (${tire.dotWeek}/${tire.dotYear}) — العمر ${ageDisplay} سنة من التصنيع.`,
        targetSection: 'tires',
        isResolved: true,
      });
    }
  }

  if (unconfiguredTires.length > 0) {
    alerts.push({
      alertKey: 'tires_incomplete',
      vehicleId: vehicle.id,
      severity: 'YELLOW',
      title: `بيانات ${unconfiguredTires.length} إطارات لم تُدخل بعد`,
      message: 'مطلوب إدخال النوع والمقاس وتاريخ DOT بمعرفة العميل بدلاً من أي قيم افتراضية.',
      targetSection: 'tires',
      isResolved: false,
    });
  }

  // 6. Emergency Equipment (Section 29 — never assumed if null)
  if (emergencyEquipment) {
    const hasUnconfirmed =
      emergencyEquipment.hasJack === null ||
      emergencyEquipment.hasLugWrench === null ||
      emergencyEquipment.hasAirPump === null;

    if (hasUnconfirmed) {
      alerts.push({
        alertKey: 'emergency_incomplete',
        vehicleId: vehicle.id,
        severity: 'YELLOW',
        title: 'تجهيزات الطوارئ غير محددة بعد',
        message: 'يرجى تأكيد توفر أو عدم توفر الكوريك ومفتاح العجل والمنفاخ.',
        targetSection: 'tires',
        isResolved: false,
      });
    }

    if (emergencyEquipment.hasJack === false || emergencyEquipment.hasLugWrench === false) {
      const missing: string[] = [];
      if (emergencyEquipment.hasJack === false) missing.push('الكوريك');
      if (emergencyEquipment.hasLugWrench === false) missing.push('مفتاح العجل');
      alerts.push({
        alertKey: 'emergency_critical',
        vehicleId: vehicle.id,
        severity: 'RED',
        title: `نقص تجهيزات طوارئ مهمة (${missing.join(' و ')})`,
        message: 'لابد من توافرهما لسلامتك أثناء السفر — يبقى هذا التنبيه ظاهرًا حتى تأكيد توفر الكوريك ومفتاح العجل.',
        targetSection: 'tires',
        isResolved: false,
      });
    } else if (emergencyEquipment.hasJack === true && emergencyEquipment.hasLugWrench === true) {
      alerts.push({
        alertKey: 'emergency_critical',
        vehicleId: vehicle.id,
        severity: 'GREEN',
        title: 'الكوريك ومفتاح العجل متوفران',
        message: 'تم تأكيد وجود تجهيزات الطوارئ الأساسية.',
        targetSection: 'tires',
        isResolved: true,
      });
    }

    if (emergencyEquipment.hasAirPump === false) {
      alerts.push({
        alertKey: 'emergency_airpump',
        vehicleId: vehicle.id,
        severity: 'YELLOW',
        title: 'نصيحة: من الضروري امتلاك منفاخ كهربائي للطوارئ',
        message: 'يُنصح بتجهيز السيارة بمنفاخ كهربائي لمواجهة طوارئ انخفاض ضغط الإطارات على الطريق.',
        targetSection: 'tires',
        isResolved: false,
      });
    }
  }

  // Sort RED first, then YELLOW, then GREEN
  const order: Record<AlertSeverity, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Syncs evaluated alerts with persisted Reminder state to guarantee:
 * - Red external notification fires ONCE upon transition into RED
 * - Does NOT repeat daily or on app restart
 * - Resets notification flag if condition resolves and later turns RED again
 */
export function reconcileReminders(
  vehicleId: string,
  evaluated: EvaluatedAlert[],
  existingReminders: Reminder[],
  nowIso: string
): { updatedReminders: Reminder[]; newlyTriggeredRedAlerts: Reminder[] } {
  const existingMap = new Map<string, Reminder>();
  for (const r of existingReminders) {
    if (r.vehicleId === vehicleId) existingMap.set(r.alertKey, r);
  }

  const updatedReminders: Reminder[] = [];
  const newlyTriggeredRedAlerts: Reminder[] = [];

  for (const ev of evaluated) {
    const prev = existingMap.get(ev.alertKey);
    const wasAlreadyRedNotified = prev?.severity === 'RED' && prev.redNotifiedExternally === true;
    const isNewRed = ev.severity === 'RED' && !wasAlreadyRedNotified;

    const reminder: Reminder = {
      id: prev?.id ?? `rem_${vehicleId}_${ev.alertKey}`,
      vehicleId,
      alertKey: ev.alertKey,
      severity: ev.severity,
      title: ev.title,
      message: ev.message,
      targetSection: ev.targetSection,
      redNotifiedExternally: ev.severity === 'RED' ? true : false,
      lastEvaluatedAt: nowIso,
      resolvedAt: ev.isResolved ? prev?.resolvedAt ?? nowIso : undefined,
    };

    updatedReminders.push(reminder);
    if (isNewRed) {
      newlyTriggeredRedAlerts.push(reminder);
    }
  }

  return { updatedReminders, newlyTriggeredRedAlerts };
}

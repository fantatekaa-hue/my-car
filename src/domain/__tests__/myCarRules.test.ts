import { describe, expect, it } from 'vitest';
import { MemoryStorageDriver, MyCarRepository } from '../../db/myCarRepository';
import { evaluateVehicleAlerts, reconcileReminders } from '../alertEngine';
import { inspectAndValidateBackup } from '../backupEngine';
import { EGYPTIAN_CAR_CATALOG, mergeCatalogWithCustom } from '../egyptianCatalog';
import { calculateFuelAnalytics } from '../fuelEngine';
import { validateEgyptianPlate } from '../plateValidator';
import { fromInternalKm, toInternalKm, toPiastres } from '../units';

describe('MY CAR (عربيتي) — Domain & Calculation Integrity Tests (Section 34 & 35)', () => {
  it('1-3. Complete vehicle isolation and multi-car switching without merged reporting', async () => {
    const repo = new MyCarRepository(new MemoryStorageDriver());
    const car1 = await repo.createVehicle({
      brand: 'تويوتا (Toyota)',
      model: 'Corolla (كورولا)',
      year: 2022,
      plateRaw: 'س ب ع 1234',
      vehicleLicenseExpiry: '2027-05-01',
      technicalInspectionDate: '2027-05-01',
      driverLicenseExpiry: '2028-01-01',
      odometerUnit: 'KM',
      initialOdometerKm: 10000,
      ownershipType: 'REGISTERED_CONTRACT',
      poaRegisteredContractDone: true,
    });

    const car2 = await repo.createVehicle({
      brand: 'بي إم دبليو (BMW)',
      model: '318i / 320i / 330i',
      year: 2021,
      plateRaw: 'ABC 789',
      vehicleLicenseExpiry: '2027-06-01',
      technicalInspectionDate: '2027-06-01',
      driverLicenseExpiry: '2028-02-01',
      odometerUnit: 'MILE',
      initialOdometerKm: toInternalKm(20000, 'MILE'),
      ownershipType: 'POWER_OF_ATTORNEY',
      poaRegisteredContractDone: false,
    });

    await repo.saveFuelEntry({
      vehicleId: car1.id,
      dateTime: '2026-10-01T10:00',
      odometerKm: 10500,
      fuelType: '92',
      liters: 40,
      totalCostPiastres: toPiastres(550),
      fillType: 'FULL',
    });

    const bundle1 = await repo.getVehicleBundle(car1.id);
    const bundle2 = await repo.getVehicleBundle(car2.id);

    expect(bundle1?.fuelEntries).toHaveLength(1);
    expect(bundle1?.expenses).toHaveLength(1);
    expect(bundle2?.fuelEntries).toHaveLength(0);
    expect(bundle2?.expenses).toHaveLength(0);
  });

  it('4. Egyptian license plate validator (Arabic & English, 2-3 letters + 2-4 digits, optional spaces)', () => {
    expect(validateEgyptianPlate('س ب ع 1234').valid).toBe(true);
    expect(validateEgyptianPlate('سبع123').valid).toBe(true);
    expect(validateEgyptianPlate('س ب 12').valid).toBe(true);
    expect(validateEgyptianPlate('ABC 789').valid).toBe(true);
    expect(validateEgyptianPlate('XYZ4567').valid).toBe(true);
    expect(validateEgyptianPlate('AB 1234').valid).toBe(true);
    expect(validateEgyptianPlate('AB 12').valid).toBe(true);
    expect(validateEgyptianPlate('1234 ق م ر').valid).toBe(true);
    expect(validateEgyptianPlate('A 123').valid).toBe(false);
    expect(validateEgyptianPlate('AB 1').valid).toBe(false);
    expect(validateEgyptianPlate('ABCD 123').valid).toBe(false);
    expect(validateEgyptianPlate('ABC 12345').valid).toBe(false);
    expect(validateEgyptianPlate('س ب C 123').valid).toBe(false);
  });

  it('5. Offline Egyptian car catalog & persistent manual additions', async () => {
    const repo = new MyCarRepository(new MemoryStorageDriver());
    await repo.addCustomCatalogEntry('Geely', 'Coolray', 2024);
    const custom = await repo.getCustomCatalog();
    const merged = mergeCatalogWithCustom(custom);
    const geely = merged.find((b) => b.brand === 'Geely');
    expect(geely).toBeDefined();
    expect(geely?.models[0].name).toBe('Coolray');
    expect(geely?.models[0].years).toContain(2024);
  });

  it('6. KM/Mile internal storage & display conversion without altering raw data', () => {
    const internalKm = toInternalKm(100, 'MILE');
    expect(internalKm).toBeCloseTo(160.934, 2);
    expect(fromInternalKm(internalKm, 'MILE')).toBeCloseTo(100, 1);
  });

  it('7-9. Odometer rejection on lower reading + confirmed correction + audit trail + expenses preserved', async () => {
    const repo = new MyCarRepository(new MemoryStorageDriver());
    const car = await repo.createVehicle({
      brand: 'هيونداي (Hyundai)',
      model: 'Elantra AD / HD / CN7 (إلنترا)',
      year: 2020,
      plateRaw: 'ق م ر 4521',
      vehicleLicenseExpiry: '2027-10-01',
      technicalInspectionDate: '2027-10-01',
      driverLicenseExpiry: '2028-10-01',
      odometerUnit: 'KM',
      initialOdometerKm: 50000,
      ownershipType: 'REGISTERED_CONTRACT',
      poaRegisteredContractDone: true,
    });

    await expect(repo.updateOdometerNormal(car.id, 49500)).rejects.toThrow();

    const fuel1 = await repo.saveFuelEntry({
      vehicleId: car.id,
      dateTime: '2026-10-01T09:00',
      odometerKm: 50000,
      fuelType: '92',
      liters: 40,
      totalCostPiastres: toPiastres(600),
      fillType: 'FULL',
    });

    const fuel2 = await repo.saveFuelEntry({
      vehicleId: car.id,
      dateTime: '2026-10-10T09:00',
      odometerKm: 50400,
      fuelType: '92',
      liters: 40,
      totalCostPiastres: toPiastres(640),
      fillType: 'FULL',
    });

    const corr = await repo.correctOdometer({
      vehicleId: car.id,
      correctedReadingKm: 50500,
      reason: 'خطأ إدخال في قراءة التفويلة الثانية',
      targetFuelEntryId: fuel2.id,
    });

    expect(corr.entryType).toBe('CORRECTION');
    expect(corr.previousReadingKm).toBe(50400);
    expect(corr.readingKm).toBe(50500);

    const bundle = await repo.getVehicleBundle(car.id);
    // Original expenses MUST remain unchanged!
    const exp1 = bundle!.expenses.find((e) => e.sourceId === fuel1.id);
    const exp2 = bundle!.expenses.find((e) => e.sourceId === fuel2.id);
    expect(exp1?.amountPiastres).toBe(toPiastres(600));
    expect(exp2?.amountPiastres).toBe(toPiastres(640));

    // Fuel distance recalculated from 50500 - 50000 = 500 km / 40 L = 12.5 km/L
    const analytics = calculateFuelAnalytics(bundle!.fuelEntries, 'KM');
    expect(analytics.overallKmPerLiter).toBeCloseTo(12.5, 4);
  });

  it('10-11. Engine oil 1000 km alert & Oil filter updated ONLY when confirmed changed (no duplicate)', async () => {
    const repo = new MyCarRepository(new MemoryStorageDriver());
    const car = await repo.createVehicle({
      brand: 'نيسان (Nissan)',
      model: 'Sunny (صني)',
      year: 2023,
      plateRaw: 'د هـ و 9876',
      vehicleLicenseExpiry: '2028-01-01',
      technicalInspectionDate: '2028-01-01',
      driverLicenseExpiry: '2028-01-01',
      odometerUnit: 'KM',
      initialOdometerKm: 10000,
      ownershipType: 'REGISTERED_CONTRACT',
      poaRegisteredContractDone: true,
    });

    // Change oil WITH filter
    await repo.saveMaintenanceRecord({
      vehicleId: car.id,
      maintenanceTypeId: `mt_${car.id}_ENGINE_OIL`,
      typeCode: 'ENGINE_OIL',
      date: '2026-09-01',
      odometerKm: 10000,
      costPiastres: toPiastres(1200),
      brandOrType: 'Shell Helix Ultra',
      viscosity: '5W-40',
      intervalKm: 10000,
      nextDueKm: 20000,
      scheduleSource: 'OEM',
      oilFilterChanged: true,
      oilFilterCostPiastres: toPiastres(250),
      oilFilterIntervalKm: 10000,
    });

    let bundle = await repo.getVehicleBundle(car.id);
    expect(bundle!.maintenanceRecords.filter((r) => r.typeCode === 'OIL_FILTER')).toHaveLength(1);
    expect(bundle!.expenses).toHaveLength(2); // 1 oil + 1 filter

    // Advance odometer to 19200 (800 km remaining -> triggers <= 1000 km alert)
    await repo.updateOdometerNormal(car.id, 19200);
    bundle = await repo.getVehicleBundle(car.id);
    const alerts = evaluateVehicleAlerts({
      vehicle: bundle!.vehicle,
      maintenanceRecords: bundle!.maintenanceRecords,
      pendingTasks: bundle!.pendingTasks,
      tireRecords: bundle!.tireRecords,
      documentRecords: bundle!.documentRecords,
      emergencyEquipment: bundle!.emergencyEquipment,
      referenceDateIso: '2026-11-17',
    });
    const oilAlert = alerts.find((a) => a.title.includes('زيت المحرك') && a.severity === 'YELLOW');
    expect(oilAlert).toBeDefined();
    expect(oilAlert?.targetSection).toBe('engine_oil');

    // Record next oil change WITHOUT changing oil filter
    await repo.saveMaintenanceRecord({
      vehicleId: car.id,
      maintenanceTypeId: `mt_${car.id}_ENGINE_OIL`,
      typeCode: 'ENGINE_OIL',
      date: '2026-11-17',
      odometerKm: 19200,
      costPiastres: toPiastres(1300),
      intervalKm: 5000,
      nextDueKm: 24200,
      scheduleSource: 'MANUAL',
      oilFilterChanged: false,
    });

    bundle = await repo.getVehicleBundle(car.id);
    // Oil filter still has only the 1 original record, NOT updated!
    const filters = bundle!.maintenanceRecords.filter((r) => r.typeCode === 'OIL_FILTER');
    expect(filters).toHaveLength(1);
    expect(filters[0].odometerKm).toBe(10000);
    expect(filters[0].brandOrType).toBeUndefined();
  });

  it('13. AC Freon repeat charge within 30 days triggers leak inspection warning', async () => {
    const repo = new MyCarRepository(new MemoryStorageDriver());
    const car = await repo.createVehicle({
      brand: 'كيا (Kia)',
      model: 'Cerato / Grand Cerato (سيراتو)',
      year: 2019,
      plateRaw: 'م ن ص 321',
      vehicleLicenseExpiry: '2028-01-01',
      technicalInspectionDate: '2028-01-01',
      driverLicenseExpiry: '2028-01-01',
      odometerUnit: 'KM',
      initialOdometerKm: 60000,
      ownershipType: 'REGISTERED_CONTRACT',
      poaRegisteredContractDone: true,
    });

    await repo.saveMaintenanceRecord({
      vehicleId: car.id,
      maintenanceTypeId: `mt_${car.id}_AC_FREON`,
      typeCode: 'AC_FREON',
      date: '2026-10-20',
      odometerKm: 60000,
      costPiastres: toPiastres(400),
      brandOrType: 'R134a',
      quantity: '500g',
      scheduleSource: 'INSPECTION_ONLY',
    });

    await repo.saveMaintenanceRecord({
      vehicleId: car.id,
      maintenanceTypeId: `mt_${car.id}_AC_FREON`,
      typeCode: 'AC_FREON',
      date: '2026-11-10',
      odometerKm: 60500,
      costPiastres: toPiastres(400),
      brandOrType: 'R134a',
      quantity: '500g',
      scheduleSource: 'INSPECTION_ONLY',
    });

    const bundle = await repo.getVehicleBundle(car.id);
    const alerts = evaluateVehicleAlerts({
      vehicle: bundle!.vehicle,
      maintenanceRecords: bundle!.maintenanceRecords,
      pendingTasks: bundle!.pendingTasks,
      tireRecords: bundle!.tireRecords,
      documentRecords: bundle!.documentRecords,
      emergencyEquipment: bundle!.emergencyEquipment,
      referenceDateIso: '2026-11-17',
    });
    expect(alerts.some((a) => a.title.includes('فريون') && a.severity === 'RED')).toBe(true);
  });

  it('17-20. Fuel Full-to-Full math, partial exclusion, weighted overall average & historical price lock', async () => {
    const repo = new MyCarRepository(new MemoryStorageDriver());
    const car = await repo.createVehicle({
      brand: 'رينو (Renault)',
      model: 'Megane (ميجان)',
      year: 2022,
      plateRaw: 'أ ب ج 5555',
      vehicleLicenseExpiry: '2028-01-01',
      technicalInspectionDate: '2028-01-01',
      driverLicenseExpiry: '2028-01-01',
      odometerUnit: 'KM',
      initialOdometerKm: 10000,
      ownershipType: 'REGISTERED_CONTRACT',
      poaRegisteredContractDone: true,
    });

    // 1. Baseline FULL fill -> no consumption
    const f1 = await repo.saveFuelEntry({
      vehicleId: car.id,
      dateTime: '2026-10-01T08:00',
      odometerKm: 10000,
      fuelType: '92',
      liters: 40,
      totalCostPiastres: toPiastres(550), // 13.75/L
      fillType: 'FULL',
    });

    // 2. Second FULL fill: 500 km / 50 L = 10 km/L
    const f2 = await repo.saveFuelEntry({
      vehicleId: car.id,
      dateTime: '2026-10-10T08:00',
      odometerKm: 10500,
      fuelType: '92',
      liters: 50,
      totalCostPiastres: toPiastres(750), // 15.00/L (price changed!)
      fillType: 'FULL',
    });

    // 3. Partial fill -> expense ONLY, never enters exact average
    await repo.saveFuelEntry({
      vehicleId: car.id,
      dateTime: '2026-10-15T08:00',
      odometerKm: 10700,
      fuelType: '95',
      liters: 15,
      totalCostPiastres: toPiastres(255),
      fillType: 'PARTIAL',
    });

    // 4. Full fill after partial -> starts new clean baseline
    await repo.saveFuelEntry({
      vehicleId: car.id,
      dateTime: '2026-10-20T08:00',
      odometerKm: 11000,
      fuelType: '92',
      liters: 25,
      totalCostPiastres: toPiastres(375),
      fillType: 'FULL',
    });

    // 5. Full fill after clean baseline: 300 km / 20 L = 15 km/L
    await repo.saveFuelEntry({
      vehicleId: car.id,
      dateTime: '2026-10-28T08:00',
      odometerKm: 11300,
      fuelType: '92',
      liters: 20,
      totalCostPiastres: toPiastres(300),
      fillType: 'FULL',
    });

    const bundle = await repo.getVehicleBundle(car.id);
    const analytics = calculateFuelAnalytics(bundle!.fuelEntries, 'KM');

    // Historical prices preserved!
    expect(bundle!.fuelEntries.find((e) => e.id === f1.id)?.pricePerLiterPiastres).toBe(1375);
    expect(bundle!.fuelEntries.find((e) => e.id === f2.id)?.pricePerLiterPiastres).toBe(1500);

    // Weighted overall average: (500 + 300) / (50 + 20) = 800 / 70 = 11.42857 km/L
    // (Arithmetic mean of 10 and 15 would have been 12.5 — strictly avoided!)
    expect(analytics.completedPeriodsCount).toBe(2);
    expect(analytics.completedDistanceKm).toBe(800);
    expect(analytics.completedLiters).toBe(70);
    expect(analytics.overallKmPerLiter).toBeCloseTo(800 / 70, 4);
    expect(analytics.totalCostPiastres).toBe(toPiastres(550 + 750 + 255 + 375 + 300));
  });

  it('21-22. Expense idempotency & Pending tasks stay visible until repaired', async () => {
    const repo = new MyCarRepository(new MemoryStorageDriver());
    const car = await repo.createVehicle({
      brand: 'شيري (Chery)',
      model: 'Arrizo 5 (أريزو 5)',
      year: 2023,
      plateRaw: 'ي ك ل 456',
      vehicleLicenseExpiry: '2028-01-01',
      technicalInspectionDate: '2028-01-01',
      driverLicenseExpiry: '2028-01-01',
      odometerUnit: 'KM',
      initialOdometerKm: 12000,
      ownershipType: 'REGISTERED_CONTRACT',
      poaRegisteredContractDone: true,
    });

    const task = await repo.addPendingTask({
      vehicleId: car.id,
      partOrIssue: 'طقم بوجيهات / صوت في المساعد الأمامي',
      odometerKm: 12000,
      priority: 'URGENT',
    });

    // Advancing odometer does NOT hide pending task
    await repo.updateOdometerNormal(car.id, 13500);
    let bundle = await repo.getVehicleBundle(car.id);
    expect(bundle!.pendingTasks[0].status).toBe('PENDING');

    // Completing task creates FaultRecord + ONE Expense
    const fault = await repo.completePendingTask({
      taskId: task.id,
      repairPerformed: 'تم تغيير المساعد الأمامي',
      partsCostPiastres: toPiastres(1800),
      laborCostPiastres: toPiastres(300),
      mechanicOrCenter: 'مركز النور',
    });

    // Re-calling completePendingTask does NOT create a second expense
    await repo.completePendingTask({
      taskId: task.id,
      repairPerformed: 'تم تغيير المساعد الأمامي',
      partsCostPiastres: toPiastres(1800),
      laborCostPiastres: toPiastres(300),
    });

    bundle = await repo.getVehicleBundle(car.id);
    const repairExpenses = bundle!.expenses.filter((e) => e.sourceId === fault.id);
    expect(repairExpenses).toHaveLength(1);
    expect(repairExpenses[0].amountPiastres).toBe(toPiastres(2100));
  });

  it('23-26. Tire DOT 5/6yr age, Emergency equipment, 60/30 POA alerts, and single-fire RED notifications', async () => {
    const repo = new MyCarRepository(new MemoryStorageDriver());
    const car = await repo.createVehicle({
      brand: 'شيفروليه (Chevrolet)',
      model: 'Optra (أوبترا)',
      year: 2020,
      plateRaw: 'ط ع ف 888',
      vehicleLicenseExpiry: '2027-01-05', // 49 days from 2026-11-17 -> triggers 60-day POA alert, NOT 30-day license alert!
      technicalInspectionDate: '2027-06-01',
      driverLicenseExpiry: '2027-06-01',
      odometerUnit: 'KM',
      initialOdometerKm: 40000,
      ownershipType: 'POWER_OF_ATTORNEY',
      poaRegisteredContractDone: false,
    });

    const bundle = await repo.getVehicleBundle(car.id);
    // Make FL tire 6.2 years old by DOT
    const fl = bundle!.tireRecords.find((t) => t.position === 'FL')!;
    await repo.saveTireRecord({ ...fl, dotWeek: 10, dotYear: 2020 });
    // Remove Jack
    await repo.saveEmergencyEquipment({ ...bundle!.emergencyEquipment!, hasJack: false, hasAirPump: false });

    const updatedBundle = await repo.getVehicleBundle(car.id);
    const evaluated = evaluateVehicleAlerts({
      vehicle: updatedBundle!.vehicle,
      maintenanceRecords: updatedBundle!.maintenanceRecords,
      pendingTasks: updatedBundle!.pendingTasks,
      tireRecords: updatedBundle!.tireRecords,
      documentRecords: updatedBundle!.documentRecords,
      emergencyEquipment: updatedBundle!.emergencyEquipment,
      referenceDateIso: '2026-11-17',
    });

    expect(evaluated.some((a) => a.alertKey === 'poa_registered_contract_60d' && a.severity === 'RED')).toBe(true);
    expect(evaluated.some((a) => a.alertKey === 'tire_FL' && a.severity === 'RED')).toBe(true);
    const emergencyCriticalAlert = evaluated.find((a) => a.alertKey === 'emergency_critical' && a.severity === 'RED');
    expect(emergencyCriticalAlert).toBeDefined();
    expect(emergencyCriticalAlert?.message).toContain('لابد من توافرهما لسلامتك أثناء السفر');
    const airPumpAlert = evaluated.find((a) => a.alertKey === 'emergency_airpump' && a.severity === 'YELLOW');
    expect(airPumpAlert).toBeDefined();
    expect(airPumpAlert?.title).toContain('نصيحة');
    expect(airPumpAlert?.message).not.toContain('غير ملح');

    // Single-fire external red alert reconciliation
    const pass1 = reconcileReminders(car.id, evaluated, [], '2026-11-17T10:00:00Z');
    expect(pass1.newlyTriggeredRedAlerts.length).toBeGreaterThanOrEqual(3);

    // Second pass (e.g. next day or app restart) MUST NOT re-fire already notified RED alerts
    const pass2 = reconcileReminders(car.id, evaluated, pass1.updatedReminders, '2026-11-18T10:00:00Z');
    expect(pass2.newlyTriggeredRedAlerts).toHaveLength(0);
  });

  it('28-29. Manual Backup creation, checksum validation, corrupt file rejection, and restore', async () => {
    const repo1 = new MyCarRepository(new MemoryStorageDriver());
    const car = await repo1.createVehicle({
      brand: 'بيجو (Peugeot)',
      model: '301',
      year: 2021,
      plateRaw: 'ب هـ و 2020',
      vehicleLicenseExpiry: '2027-08-01',
      technicalInspectionDate: '2027-08-01',
      driverLicenseExpiry: '2027-08-01',
      odometerUnit: 'KM',
      initialOdometerKm: 30000,
      ownershipType: 'REGISTERED_CONTRACT',
      poaRegisteredContractDone: true,
    });

    const backup = await repo1.createManualBackup();
    const rawJson = JSON.stringify(backup);

    // Tampered file MUST fail checksum validation
    const tamperedJson = rawJson.replace('30000', '99999');
    const badCheck = await inspectAndValidateBackup(tamperedJson);
    expect(badCheck.valid).toBe(false);

    // Valid file restores cleanly onto a fresh install
    const repo2 = new MyCarRepository(new MemoryStorageDriver());
    const preview = await repo2.previewBackupFile(rawJson);
    expect(preview.valid).toBe(true);
    expect(preview.vehicleCount).toBe(1);

    await repo2.restoreFromValidatedBackup(preview.payload!);
    const restoredCars = await repo2.getVehicles();
    expect(restoredCars).toHaveLength(1);
    expect(restoredCars[0].id).toBe(car.id);

    // Duplicate restore is blocked by default
    await expect(repo2.restoreFromValidatedBackup(preview.payload!)).rejects.toThrow();
  });

  it('30. Optional initial odometer & non-assumed tire/emergency defaults', async () => {
    const repo = new MyCarRepository(new MemoryStorageDriver());
    const car = await repo.createVehicle({
      brand: 'كيا (Kia)',
      model: 'Sportage (سبورتاج)',
      year: 2024,
      plateRaw: 'ق م 45',
      vehicleLicenseExpiry: '2027-09-15',
      technicalInspectionDate: '2028-09-15',
      driverLicenseExpiry: '2028-01-01',
      odometerUnit: 'KM',
      // initialOdometerKm omitted!
      ownershipType: 'REGISTERED_CONTRACT',
      poaRegisteredContractDone: true,
    });

    expect(car.hasOdometerReading).toBe(false);
    let bundle = await repo.getVehicleBundle(car.id);
    expect(bundle!.odometerEntries).toHaveLength(0);
    expect(bundle!.emergencyEquipment?.hasJack).toBeNull();
    expect(bundle!.emergencyEquipment?.hasLugWrench).toBeNull();
    expect(bundle!.emergencyEquipment?.hasAirPump).toBeNull();
    expect(bundle!.tireRecords.every((t) => t.dotWeek === null && t.dotYear === null && t.isConfigured === false)).toBe(true);

    // Alerts should NOT assume Green/2026 DOT or Jack=true
    const evaluated = evaluateVehicleAlerts({
      vehicle: bundle!.vehicle,
      maintenanceRecords: bundle!.maintenanceRecords,
      pendingTasks: bundle!.pendingTasks,
      tireRecords: bundle!.tireRecords,
      documentRecords: bundle!.documentRecords,
      emergencyEquipment: bundle!.emergencyEquipment,
      referenceDateIso: '2026-11-17',
    });
    expect(evaluated.some((a) => a.alertKey === 'tires_incomplete' && a.severity === 'YELLOW')).toBe(true);
    expect(evaluated.some((a) => a.alertKey === 'emergency_incomplete' && a.severity === 'YELLOW')).toBe(true);
    expect(evaluated.some((a) => a.alertKey.startsWith('tire_FL'))).toBe(false);

    // First odometer entry later sets hasOdometerReading = true and entryType = INITIAL
    const firstOdo = await repo.updateOdometerNormal(car.id, 14500);
    expect(firstOdo.entryType).toBe('INITIAL');
    bundle = await repo.getVehicleBundle(car.id);
    expect(bundle!.vehicle.hasOdometerReading).toBe(true);
    expect(bundle!.vehicle.currentOdometerKm).toBe(14500);
  });

  it('31. Catalog brands & models are English-only and 10,000 KM oil converts accurately on MILE vehicles', async () => {
    const arabicRegex = /[\u0600-\u06FF]/;
    for (const b of EGYPTIAN_CAR_CATALOG) {
      expect(arabicRegex.test(b.brand)).toBe(false);
      for (const m of b.models) {
        expect(arabicRegex.test(m.name)).toBe(false);
      }
    }

    const repo = new MyCarRepository(new MemoryStorageDriver());
    const mileCar = await repo.createVehicle({
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
      plateRaw: 'ABC 123',
      vehicleLicenseExpiry: '2028-01-01',
      technicalInspectionDate: '2028-01-01',
      driverLicenseExpiry: '2028-01-01',
      odometerUnit: 'MILE',
      initialOdometerKm: toInternalKm(60000, 'MILE'),
      ownershipType: 'REGISTERED_CONTRACT',
      poaRegisteredContractDone: true,
    });

    // User puts 10,000 KM oil on a MILE car at 60,000 miles
    const oilKmInterval = 10000;
    const odoKm = toInternalKm(60000, 'MILE');
    const saved = await repo.saveMaintenanceRecord({
      vehicleId: mileCar.id,
      maintenanceTypeId: `mt_${mileCar.id}_ENGINE_OIL`,
      typeCode: 'ENGINE_OIL',
      date: '2026-11-17',
      odometerKm: odoKm,
      costPiastres: toPiastres(1500),
      intervalKm: oilKmInterval,
      intervalMonths: 12,
      nextDueKm: odoKm + oilKmInterval,
      nextDueDate: '2027-11-17',
      scheduleSource: 'MANUAL',
    });

    // Next due reading displayed in miles should be ~ 60,000 + 6,213.71 = 66,213.71 miles
    expect(fromInternalKm(saved.nextDueKm!, 'MILE')).toBeCloseTo(66213.71, 1);
  });
});

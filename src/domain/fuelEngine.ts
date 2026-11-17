import type { FuelEntry, OdometerUnit } from './types';
import { fromInternalKm } from './units';

export interface FuelPeriodResult {
  entryId: string;
  dateTime: string;
  odometerKm: number;
  fuelType: string;
  liters: number;
  totalCostPiastres: number;
  pricePerLiterPiastres: number;
  fillType: 'FULL' | 'PARTIAL';
  distanceKm: number | null;
  kmPerLiter: number | null;
  litersPer100Km: number | null;
  isBaseline: boolean;
  excludedReason?: string;
}

export interface MonthlyFuelSummary {
  monthKey: string; // YYYY-MM
  liters: number;
  totalCostPiastres: number;
  fillsCount: number;
}

export interface FuelAnalyticsSummary {
  totalFills: number;
  fullFillsCount: number;
  partialFillsCount: number;
  totalLiters: number;
  totalCostPiastres: number;
  // Strictly from uninterrupted Full-to-Full periods ONLY
  completedPeriodsCount: number;
  completedDistanceKm: number;
  completedLiters: number;
  overallKmPerLiter: number | null;
  overallLitersPer100Km: number | null;
  // Overall mileage span & cost per distance (using total distance between first & last fill if >1 entry)
  spanDistanceKm: number;
  costPerKmPiastres: number | null;
  costPer100KmPiastres: number | null;
  costPerDisplayUnitPiastres: number | null;
  costPer100DisplayUnitsPiastres: number | null;
  // Clearly separated estimated metric if partial fills occurred between full fills
  hasInterveningPartials: boolean;
  estimatedOverallKmPerLiter: number | null;
  periods: FuelPeriodResult[];
  monthlySummaries: MonthlyFuelSummary[];
}

/**
 * Computes vehicle fuel analytics strictly following Section 22 & 22.1:
 * - Chronological sort by odometerKm then dateTime
 * - First FULL fill is baseline (no average)
 * - PARTIAL fills are included in fuel log and total cost, NEVER in exact consumption average
 * - Overall average = SUM(completed Full-to-Full distances) / SUM(corresponding liters), NOT arithmetic mean of ratios
 */
export function calculateFuelAnalytics(
  entries: FuelEntry[],
  displayUnit: OdometerUnit = 'KM'
): FuelAnalyticsSummary {
  const sorted = [...entries].sort((a, b) => {
    if (a.odometerKm !== b.odometerKm) return a.odometerKm - b.odometerKm;
    return a.dateTime.localeCompare(b.dateTime);
  });

  const periods: FuelPeriodResult[] = [];
  let lastFullEntry: FuelEntry | null = null;
  let hadPartialSinceLastFull = false;

  let completedPeriodsCount = 0;
  let completedDistanceKm = 0;
  let completedLiters = 0;

  // Track estimated (with partials summed up to next full) separately so actual vs estimated are never confused
  let estDistanceKm = 0;
  let estLiters = 0;
  let partialLitersBuffer = 0;
  let hasInterveningPartials = false;

  let totalLiters = 0;
  let totalCostPiastres = 0;
  let fullFillsCount = 0;
  let partialFillsCount = 0;

  const monthlyMap = new Map<string, MonthlyFuelSummary>();

  for (const entry of sorted) {
    totalLiters += entry.liters;
    totalCostPiastres += entry.totalCostPiastres;

    const monthKey = entry.dateTime.slice(0, 7) || 'غير محدد';
    const existingMonth = monthlyMap.get(monthKey) ?? {
      monthKey,
      liters: 0,
      totalCostPiastres: 0,
      fillsCount: 0,
    };
    existingMonth.liters += entry.liters;
    existingMonth.totalCostPiastres += entry.totalCostPiastres;
    existingMonth.fillsCount += 1;
    monthlyMap.set(monthKey, existingMonth);

    if (entry.fillType === 'PARTIAL') {
      partialFillsCount += 1;
      if (lastFullEntry !== null) {
        hadPartialSinceLastFull = true;
        hasInterveningPartials = true;
        partialLitersBuffer += entry.liters;
      }
      periods.push({
        entryId: entry.id,
        dateTime: entry.dateTime,
        odometerKm: entry.odometerKm,
        fuelType: entry.fuelType,
        liters: entry.liters,
        totalCostPiastres: entry.totalCostPiastres,
        pricePerLiterPiastres: entry.pricePerLiterPiastres,
        fillType: 'PARTIAL',
        distanceKm: null,
        kmPerLiter: null,
        litersPer100Km: null,
        isBaseline: false,
        excludedReason: 'تعبئة جزئية — تدخل في المصروف فقط ولا تدخل في متوسط الاستهلاك',
      });
      continue;
    }

    // FULL fill
    fullFillsCount += 1;

    if (lastFullEntry === null) {
      lastFullEntry = entry;
      hadPartialSinceLastFull = false;
      partialLitersBuffer = 0;
      periods.push({
        entryId: entry.id,
        dateTime: entry.dateTime,
        odometerKm: entry.odometerKm,
        fuelType: entry.fuelType,
        liters: entry.liters,
        totalCostPiastres: entry.totalCostPiastres,
        pricePerLiterPiastres: entry.pricePerLiterPiastres,
        fillType: 'FULL',
        distanceKm: null,
        kmPerLiter: null,
        litersPer100Km: null,
        isBaseline: true,
        excludedReason: 'تفويلة بداية مرجعية — لا تنتج متوسطًا',
      });
      continue;
    }

    const distanceKm = Math.max(0, entry.odometerKm - lastFullEntry.odometerKm);

    if (hadPartialSinceLastFull) {
      // Do NOT compute an exact consumption ratio when a partial fill intervened,
      // because partial fills must never distort exact Full-to-Full consumption.
      if (distanceKm > 0 && entry.liters + partialLitersBuffer > 0) {
        estDistanceKm += distanceKm;
        estLiters += entry.liters + partialLitersBuffer;
      }
      periods.push({
        entryId: entry.id,
        dateTime: entry.dateTime,
        odometerKm: entry.odometerKm,
        fuelType: entry.fuelType,
        liters: entry.liters,
        totalCostPiastres: entry.totalCostPiastres,
        pricePerLiterPiastres: entry.pricePerLiterPiastres,
        fillType: 'FULL',
        distanceKm,
        kmPerLiter: null,
        litersPer100Km: null,
        isBaseline: true,
        excludedReason: 'سبقتها تعبئة جزئية — تُعتمد كنقطة بداية جديدة للمتوسط الفعلي الدقيق',
      });
    } else if (distanceKm > 0 && entry.liters > 0) {
      const kmPerLiter = distanceKm / entry.liters;
      const litersPer100Km = (entry.liters / distanceKm) * 100;

      completedPeriodsCount += 1;
      completedDistanceKm += distanceKm;
      completedLiters += entry.liters;

      estDistanceKm += distanceKm;
      estLiters += entry.liters;

      periods.push({
        entryId: entry.id,
        dateTime: entry.dateTime,
        odometerKm: entry.odometerKm,
        fuelType: entry.fuelType,
        liters: entry.liters,
        totalCostPiastres: entry.totalCostPiastres,
        pricePerLiterPiastres: entry.pricePerLiterPiastres,
        fillType: 'FULL',
        distanceKm,
        kmPerLiter,
        litersPer100Km,
        isBaseline: false,
      });
    } else {
      periods.push({
        entryId: entry.id,
        dateTime: entry.dateTime,
        odometerKm: entry.odometerKm,
        fuelType: entry.fuelType,
        liters: entry.liters,
        totalCostPiastres: entry.totalCostPiastres,
        pricePerLiterPiastres: entry.pricePerLiterPiastres,
        fillType: 'FULL',
        distanceKm,
        kmPerLiter: null,
        litersPer100Km: null,
        isBaseline: false,
        excludedReason: 'لم تسجل مسافة موجبة عن التفويلة الكاملة السابقة',
      });
    }

    lastFullEntry = entry;
    hadPartialSinceLastFull = false;
    partialLitersBuffer = 0;
  }

  const overallKmPerLiter =
    completedDistanceKm > 0 && completedLiters > 0 ? completedDistanceKm / completedLiters : null;
  const overallLitersPer100Km =
    completedDistanceKm > 0 && completedLiters > 0 ? (completedLiters / completedDistanceKm) * 100 : null;

  const estimatedOverallKmPerLiter =
    hasInterveningPartials && estDistanceKm > 0 && estLiters > 0 ? estDistanceKm / estLiters : null;

  const spanDistanceKm =
    sorted.length >= 2 ? Math.max(0, sorted[sorted.length - 1].odometerKm - sorted[0].odometerKm) : 0;

  // Exclude the very first baseline fill cost when computing cost per distance over the span
  const spanFuelCostPiastres =
    sorted.length >= 2
      ? sorted.slice(1).reduce((sum, item) => sum + item.totalCostPiastres, 0)
      : 0;

  const costPerKmPiastres =
    spanDistanceKm > 0 ? Math.round(spanFuelCostPiastres / spanDistanceKm) : null;
  const costPer100KmPiastres =
    spanDistanceKm > 0 ? Math.round((spanFuelCostPiastres / spanDistanceKm) * 100) : null;

  const spanDisplayUnits = fromInternalKm(spanDistanceKm, displayUnit);
  const costPerDisplayUnitPiastres =
    spanDisplayUnits > 0 ? Math.round(spanFuelCostPiastres / spanDisplayUnits) : null;
  const costPer100DisplayUnitsPiastres =
    spanDisplayUnits > 0 ? Math.round((spanFuelCostPiastres / spanDisplayUnits) * 100) : null;

  const monthlySummaries = Array.from(monthlyMap.values()).sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey)
  );

  return {
    totalFills: sorted.length,
    fullFillsCount,
    partialFillsCount,
    totalLiters,
    totalCostPiastres,
    completedPeriodsCount,
    completedDistanceKm,
    completedLiters,
    overallKmPerLiter,
    overallLitersPer100Km,
    spanDistanceKm,
    costPerKmPiastres,
    costPer100KmPiastres,
    costPerDisplayUnitPiastres,
    costPer100DisplayUnitsPiastres,
    hasInterveningPartials,
    estimatedOverallKmPerLiter,
    periods,
    monthlySummaries,
  };
}

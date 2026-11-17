import type { OdometerUnit } from './types';

export const KM_PER_MILE = 1.609344;

export function toInternalKm(value: number, unit: OdometerUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  const km = unit === 'MILE' ? value * KM_PER_MILE : value;
  return Math.round(km * 1000) / 1000;
}

export function fromInternalKm(km: number, unit: OdometerUnit): number {
  if (!Number.isFinite(km)) return 0;
  const val = unit === 'MILE' ? km / KM_PER_MILE : km;
  return Math.round(val * 100) / 100;
}

export function formatDistance(km: number, unit: OdometerUnit, includeUnit = true): string {
  const converted = fromInternalKm(km, unit);
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: converted % 1 === 0 ? 0 : 1,
  }).format(converted);
  if (!includeUnit) return formatted;
  return `${formatted} ${unit === 'KM' ? 'كم (KM)' : 'ميل (Mile)'}`;
}

export function formatShortUnit(unit: OdometerUnit): string {
  return unit === 'KM' ? 'KM' : 'Mile';
}

// Exact minor-unit monetary conversions (piastres) to prevent floating-point drift
export function toPiastres(amountMajor: number | string): number {
  const num = typeof amountMajor === 'string' ? parseFloat(amountMajor.trim()) : amountMajor;
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100);
}

export function fromPiastres(piastres: number): number {
  if (!Number.isFinite(piastres)) return 0;
  return piastres / 100;
}

export function formatMoney(piastres: number, currencySymbol = 'ج.م'): string {
  const major = fromPiastres(piastres);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: major % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
  return `${formatted} ${currencySymbol}`;
}

export function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowIsoDateTime(): string {
  return new Date().toISOString().slice(0, 16);
}

export function addMonthsToDate(isoDate: string, months: number): string {
  const base = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setUTCMonth(base.getUTCMonth() + months);
  return base.toISOString().slice(0, 10);
}

export function daysBetween(fromDateIso: string, toDateIso: string): number {
  const a = new Date(`${fromDateIso.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${toDateIso.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

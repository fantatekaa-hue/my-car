import React, { useMemo, useState } from 'react';
import { BarChart3, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { calculateFuelAnalytics } from '../domain/fuelEngine';
import type { Expense, FuelEntry, OdometerEntry, Vehicle } from '../domain/types';
import { formatDistance, formatMoney, fromInternalKm } from '../domain/units';

interface VehicleReportScreenProps {
  vehicle: Vehicle;
  expenses: Expense[];
  fuelEntries: FuelEntry[];
  odometerEntries: OdometerEntry[];
  currencySymbol: string;
}

type ChartMode = 'grouped' | 'stacked' | 'trend';

interface SixMonthPoint {
  monthKey: string;
  monthLabel: string;
  fuel: number;
  maintenance: number;
  repairs: number;
  total: number;
  fuelPiastres: number;
  maintenancePiastres: number;
  repairsPiastres: number;
  totalPiastres: number;
}

const SERIES_META = [
  { key: 'fuel' as const, label: 'الوقود', color: '#0EA5E9' },
  { key: 'maintenance' as const, label: 'الصيانة', color: '#10B981' },
  { key: 'repairs' as const, label: 'الإصلاحات', color: '#F59E0B' },
];

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

function formatArabicMonthShort(yyyyMm: string): string {
  const [yStr, mStr] = yyyyMm.split('-');
  const mIdx = Number(mStr) - 1;
  const monthName = ARABIC_MONTHS[mIdx] ?? yyyyMm;
  return `${monthName} ${yStr?.slice(2) ?? ''}`.trim();
}

function getLastSixMonthKeys(expenses: Expense[]): string[] {
  const now = new Date();
  let anchorYear = now.getFullYear();
  let anchorMonth = now.getMonth() + 1;

  for (const e of expenses) {
    if (e.date.length >= 7) {
      const y = Number(e.date.slice(0, 4));
      const m = Number(e.date.slice(5, 7));
      if (Number.isFinite(y) && Number.isFinite(m) && (y > anchorYear || (y === anchorYear && m > anchorMonth))) {
        anchorYear = y;
        anchorMonth = m;
      }
    }
  }

  const keys: string[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const d = new Date(anchorYear, anchorMonth - 1 - offset, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${m}`);
  }
  return keys;
}

export const VehicleReportScreen: React.FC<VehicleReportScreenProps> = ({
  vehicle,
  expenses,
  fuelEntries,
  odometerEntries,
  currencySymbol,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [chartMode, setChartMode] = useState<ChartMode>('grouped');
  const [visibleSeries, setVisibleSeries] = useState<{
    fuel: boolean;
    maintenance: boolean;
    repairs: boolean;
  }>({
    fuel: true,
    maintenance: true,
    repairs: true,
  });

  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    for (const e of expenses) {
      if (e.date.length >= 4) yrs.add(e.date.slice(0, 4));
    }
    return Array.from(yrs).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const e of expenses) {
      if (e.date.length >= 7) months.add(e.date.slice(0, 7));
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedMonth !== 'ALL') return e.date.startsWith(selectedMonth);
      if (selectedYear !== 'ALL') return e.date.startsWith(selectedYear);
      return true;
    });
  }, [expenses, selectedMonth, selectedYear]);

  const breakdown = useMemo(() => {
    const sumBy = (types: string[]) =>
      filteredExpenses
        .filter((e) => types.includes(e.sourceType))
        .reduce((acc, e) => acc + e.amountPiastres, 0);

    const total = filteredExpenses.reduce((acc, e) => acc + e.amountPiastres, 0);
    return {
      total,
      fuel: sumBy(['FUEL']),
      maintenance: sumBy(['MAINTENANCE', 'OIL_FILTER']),
      repairs: sumBy(['FAULT_REPAIR']),
      spareParts: sumBy(['SPARE_PART']),
      additional: sumBy(['ADDITIONAL']),
    };
  }, [filteredExpenses]);

  const fuelAnalytics = useMemo(
    () => calculateFuelAnalytics(fuelEntries, vehicle.odometerUnit),
    [fuelEntries, vehicle.odometerUnit]
  );

  // Total tracked distance for this vehicle (from earliest recorded odometer/fuel reading to current)
  const trackedDistanceKm = useMemo(() => {
    const readings = [
      ...odometerEntries.map((o) => o.readingKm),
      ...fuelEntries.map((f) => f.odometerKm),
      ...(vehicle.hasOdometerReading !== false ? [vehicle.currentOdometerKm] : []),
    ];
    if (readings.length < 2) return 0;
    const minKm = Math.min(...readings);
    const maxKm = Math.max(...readings);
    return Math.max(0, maxKm - minKm);
  }, [odometerEntries, fuelEntries, vehicle.currentOdometerKm, vehicle.hasOdometerReading]);

  const trackedDisplayUnits = fromInternalKm(trackedDistanceKm, vehicle.odometerUnit);
  const operatingCostPerDisplayUnit =
    trackedDisplayUnits > 0 ? Math.round(breakdown.total / trackedDisplayUnits) : null;

  // Last 6 Months Interactive Recharts Dataset (Fuel, Maintenance, Repairs)
  const lastSixMonthsData = useMemo<SixMonthPoint[]>(() => {
    const monthKeys = getLastSixMonthKeys(expenses);
    const map = new Map<string, { fuel: number; maintenance: number; repairs: number }>();
    for (const k of monthKeys) {
      map.set(k, { fuel: 0, maintenance: 0, repairs: 0 });
    }

    for (const e of expenses) {
      const mKey = e.date.slice(0, 7);
      const bucket = map.get(mKey);
      if (!bucket) continue;
      if (e.sourceType === 'FUEL') {
        bucket.fuel += e.amountPiastres;
      } else if (e.sourceType === 'MAINTENANCE' || e.sourceType === 'OIL_FILTER') {
        bucket.maintenance += e.amountPiastres;
      } else if (e.sourceType === 'FAULT_REPAIR' || e.sourceType === 'SPARE_PART') {
        bucket.repairs += e.amountPiastres;
      }
    }

    return monthKeys.map((monthKey) => {
      const b = map.get(monthKey)!;
      const totalPiastres = b.fuel + b.maintenance + b.repairs;
      return {
        monthKey,
        monthLabel: formatArabicMonthShort(monthKey),
        fuel: Number((b.fuel / 100).toFixed(2)),
        maintenance: Number((b.maintenance / 100).toFixed(2)),
        repairs: Number((b.repairs / 100).toFixed(2)),
        total: Number((totalPiastres / 100).toFixed(2)),
        fuelPiastres: b.fuel,
        maintenancePiastres: b.maintenance,
        repairsPiastres: b.repairs,
        totalPiastres,
      };
    });
  }, [expenses]);

  const sixMonthTotals = useMemo(() => {
    const fuelPiastres = lastSixMonthsData.reduce((acc, d) => acc + d.fuelPiastres, 0);
    const maintenancePiastres = lastSixMonthsData.reduce(
      (acc, d) => acc + d.maintenancePiastres,
      0
    );
    const repairsPiastres = lastSixMonthsData.reduce((acc, d) => acc + d.repairsPiastres, 0);
    const totalPiastres = fuelPiastres + maintenancePiastres + repairsPiastres;
    const pieData = [
      { name: 'الوقود', value: Number((fuelPiastres / 100).toFixed(2)), piastres: fuelPiastres, color: '#0EA5E9' },
      {
        name: 'الصيانة',
        value: Number((maintenancePiastres / 100).toFixed(2)),
        piastres: maintenancePiastres,
        color: '#10B981',
      },
      {
        name: 'الإصلاحات',
        value: Number((repairsPiastres / 100).toFixed(2)),
        piastres: repairsPiastres,
        color: '#F59E0B',
      },
    ].filter((item) => item.piastres > 0);

    return {
      fuelPiastres,
      maintenancePiastres,
      repairsPiastres,
      totalPiastres,
      pieData,
    };
  }, [lastSixMonthsData]);

  const monthlyComparison = useMemo(() => {
    const map = new Map<
      string,
      { month: string; total: number; fuel: number; maint: number; repairs: number; additional: number }
    >();
    for (const e of expenses) {
      const m = e.date.slice(0, 7) || 'غير محدد';
      const row = map.get(m) ?? { month: m, total: 0, fuel: 0, maint: 0, repairs: 0, additional: 0 };
      row.total += e.amountPiastres;
      if (e.sourceType === 'FUEL') row.fuel += e.amountPiastres;
      else if (e.sourceType === 'MAINTENANCE' || e.sourceType === 'OIL_FILTER') row.maint += e.amountPiastres;
      else if (e.sourceType === 'FAULT_REPAIR' || e.sourceType === 'SPARE_PART') row.repairs += e.amountPiastres;
      else row.additional += e.amountPiastres;
      map.set(m, row);
    }
    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [expenses]);

  const toggleSeries = (key: 'fuel' | 'maintenance' | 'repairs') => {
    setVisibleSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.fuel && !next.maintenance && !next.repairs) return prev;
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Isolation Notice */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#262E3B] bg-[#171C24] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E11D2E] text-white">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              تقرير السيارة المستقل: {vehicle.brand} {vehicle.model} ({vehicle.year})
            </h3>
            <p className="text-xs text-slate-400">
              اللوحة: <span className="font-mono-nums">{vehicle.plateNormalized}</span> · تقرير مالي وفني خاص بهذه السيارة فقط
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setSelectedMonth('ALL');
            }}
            className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
          >
            <option value="ALL">كل السنوات</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                سنة {y}
              </option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
          >
            <option value="ALL">كل الشهور</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                شهر {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#E11D2E]/50 bg-[#171C24] p-5">
          <p className="text-xs text-slate-400">إجمالي تكلفة تشغيل السيارة</p>
          <p className="font-mono-nums mt-1 text-3xl font-bold text-[#E11D2E]">
            {formatMoney(breakdown.total, currencySymbol)}
          </p>
          <p className="font-mono-nums mt-2 text-xs text-slate-300">
            متوسط تكلفة المسافة:{' '}
            {operatingCostPerDisplayUnit !== null
              ? `${formatMoney(operatingCostPerDisplayUnit, currencySymbol)} / ${vehicle.odometerUnit}`
              : 'يتطلب مسافة مقطوعة مسجلة'}{' '}
            ({formatDistance(trackedDistanceKm, vehicle.odometerUnit)})
          </p>
        </div>

        <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-[#0EA5E9]" />
              الوقود
            </span>
            <span className="font-mono-nums font-bold text-white">
              {formatMoney(breakdown.fuel, currencySymbol)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
              الصيانة
            </span>
            <span className="font-mono-nums font-bold text-white">
              {formatMoney(breakdown.maintenance, currencySymbol)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
              الإصلاحات
            </span>
            <span className="font-mono-nums font-bold text-white">
              {formatMoney(breakdown.repairs, currencySymbol)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">قطع الغيار المنفصلة</span>
            <span className="font-mono-nums font-bold text-white">
              {formatMoney(breakdown.spareParts, currencySymbol)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">المصروفات الإضافية</span>
            <span className="font-mono-nums font-bold text-white">
              {formatMoney(breakdown.additional, currencySymbol)}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-[#262E3B] pt-2">
            <span className="text-slate-300">متوسط استهلاك الوقود</span>
            <span className="font-mono-nums font-bold text-emerald-400">
              {fuelAnalytics.overallKmPerLiter !== null
                ? `${fuelAnalytics.overallKmPerLiter.toFixed(2)} كم/لتر`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Recharts Section — Last 6 Months Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 6-Month Bar / Trend Chart */}
        <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262E3B] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  توزيع المصروفات خلال الـ 6 أشهر الماضية
                </h4>
                <p className="text-xs text-slate-400">
                  اضغط على التصنيفات بالأسفل لإظهار أو إخفاء أي بند · مرّر للمعاينة التفاعلية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-[#262E3B] bg-[#0D1015] p-1">
              {[
                { id: 'grouped' as ChartMode, label: 'متجاورة' },
                { id: 'stacked' as ChartMode, label: 'مجمّعة' },
                { id: 'trend' as ChartMode, label: 'اتجاه' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setChartMode(m.id)}
                  className={`min-h-[34px] rounded-lg px-3 text-xs font-bold transition-colors ${
                    chartMode === m.id
                      ? 'bg-[#E11D2E] text-white'
                      : 'text-slate-300 hover:bg-[#1D232E]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Legend Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {SERIES_META.map((item) => {
              const active = visibleSeries[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleSeries(item.key)}
                  className={`flex min-h-[36px] items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-all ${
                    active
                      ? 'border-[#262E3B] bg-[#0D1015] text-white'
                      : 'border-[#262E3B]/60 bg-[#0D1015]/40 text-slate-500 opacity-60'
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="h-[290px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'trend' ? (
                <AreaChart
                  data={lastSixMonthsData}
                  margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="maintGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="repairGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262E3B" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0].payload as SixMonthPoint;
                      return (
                        <div
                          dir="rtl"
                          className="rounded-xl border border-[#262E3B] bg-[#171C24] p-3 shadow-xl text-xs space-y-1.5"
                        >
                          <p className="font-bold text-white border-b border-[#262E3B] pb-1">
                            {pt.monthLabel} ({pt.monthKey})
                          </p>
                          {visibleSeries.fuel && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sky-400 font-semibold">الوقود</span>
                              <span className="font-mono-nums text-white">
                                {formatMoney(pt.fuelPiastres, currencySymbol)}
                              </span>
                            </div>
                          )}
                          {visibleSeries.maintenance && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-emerald-400 font-semibold">الصيانة</span>
                              <span className="font-mono-nums text-white">
                                {formatMoney(pt.maintenancePiastres, currencySymbol)}
                              </span>
                            </div>
                          )}
                          {visibleSeries.repairs && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-amber-400 font-semibold">الإصلاحات</span>
                              <span className="font-mono-nums text-white">
                                {formatMoney(pt.repairsPiastres, currencySymbol)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-4 border-t border-[#262E3B] pt-1">
                            <span className="font-bold text-slate-300">الإجمالي</span>
                            <span className="font-mono-nums text-[#E11D2E]">
                              {formatMoney(pt.totalPiastres, currencySymbol)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {visibleSeries.fuel && (
                    <Area
                      type="monotone"
                      dataKey="fuel"
                      name="الوقود"
                      stroke="#0EA5E9"
                      strokeWidth={2.5}
                      fill="url(#fuelGrad)"
                    />
                  )}
                  {visibleSeries.maintenance && (
                    <Area
                      type="monotone"
                      dataKey="maintenance"
                      name="الصيانة"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fill="url(#maintGrad)"
                    />
                  )}
                  {visibleSeries.repairs && (
                    <Area
                      type="monotone"
                      dataKey="repairs"
                      name="الإصلاحات"
                      stroke="#F59E0B"
                      strokeWidth={2.5}
                      fill="url(#repairGrad)"
                    />
                  )}
                </AreaChart>
              ) : (
                <BarChart
                  data={lastSixMonthsData}
                  margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#262E3B" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0].payload as SixMonthPoint;
                      return (
                        <div
                          dir="rtl"
                          className="rounded-xl border border-[#262E3B] bg-[#171C24] p-3 shadow-xl text-xs space-y-1.5"
                        >
                          <p className="font-bold text-white border-b border-[#262E3B] pb-1">
                            {pt.monthLabel} ({pt.monthKey})
                          </p>
                          {visibleSeries.fuel && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sky-400 font-semibold">الوقود</span>
                              <span className="font-mono-nums text-white">
                                {formatMoney(pt.fuelPiastres, currencySymbol)}
                              </span>
                            </div>
                          )}
                          {visibleSeries.maintenance && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-emerald-400 font-semibold">الصيانة</span>
                              <span className="font-mono-nums text-white">
                                {formatMoney(pt.maintenancePiastres, currencySymbol)}
                              </span>
                            </div>
                          )}
                          {visibleSeries.repairs && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-amber-400 font-semibold">الإصلاحات</span>
                              <span className="font-mono-nums text-white">
                                {formatMoney(pt.repairsPiastres, currencySymbol)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-4 border-t border-[#262E3B] pt-1">
                            <span className="font-bold text-slate-300">الإجمالي</span>
                            <span className="font-mono-nums text-[#E11D2E]">
                              {formatMoney(pt.totalPiastres, currencySymbol)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {visibleSeries.fuel && (
                    <Bar
                      dataKey="fuel"
                      name="الوقود"
                      stackId={chartMode === 'stacked' ? 'total' : undefined}
                      fill="#0EA5E9"
                      radius={chartMode === 'stacked' ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                    />
                  )}
                  {visibleSeries.maintenance && (
                    <Bar
                      dataKey="maintenance"
                      name="الصيانة"
                      stackId={chartMode === 'stacked' ? 'total' : undefined}
                      fill="#10B981"
                      radius={chartMode === 'stacked' ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                    />
                  )}
                  {visibleSeries.repairs && (
                    <Bar
                      dataKey="repairs"
                      name="الإصلاحات"
                      stackId={chartMode === 'stacked' ? 'total' : undefined}
                      fill="#F59E0B"
                      radius={chartMode === 'stacked' ? [6, 6, 0, 0] : [6, 6, 0, 0]}
                    />
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6-Month Category Share Donut Chart */}
        <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 lg:col-span-4 flex flex-col justify-between space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#262E3B] pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <PieChartIcon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">نسب التوزيع (6 أشهر)</h4>
              <p className="text-xs text-slate-400">وقود · صيانة · إصلاحات</p>
            </div>
          </div>

          {sixMonthTotals.totalPiastres === 0 ? (
            <div className="flex flex-1 items-center justify-center py-10 text-center text-xs text-slate-400">
              سجّل مصروفات وقود أو صيانة أو إصلاحات لعرض نسب التوزيع التفاعلية للـ 6 أشهر الأخيرة.
            </div>
          ) : (
            <>
              <div className="relative h-[200px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sixMonthTotals.pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {sixMonthTotals.pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload as {
                          name: string;
                          piastres: number;
                          color: string;
                        };
                        const pct =
                          sixMonthTotals.totalPiastres > 0
                            ? Math.round((item.piastres / sixMonthTotals.totalPiastres) * 100)
                            : 0;
                        return (
                          <div
                            dir="rtl"
                            className="rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2 shadow-xl text-xs"
                          >
                            <p className="font-bold text-white">{item.name}</p>
                            <p className="font-mono-nums text-[#E11D2E]">
                              {formatMoney(item.piastres, currencySymbol)} ({pct}%)
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-semibold text-slate-400">إجمالي 6 أشهر</span>
                  <span className="font-mono-nums text-sm font-bold text-white">
                    {formatMoney(sixMonthTotals.totalPiastres, currencySymbol)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  {
                    label: 'الوقود',
                    piastres: sixMonthTotals.fuelPiastres,
                    color: '#0EA5E9',
                  },
                  {
                    label: 'الصيانة',
                    piastres: sixMonthTotals.maintenancePiastres,
                    color: '#10B981',
                  },
                  {
                    label: 'الإصلاحات',
                    piastres: sixMonthTotals.repairsPiastres,
                    color: '#F59E0B',
                  },
                ].map((cat) => {
                  const pct =
                    sixMonthTotals.totalPiastres > 0
                      ? Math.round((cat.piastres / sixMonthTotals.totalPiastres) * 100)
                      : 0;
                  return (
                    <div
                      key={cat.label}
                      className="flex items-center justify-between rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs"
                    >
                      <span className="flex items-center gap-2 font-bold text-slate-200">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.label}
                      </span>
                      <span className="font-mono-nums text-white">
                        {formatMoney(cat.piastres, currencySymbol)}{' '}
                        <span className="text-slate-400">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Month-over-Month Comparison */}
      <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5">
        <h4 className="text-base font-bold text-white">مقارنة الأشهر (هذه السيارة فقط)</h4>
        {monthlyComparison.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">لا توجد مصروفات مسجلة بعد.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#262E3B] text-slate-400">
                  <th className="py-2 font-semibold">الشهر</th>
                  <th className="py-2 font-semibold">الوقود</th>
                  <th className="py-2 font-semibold">الصيانة</th>
                  <th className="py-2 font-semibold">الإصلاحات والقطع</th>
                  <th className="py-2 font-semibold">الإضافية</th>
                  <th className="py-2 font-semibold">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {monthlyComparison.map((row) => (
                  <tr key={row.month} className="border-b border-[#262E3B]/60">
                    <td className="font-mono-nums py-2.5 font-bold text-white">{row.month}</td>
                    <td className="font-mono-nums py-2.5 text-slate-300">
                      {formatMoney(row.fuel, currencySymbol)}
                    </td>
                    <td className="font-mono-nums py-2.5 text-slate-300">
                      {formatMoney(row.maint, currencySymbol)}
                    </td>
                    <td className="font-mono-nums py-2.5 text-slate-300">
                      {formatMoney(row.repairs, currencySymbol)}
                    </td>
                    <td className="font-mono-nums py-2.5 text-slate-300">
                      {formatMoney(row.additional, currencySymbol)}
                    </td>
                    <td className="font-mono-nums py-2.5 font-bold text-[#E11D2E]">
                      {formatMoney(row.total, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

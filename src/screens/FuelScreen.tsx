import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Fuel } from 'lucide-react';
import { calculateFuelAnalytics } from '../domain/fuelEngine';
import type { FillType, FuelEntry, Vehicle } from '../domain/types';
import {
  formatDistance,
  formatMoney,
  fromInternalKm,
  nowIsoDateTime,
  toInternalKm,
  toPiastres,
} from '../domain/units';

interface FuelScreenProps {
  vehicle: Vehicle;
  fuelEntries: FuelEntry[];
  customFuelTypes: string[];
  currencySymbol: string;
  onAddFuel: (input: {
    vehicleId: string;
    dateTime: string;
    odometerKm: number;
    fuelType: string;
    liters: number;
    totalCostPiastres: number;
    fillType: FillType;
    notes?: string;
  }) => Promise<void>;
}

export const FuelScreen: React.FC<FuelScreenProps> = ({
  vehicle,
  fuelEntries,
  customFuelTypes,
  currencySymbol,
  onAddFuel,
}) => {
  const analytics = useMemo(
    () => calculateFuelAnalytics(fuelEntries, vehicle.odometerUnit),
    [fuelEntries, vehicle.odometerUnit]
  );

  const allFuelTypes = useMemo(
    () => Array.from(new Set(['80', '92', '95', 'سولار', ...customFuelTypes])),
    [customFuelTypes]
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fuelType, setFuelType] = useState('92');
  const [customFuelInput, setCustomFuelInput] = useState('');
  const [useCustomFuel, setUseCustomFuel] = useState(false);
  const [fillType, setFillType] = useState<FillType>('FULL');
  const [dateTime, setDateTime] = useState(nowIsoDateTime());
  const [odometerInput, setOdometerInput] = useState(
    vehicle.hasOdometerReading !== false
      ? String(Math.round(fromInternalKm(vehicle.currentOdometerKm, vehicle.odometerUnit)))
      : ''
  );
  const [litersInput, setLitersInput] = useState('');
  const [totalCostInput, setTotalCostInput] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chosenFuel = useCustomFuel ? customFuelInput.trim() : fuelType;
  const litersVal = parseFloat(litersInput);
  const costVal = parseFloat(totalCostInput);
  const previewPricePerLiter =
    Number.isFinite(litersVal) && litersVal > 0 && Number.isFinite(costVal) && costVal >= 0
      ? Math.round(toPiastres(costVal) / litersVal)
      : null;

  const goToStep = (target: 1 | 2 | 3) => {
    setError(null);
    setStep(target);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  };

  const handleNextStep = () => {
    setError(null);
    if (step === 1) {
      if (!chosenFuel) {
        setError('يرجى تحديد نوع الوقود.');
        return;
      }
      const odoVal = parseFloat(odometerInput);
      if (!Number.isFinite(odoVal) || odoVal < 0) {
        setError('قراءة العداد غير صالحة.');
        return;
      }
      goToStep(2);
      return;
    }

    if (step === 2) {
      if (!Number.isFinite(litersVal) || litersVal <= 0) {
        setError('كمية اللترات يجب أن تكون أكبر من صفر.');
        return;
      }
      if (!Number.isFinite(costVal) || costVal < 0) {
        setError('المبلغ الإجمالي غير صالح.');
        return;
      }
      goToStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      handleNextStep();
      return;
    }

    setError(null);
    const odoVal = parseFloat(odometerInput);

    if (!chosenFuel) {
      goToStep(1);
      setError('يرجى تحديد نوع الوقود.');
      return;
    }
    if (!Number.isFinite(odoVal) || odoVal < 0) {
      goToStep(1);
      setError('قراءة العداد غير صالحة.');
      return;
    }
    if (!Number.isFinite(litersVal) || litersVal <= 0) {
      goToStep(2);
      setError('كمية اللترات يجب أن تكون أكبر من صفر.');
      return;
    }
    if (!Number.isFinite(costVal) || costVal < 0) {
      goToStep(2);
      setError('المبلغ الإجمالي غير صالح.');
      return;
    }

    setSaving(true);
    try {
      await onAddFuel({
        vehicleId: vehicle.id,
        dateTime,
        odometerKm: toInternalKm(odoVal, vehicle.odometerUnit),
        fuelType: chosenFuel,
        liters: litersVal,
        totalCostPiastres: toPiastres(costVal),
        fillType,
        notes: notes.trim() || undefined,
      });
      setLitersInput('');
      setTotalCostInput('');
      setNotes('');
      setUseCustomFuel(false);
      setCustomFuelInput('');
      goToStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ تعبئة الوقود.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Compact KPI Overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-3.5 sm:p-4">
          <p className="text-[11px] sm:text-xs text-slate-400">المتوسط العام الفعلي (Full-to-Full)</p>
          <p className="font-mono-nums mt-1 text-lg sm:text-2xl font-bold text-white">
            {analytics.overallKmPerLiter !== null
              ? `${analytics.overallKmPerLiter.toFixed(2)} كم/لتر`
              : '—'}
          </p>
          <p className="font-mono-nums mt-1 text-[11px] sm:text-xs text-slate-400">
            {analytics.overallLitersPer100Km !== null
              ? `${analytics.overallLitersPer100Km.toFixed(2)} لتر / 100 كم · (${analytics.completedPeriodsCount} فترة مكتملة)`
              : 'يتطلب تفويلتين كاملتين متتاليتين بدون جزئية'}
          </p>
        </div>

        <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-3.5 sm:p-4">
          <p className="text-[11px] sm:text-xs text-slate-400">
            متوسط تكلفة {vehicle.odometerUnit === 'KM' ? 'الكيلومتر / 100 كم' : 'الميل / 100 ميل'}
          </p>
          <p className="font-mono-nums mt-1 text-lg sm:text-2xl font-bold text-white">
            {analytics.costPerDisplayUnitPiastres !== null
              ? formatMoney(analytics.costPerDisplayUnitPiastres, currencySymbol)
              : '—'}
          </p>
          <p className="font-mono-nums mt-1 text-[11px] sm:text-xs text-slate-400">
            {analytics.costPer100DisplayUnitsPiastres !== null
              ? `كل 100 ${vehicle.odometerUnit}: ${formatMoney(analytics.costPer100DisplayUnitsPiastres, currencySymbol)}`
              : 'بانتظار تسجيل مسافة بين تعبئتين'}
          </p>
        </div>

        <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-3.5 sm:p-4">
          <p className="text-[11px] sm:text-xs text-slate-400">إجمالي اللترات والمصروف</p>
          <p className="font-mono-nums mt-1 text-lg sm:text-2xl font-bold text-[#E11D2E]">
            {formatMoney(analytics.totalCostPiastres, currencySymbol)}
          </p>
          <p className="font-mono-nums mt-1 text-[11px] sm:text-xs text-slate-400">
            {analytics.totalLiters.toFixed(1)} لتر ({analytics.fullFillsCount} كاملة ·{' '}
            {analytics.partialFillsCount} جزئية)
          </p>
        </div>

        <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-3.5 sm:p-4">
          <p className="text-[11px] sm:text-xs text-slate-400">التمييز بين الفعلي والتقديري</p>
          <p className="font-mono-nums mt-1 text-sm sm:text-lg font-bold text-slate-200">
            {analytics.hasInterveningPartials && analytics.estimatedOverallKmPerLiter !== null
              ? `تقديري (شامل الجزئي): ${analytics.estimatedOverallKmPerLiter.toFixed(2)} كم/لتر`
              : 'فعلي صافي 100%'}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-400">
            التعبئة الجزئية تدخل في المصروف فقط ولا تدخل في المتوسط الدقيق.
          </p>
        </div>
      </div>

      {/* Step-by-Step Fuel Wizard + History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-4 lg:col-span-6"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#262E3B] pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E11D2E] text-white shrink-0">
                <Fuel className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">تسجيل تعبئة وقود جديدة</h3>
                <p className="text-xs text-slate-400">
                  الخطوة {step} من 3 —{' '}
                  {step === 1
                    ? 'النوع والعداد'
                    : step === 2
                    ? 'الكمية والتكلفة'
                    : 'المراجعة والحفظ'}
                </p>
              </div>
            </div>
            <span className="font-mono-nums rounded-lg border border-[#262E3B] bg-[#0D1015] px-2.5 py-1 text-xs font-bold text-slate-300">
              {step} / 3
            </span>
          </div>

          {/* 3-Step Bar */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 1 as const, label: 'النوع والعداد' },
              { id: 2 as const, label: 'الكمية والتكلفة' },
              { id: 3 as const, label: 'المراجعة والحفظ' },
            ].map((s) => {
              const active = step === s.id;
              const done = step > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={s.id > step}
                  onClick={() => {
                    if (s.id <= step) goToStep(s.id);
                  }}
                  className={`min-h-[42px] rounded-xl border px-2 py-1.5 text-center transition-colors ${
                    active
                      ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                      : done
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : 'border-[#262E3B] bg-[#0D1015] text-slate-500 opacity-75'
                  }`}
                >
                  <span className="block font-mono-nums text-[10px] font-bold">0{s.id}</span>
                  <span className="block text-[10px] font-bold leading-tight">{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* STEP 1: Fill Type, Fuel Grade, Date & Odometer */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">نوع التعبئة</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFillType('FULL')}
                    className={`min-h-[44px] rounded-xl border text-xs font-bold ${
                      fillType === 'FULL'
                        ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                        : 'border-[#262E3B] bg-[#0D1015] text-slate-300'
                    }`}
                  >
                    تفويلة كاملة (Full)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFillType('PARTIAL')}
                    className={`min-h-[44px] rounded-xl border text-xs font-bold ${
                      fillType === 'PARTIAL'
                        ? 'border-amber-500 bg-amber-500 text-slate-950'
                        : 'border-[#262E3B] bg-[#0D1015] text-slate-300'
                    }`}
                  >
                    تعبئة جزئية (Partial)
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">نوع الوقود</label>
                  <button
                    type="button"
                    onClick={() => setUseCustomFuel((v) => !v)}
                    className="text-xs font-semibold text-[#E11D2E] hover:underline"
                  >
                    {useCustomFuel ? 'اختيار من القائمة' : '+ نوع وقود مخصص'}
                  </button>
                </div>
                {useCustomFuel ? (
                  <input
                    type="text"
                    value={customFuelInput}
                    onChange={(e) => setCustomFuelInput(e.target.value)}
                    placeholder="مثال: غاز طبيعي"
                    className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allFuelTypes.map((ft) => (
                      <button
                        key={ft}
                        type="button"
                        onClick={() => setFuelType(ft)}
                        className={`min-h-[42px] rounded-xl border px-4 text-xs font-bold ${
                          fuelType === ft
                            ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                            : 'border-[#262E3B] bg-[#0D1015] text-slate-300'
                        }`}
                      >
                        {ft}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">التاريخ والوقت</label>
                  <input
                    type="datetime-local"
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-xs text-white focus:border-[#E11D2E] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    قراءة العداد ({vehicle.odometerUnit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={odometerInput}
                    onChange={(e) => setOdometerInput(e.target.value)}
                    className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Liters & Total Cost */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#262E3B] bg-[#0D1015] px-3.5 py-2.5">
                <div className="text-xs text-slate-300">
                  <strong className="text-white">
                    {fillType === 'FULL' ? 'تفويلة كاملة' : 'تعبئة جزئية'} · وقود {chosenFuel}
                  </strong>
                  <span className="font-mono-nums block text-[11px] text-slate-400">
                    عداد {odometerInput} {vehicle.odometerUnit} · {dateTime.replace('T', ' ')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="text-xs font-bold text-[#E11D2E] hover:underline shrink-0"
                >
                  تعديل
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">اللترات</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={litersInput}
                    onChange={(e) => setLitersInput(e.target.value)}
                    placeholder="مثال: 40"
                    className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    المبلغ الإجمالي ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalCostInput}
                    onChange={(e) => setTotalCostInput(e.target.value)}
                    placeholder="مثال: 600"
                    className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                    required
                  />
                </div>
              </div>

              {previewPricePerLiter !== null && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  سعر اللتر المحسوب (يُحفظ تاريخيًا):{' '}
                  <strong className="font-mono-nums">
                    {formatMoney(previewPricePerLiter, currencySymbol)}
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Review, Notes & Save */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">
                    {fillType === 'FULL' ? 'تفويلة كاملة (Full)' : 'تعبئة جزئية (Partial)'} — وقود{' '}
                    {chosenFuel}
                  </span>
                  <span className="font-mono-nums font-bold text-[#E11D2E]">
                    {formatMoney(toPiastres(costVal || 0), currencySymbol)}
                  </span>
                </div>
                <div className="font-mono-nums flex flex-wrap gap-x-4 gap-y-1 text-slate-400">
                  <span>{dateTime.replace('T', ' ')}</span>
                  <span>
                    العداد: {odometerInput} {vehicle.odometerUnit}
                  </span>
                  <span>{litersVal} لتر</span>
                  {previewPricePerLiter !== null && (
                    <span className="text-emerald-400 font-bold">
                      سعر اللتر: {formatMoney(previewPricePerLiter, currencySymbol)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  تُضاف تلقائيًا إلى سجل المصروفات دون تكرار.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">ملاحظات (اختياري)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: محطة وطنية أو طريق السفر"
                  className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[#262E3B] pt-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => goToStep((step - 1) as 1 | 2)}
                className="flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[#262E3B] bg-[#0D1015] px-4 text-xs font-bold text-slate-300 hover:border-[#E11D2E]"
              >
                <ArrowRight className="h-4 w-4" />
                <span>السابق</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">البيانات مقسمة لسهولة الإدخال</span>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex min-h-[46px] flex-1 max-w-[230px] items-center justify-center gap-2 rounded-xl bg-[#E11D2E] px-5 text-sm font-bold text-white hover:bg-[#C81625]"
              >
                <span>{step === 1 ? 'التالي: الكمية والتكلفة' : 'التالي: المراجعة والحفظ'}</span>
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="flex min-h-[46px] flex-1 max-w-[230px] items-center justify-center gap-2 rounded-xl bg-[#E11D2E] px-5 text-sm font-bold text-white hover:bg-[#C81625] disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{saving ? 'جارٍ الحفظ...' : 'حفظ التعبئة'}</span>
              </button>
            )}
          </div>
        </form>

        <div className="space-y-6 lg:col-span-6">
          {/* Monthly Comparison */}
          <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5">
            <h3 className="text-base font-bold text-white">الملخص الشهري والمقارنة</h3>
            {analytics.monthlySummaries.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">لا توجد تعبئات مسجلة لهذه السيارة بعد.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-[#262E3B] text-slate-400">
                      <th className="py-2 font-semibold">الشهر</th>
                      <th className="py-2 font-semibold">عدد التعبئات</th>
                      <th className="py-2 font-semibold">اللترات</th>
                      <th className="py-2 font-semibold">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.monthlySummaries.map((m) => (
                      <tr key={m.monthKey} className="border-b border-[#262E3B]/60">
                        <td className="font-mono-nums py-2.5 font-semibold text-white">{m.monthKey}</td>
                        <td className="font-mono-nums py-2.5 text-slate-300">{m.fillsCount}</td>
                        <td className="font-mono-nums py-2.5 text-slate-300">{m.liters.toFixed(1)} لتر</td>
                        <td className="font-mono-nums py-2.5 font-bold text-[#E11D2E]">
                          {formatMoney(m.totalCostPiastres, currencySymbol)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Fuel Log */}
          <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5">
            <h3 className="text-base font-bold text-white">سجل التعبئات ({analytics.periods.length})</h3>
            <div className="mt-3 space-y-3">
              {[...analytics.periods].reverse().map((p) => (
                <div
                  key={p.entryId}
                  className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <span>وقود {p.fuelType}</span>
                      <span className="text-slate-500">·</span>
                      <span className={p.fillType === 'FULL' ? 'text-emerald-400' : 'text-amber-400'}>
                        {p.fillType === 'FULL' ? 'تفويلة كاملة' : 'تعبئة جزئية'}
                      </span>
                    </div>
                    <span className="font-mono-nums text-sm font-bold text-[#E11D2E]">
                      {formatMoney(p.totalCostPiastres, currencySymbol)}
                    </span>
                  </div>
                  <div className="font-mono-nums mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>{p.dateTime.replace('T', ' ')}</span>
                    <span>العداد: {formatDistance(p.odometerKm, vehicle.odometerUnit)}</span>
                    <span>{p.liters} لتر</span>
                    <span>سعر اللتر التاريخي: {formatMoney(p.pricePerLiterPiastres, currencySymbol)}</span>
                  </div>
                  {p.kmPerLiter !== null ? (
                    <p className="font-mono-nums mt-2 text-xs font-bold text-emerald-400">
                      فعلي: {p.kmPerLiter.toFixed(2)} كم/لتر ({p.litersPer100Km?.toFixed(2)} لتر/100 كم) · مسافة الفترة:{' '}
                      {formatDistance(p.distanceKm ?? 0, vehicle.odometerUnit)}
                    </p>
                  ) : (
                    p.excludedReason && (
                      <p className="mt-1.5 text-xs text-slate-400">{p.excludedReason}</p>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

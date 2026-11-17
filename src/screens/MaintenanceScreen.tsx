import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Wrench } from 'lucide-react';
import type {
  ConditionStatus,
  MaintenanceRecord,
  MaintenanceType,
  MaintenanceTypeCode,
  ScheduleSource,
  Vehicle,
} from '../domain/types';
import {
  addMonthsToDate,
  daysBetween,
  formatDistance,
  formatMoney,
  fromInternalKm,
  toInternalKm,
  todayIsoDate,
  toPiastres,
} from '../domain/units';

interface MaintenanceScreenProps {
  mode?: 'ENGINE_OIL' | 'GENERAL';
  vehicle: Vehicle;
  maintenanceTypes: MaintenanceType[];
  maintenanceRecords: MaintenanceRecord[];
  currencySymbol: string;
  onSaveRecord: (
    input: Omit<MaintenanceRecord, 'id' | 'createdAt'> & {
      oilFilterIntervalKm?: number;
      oilFilterBrand?: string;
    }
  ) => Promise<void>;
  onAddCustomType: (name: string, description?: string) => Promise<MaintenanceType>;
}

const MAINTENANCE_ORDER_RANK: Record<MaintenanceTypeCode, number> = {
  ENGINE_OIL: 0,
  OIL_FILTER: 1,
  AIR_FILTER: 2,
  AC_FILTER: 3,
  BRAKE_PADS: 4,
  SPARK_PLUGS: 5,
  BATTERY: 6,
  BELTS: 7,
  SUSPENSION: 8,
  TRANSMISSION_OIL: 9,
  CUSTOM: 10,
  COOLANT: 11,
  AC_FREON: 12,
};

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  mode = 'GENERAL',
  vehicle,
  maintenanceTypes,
  maintenanceRecords,
  currencySymbol,
  onSaveRecord,
  onAddCustomType,
}) => {
  const visibleTypes = useMemo(() => {
    const filtered = maintenanceTypes.filter((t) =>
      mode === 'ENGINE_OIL'
        ? t.code === 'ENGINE_OIL' || t.code === 'OIL_FILTER'
        : t.code !== 'ENGINE_OIL' && t.code !== 'OIL_FILTER'
    );
    return [...filtered].sort(
      (a, b) => (MAINTENANCE_ORDER_RANK[a.code] ?? 99) - (MAINTENANCE_ORDER_RANK[b.code] ?? 99)
    );
  }, [maintenanceTypes, mode]);

  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    visibleTypes[0]?.id ?? ''
  );

  const selectedType = useMemo(
    () => visibleTypes.find((t) => t.id === selectedTypeId) ?? visibleTypes[0],
    [visibleTypes, selectedTypeId]
  );

  const [date, setDate] = useState(todayIsoDate());
  const [odometerInput, setOdometerInput] = useState(
    vehicle.hasOdometerReading !== false
      ? String(Math.round(fromInternalKm(vehicle.currentOdometerKm, vehicle.odometerUnit)))
      : ''
  );
  const [costInput, setCostInput] = useState('');
  const [brandOrType, setBrandOrType] = useState('');
  const [viscosity, setViscosity] = useState('');
  const [quantity, setQuantity] = useState('');
  const [intervalDistance, setIntervalDistance] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [scheduleSource, setScheduleSource] = useState<ScheduleSource>('MANUAL');
  const [sourceLabel, setSourceLabel] = useState('');
  const [oilFilterChanged, setOilFilterChanged] = useState(false);
  const [oilFilterCostInput, setOilFilterCostInput] = useState('');
  const [oilFilterIntervalInput, setOilFilterIntervalInput] = useState('');
  const [beltKind, setBeltKind] = useState('سير كاتينة');
  const [conditionStatus, setConditionStatus] = useState<ConditionStatus>('GOOD');
  const [batteryCapacityAh, setBatteryCapacityAh] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [suspensionPart, setSuspensionPart] = useState('');
  const [mechanicOrCenter, setMechanicOrCenter] = useState('');
  const [notes, setNotes] = useState('');

  // Custom item creation
  const [showCustomCreator, setShowCustomCreator] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const typeCode: MaintenanceTypeCode = selectedType?.code ?? 'ENGINE_OIL';

  const isOilRelated = typeCode === 'ENGINE_OIL' || typeCode === 'OIL_FILTER';

  const goToStep = (target: 1 | 2 | 3) => {
    setError(null);
    setStep(target);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  // Live preview of next change odometer reading & date
  const parsedOdoNum = parseFloat(odometerInput);
  const parsedDistNum = parseFloat(intervalDistance);
  const parsedMonthsNum = typeCode === 'ENGINE_OIL' ? 12 : parseInt(intervalMonths, 10);

  // Oil & Oil filter ratings are always entered in KM; auto-convert to Mile if vehicle uses MILE
  const intervalConvertedToOdoUnit =
    Number.isFinite(parsedDistNum) && parsedDistNum > 0
      ? isOilRelated
        ? fromInternalKm(parsedDistNum, vehicle.odometerUnit)
        : parsedDistNum
      : null;

  const previewNextOdo =
    Number.isFinite(parsedOdoNum) && parsedOdoNum >= 0 && intervalConvertedToOdoUnit !== null
      ? Math.round(parsedOdoNum + intervalConvertedToOdoUnit)
      : null;
  const previewNextDate =
    date && Number.isFinite(parsedMonthsNum) && parsedMonthsNum > 0
      ? addMonthsToDate(date, parsedMonthsNum)
      : null;

  // Detect AC Freon repeat charge within 30 days (Section 18)
  const freonLeakWarning = useMemo(() => {
    const freon = maintenanceRecords
      .filter((r) => r.typeCode === 'AC_FREON')
      .sort((a, b) => a.date.localeCompare(b.date));
    if (freon.length < 2) return null;
    const prev = freon[freon.length - 2];
    const latest = freon[freon.length - 1];
    const gap = daysBetween(prev.date, latest.date);
    return gap >= 0 && gap <= 30 ? gap : null;
  }, [maintenanceRecords]);

  const handleCreateCustomType = async () => {
    if (!customName.trim()) return;
    const created = await onAddCustomType(customName.trim(), customDesc.trim() || undefined);
    setSelectedTypeId(created.id);
    setCustomName('');
    setCustomDesc('');
    setShowCustomCreator(false);
  };

  const handleNextStep = () => {
    setError(null);
    if (step === 1) {
      if (!selectedType) {
        setError('يرجى اختيار بند الصيانة أولًا.');
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
      goToStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      handleNextStep();
      return;
    }
    if (!selectedType) return;
    setError(null);

    const odoVal = parseFloat(odometerInput);
    if (!Number.isFinite(odoVal) || odoVal < 0) {
      goToStep(1);
      setError('قراءة العداد غير صالحة.');
      return;
    }

    const isOilRelatedSubmit = typeCode === 'ENGINE_OIL' || typeCode === 'OIL_FILTER';
    const odoKm = toInternalKm(odoVal, vehicle.odometerUnit);
    const intervalVal = parseFloat(intervalDistance);
    const intervalKm =
      Number.isFinite(intervalVal) && intervalVal > 0
        ? isOilRelatedSubmit
          ? intervalVal
          : toInternalKm(intervalVal, vehicle.odometerUnit)
        : undefined;
    const monthsVal = typeCode === 'ENGINE_OIL' ? 12 : parseInt(intervalMonths, 10);
    const validMonths = Number.isFinite(monthsVal) && monthsVal > 0 ? monthsVal : undefined;

    const isInspectionOnly =
      typeCode === 'BRAKE_PADS' || typeCode === 'SUSPENSION' || typeCode === 'AC_FREON';

    const wMonths = parseInt(warrantyMonths, 10);
    const warrantyExpiryDate =
      typeCode === 'BATTERY' && Number.isFinite(wMonths) && wMonths > 0
        ? addMonthsToDate(date, wMonths)
        : undefined;

    const filterIntervalVal = parseFloat(oilFilterIntervalInput);
    const filterIntervalKm =
      Number.isFinite(filterIntervalVal) && filterIntervalVal > 0
        ? filterIntervalVal
        : intervalKm;

    setSaving(true);
    try {
      await onSaveRecord({
        vehicleId: vehicle.id,
        maintenanceTypeId: selectedType.id,
        typeCode,
        customName: selectedType.isCustom ? selectedType.name : undefined,
        date,
        odometerKm: odoKm,
        costPiastres: toPiastres(costInput || '0'),
        brandOrType: typeCode === 'OIL_FILTER' ? undefined : brandOrType.trim() || undefined,
        viscosity: typeCode === 'ENGINE_OIL' ? viscosity.trim() || undefined : undefined,
        quantity:
          typeCode === 'TRANSMISSION_OIL' || typeCode === 'AC_FREON'
            ? quantity.trim() || undefined
            : undefined,
        intervalKm,
        intervalMonths: validMonths,
        nextDueKm: intervalKm !== undefined ? odoKm + intervalKm : undefined,
        nextDueDate: validMonths !== undefined ? addMonthsToDate(date, validMonths) : undefined,
        scheduleSource: isInspectionOnly ? 'INSPECTION_ONLY' : scheduleSource,
        sourceLabel: sourceLabel.trim() || undefined,
        oilFilterChanged: typeCode === 'ENGINE_OIL' ? oilFilterChanged : undefined,
        oilFilterCostPiastres:
          typeCode === 'ENGINE_OIL' && oilFilterChanged
            ? toPiastres(oilFilterCostInput || '0')
            : undefined,
        oilFilterIntervalKm:
          typeCode === 'ENGINE_OIL' && oilFilterChanged ? filterIntervalKm : undefined,
        beltKind: typeCode === 'BELTS' ? beltKind : undefined,
        conditionStatus:
          typeCode === 'BRAKE_PADS' || typeCode === 'BATTERY' || typeCode === 'SUSPENSION'
            ? conditionStatus
            : undefined,
        batteryCapacityAh:
          typeCode === 'BATTERY' && parseInt(batteryCapacityAh, 10) > 0
            ? parseInt(batteryCapacityAh, 10)
            : undefined,
        warrantyMonths: typeCode === 'BATTERY' && Number.isFinite(wMonths) ? wMonths : undefined,
        warrantyExpiryDate,
        suspensionPart: typeCode === 'SUSPENSION' ? suspensionPart.trim() || undefined : undefined,
        mechanicOrCenter: mechanicOrCenter.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setCostInput('');
      setNotes('');
      setOilFilterCostInput('');
      goToStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ عملية الصيانة.');
    } finally {
      setSaving(false);
    }
  };

  const filteredRecords = maintenanceRecords.filter(
    (r) => !selectedType || r.maintenanceTypeId === selectedType.id
  );

  return (
    <div className="space-y-6">
      {mode === 'GENERAL' && freonLeakWarning !== null && (
        <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-200">
          <strong>تنبيه مراجعة فريون التكييف:</strong> تكرر شحن الفريون خلال {freonLeakWarning} يومًا — يُوصى بمراجعة فنية لاحتمال وجود تسريب (تنبيه مراجعة وليس تشخيصًا مؤكدًا ولا يطلب شحنًا تلقائيًا).
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-4 lg:col-span-6"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#262E3B] pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E11D2E] text-white shrink-0">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {step === 1
                    ? mode === 'ENGINE_OIL'
                      ? 'زيت المحرك والفلتر'
                      : 'تسجيل بند صيانة'
                    : `تسجيل: ${selectedType?.name}`}
                </h3>
                <p className="text-xs text-slate-400">
                  الخطوة {step} من 3 —{' '}
                  {step === 1
                    ? 'اختيار البند والعداد'
                    : step === 2
                    ? 'التفاصيل والموعد القادم'
                    : 'التكلفة والتأكيد'}
                </p>
              </div>
            </div>
          </div>

          {/* 3-Step Progress Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { num: 1 as const, title: '01 · البند والعداد' },
              { num: 2 as const, title: '02 · التفاصيل والموعد' },
              { num: 3 as const, title: '03 · التكلفة والحفظ' },
            ].map((item) => (
              <button
                key={item.num}
                type="button"
                disabled={item.num > step}
                onClick={() => {
                  if (item.num <= step) {
                    goToStep(item.num);
                  }
                }}
                className={`min-h-[42px] rounded-xl border px-2 text-[11px] font-bold transition-colors ${
                  step === item.num
                    ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                    : item.num < step
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-[#262E3B] bg-[#0D1015] text-slate-500 opacity-75'
                }`}
              >
                {item.title}
              </button>
            ))}
          </div>

          {/* STEP 1: Pick Maintenance Type + Date & Odometer */}
          {step === 1 && (
            <>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-300">
                    {mode === 'ENGINE_OIL'
                      ? 'اختر نوع العملية'
                      : `اختر بند الصيانة (${visibleTypes.length})`}
                  </label>
                  {mode === 'GENERAL' && (
                    <button
                      type="button"
                      onClick={() => setShowCustomCreator((v) => !v)}
                      className="min-h-[34px] rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-1 text-xs font-bold text-[#E11D2E] hover:border-[#E11D2E]"
                    >
                      {showCustomCreator ? 'إغلاق' : '+ إضافة بند مخصص'}
                    </button>
                  )}
                </div>

                {mode === 'GENERAL' && showCustomCreator && (
                  <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-[#262E3B] bg-[#0D1015] p-3">
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="اسم البند (مثال: حساس أكسجين / طلمبة بنزين)"
                      className="rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2 text-xs text-white focus:border-[#E11D2E] focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customDesc}
                        onChange={(e) => setCustomDesc(e.target.value)}
                        placeholder="وصف مختصر (اختياري)"
                        className="flex-1 rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2 text-xs text-white focus:border-[#E11D2E] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCreateCustomType}
                        className="min-h-[38px] rounded-xl bg-[#E11D2E] px-4 text-xs font-bold text-white"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {visibleTypes.map((mt) => (
                    <button
                      key={mt.id}
                      type="button"
                      onClick={() => {
                        setSelectedTypeId(mt.id);
                        setBrandOrType('');
                        setError(null);
                      }}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-right text-xs font-bold transition-colors ${
                        selectedType?.id === mt.id
                          ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                          : 'border-[#262E3B] bg-[#0D1015] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {mt.name}
                    </button>
                  ))}
                </div>

                {selectedType?.description && (
                  <p className="rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-slate-400">
                    {selectedType.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">التاريخ</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-xs text-white"
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
                    className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleNextStep}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#E11D2E] text-sm font-bold text-white hover:bg-[#C81625]"
              >
                <span>التالي: التفاصيل والموعد</span>
                <ArrowLeft className="h-4 w-4" />
              </button>
            </>
          )}

          {/* STEP 2: Type Specs & Schedule */}
          {step === 2 && (
            <>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#262E3B] bg-[#0D1015] px-3.5 py-2.5 text-xs">
                <div>
                  <span className="font-bold text-white">{selectedType?.name}</span>
                  <span className="font-mono-nums mr-2 text-slate-400">
                    ({odometerInput || '0'} {vehicle.odometerUnit})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="font-bold text-[#E11D2E] hover:underline"
                >
                  تغيير البند
                </button>
              </div>

              {(typeCode === 'AIR_FILTER' || typeCode === 'AC_FILTER') && (
                <p className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-2.5 text-xs text-slate-300">
                  تسجيل تغيير الفلتر فقط (لا يوجد خيار تنظيف).
                </p>
              )}

              {typeCode === 'BELTS' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">نوع السير</label>
                  <select
                    value={beltKind}
                    onChange={(e) => setBeltKind(e.target.value)}
                    className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
                  >
                    <option value="سير كاتينة">سير كاتينة</option>
                    <option value="مجموعة سيور">مجموعة سيور</option>
                    <option value="سير دينامو">سير دينامو</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
              )}

              {typeCode === 'SUSPENSION' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    الجزء المفحوص / المغير
                  </label>
                  <input
                    type="text"
                    value={suspensionPart}
                    onChange={(e) => setSuspensionPart(e.target.value)}
                    placeholder="مثال: مقص أمامي يمين / مساعد خلفي"
                    className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
                  />
                </div>
              )}

              {typeCode !== 'OIL_FILTER' && (
                <div
                  className={`grid grid-cols-1 gap-3 ${
                    typeCode === 'ENGINE_OIL' ||
                    typeCode === 'TRANSMISSION_OIL' ||
                    typeCode === 'AC_FREON'
                      ? 'sm:grid-cols-2'
                      : ''
                  }`}
                >
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">
                      {typeCode === 'ENGINE_OIL'
                        ? 'نوع وماركة الزيت'
                        : `النوع / الماركة ${
                            typeCode === 'AIR_FILTER' || typeCode === 'AC_FILTER' ? '(اختياري)' : ''
                          }`}
                    </label>
                    <input
                      type="text"
                      value={brandOrType}
                      onChange={(e) => setBrandOrType(e.target.value)}
                      placeholder={
                        typeCode === 'AC_FREON' ? 'R134a / R1234yf' : 'مثال: Bosch / Shell / OEM'
                      }
                      className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
                    />
                  </div>

                  {typeCode === 'ENGINE_OIL' && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-300">اللزوجة</label>
                      <input
                        type="text"
                        value={viscosity}
                        onChange={(e) => setViscosity(e.target.value)}
                        placeholder="مثال: 5W-30 أو 5W-40"
                        className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
                      />
                    </div>
                  )}

                  {(typeCode === 'TRANSMISSION_OIL' || typeCode === 'AC_FREON') && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-300">الكمية</label>
                      <input
                        type="text"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder={typeCode === 'AC_FREON' ? 'مثال: 500 جم' : 'مثال: 4 لتر'}
                        className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
                      />
                    </div>
                  )}
                </div>
              )}

              {typeCode === 'BATTERY' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">
                      السعة (Ah)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={batteryCapacityAh}
                      onChange={(e) => setBatteryCapacityAh(e.target.value)}
                      placeholder="مثال: 60"
                      className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">
                      مدة الضمان (شهور)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={warrantyMonths}
                      onChange={(e) => setWarrantyMonths(e.target.value)}
                      placeholder="مثال: 12"
                      className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
                    />
                  </div>
                </div>
              )}

              {(typeCode === 'BRAKE_PADS' ||
                typeCode === 'BATTERY' ||
                typeCode === 'SUSPENSION') && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">الحالة</label>
                  <select
                    value={conditionStatus}
                    onChange={(e) => setConditionStatus(e.target.value as ConditionStatus)}
                    className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
                  >
                    <option value="GOOD">جيدة / سليم</option>
                    <option value="FOLLOW_UP">يحتاج متابعة</option>
                    <option value="NEEDS_REPLACEMENT">يحتاج تغيير</option>
                    <option value="NEEDS_REPAIR">يحتاج إصلاح</option>
                  </select>
                </div>
              )}

              {/* Due Schedule (NOT forced for Brakes, Suspension, Freon, Battery) */}
              {typeCode !== 'BRAKE_PADS' &&
                typeCode !== 'SUSPENSION' &&
                typeCode !== 'AC_FREON' &&
                typeCode !== 'BATTERY' && (
                  <div className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-3.5 space-y-3">
                    <label className="block text-xs font-semibold text-slate-300">
                      مصدر الموعد القادم
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setScheduleSource('OEM')}
                        className={`min-h-[40px] rounded-xl border text-xs font-bold ${
                          scheduleSource === 'OEM'
                            ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                            : 'border-[#262E3B] bg-[#171C24] text-slate-300'
                        }`}
                      >
                        توصية الشركة المصنعة
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleSource('MANUAL')}
                        className={`min-h-[40px] rounded-xl border text-xs font-bold ${
                          scheduleSource === 'MANUAL'
                            ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                            : 'border-[#262E3B] bg-[#171C24] text-slate-300'
                        }`}
                      >
                        إدخال يدوي
                      </button>
                    </div>

                    {scheduleSource === 'OEM' && (
                      <input
                        type="text"
                        value={sourceLabel}
                        onChange={(e) => setSourceLabel(e.target.value)}
                        placeholder="مرجع التوصية (مثال: كتيب المالك ص 142)"
                        className="w-full rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2 text-xs text-white"
                      />
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-200">
                          {typeCode === 'ENGINE_OIL'
                            ? 'عدد كيلومترات الزيت (كم / KM)'
                            : typeCode === 'OIL_FILTER'
                            ? 'فترة الفلتر (كم / KM)'
                            : `فترة المسافة (${vehicle.odometerUnit})`}
                        </label>
                        {typeCode === 'ENGINE_OIL' && (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {[3000, 5000, 7500, 10000, 15000].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setIntervalDistance(String(preset))}
                                className={`min-h-[34px] rounded-lg border px-2.5 py-1 font-mono-nums text-[11px] font-bold transition-colors ${
                                  intervalDistance === String(preset)
                                    ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                                    : 'border-[#262E3B] bg-[#171C24] text-slate-300 hover:border-[#E11D2E]'
                                }`}
                              >
                                {preset.toLocaleString('en-US')}
                              </button>
                            ))}
                          </div>
                        )}
                        <input
                          type="number"
                          min={0}
                          value={intervalDistance}
                          onChange={(e) => setIntervalDistance(e.target.value)}
                          placeholder={
                            isOilRelated
                              ? 'اكتب المسافة بالكيلومتر (مثال: 10000)'
                              : `اكتب المسافة (${vehicle.odometerUnit})`
                          }
                          className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2 text-xs text-white"
                        />
                        {isOilRelated && vehicle.odometerUnit === 'MILE' && (
                          <p className="mt-1 text-[11px] text-amber-300">
                            وحدة السيارة بالميل (Mile): أدخل مسافة الزيت بالكيلومتر وسيتم تحويلها تلقائيًا للميل.
                          </p>
                        )}
                      </div>

                      {typeCode !== 'ENGINE_OIL' && (
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-200">
                            أو بعد عدد شهور (اختياري)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={intervalMonths}
                            onChange={(e) => setIntervalMonths(e.target.value)}
                            placeholder="مثال: 6 أو 12"
                            className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2 text-xs text-white"
                          />
                        </div>
                      )}
                    </div>

                    {(previewNextOdo !== null || previewNextDate !== null) && (
                      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 space-y-1.5">
                        <p className="text-[11px] font-bold text-emerald-300">
                          موعد التغيير القادم المحسوب:
                        </p>
                        {isOilRelated &&
                          vehicle.odometerUnit === 'MILE' &&
                          intervalConvertedToOdoUnit !== null && (
                            <p className="font-mono-nums text-xs text-amber-200">
                              تحويل مسافة الزيت: {parsedDistNum.toLocaleString('en-US')} كم ≈{' '}
                              {Math.round(intervalConvertedToOdoUnit).toLocaleString('en-US')} ميل
                              (Mile)
                            </p>
                          )}
                        {previewNextOdo !== null && (
                          <p className="font-mono-nums text-xs font-bold text-white">
                            عند عداد: {previewNextOdo.toLocaleString('en-US')}{' '}
                            {vehicle.odometerUnit}
                          </p>
                        )}
                        {previewNextDate !== null && (
                          <p className="font-mono-nums text-xs font-bold text-white">
                            {previewNextOdo !== null ? 'أو بتاريخ: ' : 'بتاريخ: '}
                            {previewNextDate}{' '}
                            {typeCode === 'ENGINE_OIL'
                              ? '(تلقائي: سنة واحدة)'
                              : `(بعد ${parsedMonthsNum} شهور)`}
                            {previewNextOdo !== null ? ' — أيهما أقرب' : ''}
                          </p>
                        )}
                        {typeCode === 'ENGINE_OIL' && (
                          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200">
                            تحذير: المدة الزمنية المحددة (سنة واحدة) هي مدة تقديرية فقط؛ يُرجى مراجعة توصية الشركة المصنعة وظروف التشغيل.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="flex min-h-[48px] items-center gap-1.5 rounded-xl border border-[#262E3B] bg-[#0D1015] px-4 text-sm font-semibold text-slate-300 hover:border-[#E11D2E]"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>السابق</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#E11D2E] text-sm font-bold text-white hover:bg-[#C81625]"
                >
                  <span>التالي: التكلفة والتأكيد</span>
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {/* STEP 3: Summary, Optional Oil Filter, Cost, Workshop & Save */}
          {step === 3 && (
            <>
              <div className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-3 text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
                  <span className="font-bold text-white">
                    {selectedType?.name}
                    {brandOrType ? ` · ${brandOrType}` : ''}
                    {viscosity ? ` (${viscosity})` : ''}
                    {beltKind && typeCode === 'BELTS' ? ` · ${beltKind}` : ''}
                  </span>
                  <span className="font-mono-nums text-slate-400">
                    {date} · {odometerInput || '0'} {vehicle.odometerUnit}
                  </span>
                </div>
                {previewNextOdo !== null && (
                  <p className="font-mono-nums font-bold text-emerald-400">
                    التغيير القادم: {previewNextOdo.toLocaleString('en-US')} {vehicle.odometerUnit}
                    {previewNextDate ? ` أو ${previewNextDate}` : ''}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  التكلفة ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  placeholder="0"
                  className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
                />
              </div>

              {typeCode === 'ENGINE_OIL' && (
                <div className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-3.5 space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-white">
                    <input
                      type="checkbox"
                      checked={oilFilterChanged}
                      onChange={(e) => setOilFilterChanged(e.target.checked)}
                      className="h-4 w-4 accent-[#E11D2E]"
                    />
                    <span>هل تم تغيير فلتر الزيت مع الزيت؟ (يُحدّث سجل الفلتر تلقائيًا بدون تكرار)</span>
                  </label>
                  {oilFilterChanged && (
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={oilFilterCostInput}
                        onChange={(e) => setOilFilterCostInput(e.target.value)}
                        placeholder={`تكلفة الفلتر (${currencySymbol}) اختياري`}
                        className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="number"
                        min={0}
                        value={oilFilterIntervalInput}
                        onChange={(e) => setOilFilterIntervalInput(e.target.value)}
                        placeholder="فترة الفلتر (كم / KM)"
                        className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2 text-xs text-white"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    اسم الميكانيكي / مركز الصيانة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={mechanicOrCenter}
                    onChange={(e) => setMechanicOrCenter(e.target.value)}
                    className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    ملاحظات (اختياري)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="flex min-h-[48px] items-center gap-1.5 rounded-xl border border-[#262E3B] bg-[#0D1015] px-4 text-sm font-semibold text-slate-300 hover:border-[#E11D2E]"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>السابق</span>
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#E11D2E] text-sm font-bold text-white hover:bg-[#C81625] disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{saving ? 'جارٍ الحفظ...' : 'حفظ سجل الصيانة'}</span>
                </button>
              </div>
            </>
          )}
        </form>

        <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 lg:col-span-6">
          <h3 className="text-base font-bold text-white">
            سجل {selectedType?.name} ({filteredRecords.length})
          </h3>
          {filteredRecords.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">لا توجد سجلات سابقة لهذا البند.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {filteredRecords.map((rec) => {
                const ageDays = rec.typeCode === 'BATTERY' ? daysBetween(rec.date, todayIsoDate()) : null;
                return (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">
                        {rec.typeCode === 'OIL_FILTER'
                          ? selectedType?.name
                          : rec.brandOrType || selectedType?.name}
                        {rec.viscosity ? ` · ${rec.viscosity}` : ''}
                        {rec.beltKind ? ` · ${rec.beltKind}` : ''}
                      </span>
                      <span className="font-mono-nums text-sm font-bold text-[#E11D2E]">
                        {formatMoney(rec.costPiastres, currencySymbol)}
                      </span>
                    </div>
                    <div className="font-mono-nums mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>التاريخ: {rec.date}</span>
                      <span>العداد: {formatDistance(rec.odometerKm, vehicle.odometerUnit)}</span>
                      {(rec.typeCode === 'ENGINE_OIL' || rec.typeCode === 'OIL_FILTER') &&
                        rec.intervalKm !== undefined &&
                        vehicle.odometerUnit === 'MILE' && (
                          <span>
                            المسافة: {Math.round(rec.intervalKm).toLocaleString('en-US')} كم (≈{' '}
                            {Math.round(fromInternalKm(rec.intervalKm, 'MILE')).toLocaleString('en-US')} ميل)
                          </span>
                        )}
                      {rec.nextDueKm !== undefined && (
                        <span className="font-bold text-emerald-400">
                          التغيير القادم عند عداد: {formatDistance(rec.nextDueKm, vehicle.odometerUnit)}
                        </span>
                      )}
                      {rec.nextDueDate && (
                        <span className="font-bold text-emerald-400">
                          {rec.nextDueKm !== undefined ? 'أو بتاريخ: ' : 'موعد زمني: '}
                          {rec.nextDueDate}
                          {rec.typeCode === 'ENGINE_OIL'
                            ? ' (سنة واحدة - تقديرية)'
                            : rec.intervalMonths
                            ? ` (بعد ${rec.intervalMonths} شهور)`
                            : ''}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>
                        مصدر الموعد:{' '}
                        {rec.scheduleSource === 'OEM'
                          ? `توصية الشركة المصنعة${rec.sourceLabel ? ` (${rec.sourceLabel})` : ''}`
                          : rec.scheduleSource === 'INSPECTION_ONLY'
                          ? 'متابعة حسب الفحص والحالة'
                          : 'إدخال يدوي'}
                      </span>
                      {rec.mechanicOrCenter && <span>· المركز/الميكانيكي: {rec.mechanicOrCenter}</span>}
                      {ageDays !== null && (
                        <span>· عمر البطارية منذ التركيب: {Math.floor(ageDays / 30)} شهر ({ageDays} يوم)</span>
                      )}
                      {rec.warrantyExpiryDate && <span>· انتهاء الضمان: {rec.warrantyExpiryDate}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

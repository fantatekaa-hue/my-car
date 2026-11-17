import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Car, CheckCircle2, Disc, ShieldAlert, X } from 'lucide-react';
import { mergeCatalogWithCustom } from '../domain/egyptianCatalog';
import { splitPlateToSlots, validateEgyptianPlate } from '../domain/plateValidator';
import type { CustomCatalogEntry, OdometerUnit, OwnershipType, Vehicle } from '../domain/types';
import { toInternalKm, todayIsoDate } from '../domain/units';

interface VehicleModalProps {
  isOpen: boolean;
  editingVehicle: Vehicle | null;
  customCatalog: CustomCatalogEntry[];
  onClose: () => void;
  onCreate: (data: {
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
    saveToCustomCatalog: boolean;
    emergencyEquipment: {
      hasJack: boolean | null;
      hasLugWrench: boolean | null;
      hasAirPump: boolean | null;
    };
    tiresInput: {
      configured: boolean;
      brand: string;
      size: string;
      dotWeek: number | null;
      dotYear: number | null;
      installDate?: string;
    };
  }) => Promise<void>;
  onUpdate: (vehicle: Vehicle) => Promise<void>;
}

function buildInspectionDateFromLicense(licenseExpiry: string, inspectionYear: number): string {
  const parts = licenseExpiry.split('-');
  const month = parseInt(parts[1] || '1', 10);
  const day = parseInt(parts[2] || '1', 10);
  const maxDayInMonth = new Date(Date.UTC(inspectionYear, month, 0)).getUTCDate();
  const safeDay = Math.min(Math.max(1, day), maxDayInMonth);
  return `${inspectionYear}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  editingVehicle,
  customCatalog,
  onClose,
  onCreate,
  onUpdate,
}) => {
  const catalog = useMemo(() => mergeCatalogWithCustom(customCatalog), [customCatalog]);

  const initialInCatalog = useMemo(() => {
    if (!editingVehicle) return true;
    const b = catalog.find((item) => item.brand === editingVehicle.brand);
    const m = b?.models.find((item) => item.name === editingVehicle.model);
    return Boolean(b && m && m.years.includes(editingVehicle.year));
  }, [catalog, editingVehicle]);

  const [step, setStep] = useState<number>(1);
  const maxStep = editingVehicle ? 2 : 4;

  const [manualMode, setManualMode] = useState(!initialInCatalog);
  const [brand, setBrand] = useState(editingVehicle?.brand ?? catalog[0]?.brand ?? '');
  const [model, setModel] = useState(
    editingVehicle?.model ?? catalog[0]?.models[0]?.name ?? ''
  );
  const [year, setYear] = useState<number>(
    editingVehicle?.year ?? catalog[0]?.models[0]?.years[0] ?? new Date().getFullYear()
  );

  // Split 3 letter slots + 4 digit slots
  const initialSlots = useMemo(
    () => splitPlateToSlots(editingVehicle?.plateRaw ?? ''),
    [editingVehicle]
  );
  const [letterSlots, setLetterSlots] = useState<[string, string, string]>(
    initialSlots.letterSlots
  );
  const [digitSlots, setDigitSlots] = useState<[string, string, string, string]>(
    initialSlots.digitSlots
  );
  const letterRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [purchaseDate, setPurchaseDate] = useState(editingVehicle?.purchaseDate ?? '');
  const [odometerUnit, setOdometerUnit] = useState<OdometerUnit>(
    editingVehicle?.odometerUnit ?? 'KM'
  );
  // Optional on first add (blank by default)
  const [odometerInput, setOdometerInput] = useState<string>('');
  const [ownershipType, setOwnershipType] = useState<OwnershipType>(
    editingVehicle?.ownershipType ?? 'REGISTERED_CONTRACT'
  );
  const [poaRegisteredContractDone, setPoaRegisteredContractDone] = useState<boolean>(
    editingVehicle?.poaRegisteredContractDone ?? false
  );

  const defaultNextYear = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [vehicleLicenseExpiry, setVehicleLicenseExpiry] = useState(defaultNextYear);
  const [inspectionYear, setInspectionYear] = useState<number>(new Date().getFullYear() + 1);
  const [driverLicenseExpiry, setDriverLicenseExpiry] = useState(defaultNextYear);

  // Customer-provided emergency tools (NO pre-selected true/false assumptions)
  const [hasJack, setHasJack] = useState<boolean | null>(null);
  const [hasLugWrench, setHasLugWrench] = useState<boolean | null>(null);
  const [hasAirPump, setHasAirPump] = useState<boolean | null>(null);

  // Customer-provided tires (NO pre-filled DOT or brand)
  const [tireEntryMode, setTireEntryMode] = useState<'NOW' | 'PER_TIRE_LATER'>('NOW');
  const [tireBrand, setTireBrand] = useState('');
  const [tireSize, setTireSize] = useState('');
  const [tireDotWeek, setTireDotWeek] = useState('');
  const [tireDotYear, setTireDotYear] = useState('');

  const [saveToCustomCatalog, setSaveToCustomCatalog] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const selectedBrandObj = catalog.find((b) => b.brand === brand);
  const availableModels = selectedBrandObj?.models ?? [];
  const selectedModelObj = availableModels.find((m) => m.name === model);
  const availableYears = selectedModelObj?.years ?? [];

  const composedPlateRaw = `${letterSlots.filter(Boolean).join('')} ${digitSlots.filter(Boolean).join('')}`.trim();
  const plateCheck = validateEgyptianPlate(composedPlateRaw);
  const computedInspectionDate = buildInspectionDateFromLicense(
    vehicleLicenseExpiry,
    Number.isFinite(inspectionYear) ? inspectionYear : new Date().getFullYear() + 1
  );

  const stepLabels = editingVehicle
    ? ['السيارة واللوحة', 'الوحدة والملكية']
    : ['السيارة واللوحة', 'العداد والملكية', 'التراخيص والفحص', 'الطوارئ والإطارات'];

  const handleLetterChange = (index: number, raw: string) => {
    const clean = raw.replace(/[\s\-\u06400-9٠-٩]/g, '').slice(-1);
    const next: [string, string, string] = [...letterSlots] as [string, string, string];
    next[index] = clean;
    setLetterSlots(next);
    if (clean && index < 2) {
      letterRefs.current[index + 1]?.focus();
    } else if (clean && index === 2) {
      digitRefs.current[0]?.focus();
    }
  };

  const handleLetterKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !letterSlots[index] && index > 0) {
      letterRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitChange = (index: number, raw: string) => {
    const normalized = raw
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[^0-9]/g, '')
      .slice(-1);
    const next: [string, string, string, string] = [...digitSlots] as [
      string,
      string,
      string,
      string,
    ];
    next[index] = normalized;
    setDigitSlots(next);
    if (normalized && index < 3) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digitSlots[index]) {
      if (index > 0) {
        digitRefs.current[index - 1]?.focus();
      } else {
        letterRefs.current[2]?.focus();
      }
    }
  };

  const handleBrandChange = (newBrand: string) => {
    setBrand(newBrand);
    const bObj = catalog.find((b) => b.brand === newBrand);
    const firstModel = bObj?.models[0];
    if (firstModel) {
      setModel(firstModel.name);
      setYear(firstModel.years[0] ?? new Date().getFullYear());
    }
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    const mObj = availableModels.find((m) => m.name === newModel);
    if (mObj?.years[0]) {
      setYear(mObj.years[0]);
    }
  };

  const validateCurrentStep = (targetStep: number): boolean => {
    setError(null);
    if (targetStep === 1) {
      if (!brand.trim() || !model.trim()) {
        setError('يرجى تحديد الماركة والموديل.');
        return false;
      }
      if (!Number.isFinite(year) || year < 1970 || year > 2035) {
        setError('يرجى إدخال سنة صنع صحيحة.');
        return false;
      }
      if (!plateCheck.valid) {
        setError(plateCheck.error || 'رقم اللوحة المصرية غير صحيح.');
        return false;
      }
    }
    if (targetStep === 2 && !editingVehicle) {
      if (odometerInput.trim() !== '') {
        const odoNum = parseFloat(odometerInput);
        if (!Number.isFinite(odoNum) || odoNum < 0) {
          setError('قراءة العداد غير صالحة.');
          return false;
        }
      }
    }
    if (targetStep === 3 && !editingVehicle) {
      if (!vehicleLicenseExpiry || !driverLicenseExpiry) {
        setError('يرجى تحديد تواريخ انتهاء التراخيص.');
        return false;
      }
      if (!Number.isFinite(inspectionYear) || inspectionYear < 2020 || inspectionYear > 2045) {
        setError('يرجى إدخال سنة فحص فني صحيحة.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep(step)) return;
    setStep((prev) => Math.min(maxStep, prev + 1));
  };

  const handlePrev = () => {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < maxStep) {
      handleNext();
      return;
    }

    setError(null);
    if (!plateCheck.valid) {
      setStep(1);
      setError(plateCheck.error || 'رقم اللوحة المصرية غير صحيح.');
      return;
    }
    if (!brand.trim() || !model.trim()) {
      setStep(1);
      setError('يرجى تحديد الماركة والموديل.');
      return;
    }

    if (editingVehicle) {
      setSubmitting(true);
      try {
        await onUpdate({
          ...editingVehicle,
          brand: brand.trim(),
          model: model.trim(),
          year,
          plateRaw: composedPlateRaw,
          plateNormalized: plateCheck.normalized,
          purchaseDate: purchaseDate || undefined,
          odometerUnit,
          ownershipType,
          poaRegisteredContractDone:
            ownershipType === 'REGISTERED_CONTRACT' ? true : poaRegisteredContractDone,
          poaStatusUpdatedAt: new Date().toISOString(),
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ السيارة.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    let initialOdometerKm: number | undefined = undefined;
    if (odometerInput.trim() !== '') {
      const odoNum = parseFloat(odometerInput);
      if (!Number.isFinite(odoNum) || odoNum < 0) {
        setStep(2);
        setError('قراءة العداد غير صالحة.');
        return;
      }
      initialOdometerKm = toInternalKm(odoNum, odometerUnit);
    }

    if (hasJack === null || hasLugWrench === null || hasAirPump === null) {
      setError('يرجى تحديد توفر أو عدم توفر تجهيزات الطوارئ (الكوريك ومفتاح العجل والمنفاخ) أولًا.');
      return;
    }

    let parsedWeek: number | null = null;
    let parsedYear: number | null = null;
    if (tireEntryMode === 'NOW') {
      const w = parseInt(tireDotWeek, 10);
      const y = parseInt(tireDotYear, 10);
      if (!tireBrand.trim() || !tireSize.trim()) {
        setError('يرجى إدخال ماركة ومقاس الإطارات، أو اختيار إدخال كل إطار على حدة لاحقًا.');
        return;
      }
      if (!Number.isFinite(w) || w < 1 || w > 53 || !Number.isFinite(y) || y < 2005 || y > 2030) {
        setError('يرجى إدخال أسبوع (1-53) وسنة تصنيع DOT صحيحة للإطارات.');
        return;
      }
      parsedWeek = w;
      parsedYear = y;
    }

    setSubmitting(true);
    try {
      await onCreate({
        brand: brand.trim(),
        model: model.trim(),
        year,
        plateRaw: composedPlateRaw,
        purchaseDate: purchaseDate || undefined,
        vehicleLicenseExpiry,
        technicalInspectionDate: computedInspectionDate,
        driverLicenseExpiry,
        odometerUnit,
        initialOdometerKm,
        ownershipType,
        poaRegisteredContractDone,
        saveToCustomCatalog: manualMode && saveToCustomCatalog,
        emergencyEquipment: {
          hasJack,
          hasLugWrench,
          hasAirPump,
        },
        tiresInput: {
          configured: tireEntryMode === 'NOW',
          brand: tireBrand.trim(),
          size: tireSize.trim(),
          dotWeek: parsedWeek,
          dotYear: parsedYear,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ السيارة.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 backdrop-blur-sm p-3 sm:p-4">
      <div className="my-auto w-full max-w-2xl rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 md:p-6">
        <div className="flex items-center justify-between border-b border-[#262E3B] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E11D2E]/15 text-[#E11D2E]">
              <Car className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {editingVehicle ? 'تعديل بيانات السيارة' : 'إضافة سيارة جديدة'}
              </h2>
              <p className="text-xs text-slate-400">
                الخطوة {step} من {maxStep} — {stepLabels[step - 1]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#262E3B] text-slate-400 hover:bg-[#1D232E] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Wizard Step Progress Bar */}
        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${maxStep}, minmax(0, 1fr))` }}>
          {stepLabels.map((label, idx) => {
            const sNum = idx + 1;
            const isActive = sNum === step;
            const isDone = sNum < step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (sNum <= step) {
                    setError(null);
                    setStep(sNum);
                  }
                }}
                disabled={sNum > step}
                className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition-colors ${
                  isActive
                    ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                    : isDone
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-[#262E3B] bg-[#0D1015] text-slate-500 opacity-75'
                }`}
              >
                <span className="font-mono-nums text-[11px] font-bold">0{sNum}</span>
                <span className="mt-0.5 text-[10px] font-bold leading-tight">{label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* STEP 1: Vehicle Model & License Plate */}
          {step === 1 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#262E3B] bg-[#0D1015] p-3">
                <span className="text-xs text-slate-300">
                  {manualMode
                    ? 'إدخال يدوي حر (يُحفظ محليًا لاستخدامه لاحقًا)'
                    : 'قاعدة السوق المصري (محلية دون إنترنت)'}
                </span>
                <button
                  type="button"
                  onClick={() => setManualMode((v) => !v)}
                  className="min-h-[36px] rounded-lg bg-[#1D232E] px-3 py-1.5 text-xs font-semibold text-[#E11D2E] hover:bg-[#262E3B]"
                >
                  {manualMode ? 'العودة لقائمة السوق المصري' : 'إضافة ماركة/موديل/سنة يدويًا'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    الماركة (Brand)
                  </label>
                  {manualMode ? (
                    <input
                      type="text"
                      dir="ltr"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g. Geely"
                      className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                      required
                    />
                  ) : (
                    <select
                      dir="ltr"
                      value={brand}
                      onChange={(e) => handleBrandChange(e.target.value)}
                      className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                    >
                      {catalog.map((b) => (
                        <option key={b.brand} value={b.brand}>
                          {b.brand}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    الموديل (Model)
                  </label>
                  {manualMode ? (
                    <input
                      type="text"
                      dir="ltr"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. Coolray"
                      className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                      required
                    />
                  ) : (
                    <select
                      dir="ltr"
                      value={model}
                      onChange={(e) => handleModelChange(e.target.value)}
                      className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                    >
                      {availableModels.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">سنة الصنع</label>
                  {manualMode || availableYears.length === 0 ? (
                    <input
                      type="number"
                      min={1970}
                      max={2035}
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                      required
                    />
                  ) : (
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                    >
                      {availableYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {manualMode && !editingVehicle && (
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={saveToCustomCatalog}
                    onChange={(e) => setSaveToCustomCatalog(e.target.checked)}
                    className="h-4 w-4 accent-[#E11D2E]"
                  />
                  <span>حفظ هذه الماركة والموديل والسنة محليًا على الجهاز للاستخدام لاحقًا</span>
                </label>
              )}

              {/* Split Egyptian License Plate: 3 separate letter boxes + 4 separate digit boxes */}
              <div className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-4 space-y-2.5">
                <label className="block text-xs font-semibold text-slate-300">رقم اللوحة</label>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-1" dir="rtl">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400">الحروف</span>
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((idx) => (
                        <input
                          key={`l_${idx}`}
                          ref={(el) => {
                            letterRefs.current[idx] = el;
                          }}
                          type="text"
                          maxLength={1}
                          value={letterSlots[idx]}
                          onChange={(e) => handleLetterChange(idx, e.target.value)}
                          onKeyDown={(e) => handleLetterKeyDown(idx, e)}
                          aria-label={`حرف اللوحة ${idx + 1}`}
                          className="h-12 w-11 rounded-xl border border-[#262E3B] bg-[#171C24] text-center text-lg font-bold text-white focus:border-[#E11D2E] focus:outline-none"
                        />
                      ))}
                    </div>
                  </div>

                  <span className="mt-5 text-lg font-bold text-slate-500">—</span>

                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400">الأرقام</span>
                    <div className="flex items-center gap-1.5" dir="ltr">
                      {[0, 1, 2, 3].map((idx) => (
                        <input
                          key={`d_${idx}`}
                          ref={(el) => {
                            digitRefs.current[idx] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digitSlots[idx]}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                          aria-label={`رقم اللوحة ${idx + 1}`}
                          className="font-mono-nums h-12 w-11 rounded-xl border border-[#262E3B] bg-[#171C24] text-center text-lg font-bold text-white focus:border-[#E11D2E] focus:outline-none"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {!plateCheck.valid &&
                  ((letterSlots.filter(Boolean).length >= 2 &&
                    digitSlots.filter(Boolean).length >= 2) ||
                    Boolean(error)) && (
                    <p className="text-center text-xs font-semibold text-red-400">
                      {plateCheck.error}
                    </p>
                  )}
              </div>
            </>
          )}

          {/* STEP 2: Odometer Unit, Optional Reading & Ownership */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    وحدة عرض العداد
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['KM', 'MILE'] as OdometerUnit[]).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setOdometerUnit(u)}
                        className={`min-h-[44px] rounded-xl border text-sm font-bold transition-colors ${
                          odometerUnit === u
                            ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                            : 'border-[#262E3B] bg-[#0D1015] text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {u === 'KM' ? 'كيلومتر (KM)' : 'ميل (Mile)'}
                      </button>
                    ))}
                  </div>
                </div>

                {!editingVehicle ? (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                      قراءة العداد الحالية ({odometerUnit}) —{' '}
                      <span className="text-slate-400">اختياري</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={odometerInput}
                      onChange={(e) => setOdometerInput(e.target.value)}
                      placeholder="اتركه فارغًا إذا كنت بعيدًا عن السيارة الآن"
                      className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white placeholder:text-xs focus:border-[#E11D2E] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                      تاريخ الشراء (اختياري)
                    </label>
                    <input
                      type="date"
                      value={purchaseDate}
                      max={todayIsoDate()}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-4 space-y-3">
                <label className="block text-xs font-semibold text-slate-300">طريقة الامتلاك</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOwnershipType('REGISTERED_CONTRACT')}
                    className={`min-h-[44px] rounded-xl border text-xs font-bold transition-colors ${
                      ownershipType === 'REGISTERED_CONTRACT'
                        ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                        : 'border-[#262E3B] bg-[#171C24] text-slate-300'
                    }`}
                  >
                    عقد مسجل
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwnershipType('POWER_OF_ATTORNEY')}
                    className={`min-h-[44px] rounded-xl border text-xs font-bold transition-colors ${
                      ownershipType === 'POWER_OF_ATTORNEY'
                        ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                        : 'border-[#262E3B] bg-[#171C24] text-slate-300'
                    }`}
                  >
                    شراء بتوكيل
                  </button>
                </div>

                {ownershipType === 'POWER_OF_ATTORNEY' && (
                  <div className="pt-2">
                    <p className="mb-2 text-xs font-semibold text-amber-300">
                      هل تم عمل عقد مسجل؟ (في حالة «لا» يظهر تنبيه قبل انتهاء الترخيص بـ 60 يومًا)
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setPoaRegisteredContractDone(true)}
                        className={`min-h-[44px] flex-1 rounded-xl border py-2 text-xs font-bold ${
                          poaRegisteredContractDone
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : 'border-[#262E3B] bg-[#171C24] text-slate-400'
                        }`}
                      >
                        نعم، تم عمل عقد مسجل
                      </button>
                      <button
                        type="button"
                        onClick={() => setPoaRegisteredContractDone(false)}
                        className={`min-h-[44px] flex-1 rounded-xl border py-2 text-xs font-bold ${
                          !poaRegisteredContractDone
                            ? 'border-red-500 bg-red-500/20 text-red-300'
                            : 'border-[#262E3B] bg-[#171C24] text-slate-400'
                        }`}
                      >
                        لا، لم يُسجل العقد بعد
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* STEP 3: Licenses & Inspection Year */}
          {!editingVehicle && step === 3 && (
            <div className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    تاريخ انتهاء ترخيص السيارة
                  </label>
                  <input
                    type="date"
                    value={vehicleLicenseExpiry}
                    onChange={(e) => setVehicleLicenseExpiry(e.target.value)}
                    className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    سنة الفحص الفني
                  </label>
                  <input
                    type="number"
                    min={2020}
                    max={2040}
                    value={inspectionYear}
                    onChange={(e) => setInspectionYear(Number(e.target.value))}
                    className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    تاريخ انتهاء رخصة القيادة الشخصية
                  </label>
                  <input
                    type="date"
                    value={driverLicenseExpiry}
                    onChange={(e) => setDriverLicenseExpiry(e.target.value)}
                    className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2.5 text-sm text-white focus:border-[#E11D2E] focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Emergency Equipment & Tires */}
          {!editingVehicle && step === 4 && (
            <>
              <div className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[#E11D2E]" />
                  <h4 className="text-xs font-bold text-white">تجهيزات الطوارئ</h4>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {[
                    { label: 'الكوريك', val: hasJack, set: setHasJack },
                    { label: 'مفتاح العجل', val: hasLugWrench, set: setHasLugWrench },
                    { label: 'منفاخ كهربائي', val: hasAirPump, set: setHasAirPump },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-[#262E3B] bg-[#171C24] p-2.5 space-y-2"
                    >
                      <span className="block text-xs font-bold text-slate-200">{item.label}</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => item.set(true)}
                          className={`min-h-[40px] rounded-lg border text-[11px] font-bold ${
                            item.val === true
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                              : 'border-[#262E3B] bg-[#0D1015] text-slate-400'
                          }`}
                        >
                          متوفر
                        </button>
                        <button
                          type="button"
                          onClick={() => item.set(false)}
                          className={`min-h-[40px] rounded-lg border text-[11px] font-bold ${
                            item.val === false
                              ? 'border-red-500 bg-red-500/20 text-red-300'
                              : 'border-[#262E3B] bg-[#0D1015] text-slate-400'
                          }`}
                        >
                          غير متوفر
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {(hasJack === false || hasLugWrench === false) && (
                  <p className="rounded-lg border border-red-500/60 bg-red-500/15 px-3 py-2 text-[11px] font-bold text-red-400">
                    تنبيه: لابد من توافرهما لسلامتك أثناء السفر
                  </p>
                )}
                {hasAirPump === false && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-300">
                    نصيحة: من الضروري امتلاك منفاخ كهربائي للطوارئ
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Disc className="h-4 w-4 text-[#E11D2E]" />
                    <h4 className="text-xs font-bold text-white">بيانات الإطارات</h4>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTireEntryMode('NOW')}
                      className={`min-h-[36px] rounded-lg px-3 py-1 text-[11px] font-bold ${
                        tireEntryMode === 'NOW'
                          ? 'bg-[#E11D2E] text-white'
                          : 'bg-[#171C24] text-slate-400'
                      }`}
                    >
                      إدخال الآن
                    </button>
                    <button
                      type="button"
                      onClick={() => setTireEntryMode('PER_TIRE_LATER')}
                      className={`min-h-[36px] rounded-lg px-3 py-1 text-[11px] font-bold ${
                        tireEntryMode === 'PER_TIRE_LATER'
                          ? 'bg-[#E11D2E] text-white'
                          : 'bg-[#171C24] text-slate-400'
                      }`}
                    >
                      مختلفة (تُدخل لكل إطار لاحقًا)
                    </button>
                  </div>
                </div>

                {tireEntryMode === 'NOW' ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <input
                      type="text"
                      value={tireBrand}
                      onChange={(e) => setTireBrand(e.target.value)}
                      placeholder="الماركة (مثال: Bridgestone)"
                      className="rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2.5 text-xs text-white focus:border-[#E11D2E] focus:outline-none"
                      required
                    />
                    <input
                      type="text"
                      value={tireSize}
                      onChange={(e) => setTireSize(e.target.value)}
                      placeholder="المقاس (205/55R16)"
                      className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2.5 text-xs text-white focus:border-[#E11D2E] focus:outline-none"
                      required
                    />
                    <input
                      type="number"
                      min={1}
                      max={53}
                      value={tireDotWeek}
                      onChange={(e) => setTireDotWeek(e.target.value)}
                      placeholder="أسبوع DOT (1-53)"
                      className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2.5 text-xs text-white focus:border-[#E11D2E] focus:outline-none"
                      required
                    />
                    <input
                      type="number"
                      min={2005}
                      max={2030}
                      value={tireDotYear}
                      onChange={(e) => setTireDotYear(e.target.value)}
                      placeholder="سنة DOT (مثال: 2023)"
                      className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2.5 text-xs text-white focus:border-[#E11D2E] focus:outline-none"
                      required
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    سيتم استكمال بيانات كل إطار من قسم الإطارات.
                  </p>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[#262E3B] pt-3">
            <div>
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#262E3B] bg-[#0D1015] px-4 text-sm font-semibold text-slate-300 hover:border-[#E11D2E]"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>السابق</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] rounded-xl border border-[#262E3B] px-5 text-sm font-semibold text-slate-300 hover:bg-[#1D232E]"
                >
                  إلغاء
                </button>
              )}
            </div>

            {step < maxStep ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E11D2E] px-6 text-sm font-bold text-white hover:bg-[#C81625]"
              >
                <span>التالي</span>
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E11D2E] px-6 text-sm font-bold text-white hover:bg-[#C81625] disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {submitting ? 'جارٍ الحفظ...' : editingVehicle ? 'حفظ التعديلات' : 'إضافة السيارة'}
                </span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

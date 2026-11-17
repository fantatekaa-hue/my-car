import React, { useLayoutEffect, useState } from 'react';
import { Check, Disc, FileCheck, ShieldAlert } from 'lucide-react';
import { getTireAgeYearsFromDot } from '../domain/alertEngine';
import type {
  ConditionStatus,
  DocumentRecord,
  EmergencyEquipment,
  TireRecord,
  Vehicle,
} from '../domain/types';
import {
  daysBetween,
  formatDistance,
  fromInternalKm,
  toInternalKm,
  todayIsoDate,
} from '../domain/units';

interface TiresAndDocsScreenProps {
  initialTab?: 'TIRES' | 'DOCS';
  vehicle: Vehicle;
  tireRecords: TireRecord[];
  emergencyEquipment: EmergencyEquipment | null;
  documentRecords: DocumentRecord[];
  onSaveTire: (tire: TireRecord) => Promise<void>;
  onSaveEmergency: (eq: EmergencyEquipment) => Promise<void>;
  onRenewDocument: (params: { documentId: string; newExpiryDate: string; notes?: string }) => Promise<void>;
  onTogglePoaRegistered: (done: boolean) => Promise<void>;
}

const DOC_TITLES: Record<string, string> = {
  VEHICLE_LICENSE: 'ترخيص السيارة',
  TECHNICAL_INSPECTION: 'موعد الفحص الفني',
  DRIVER_LICENSE: 'رخصة القيادة الشخصية',
};

export const TiresAndDocsScreen: React.FC<TiresAndDocsScreenProps> = ({
  initialTab = 'TIRES',
  vehicle,
  tireRecords,
  emergencyEquipment,
  documentRecords,
  onSaveTire,
  onSaveEmergency,
  onRenewDocument,
  onTogglePoaRegistered,
}) => {
  const [tab, setTab] = useState<'TIRES' | 'DOCS'>(initialTab);
  const [editingTire, setEditingTire] = useState<TireRecord | null>(null);
  const [tireOdoDisplay, setTireOdoDisplay] = useState('');

  // Document renewal state
  const [renewDoc, setRenewDoc] = useState<DocumentRecord | null>(null);
  const [newExpiry, setNewExpiry] = useState('');
  const [renewNotes, setRenewNotes] = useState('');

  useLayoutEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [tab]);

  const openTireEdit = (t: TireRecord) => {
    setEditingTire({ ...t });
    setTireOdoDisplay(String(Math.round(fromInternalKm(t.installOdometerKm, vehicle.odometerUnit))));
  };

  const handleTireSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTire) return;
    await onSaveTire({
      ...editingTire,
      dotWeek: editingTire.dotWeek ?? 1,
      dotYear: editingTire.dotYear ?? new Date().getFullYear(),
      isConfigured: true,
      installOdometerKm: toInternalKm(parseFloat(tireOdoDisplay) || 0, vehicle.odometerUnit),
    });
    setEditingTire(null);
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewDoc || !newExpiry) return;
    await onRenewDocument({
      documentId: renewDoc.id,
      newExpiryDate: newExpiry,
      notes: renewNotes.trim() || undefined,
    });
    setRenewDoc(null);
    setNewExpiry('');
    setRenewNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#262E3B] bg-[#171C24] p-1.5 max-w-md">
        <button
          type="button"
          onClick={() => setTab('TIRES')}
          className={`min-h-[44px] rounded-xl text-xs font-bold ${
            tab === 'TIRES' ? 'bg-[#E11D2E] text-white' : 'text-slate-300'
          }`}
        >
          الإطارات وتجهيزات الطوارئ
        </button>
        <button
          type="button"
          onClick={() => setTab('DOCS')}
          className={`min-h-[44px] rounded-xl text-xs font-bold ${
            tab === 'DOCS' ? 'bg-[#E11D2E] text-white' : 'text-slate-300'
          }`}
        >
          الأوراق والتراخيص
        </button>
      </div>

      {tab === 'TIRES' && (
        <div className="space-y-6">
          {/* Emergency Equipment */}
          {emergencyEquipment && (
            <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5">
              <div className="flex items-center gap-3 border-b border-[#262E3B] pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E11D2E]/15 text-[#E11D2E]">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">تجهيزات الطوارئ</h3>
                  <p className="text-xs text-slate-400">
                    نقص الكوريك أو مفتاح العجل يطلق تنبيهًا مهمًا (أحمر) · عدم توفر المنفاخ يظهر نصيحة باقتنائه للطوارئ
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  {
                    key: 'hasJack' as const,
                    label: 'الكوريك',
                    value: emergencyEquipment.hasJack,
                    priority: 'معدّة أساسية',
                  },
                  {
                    key: 'hasLugWrench' as const,
                    label: 'مفتاح العجل',
                    value: emergencyEquipment.hasLugWrench,
                    priority: 'معدّة أساسية',
                  },
                  {
                    key: 'hasAirPump' as const,
                    label: 'منفاخ كهربائي',
                    value: emergencyEquipment.hasAirPump,
                    priority: 'معدّة مساعدة',
                  },
                ].map((eq) => (
                  <div
                    key={eq.key}
                    className={`rounded-xl border p-3.5 transition-colors space-y-2.5 ${
                      eq.value === true
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : eq.value === false
                        ? eq.key === 'hasAirPump'
                          ? 'border-amber-500/40 bg-amber-500/10'
                          : 'border-red-500/50 bg-red-500/10'
                        : 'border-amber-500/40 bg-[#0D1015]'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{eq.label}</p>
                      <p
                        className={`text-[11px] ${
                          eq.value === false && eq.key !== 'hasAirPump'
                            ? 'font-bold text-red-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {eq.value === true
                          ? 'متوفر ومؤكد'
                          : eq.value === false
                          ? eq.key === 'hasAirPump'
                            ? `غير متوفر (${eq.priority})`
                            : 'غير متوفر — لابد من توافرهما لسلامتك أثناء السفر'
                          : 'لم يُحدد بعد — يرجى الاختيار'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onSaveEmergency({
                            ...emergencyEquipment,
                            [eq.key]: true,
                          })
                        }
                        className={`min-h-[34px] rounded-lg border text-xs font-bold flex items-center justify-center gap-1 ${
                          eq.value === true
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-[#262E3B] bg-[#171C24] text-slate-300'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>متوفر</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSaveEmergency({
                            ...emergencyEquipment,
                            [eq.key]: false,
                          })
                        }
                        className={`min-h-[34px] rounded-lg border text-xs font-bold ${
                          eq.value === false
                            ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                            : 'border-[#262E3B] bg-[#171C24] text-slate-300'
                        }`}
                      >
                        غير متوفر
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {(emergencyEquipment.hasJack === false ||
                emergencyEquipment.hasLugWrench === false) && (
                <div className="mt-3 rounded-xl border border-red-500/60 bg-red-500/15 px-3.5 py-2.5 text-xs font-bold text-red-400">
                  تنبيه هام: لابد من توافرهما لسلامتك أثناء السفر
                </div>
              )}
            </div>
          )}

          {/* 5 Independent Tire Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tireRecords.map((tire) => {
              const configured =
                tire.isConfigured !== false && tire.dotWeek != null && tire.dotYear != null;
              const ageYears = configured
                ? getTireAgeYearsFromDot(tire.dotWeek!, tire.dotYear!)
                : null;
              const isRed =
                (ageYears !== null && ageYears >= 6) || tire.treadStatus === 'NEEDS_REPLACEMENT';
              const isYellow =
                !isRed &&
                (!configured || (ageYears !== null && ageYears >= 5) || tire.treadStatus === 'FOLLOW_UP');

              return (
                <div
                  key={tire.id}
                  className={`rounded-2xl border bg-[#171C24] p-4 ${
                    isRed
                      ? 'border-red-500/60'
                      : isYellow
                      ? 'border-amber-500/60'
                      : 'border-[#262E3B]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0D1015] text-[#E11D2E]">
                        <Disc className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{tire.positionLabel}</h4>
                        <p className="font-mono-nums text-xs text-slate-400">
                          {configured
                            ? `DOT: W${String(tire.dotWeek).padStart(2, '0')} / ${tire.dotYear}`
                            : 'DOT: غير مدخل بعد'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        !configured
                          ? 'text-amber-300'
                          : isRed
                          ? 'text-red-400'
                          : isYellow
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {ageYears !== null ? `${ageYears.toFixed(1)} سنة` : 'مطلوب الإدخال'}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-slate-300">
                    {configured ? (
                      <>
                        <p>
                          الماركة والمقاس: {tire.brand || '—'} · {tire.size || '—'}
                        </p>
                        <p className="font-mono-nums">
                          التركيب: {tire.installDate || '—'} ·{' '}
                          {formatDistance(tire.installOdometerKm, vehicle.odometerUnit)}
                        </p>
                      </>
                    ) : (
                      <p className="text-amber-200/90">
                        لم يتم إدخال الماركة والمقاس وتاريخ DOT بعد.
                      </p>
                    )}
                    <p>
                      الحالة:{' '}
                      {tire.treadStatus === 'GOOD'
                        ? 'جيدة'
                        : tire.treadStatus === 'FOLLOW_UP'
                        ? 'تحتاج متابعة'
                        : 'تحتاج تغيير'}
                    </p>
                    {tire.conditionNotes && <p className="text-slate-400">{tire.conditionNotes}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => openTireEdit(tire)}
                    className={`mt-3 min-h-[40px] w-full rounded-xl text-xs font-bold ${
                      configured
                        ? 'border border-[#262E3B] bg-[#0D1015] text-white hover:border-[#E11D2E]'
                        : 'bg-[#E11D2E] text-white hover:bg-[#C81625]'
                    }`}
                  >
                    {configured ? 'تحديث / تغيير هذا الإطار' : 'إدخال بيانات الإطار'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'DOCS' && (
        <div className="space-y-5">
          {vehicle.ownershipType === 'POWER_OF_ATTORNEY' && (
            <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white">حالة الشراء بتوكيل</h4>
                <p className="text-xs text-slate-400">
                  {vehicle.poaRegisteredContractDone
                    ? 'تم تأكيد عمل عقد مسجل — لن يظهر تنبيه الـ 60 يومًا.'
                    : 'لم يُسجل العقد بعد — يظهر تنبيه قبل انتهاء ترخيص السيارة بـ 60 يومًا.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onTogglePoaRegistered(!vehicle.poaRegisteredContractDone)}
                className={`min-h-[42px] rounded-xl px-4 text-xs font-bold ${
                  vehicle.poaRegisteredContractDone
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-[#E11D2E] text-white'
                }`}
              >
                {vehicle.poaRegisteredContractDone ? 'مُسجل بالفعل (اضغط للتغيير)' : 'تأكيد: تم عمل عقد مسجل'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {documentRecords.map((doc) => {
              const daysLeft = daysBetween(todayIsoDate(), doc.expiryDate);
              const isRed = daysLeft <= 30;
              const isYellow = !isRed && daysLeft <= 45;

              return (
                <div
                  key={doc.id}
                  className={`rounded-2xl border bg-[#171C24] p-5 flex flex-col justify-between ${
                    isRed
                      ? 'border-red-500/60'
                      : isYellow
                      ? 'border-amber-500/60'
                      : 'border-[#262E3B]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D1015] text-[#E11D2E]">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {DOC_TITLES[doc.docType] ?? doc.docType}
                        </h4>
                        <p className="font-mono-nums text-xs text-slate-400">
                          الانتهاء: {doc.expiryDate}
                        </p>
                      </div>
                    </div>

                    <p
                      className={`mt-3 text-xs font-bold ${
                        isRed ? 'text-red-400' : isYellow ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {daysLeft <= 0
                        ? `منتهي منذ ${Math.abs(daysLeft)} يومًا`
                        : `متبقي ${daysLeft} يومًا`}
                    </p>

                    {doc.previousHistory.length > 0 && (
                      <div className="mt-3 border-t border-[#262E3B] pt-2.5">
                        <p className="text-[11px] font-semibold text-slate-400">سجل التجديدات السابقة:</p>
                        <ul className="mt-1 space-y-1">
                          {doc.previousHistory.map((h, i) => (
                            <li key={i} className="font-mono-nums text-[11px] text-slate-500">
                              انتهى في {h.expiryDate} (تم التجديد في {h.renewedAt})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRenewDoc(doc);
                      setNewExpiry(doc.expiryDate);
                    }}
                    className="mt-4 min-h-[42px] w-full rounded-xl bg-[#E11D2E] text-xs font-bold text-white hover:bg-[#C81625]"
                  >
                    تجديد وحفظ السجل السابق
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editingTire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleTireSave}
            className="w-full max-w-md rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-3"
          >
            <h3 className="text-base font-bold text-white">تحديث إطار: {editingTire.positionLabel}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">أسبوع التصنيع (DOT Week 1-53)</label>
                <input
                  type="number"
                  min={1}
                  max={53}
                  value={editingTire.dotWeek ?? ''}
                  onChange={(e) =>
                    setEditingTire({
                      ...editingTire,
                      dotWeek: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="مثال: 24"
                  className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">سنة التصنيع (DOT Year)</label>
                <input
                  type="number"
                  min={2005}
                  max={2030}
                  value={editingTire.dotYear ?? ''}
                  onChange={(e) =>
                    setEditingTire({
                      ...editingTire,
                      dotYear: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="مثال: 2023"
                  className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={editingTire.brand}
                onChange={(e) => setEditingTire({ ...editingTire, brand: e.target.value })}
                placeholder="الماركة"
                className="rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
                required
              />
              <input
                type="text"
                value={editingTire.size}
                onChange={(e) => setEditingTire({ ...editingTire, size: e.target.value })}
                placeholder="المقاس (مثال: 205/55R16)"
                className="rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={editingTire.installDate || todayIsoDate()}
                onChange={(e) => setEditingTire({ ...editingTire, installDate: e.target.value })}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
              />
              <input
                type="number"
                value={tireOdoDisplay}
                onChange={(e) => setTireOdoDisplay(e.target.value)}
                placeholder={`عداد التركيب (${vehicle.odometerUnit})`}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
              />
            </div>
            <select
              value={editingTire.treadStatus}
              onChange={(e) =>
                setEditingTire({ ...editingTire, treadStatus: e.target.value as ConditionStatus })
              }
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
            >
              <option value="GOOD">النقشة جيدة</option>
              <option value="FOLLOW_UP">يحتاج متابعة</option>
              <option value="NEEDS_REPLACEMENT">يحتاج استبدال</option>
            </select>
            <input
              type="text"
              value={editingTire.conditionNotes}
              onChange={(e) => setEditingTire({ ...editingTire, conditionNotes: e.target.value })}
              placeholder="ملاحظات النقشة والتشققات"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTire(null)}
                className="min-h-[42px] rounded-xl border border-[#262E3B] px-4 text-xs text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-[#E11D2E] px-5 text-xs font-bold text-white"
              >
                حفظ الإطار
              </button>
            </div>
          </form>
        </div>
      )}

      {renewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleRenewSubmit}
            className="w-full max-w-md rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-4"
          >
            <h3 className="text-base font-bold text-white">
              تجديد: {DOC_TITLES[renewDoc.docType] ?? renewDoc.docType}
            </h3>
            <p className="text-xs text-slate-400">
              سيتم حفظ التاريخ السابق ({renewDoc.expiryDate}) في سجل التجديدات تلقائيًا.
            </p>
            <input
              type="date"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
              className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
              required
            />
            <input
              type="text"
              value={renewNotes}
              onChange={(e) => setRenewNotes(e.target.value)}
              placeholder="ملاحظات التجديد (اختياري)"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenewDoc(null)}
                className="min-h-[42px] rounded-xl border border-[#262E3B] px-4 text-xs text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-[#E11D2E] px-5 text-xs font-bold text-white"
              >
                تأكيد التجديد
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

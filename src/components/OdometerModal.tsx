import React, { useState } from 'react';
import { AlertTriangle, Gauge, History, X } from 'lucide-react';
import type { FuelEntry, OdometerEntry, Vehicle } from '../domain/types';
import { formatDistance, fromInternalKm, toInternalKm } from '../domain/units';

interface OdometerModalProps {
  isOpen: boolean;
  vehicle: Vehicle;
  odometerEntries: OdometerEntry[];
  fuelEntries: FuelEntry[];
  onClose: () => void;
  onNormalUpdate: (newKm: number) => Promise<void>;
  onCorrectOdometer: (params: {
    correctedReadingKm: number;
    reason: string;
    targetFuelEntryId?: string;
  }) => Promise<void>;
}

export const OdometerModal: React.FC<OdometerModalProps> = ({
  isOpen,
  vehicle,
  odometerEntries,
  fuelEntries,
  onClose,
  onNormalUpdate,
  onCorrectOdometer,
}) => {
  const [tab, setTab] = useState<'UPDATE' | 'CORRECTION' | 'HISTORY'>('UPDATE');
  const hasReading = vehicle.hasOdometerReading !== false;
  const currentDisplay = Math.round(
    fromInternalKm(vehicle.currentOdometerKm, vehicle.odometerUnit) * 100
  ) / 100;

  const [newReadingInput, setNewReadingInput] = useState(hasReading ? String(currentDisplay) : '');
  const [corrReadingInput, setCorrReadingInput] = useState(hasReading ? String(currentDisplay) : '');
  const [corrReason, setCorrReason] = useState('');
  const [targetFuelId, setTargetFuelId] = useState<string>('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleNormalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const val = parseFloat(newReadingInput);
    if (!Number.isFinite(val) || val < 0) {
      setError('قراءة العداد غير صالحة.');
      return;
    }
    setSaving(true);
    try {
      await onNormalUpdate(toInternalKm(val, vehicle.odometerUnit));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحديث العداد.');
    } finally {
      setSaving(false);
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const val = parseFloat(corrReadingInput);
    if (!Number.isFinite(val) || val < 0) {
      setError('القيمة المصححة غير صالحة.');
      return;
    }
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }
    setSaving(true);
    try {
      await onCorrectOdometer({
        correctedReadingKm: toInternalKm(val, vehicle.odometerUnit),
        reason: corrReason || 'تصحيح قراءة سابقة',
        targetFuelEntryId: targetFuelId || undefined,
      });
      setConfirmStep(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تصحيح العداد.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4">
      <div className="my-auto w-full max-w-xl rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 md:p-6">
        <div className="flex items-center justify-between border-b border-[#262E3B] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E11D2E]/15 text-[#E11D2E]">
              <Gauge className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">العداد — {vehicle.brand} {vehicle.model}</h2>
              <p className="font-mono-nums text-xs text-slate-400">
                القراءة الحالية:{' '}
                {hasReading
                  ? formatDistance(vehicle.currentOdometerKm, vehicle.odometerUnit)
                  : 'غير مسجلة بعد'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#262E3B] text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#0D1015] p-1">
          <button
            type="button"
            onClick={() => {
              setTab('UPDATE');
              setError(null);
            }}
            className={`min-h-[40px] rounded-lg text-xs font-bold ${
              tab === 'UPDATE' ? 'bg-[#E11D2E] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            تحديث القراءة
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('CORRECTION');
              setConfirmStep(false);
              setError(null);
            }}
            className={`min-h-[40px] rounded-lg text-xs font-bold ${
              tab === 'CORRECTION' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            تصحيح العداد
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('HISTORY');
              setError(null);
            }}
            className={`min-h-[40px] rounded-lg text-xs font-bold ${
              tab === 'HISTORY' ? 'bg-[#1D232E] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            سجل القراءات ({odometerEntries.length})
          </button>
        </div>

        {tab === 'UPDATE' && (
          <form onSubmit={handleNormalSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                القراءة الجديدة ({vehicle.odometerUnit})
              </label>
              <input
                type="number"
                step="any"
                min={0}
                value={newReadingInput}
                onChange={(e) => setNewReadingInput(e.target.value)}
                className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-4 py-3 text-lg font-bold text-white focus:border-[#E11D2E] focus:outline-none"
                required
              />
              <p className="mt-1.5 text-xs text-slate-400">
                {hasReading
                  ? `لا يقبل التحديث العادي قراءة أقل من آخر قراءة معتمدة (${currentDisplay} ${vehicle.odometerUnit}).`
                  : 'هذه أول قراءة عداد للسيارة — أدخل القراءة الحالية كما تظهر في التابلوه.'}
              </p>
            </div>
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-semibold text-red-300">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="min-h-[46px] w-full rounded-xl bg-[#E11D2E] font-bold text-white hover:bg-[#C81625]"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ القراءة الجديدة'}
            </button>
          </form>
        )}

        {tab === 'CORRECTION' && (
          <form onSubmit={handleCorrectionSubmit} className="mt-4 space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p>
                يتم حفظ القراءة السابقة والجديدة والتوقيت في سجل التصحيحات، وتُعاد حسابات المسافات ومؤشرات الوقود والصيانة المتأثرة دون حذف أو تغيير أي مصروف أصلي.
              </p>
            </div>

            {fuelEntries.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  نطاق التصحيح
                </label>
                <select
                  value={targetFuelId}
                  onChange={(e) => {
                    setTargetFuelId(e.target.value);
                    const found = fuelEntries.find((f) => f.id === e.target.value);
                    if (found) {
                      setCorrReadingInput(
                        String(Math.round(fromInternalKm(found.odometerKm, vehicle.odometerUnit)))
                      );
                    } else {
                      setCorrReadingInput(String(currentDisplay));
                    }
                    setConfirmStep(false);
                  }}
                  className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">تصحيح قراءة العداد الحالية للسيارة</option>
                  {fuelEntries.map((f) => (
                    <option key={f.id} value={f.id}>
                      تصحيح قراءة تفويلة ({f.dateTime.replace('T', ' ')}) — الحالية:{' '}
                      {Math.round(fromInternalKm(f.odometerKm, vehicle.odometerUnit))} {vehicle.odometerUnit}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                القراءة المصححة ({vehicle.odometerUnit})
              </label>
              <input
                type="number"
                step="any"
                min={0}
                value={corrReadingInput}
                onChange={(e) => {
                  setCorrReadingInput(e.target.value);
                  setConfirmStep(false);
                }}
                className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-4 py-3 text-base font-bold text-white focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">سبب التصحيح</label>
              <input
                type="text"
                value={corrReason}
                onChange={(e) => setCorrReason(e.target.value)}
                placeholder="مثال: تصحيح رقم مسجل بالخطأ"
                className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            {confirmStep && (
              <div className="rounded-xl border border-[#E11D2E] bg-[#E11D2E]/10 p-3 text-xs font-bold text-white">
                تأكيد نهائي: سيتم تسجيل هذا التعديل كـ «تصحيح معتمد» مع الاحتفاظ بالقيمة السابقة ({currentDisplay} {vehicle.odometerUnit}). اضغط مرة أخرى للتنفيذ.
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="min-h-[46px] w-full rounded-xl bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
            >
              {saving ? 'جارٍ التصحيح...' : confirmStep ? 'تأكيد وتنفيذ التصحيح' : 'مراجعة وتصحيح العداد'}
            </button>
          </form>
        )}

        {tab === 'HISTORY' && (
          <div className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-1">
            {odometerEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between rounded-xl border border-[#262E3B] bg-[#0D1015] p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-400" />
                    <span className="font-mono-nums text-sm font-bold text-white">
                      {formatDistance(entry.readingKm, vehicle.odometerUnit)}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        entry.entryType === 'CORRECTION'
                          ? 'text-amber-400'
                          : entry.entryType === 'INITIAL'
                          ? 'text-sky-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      ·{' '}
                      {entry.entryType === 'CORRECTION'
                        ? 'تم التصحيح'
                        : entry.entryType === 'INITIAL'
                        ? 'بداية'
                        : 'تحديث عادي'}
                    </span>
                  </div>
                  {entry.entryType === 'CORRECTION' && entry.previousReadingKm !== undefined && (
                    <p className="mt-1 text-xs text-amber-300">
                      القيمة السابقة قبل التصحيح:{' '}
                      {formatDistance(entry.previousReadingKm, vehicle.odometerUnit)}
                    </p>
                  )}
                  {entry.reason && <p className="mt-0.5 text-xs text-slate-400">{entry.reason}</p>}
                </div>
                <span className="font-mono-nums text-[11px] text-slate-500">
                  {entry.recordedAt.replace('T', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

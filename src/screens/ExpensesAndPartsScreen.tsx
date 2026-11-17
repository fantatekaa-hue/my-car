import React, { useState } from 'react';
import { Cog, Plus, Receipt } from 'lucide-react';
import type {
  AdditionalExpenseCategory,
  Expense,
  FaultRecord,
  MaintenanceRecord,
  SparePart,
  Vehicle,
} from '../domain/types';
import {
  formatDistance,
  formatMoney,
  fromInternalKm,
  toInternalKm,
  todayIsoDate,
  toPiastres,
} from '../domain/units';

interface ExpensesAndPartsScreenProps {
  initialTab?: 'EXPENSES' | 'PARTS';
  vehicle: Vehicle;
  expenses: Expense[];
  spareParts: SparePart[];
  maintenanceRecords: MaintenanceRecord[];
  faultRecords: FaultRecord[];
  currencySymbol: string;
  onAddAdditionalExpense: (params: {
    vehicleId: string;
    categoryLabel: string;
    date: string;
    amountPiastres: number;
    odometerKm?: number;
    notes?: string;
  }) => Promise<void>;
  onAddSparePart: (input: Omit<SparePart, 'id' | 'createdAt'>) => Promise<void>;
}

const ADDITIONAL_CATEGORIES: AdditionalExpenseCategory[] = [
  'غسيل',
  'معطرات ومنظفات',
  'إكسسوارات ورفاهيات',
  'ركنة وجراج',
  'أخرى',
];

export const ExpensesAndPartsScreen: React.FC<ExpensesAndPartsScreenProps> = ({
  initialTab = 'EXPENSES',
  vehicle,
  expenses,
  spareParts,
  maintenanceRecords,
  faultRecords,
  currencySymbol,
  onAddAdditionalExpense,
  onAddSparePart,
}) => {
  const [tab, setTab] = useState<'EXPENSES' | 'PARTS'>(initialTab);

  // Additional expense state
  const [category, setCategory] = useState<string>('غسيل');
  const [customCategory, setCustomCategory] = useState('');
  const [expDate, setExpDate] = useState(todayIsoDate());
  const [expAmount, setExpAmount] = useState('');
  const [expOdo, setExpOdo] = useState(
    vehicle.hasOdometerReading !== false
      ? String(Math.round(fromInternalKm(vehicle.currentOdometerKm, vehicle.odometerUnit)))
      : ''
  );
  const [expNotes, setExpNotes] = useState('');

  // Spare part state
  const [partName, setPartName] = useState('');
  const [partBrand, setPartBrand] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayIsoDate());
  const [installDate, setInstallDate] = useState(todayIsoDate());
  const [partOdo, setPartOdo] = useState(
    vehicle.hasOdometerReading !== false
      ? String(Math.round(fromInternalKm(vehicle.currentOdometerKm, vehicle.odometerUnit)))
      : ''
  );
  const [partPrice, setPartPrice] = useState('');
  const [vendor, setVendor] = useState('');
  const [partNotes, setPartNotes] = useState('');
  const [linkedType, setLinkedType] = useState<'STANDALONE' | 'MAINTENANCE' | 'FAULT'>('STANDALONE');
  const [linkedId, setLinkedId] = useState('');
  const [includedInParentCost, setIncludedInParentCost] = useState(false);

  const handleSaveAdditional = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountP = toPiastres(expAmount);
    if (amountP <= 0) return;
    const catLabel = category === 'أخرى' && customCategory.trim() ? customCategory.trim() : category;
    await onAddAdditionalExpense({
      vehicleId: vehicle.id,
      categoryLabel: catLabel,
      date: expDate,
      amountPiastres: amountP,
      odometerKm: expOdo ? toInternalKm(parseFloat(expOdo), vehicle.odometerUnit) : undefined,
      notes: expNotes.trim() || undefined,
    });
    setExpAmount('');
    setExpNotes('');
  };

  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) return;
    await onAddSparePart({
      vehicleId: vehicle.id,
      partName: partName.trim(),
      brand: partBrand.trim() || 'غير محدد',
      purchaseDate,
      installDate,
      odometerKm: toInternalKm(parseFloat(partOdo) || 0, vehicle.odometerUnit),
      pricePiastres: toPiastres(partPrice || '0'),
      vendorOrCenter: vendor.trim() || undefined,
      notes: partNotes.trim() || undefined,
      linkedRecordType: linkedType,
      linkedRecordId: linkedType !== 'STANDALONE' ? linkedId || undefined : undefined,
      includedInParentCost: linkedType !== 'STANDALONE' ? includedInParentCost : false,
    });
    setPartName('');
    setPartBrand('');
    setPartPrice('');
    setPartNotes('');
  };

  const automaticExpenses = expenses.filter((e) => e.isAutomatic);
  const additionalExpenses = expenses.filter((e) => !e.isAutomatic);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#262E3B] bg-[#171C24] p-1.5 max-w-md">
        <button
          type="button"
          onClick={() => setTab('EXPENSES')}
          className={`min-h-[44px] rounded-xl text-xs font-bold ${
            tab === 'EXPENSES' ? 'bg-[#E11D2E] text-white' : 'text-slate-300'
          }`}
        >
          المصروفات ({expenses.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('PARTS')}
          className={`min-h-[44px] rounded-xl text-xs font-bold ${
            tab === 'PARTS' ? 'bg-[#E11D2E] text-white' : 'text-slate-300'
          }`}
        >
          قطع الغيار ({spareParts.length})
        </button>
      </div>

      {tab === 'EXPENSES' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSaveAdditional}
            className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-4 lg:col-span-5"
          >
            <div className="flex items-center gap-3 border-b border-[#262E3B] pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E11D2E] text-white">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">إضافة مصروف إضافي</h3>
                <p className="text-xs text-slate-400">
                  الوقود والصيانة والإصلاحات تُضاف تلقائيًا من أقسامها لمنع التكرار
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {ADDITIONAL_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`min-h-[38px] rounded-xl border px-3 text-xs font-bold ${
                    category === c
                      ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                      : 'border-[#262E3B] bg-[#0D1015] text-slate-300'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {category === 'أخرى' && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="اسم التصنيف"
                className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
              />
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder={`المبلغ (${currencySymbol})`}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
                required
              />
            </div>

            <input
              type="number"
              value={expOdo}
              onChange={(e) => setExpOdo(e.target.value)}
              placeholder={`قراءة العداد (${vehicle.odometerUnit}) اختياري`}
              className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
            />
            <input
              type="text"
              value={expNotes}
              onChange={(e) => setExpNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
            />

            <button
              type="submit"
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#E11D2E] text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              <span>حفظ المصروف الإضافي</span>
            </button>
          </form>

          <div className="space-y-5 lg:col-span-7">
            <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5">
              <h3 className="text-base font-bold text-white">
                المصروفات الإضافية ({additionalExpenses.length})
              </h3>
              <div className="mt-3 space-y-2.5">
                {additionalExpenses.length === 0 ? (
                  <p className="text-xs text-slate-400">لا توجد مصروفات إضافية مسجلة.</p>
                ) : (
                  additionalExpenses.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-xl border border-[#262E3B] bg-[#0D1015] p-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{e.categoryLabel}</p>
                        <p className="font-mono-nums text-xs text-slate-400">
                          {e.date}
                          {e.odometerKm !== undefined
                            ? ` · ${formatDistance(e.odometerKm, vehicle.odometerUnit)}`
                            : ''}
                          {e.notes ? ` · ${e.notes}` : ''}
                        </p>
                      </div>
                      <span className="font-mono-nums text-sm font-bold text-[#E11D2E]">
                        {formatMoney(e.amountPiastres, currencySymbol)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5">
              <h3 className="text-base font-bold text-white">
                المصروفات التلقائية المرتبطة ({automaticExpenses.length})
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                تتحدث وتُلغى تلقائيًا من عملياتها الأصلية ولا يمكن تكرارها يدويًا.
              </p>
              <div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {automaticExpenses.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-xl border border-[#262E3B] bg-[#0D1015] p-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{e.categoryLabel}</p>
                      <p className="font-mono-nums text-xs text-slate-400">
                        {e.date}
                        {e.odometerKm !== undefined
                          ? ` · ${formatDistance(e.odometerKm, vehicle.odometerUnit)}`
                          : ''}
                      </p>
                    </div>
                    <span className="font-mono-nums text-sm font-bold text-emerald-400">
                      {formatMoney(e.amountPiastres, currencySymbol)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'PARTS' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSavePart}
            className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-3 lg:col-span-5"
          >
            <div className="flex items-center gap-3 border-b border-[#262E3B] pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E11D2E] text-white">
                <Cog className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">تسجيل قطعة غيار</h3>
                <p className="text-xs text-slate-400">بدون ضمان عام أو رفع صور فواتير</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="اسم القطعة"
                className="rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
                required
              />
              <input
                type="text"
                value={partBrand}
                onChange={(e) => setPartBrand(e.target.value)}
                placeholder="الماركة"
                className="rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">تاريخ الشراء</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">تاريخ التركيب</label>
                <input
                  type="date"
                  value={installDate}
                  onChange={(e) => setInstallDate(e.target.value)}
                  className="font-mono-nums w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={partOdo}
                onChange={(e) => setPartOdo(e.target.value)}
                placeholder={`العداد (${vehicle.odometerUnit})`}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                step="0.01"
                min={0}
                value={partPrice}
                onChange={(e) => setPartPrice(e.target.value)}
                placeholder={`السعر (${currencySymbol})`}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
              />
            </div>

            <select
              value={linkedType}
              onChange={(e) => {
                setLinkedType(e.target.value as 'STANDALONE' | 'MAINTENANCE' | 'FAULT');
                setLinkedId('');
              }}
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
            >
              <option value="STANDALONE">قطعة مستقلة (تُضاف للمصروفات)</option>
              <option value="MAINTENANCE">مرتبطة بعملية صيانة</option>
              <option value="FAULT">مرتبطة بعملية إصلاح عطل</option>
            </select>

            {linkedType === 'MAINTENANCE' && (
              <select
                value={linkedId}
                onChange={(e) => setLinkedId(e.target.value)}
                className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
              >
                <option value="">اختر عملية الصيانة...</option>
                {maintenanceRecords.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.date} — {m.customName || m.typeCode}
                  </option>
                ))}
              </select>
            )}

            {linkedType === 'FAULT' && (
              <select
                value={linkedId}
                onChange={(e) => setLinkedId(e.target.value)}
                className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
              >
                <option value="">اختر سجل الإصلاح...</option>
                {faultRecords.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.appearedAt} — {f.title}
                  </option>
                ))}
              </select>
            )}

            {linkedType !== 'STANDALONE' && (
              <label className="flex items-center gap-2 text-xs text-amber-300">
                <input
                  type="checkbox"
                  checked={includedInParentCost}
                  onChange={(e) => setIncludedInParentCost(e.target.checked)}
                  className="h-4 w-4 accent-[#E11D2E]"
                />
                <span>سعر هذه القطعة محسوب بالفعل ضمن إجمالي الصيانة/الإصلاح (لا تسجّل مصروفًا مكررًا)</span>
              </label>
            )}

            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="مكان الشراء / مركز الصيانة (اختياري)"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
            />
            <input
              type="text"
              value={partNotes}
              onChange={(e) => setPartNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
            />

            <button
              type="submit"
              className="min-h-[46px] w-full rounded-xl bg-[#E11D2E] text-sm font-bold text-white"
            >
              حفظ قطعة الغيار
            </button>
          </form>

          <div className="space-y-3 lg:col-span-7">
            {spareParts.map((p) => (
              <div key={p.id} className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-white">
                    {p.partName} ({p.brand})
                  </span>
                  <span className="font-mono-nums text-sm font-bold text-[#E11D2E]">
                    {formatMoney(p.pricePiastres, currencySymbol)}
                  </span>
                </div>
                <p className="font-mono-nums mt-1 text-xs text-slate-400">
                  الشراء: {p.purchaseDate} · التركيب: {p.installDate} ·{' '}
                  {formatDistance(p.odometerKm, vehicle.odometerUnit)}
                </p>
                {p.vendorOrCenter && (
                  <p className="mt-1 text-xs text-slate-400">المصدر: {p.vendorOrCenter}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

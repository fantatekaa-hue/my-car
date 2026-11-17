import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ClipboardList, Plus, Wrench } from 'lucide-react';
import type { FaultRecord, FaultStatus, PendingTask, TaskPriority, Vehicle } from '../domain/types';
import {
  formatDistance,
  formatMoney,
  fromInternalKm,
  toInternalKm,
  todayIsoDate,
  toPiastres,
} from '../domain/units';

interface FaultsAndTasksScreenProps {
  vehicle: Vehicle;
  faultRecords: FaultRecord[];
  pendingTasks: PendingTask[];
  currencySymbol: string;
  onAddPendingTask: (input: Omit<PendingTask, 'id' | 'status' | 'createdAt'>) => Promise<void>;
  onCompletePendingTask: (params: {
    taskId: string;
    repairPerformed: string;
    partsCostPiastres: number;
    laborCostPiastres: number;
    mechanicOrCenter?: string;
    repairedAt?: string;
    odometerKm?: number;
  }) => Promise<void>;
  onSaveFault: (input: Omit<FaultRecord, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
}

export const FaultsAndTasksScreen: React.FC<FaultsAndTasksScreenProps> = ({
  vehicle,
  faultRecords,
  pendingTasks,
  currencySymbol,
  onAddPendingTask,
  onCompletePendingTask,
  onSaveFault,
}) => {
  const [tab, setTab] = useState<'TASKS' | 'FAULTS'>('TASKS');

  // Pending task form
  const [partOrIssue, setPartOrIssue] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskOdo, setTaskOdo] = useState(
    vehicle.hasOdometerReading !== false
      ? String(Math.round(fromInternalKm(vehicle.currentOdometerKm, vehicle.odometerUnit)))
      : ''
  );
  const [priority, setPriority] = useState<TaskPriority>('URGENT');

  // Task completion dialog state
  const [completingTask, setCompletingTask] = useState<PendingTask | null>(null);
  const [compRepairPerformed, setCompRepairPerformed] = useState('');
  const [compPartsCost, setCompPartsCost] = useState('');
  const [compLaborCost, setCompLaborCost] = useState('');
  const [compMechanic, setCompMechanic] = useState('');

  // Fault form
  const [faultTitle, setFaultTitle] = useState('');
  const [faultDate, setFaultDate] = useState(todayIsoDate());
  const [faultOdo, setFaultOdo] = useState(
    vehicle.hasOdometerReading !== false
      ? String(Math.round(fromInternalKm(vehicle.currentOdometerKm, vehicle.odometerUnit)))
      : ''
  );
  const [faultDesc, setFaultDesc] = useState('');
  const [faultDiag, setFaultDiag] = useState('');
  const [faultRepair, setFaultRepair] = useState('');
  const [faultPartsCost, setFaultPartsCost] = useState('');
  const [faultLaborCost, setFaultLaborCost] = useState('');
  const [faultMechanic, setFaultMechanic] = useState('');
  const [faultStatus, setFaultStatus] = useState<FaultStatus>('UNREPAIRED');

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partOrIssue.trim()) return;
    await onAddPendingTask({
      vehicleId: vehicle.id,
      partOrIssue: partOrIssue.trim(),
      description: taskDesc.trim() || undefined,
      odometerKm: toInternalKm(parseFloat(taskOdo) || 0, vehicle.odometerUnit),
      priority,
    });
    setPartOrIssue('');
    setTaskDesc('');
  };

  const handleCompleteTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask) return;
    await onCompletePendingTask({
      taskId: completingTask.id,
      repairPerformed: compRepairPerformed.trim() || 'تم الإصلاح',
      partsCostPiastres: toPiastres(compPartsCost || '0'),
      laborCostPiastres: toPiastres(compLaborCost || '0'),
      mechanicOrCenter: compMechanic.trim() || undefined,
      repairedAt: todayIsoDate(),
      odometerKm: vehicle.currentOdometerKm,
    });
    setCompletingTask(null);
    setCompRepairPerformed('');
    setCompPartsCost('');
    setCompLaborCost('');
    setCompMechanic('');
  };

  const handleAddFault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faultTitle.trim()) return;
    const partsP = toPiastres(faultPartsCost || '0');
    const laborP = toPiastres(faultLaborCost || '0');
    await onSaveFault({
      vehicleId: vehicle.id,
      title: faultTitle.trim(),
      appearedAt: faultDate,
      odometerKm: toInternalKm(parseFloat(faultOdo) || 0, vehicle.odometerUnit),
      description: faultDesc.trim(),
      diagnosis: faultDiag.trim() || undefined,
      repairPerformed: faultRepair.trim() || undefined,
      partsCostPiastres: partsP,
      laborCostPiastres: laborP,
      totalCostPiastres: partsP + laborP,
      mechanicOrCenter: faultMechanic.trim() || undefined,
      status: faultStatus,
      repairedAt: faultStatus === 'REPAIRED' ? todayIsoDate() : undefined,
    });
    setFaultTitle('');
    setFaultDesc('');
    setFaultDiag('');
    setFaultRepair('');
    setFaultPartsCost('');
    setFaultLaborCost('');
  };

  const activeTasks = pendingTasks.filter((t) => t.status === 'PENDING');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#262E3B] bg-[#171C24] p-1.5 max-w-md">
        <button
          type="button"
          onClick={() => setTab('TASKS')}
          className={`min-h-[44px] rounded-xl text-xs font-bold ${
            tab === 'TASKS' ? 'bg-[#E11D2E] text-white' : 'text-slate-300'
          }`}
        >
          الأعمال المطلوبة ({activeTasks.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('FAULTS')}
          className={`min-h-[44px] rounded-xl text-xs font-bold ${
            tab === 'FAULTS' ? 'bg-[#E11D2E] text-white' : 'text-slate-300'
          }`}
        >
          سجل الأعطال والإصلاحات ({faultRecords.length})
        </button>
      </div>

      {tab === 'TASKS' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleAddTask}
            className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-4 lg:col-span-5"
          >
            <div className="flex items-center gap-3 border-b border-[#262E3B] pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E11D2E] text-white">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">إضافة عمل مطلوب</h3>
                <p className="text-xs text-slate-400">لا يختفي بتغير العداد أو الوقت حتى تأكيد «تم الإصلاح»</p>
              </div>
            </div>

            <input
              type="text"
              value={partOrIssue}
              onChange={(e) => setPartOrIssue(e.target.value)}
              placeholder="اسم الجزء أو المشكلة"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
              required
            />
            <textarea
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              placeholder="وصف أو ملاحظة (اختياري)"
              rows={2}
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={taskOdo}
                onChange={(e) => setTaskOdo(e.target.value)}
                placeholder={`العداد (${vehicle.odometerUnit})`}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
              >
                <option value="URGENT">أهمية عاجلة (أحمر)</option>
                <option value="NORMAL">أهمية عادية (أصفر)</option>
              </select>
            </div>
            <button
              type="submit"
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#E11D2E] text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة للقائمة المطلوبة</span>
            </button>
          </form>

          <div className="space-y-3 lg:col-span-7">
            {pendingTasks.length === 0 ? (
              <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-6 text-sm text-slate-400">
                لا توجد أعمال مطلوبة حاليًا.
              </div>
            ) : (
              pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-white">{task.partOrIssue}</p>
                      <p className="font-mono-nums mt-0.5 text-xs text-slate-400">
                        {formatDistance(task.odometerKm, vehicle.odometerUnit)} ·{' '}
                        {task.status === 'PENDING' ? (
                          <span className={task.priority === 'URGENT' ? 'text-red-400 font-bold' : 'text-amber-400 font-bold'}>
                            {task.priority === 'URGENT' ? 'قيد الانتظار (عاجل)' : 'قيد الانتظار'}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold">تم الإصلاح والتحويل لسجل الأعطال</span>
                        )}
                      </p>
                      {task.description && <p className="mt-1 text-xs text-slate-300">{task.description}</p>}
                    </div>
                    {task.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => setCompletingTask(task)}
                        className="flex min-h-[42px] items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>تم الإصلاح</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'FAULTS' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleAddFault}
            className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-3 lg:col-span-5"
          >
            <div className="flex items-center gap-3 border-b border-[#262E3B] pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E11D2E] text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">تسجيل عطل أو إصلاح</h3>
                <p className="text-xs text-slate-400">بدون صور أعطال · يرتبط بالمصروفات تلقائيًا عند الإصلاح</p>
              </div>
            </div>

            <input
              type="text"
              value={faultTitle}
              onChange={(e) => setFaultTitle(e.target.value)}
              placeholder="اسم العطل"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={faultDate}
                onChange={(e) => setFaultDate(e.target.value)}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
              />
              <input
                type="number"
                value={faultOdo}
                onChange={(e) => setFaultOdo(e.target.value)}
                placeholder={`العداد (${vehicle.odometerUnit})`}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
              />
            </div>
            <select
              value={faultStatus}
              onChange={(e) => setFaultStatus(e.target.value as FaultStatus)}
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
            >
              <option value="UNREPAIRED">لم يتم الإصلاح</option>
              <option value="DIAGNOSED_NOT_REPAIRED">تم التشخيص ولم يتم الإصلاح</option>
              <option value="REPAIRED">تم الإصلاح</option>
            </select>
            <textarea
              value={faultDesc}
              onChange={(e) => setFaultDesc(e.target.value)}
              placeholder="وصف العطل"
              rows={2}
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
            />
            <input
              type="text"
              value={faultDiag}
              onChange={(e) => setFaultDiag(e.target.value)}
              placeholder="التشخيص (اختياري)"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
            />
            <input
              type="text"
              value={faultRepair}
              onChange={(e) => setFaultRepair(e.target.value)}
              placeholder="الإصلاح الذي تم (اختياري)"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="0.01"
                min={0}
                value={faultPartsCost}
                onChange={(e) => setFaultPartsCost(e.target.value)}
                placeholder={`تكلفة القطع (${currencySymbol})`}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
              />
              <input
                type="number"
                step="0.01"
                min={0}
                value={faultLaborCost}
                onChange={(e) => setFaultLaborCost(e.target.value)}
                placeholder={`أجرة الفني (${currencySymbol})`}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-xs text-white"
              />
            </div>
            <input
              type="text"
              value={faultMechanic}
              onChange={(e) => setFaultMechanic(e.target.value)}
              placeholder="اسم الميكانيكي / المركز (اختياري)"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              className="min-h-[46px] w-full rounded-xl bg-[#E11D2E] text-sm font-bold text-white"
            >
              حفظ العطل
            </button>
          </form>

          <div className="space-y-3 lg:col-span-7">
            {faultRecords.map((f) => (
              <div key={f.id} className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-bold text-white">{f.title}</span>
                  <span className="font-mono-nums text-sm font-bold text-[#E11D2E]">
                    {formatMoney(f.totalCostPiastres, currencySymbol)}
                  </span>
                </div>
                <p className="font-mono-nums mt-1 text-xs text-slate-400">
                  ظهور: {f.appearedAt} · {formatDistance(f.odometerKm, vehicle.odometerUnit)} ·{' '}
                  {f.status === 'REPAIRED'
                    ? 'تم الإصلاح'
                    : f.status === 'DIAGNOSED_NOT_REPAIRED'
                    ? 'تم التشخيص ولم يتم الإصلاح'
                    : 'لم يتم الإصلاح'}
                </p>
                {f.description && <p className="mt-1 text-xs text-slate-300">{f.description}</p>}
                {f.repairPerformed && (
                  <p className="mt-1 text-xs text-emerald-400">الإصلاح: {f.repairPerformed}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {completingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleCompleteTaskSubmit}
            className="w-full max-w-md rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">إتمام الإصلاح: {completingTask.partOrIssue}</h3>
            </div>
            <input
              type="text"
              value={compRepairPerformed}
              onChange={(e) => setCompRepairPerformed(e.target.value)}
              placeholder="تفاصيل الإصلاح الذي تم"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="0.01"
                min={0}
                value={compPartsCost}
                onChange={(e) => setCompPartsCost(e.target.value)}
                placeholder={`قطع الغيار (${currencySymbol})`}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
              />
              <input
                type="number"
                step="0.01"
                min={0}
                value={compLaborCost}
                onChange={(e) => setCompLaborCost(e.target.value)}
                placeholder={`أجرة الفني (${currencySymbol})`}
                className="font-mono-nums rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
              />
            </div>
            <input
              type="text"
              value={compMechanic}
              onChange={(e) => setCompMechanic(e.target.value)}
              placeholder="اسم الميكانيكي / المركز (اختياري)"
              className="w-full rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2.5 text-sm text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompletingTask(null)}
                className="min-h-[42px] rounded-xl border border-[#262E3B] px-4 text-xs text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white"
              >
                تأكيد «تم الإصلاح»
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

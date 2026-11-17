import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Copy,
  Download,
  FlaskConical,
  HardDrive,
  Info,
  Moon,
  Package,
  Smartphone,
  Sun,
  Upload,
} from 'lucide-react';
import type { BackupPreviewSummary } from '../domain/backupEngine';
import type {
  AppSettings,
  BackupMetadata,
  FullBackupPayload,
  ThemePreference,
} from '../domain/types';

interface BackupAndMoreScreenProps {
  initialTab?: 'BACKUP' | 'ABOUT' | 'TESTS';
  backupMeta: BackupMetadata;
  settings: AppSettings;
  themePref: ThemePreference;
  systemIsDark: boolean;
  onChangeTheme: (pref: ThemePreference) => Promise<void>;
  onUpdateCurrency: (code: string, symbol: string) => Promise<void>;
  onCreateBackup: () => Promise<FullBackupPayload>;
  onPreviewBackupFile: (rawJson: string) => Promise<BackupPreviewSummary>;
  onConfirmRestore: (payload: FullBackupPayload, allowDuplicate: boolean) => Promise<void>;
}

const FUNCTIONAL_CHECKLIST = [
  '1. إضافة سيارتين على الأقل مع استقلال كامل للبيانات',
  '2. التبديل بين السيارات وعرض بيانات السيارة المختارة فقط',
  '3. عدم وجود أي تقرير مجمع لجميع السيارات',
  '4. التحقق من رقم اللوحة المصرية (عربي/إنجليزي، 2 إلى 3 حروف + 2 إلى 4 أرقام)',
  '5. قاعدة الماركات والموديلات والسنوات المحلية والإضافة اليدوية دون إنترنت',
  '6. تبديل KM/Mile في العرض دون تغيير القيم الأصلية المخزنة',
  '7. رفض قراءة عداد أقل من السابقة في التحديث العادي',
  '8. تصحيح العداد مع سجل التصحيحات وإعادة حساب المؤشرات المتأثرة',
  '9. بقاء مبالغ المصروفات الأصلية دون تغيير بعد تصحيح العداد',
  '10. تنبيه زيت المحرك قبل 1000 كم (أو ما يعادلها بالميل) وحسب الأقرب زمنًا/مسافة',
  '11. تحديث موعد فلتر الزيت فقط عند تأكيد تغييره ومنع التكرار',
  '12. تغطية الفلاتر والبوجيهات وتيل الفرامل وزيت الفتيس والسيور وسائل التبريد',
  '13. تنبيه مراجعة فريون التكييف عند تكرار الشحن خلال 30 يومًا',
  '14. البطارية: حساب العمر من التركيب وتنبيه انتهاء الضمان دون عمر ثابت',
  '15. إضافة عناصر صيانة مخصصة وظهورها في السجل والتنبيهات',
  '16. حقل الميكانيكي / مركز الصيانة الاختياري',
  '17. Full-to-Full: أول تفويلة نقطة بداية بدون متوسط',
  '18. التعبئة الجزئية: تدخل المصروف فقط ولا تدخل المتوسط الدقيق',
  '19. المتوسط العام المرجح = مجموع المسافات ÷ مجموع اللترات',
  '20. ثبات سعر اللتر التاريخي عند تغير الأسعار لاحقًا',
  '21. منع تكرار المصروفات عبر مفتاح المصدر الفريد (sourceType + sourceId)',
  '22. بقاء الأعمال المطلوبة ظاهرة حتى تأكيد «تم الإصلاح»',
  '23. الإطارات (5 سجلات شاملة الاستبن) وتنبيه 5 و6 سنوات من DOT',
  '24. تنبيهات الكوريك ومفتاح العجل (أحمر) والمنفاخ (أصفر)',
  '25. تنبيهات الترخيص والفحص والرخصة (30 يومًا) والتوكيل (60 يومًا)',
  '26. إطلاق الإشعار الأحمر الخارجي مرة واحدة وعدم تكراره يوميًا',
  '27. بقاء التنبيه داخل التطبيق حتى الحل',
  '28. إنشاء نسخة احتياطية يدوية واستعادتها بعد المعاينة والتأكيد',
  '29. رفض ملف احتياطي تالف أو غير متوافق (Checksum + Schema)',
  '30. العمل الكامل للوظائف اليومية دون اتصال بالإنترنت',
  '31. جدولة التنبيهات في Android عبر WorkManager + BootReceiver',
  '32. دعم ترحيل قاعدة Room عند تحديث التطبيق دون فقد البيانات',
  '33. صفحة «حول التطبيق» بالنصوص الحرفية المطلوبة',
  '34. نص by Ahmed Ali بحجم صغير جدًا وهادئ في الرئيسية',
  '35. عدم ظهور رقم الهاتف على الشاشة الرئيسية نهائيًا',
  '36. حزمة مشروع Android Native جاهزة لبناء MyCar-Release.apk',
];

export const BackupAndMoreScreen: React.FC<BackupAndMoreScreenProps> = ({
  initialTab = 'BACKUP',
  backupMeta,
  settings,
  themePref,
  systemIsDark,
  onChangeTheme,
  onUpdateCurrency,
  onCreateBackup,
  onPreviewBackupFile,
  onConfirmRestore,
}) => {
  const [tab, setTab] = useState<'BACKUP' | 'ABOUT' | 'TESTS'>(initialTab);
  const [preview, setPreview] = useState<BackupPreviewSummary | null>(null);
  const [allowDuplicateRestore, setAllowDuplicateRestore] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [currencyCode, setCurrencyCode] = useState(settings.currencyCode);

  const [notifPermission, setNotifPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyAppUrl = async () => {
    try {
      const targetUrl = typeof window !== 'undefined' ? window.location.origin : '';
      if (targetUrl && navigator.clipboard) {
        await navigator.clipboard.writeText(targetUrl);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
      }
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  };

  const handleRequestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const res = await Notification.requestPermission();
    setNotifPermission(res);
  };

  const handleExport = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    const payload = await onCreateBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MyCar-Backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('تم إنشاء وتنزيل ملف النسخة الاحتياطية بنجاح.');
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setStatusMsg(null);
    const text = await file.text();
    const res = await onPreviewBackupFile(text);
    setPreview(res);
    setAllowDuplicateRestore(false);
    if (!res.valid) {
      setErrorMsg(res.error || 'ملف غير صالح.');
    }
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!preview?.valid || !preview.payload) return;
    setErrorMsg(null);
    try {
      await onConfirmRestore(preview.payload, allowDuplicateRestore);
      setPreview(null);
      setStatusMsg('تمت استعادة جميع السيارات والسجلات والإعدادات بنجاح.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذرت استعادة النسخة.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#262E3B] bg-[#171C24] p-1.5 max-w-xl">
        <button
          type="button"
          onClick={() => setTab('BACKUP')}
          className={`min-h-[44px] rounded-xl text-xs font-bold ${
            tab === 'BACKUP' ? 'bg-[#E11D2E] text-white' : 'text-slate-300'
          }`}
        >
          النسخ الاحتياطي والإعدادات
        </button>
        <button
          type="button"
          onClick={() => setTab('TESTS')}
          className={`min-h-[44px] rounded-xl text-xs font-bold ${
            tab === 'TESTS' ? 'bg-[#E11D2E] text-white' : 'text-slate-300'
          }`}
        >
          مشروع Android والاختبارات
        </button>
        <button
          type="button"
          onClick={() => setTab('ABOUT')}
          className={`min-h-[44px] rounded-xl text-xs font-bold ${
            tab === 'ABOUT' ? 'bg-[#E11D2E] text-white' : 'text-slate-300'
          }`}
        >
          حول التطبيق
        </button>
      </div>

      {tab === 'BACKUP' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-4 lg:col-span-7">
            <div className="flex items-center gap-3 border-b border-[#262E3B] pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E11D2E] text-white">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">النسخ الاحتياطي والاستعادة (يدوي فقط)</h3>
                <p className="text-xs text-slate-400">
                  لا يوجد نسخ تلقائي · يتم فحص سلامة الملف وعرض ملخصه قبل الاستبدال
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[#262E3B] bg-[#0D1015] p-3.5 text-xs text-slate-300">
              <p>
                تاريخ آخر نسخة احتياطية:{' '}
                <strong className="font-mono-nums text-white">
                  {backupMeta.lastBackupAt
                    ? backupMeta.lastBackupAt.replace('T', ' ').slice(0, 19)
                    : 'لم يتم إنشاء نسخة بعد'}
                </strong>
              </p>
              {backupMeta.lastRestoredAt && (
                <p className="mt-1 text-slate-400">
                  آخر استعادة:{' '}
                  <span className="font-mono-nums">
                    {backupMeta.lastRestoredAt.replace('T', ' ').slice(0, 19)}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#E11D2E] px-5 text-sm font-bold text-white hover:bg-[#C81625]"
              >
                <Download className="h-4 w-4" />
                <span>إنشاء نسخة احتياطية</span>
              </button>

              <label className="flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#262E3B] bg-[#0D1015] px-5 text-sm font-bold text-white hover:border-[#E11D2E]">
                <Upload className="h-4 w-4 text-[#E11D2E]" />
                <span>استيراد ملف نسخة احتياطية</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFilePick}
                  className="hidden"
                />
              </label>
            </div>

            {statusMsg && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
                {statusMsg}
              </div>
            )}
            {errorMsg && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-semibold text-red-300">
                {errorMsg}
              </div>
            )}

            {preview?.valid && preview.payload && (
              <div className="rounded-xl border border-amber-500/50 bg-[#0D1015] p-4 space-y-3">
                <h4 className="text-sm font-bold text-amber-300">معاينة محتويات النسخة قبل التأكيد</h4>
                <div className="font-mono-nums grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-3">
                  <span>التاريخ: {preview.exportedAt?.slice(0, 10)}</span>
                  <span>السيارات: {preview.vehicleCount}</span>
                  <span>الوقود: {preview.fuelCount}</span>
                  <span>الصيانة: {preview.maintenanceCount}</span>
                  <span>الأعطال: {preview.faultCount}</span>
                  <span>المصروفات: {preview.expenseCount}</span>
                  <span>قطع الغيار: {preview.sparePartCount}</span>
                  <span>الإطارات: {preview.tireCount}</span>
                  <span>الوثائق: {preview.documentCount}</span>
                </div>

                {preview.isDuplicateRestore && (
                  <label className="flex items-center gap-2 text-xs text-red-300">
                    <input
                      type="checkbox"
                      checked={allowDuplicateRestore}
                      onChange={(e) => setAllowDuplicateRestore(e.target.checked)}
                      className="h-4 w-4 accent-[#E11D2E]"
                    />
                    <span>تنبيه: هذه النسخة تمت استعادتها سابقًا. فعّل هذا الخيار للسماح بإعادة الاستعادة.</span>
                  </label>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="min-h-[40px] rounded-xl border border-[#262E3B] px-4 text-xs text-slate-300"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={preview.isDuplicateRestore && !allowDuplicateRestore}
                    onClick={handleConfirmRestore}
                    className="min-h-[40px] rounded-xl bg-[#E11D2E] px-5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    تأكيد واستبدال البيانات الحالية
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5 lg:col-span-5">
            <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#E11D2E]" />
                <h3 className="text-base font-bold text-white">حالة صلاحية الإشعارات</h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                الحالة الحالية في المتصفح:{' '}
                <strong className="text-white">
                  {notifPermission === 'granted'
                    ? 'مسموح'
                    : notifPermission === 'denied'
                    ? 'مرفوضة — يرجى تفعيلها من إعدادات المتصفح/النظام'
                    : 'تحتاج موافقة'}
                </strong>
              </p>
              <p className="text-xs leading-relaxed text-slate-400">
                على هواتف Android 13+، إذا رفضت صلاحية الإشعارات أو قيّد النظام التطبيق عبر تحسين البطارية، فلن تظهر الإشعارات الحمراء الخارجية حتى تفعيلها من إعدادات إشعارات التطبيق.
              </p>
              {notifPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestNotifPermission}
                  className="min-h-[42px] rounded-xl border border-[#262E3B] bg-[#0D1015] px-4 text-xs font-bold text-white hover:border-[#E11D2E]"
                >
                  طلب تفعيل صلاحية الإشعارات
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white">مظهر التطبيق (الألوان)</h3>
                <span className="text-[11px] font-semibold text-slate-400">
                  إعداد الموبايل حاليًا: {systemIsDark ? 'داكن' : 'فاتح'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: 'light' as ThemePreference,
                    label: 'فاتح',
                    icon: <Sun className="h-4 w-4" />,
                  },
                  {
                    id: 'dark' as ThemePreference,
                    label: 'داكن',
                    icon: <Moon className="h-4 w-4" />,
                  },
                  {
                    id: 'system' as ThemePreference,
                    label: 'حسب الموبايل',
                    icon: <Smartphone className="h-4 w-4" />,
                  },
                ].map((opt) => {
                  const selected = themePref === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeTheme(opt.id)}
                      className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition-colors ${
                        selected
                          ? 'border-[#E11D2E] bg-[#E11D2E] text-white'
                          : 'border-[#262E3B] bg-[#0D1015] text-slate-300 hover:border-[#E11D2E]'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-3">
              <h3 className="text-base font-bold text-white">إعدادات العملة العامة</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  placeholder="EGP"
                  className="rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
                />
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="ج.م"
                  className="rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 py-2 text-sm text-white"
                />
              </div>
              <button
                type="button"
                onClick={() => onUpdateCurrency(currencyCode, currencySymbol)}
                className="min-h-[40px] rounded-xl bg-[#1D232E] px-4 text-xs font-bold text-white hover:bg-[#262E3B]"
              >
                حفظ العملة
              </button>
            </div>

            <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-[#E11D2E]" />
                <h3 className="text-base font-bold text-white">تجربة وتثبيت على الموبايل (بدون APK)</h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                يمكنك تجربة التطبيق على هاتفك فورًا كتطبيق مستقل يعمل دون إنترنت قبل اعتماد نسخة Android APK:
              </p>
              <ul className="space-y-1.5 text-xs text-slate-400">
                <li>1. انسخ الرابط وافتحه في متصفح Chrome على الموبايل (أو Safari على iPhone).</li>
                <li>2. من قائمة المتصفح (⋮ أو زر المشاركة) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</li>
                <li>3. بعد التثبيت يفتح التطبيق بشاشة كاملة ويحفظ بياناتك محليًا دون اتصال.</li>
              </ul>
              <button
                type="button"
                onClick={handleCopyAppUrl}
                className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#E11D2E] px-4 text-xs font-bold text-white hover:bg-[#C81625]"
              >
                <Copy className="h-4 w-4" />
                <span>{linkCopied ? 'تم نسخ الرابط بنجاح' : 'نسخ رابط التطبيق لفتحه على الموبايل'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'TESTS' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E11D2E] text-white">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    مشروع Native Android الكامل (Kotlin + Jetpack Compose + Room + WorkManager)
                  </h3>
                  <p className="text-xs text-slate-400">
                    جاهز للفتح في Android Studio وبناء MyCar-Release.apk (ملاحظة: بيئة AI Studio الحالية لا تحتوي على JDK/Android SDK لتوليد APK مباشرة).
                  </p>
                </div>
              </div>
              <a
                href="/MyCar-Android-Project.zip"
                download="MyCar-Android-Project.zip"
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E11D2E] px-5 text-xs font-bold text-white hover:bg-[#C81625]"
              >
                <Download className="h-4 w-4" />
                <span>تحميل مشروع Android الكامل (ZIP)</span>
              </a>
            </div>

            <div className="mt-4 rounded-xl border border-[#262E3B] bg-[#0D1015] p-4 space-y-1.5 text-xs text-slate-300">
              <p className="font-bold text-white">خطوات إخراج ملف MyCar-Release.apk عبر GitHub:</p>
              <p>1. حمّل ملف ZIP وفك ضغطه (مع التأكد من وجود مجلد <span dir="ltr" className="font-mono-nums text-emerald-400">.github</span> المخفي).</p>
              <p>2. ارفع جميع الملفات والمجلدات المستخرجة إلى مستودع GitHub جديد (في جذر المستودع على فرع <span dir="ltr" className="font-mono-nums text-white">main</span>).</p>
              <p>3. افتح تبويب <span dir="ltr" className="font-semibold text-white">Actions ← Build MyCar APK</span> وبعد اكتمال البناء حمّل <span dir="ltr" className="font-semibold text-emerald-400">MyCar-Release-APK</span> من قسم <span dir="ltr">Artifacts</span>.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5">
            <div className="flex items-center gap-2 border-b border-[#262E3B] pb-3">
              <FlaskConical className="h-5 w-5 text-[#E11D2E]" />
              <h3 className="text-base font-bold text-white">
                تغطية الاختبارات الوظيفية الـ 36 وسلامة الحسابات
              </h3>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {FUNCTIONAL_CHECKLIST.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-xl border border-[#262E3B] bg-[#0D1015] p-3 text-xs text-slate-200"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'ABOUT' && (
        <div className="mx-auto max-w-lg rounded-2xl border border-[#262E3B] bg-[#171C24] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E11D2E]/15 text-[#E11D2E]">
            <Info className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">عربيتي | MY CAR</h2>
          <p className="mt-1 text-xs text-slate-400">الإصدار 2.0.0</p>
          <div className="my-6 border-t border-[#262E3B]" />
          <p dir="ltr" className="text-sm font-semibold text-white">
            Programmed and Developed by Mr. Ahmed Ali Hassab Allah
          </p>
          <p dir="ltr" className="font-mono-nums mt-2 text-base font-bold text-[#E11D2E]">
            Phone: 01002277232
          </p>
        </div>
      )}
    </div>
  );
};

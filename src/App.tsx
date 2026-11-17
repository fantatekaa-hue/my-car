/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  Car,
  Check,
  CheckCircle2,
  Cog,
  Disc,
  Droplet,
  Edit3,
  FileCheck,
  Fuel,
  Gauge,
  HardDrive,
  Home,
  Info,
  Moon,
  Plus,
  Receipt,
  Smartphone,
  Sun,
  Trash2,
  Wrench,
} from 'lucide-react';
import { OdometerModal } from './components/OdometerModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { VehicleModal } from './components/VehicleModal';
import { defaultRepository, type VehicleBundle } from './db/myCarRepository';
import type {
  AppSection,
  AppSettings,
  BackupMetadata,
  CustomCatalogEntry,
  ThemePreference,
  Vehicle,
} from './domain/types';
import { formatDistance } from './domain/units';
import { BackupAndMoreScreen } from './screens/BackupAndMoreScreen';
import { ExpensesAndPartsScreen } from './screens/ExpensesAndPartsScreen';
import { FaultsAndTasksScreen } from './screens/FaultsAndTasksScreen';
import { FuelScreen } from './screens/FuelScreen';
import { MaintenanceScreen } from './screens/MaintenanceScreen';
import { TiresAndDocsScreen } from './screens/TiresAndDocsScreen';
import { VehicleReportScreen } from './screens/VehicleReportScreen';

const DEFAULT_SETTINGS: AppSettings = {
  id: 'app_settings',
  currencyCode: 'EGP',
  currencySymbol: 'ج.م',
  customFuelTypes: [],
  notificationsEnabledByUser: true,
  theme: 'light',
  schemaVersion: 1,
  updatedAt: '',
};

function getSystemDarkMatches(): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

function resolveEffectiveTheme(pref: ThemePreference, systemIsDark: boolean): 'dark' | 'light' {
  if (pref === 'dark' || pref === 'light') return pref;
  return systemIsDark ? 'dark' : 'light';
}

function applyDocumentTheme(effective: 'dark' | 'light', pref: ThemePreference) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = effective;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', effective === 'light' ? '#F3F7FC' : '#141D2B');
    }
  }
  try {
    localStorage.setItem('mycar_theme', pref);
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

function resetViewportScroll() {
  if (typeof document !== 'undefined') {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
}

export default function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [section, setSection] = useState<AppSection>('home');
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => getSystemDarkMatches());
  const [themePref, setThemePref] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem('mycar_theme');
      if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
      return 'light';
    } catch {
      return 'light';
    }
  });
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customCatalog, setCustomCatalog] = useState<CustomCatalogEntry[]>([]);
  const [backupMeta, setBackupMeta] = useState<BackupMetadata>({ id: 'backup_meta' });
  const [bundle, setBundle] = useState<VehicleBundle | null>(null);

  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [confirmDeleteVehicle, setConfirmDeleteVehicle] = useState<Vehicle | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const fireBrowserRedNotification = useCallback(
    (vehicle: Vehicle, title: string, body: string, tag: string) => {
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;
      try {
        new Notification(`${vehicle.brand} ${vehicle.model} — ${title}`, {
          body,
          tag,
          icon: '/pwa-192x192.png',
        });
      } catch {
        // Ignore if environment blocks Notification constructor
      }
    },
    []
  );

  const loadAppState = useCallback(
    async (preferredVehicleId?: string) => {
      const [loadedSettings, loadedVehicles, loadedCatalog, loadedMeta] = await Promise.all([
        defaultRepository.getSettings(),
        defaultRepository.getVehicles(true),
        defaultRepository.getCustomCatalog(),
        defaultRepository.getBackupMetadata(),
      ]);

      const activePool = loadedVehicles.filter((v) => !v.isArchived);
      const targetId =
        preferredVehicleId && activePool.some((v) => v.id === preferredVehicleId)
          ? preferredVehicleId
          : loadedSettings.activeVehicleId &&
            activePool.some((v) => v.id === loadedSettings.activeVehicleId)
          ? loadedSettings.activeVehicleId
          : activePool[0]?.id;

      let updatedSettings = loadedSettings;
      if (targetId !== loadedSettings.activeVehicleId) {
        updatedSettings = await defaultRepository.updateSettings({ activeVehicleId: targetId });
      }

      setSettings(updatedSettings);
      const savedLocalTheme =
        typeof localStorage !== 'undefined' ? localStorage.getItem('mycar_theme') : null;
      const resolvedPref: ThemePreference =
        updatedSettings.theme ??
        (savedLocalTheme === 'dark' || savedLocalTheme === 'light' || savedLocalTheme === 'system'
          ? savedLocalTheme
          : 'light');
      setThemePref(resolvedPref);
      applyDocumentTheme(resolveEffectiveTheme(resolvedPref, getSystemDarkMatches()), resolvedPref);
      setVehicles(loadedVehicles);
      setCustomCatalog(loadedCatalog);
      setBackupMeta(loadedMeta);

      if (targetId) {
        const alertSync = await defaultRepository.recomputeVehicleReminders(targetId);
        const loadedBundle = await defaultRepository.getVehicleBundle(targetId);
        setBundle(loadedBundle);

        if (loadedBundle) {
          for (const newRed of alertSync.newlyTriggeredRedAlerts) {
            fireBrowserRedNotification(
              loadedBundle.vehicle,
              newRed.title,
              newRed.message,
              newRed.id
            );
          }
        }
      } else {
        setBundle(null);
      }
    },
    [fireBrowserRedNotification]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadAppState();
      setTimeout(() => {
        if (mounted) setIsBooting(false);
      }, 650);
    })();
    return () => {
      mounted = false;
    };
  }, [loadAppState]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    setSystemIsDark(mq.matches);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handleChange);
      return () => mq.removeEventListener('change', handleChange);
    }
    mq.addListener(handleChange);
    return () => mq.removeListener(handleChange);
  }, []);

  useEffect(() => {
    applyDocumentTheme(resolveEffectiveTheme(themePref, systemIsDark), themePref);
  }, [themePref, systemIsDark]);

  useEffect(() => {
    if (!themeMenuOpen) return;
    const handleClickOutside = (ev: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(ev.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [themeMenuOpen]);

  useLayoutEffect(() => {
    resetViewportScroll();
  }, [section]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rafId = window.requestAnimationFrame(() => {
      resetViewportScroll();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [section]);

  const activeVehicle = bundle?.vehicle ?? null;
  const activeVehiclesList = useMemo(() => vehicles.filter((v) => !v.isArchived), [vehicles]);
  const archivedVehiclesList = useMemo(() => vehicles.filter((v) => v.isArchived), [vehicles]);

  const sectionActionCounts = useMemo(() => {
    const map: Partial<Record<AppSection, { red: number; yellow: number }>> = {};
    if (!bundle) return map;

    const addCount = (sec: AppSection, sev: 'RED' | 'YELLOW') => {
      const curr = map[sec] ?? { red: 0, yellow: 0 };
      if (sev === 'RED') curr.red += 1;
      else curr.yellow += 1;
      map[sec] = curr;
    };

    for (const rem of bundle.reminders) {
      if (rem.severity === 'RED' || rem.severity === 'YELLOW') {
        addCount(rem.targetSection, rem.severity);
      }
    }

    for (const fault of bundle.faultRecords) {
      if (fault.status !== 'REPAIRED') {
        addCount('faults', 'RED');
      }
    }

    return map;
  }, [bundle]);

  const handleSelectVehicle = async (vehicleId: string) => {
    await defaultRepository.updateSettings({ activeVehicleId: vehicleId });
    await loadAppState(vehicleId);
    if (section === 'vehicles') setSection('home');
  };

  const handleSelectTheme = async (nextPref: ThemePreference) => {
    setThemePref(nextPref);
    setThemeMenuOpen(false);
    applyDocumentTheme(resolveEffectiveTheme(nextPref, systemIsDark), nextPref);
    await defaultRepository.updateSettings({ theme: nextPref });
  };

  if (isBooting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1015] px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#262E3B] bg-[#171C24] text-[#E11D2E]">
          <Gauge className="h-11 w-11" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">عربيتي | MY CAR</h1>
        <p className="mt-2 text-xs text-slate-400">جارٍ تهيئة قاعدة البيانات المحلية...</p>
      </div>
    );
  }

  const redAlerts = bundle?.reminders.filter((r) => r.severity === 'RED') ?? [];
  const yellowAlerts = bundle?.reminders.filter((r) => r.severity === 'YELLOW') ?? [];
  const greenAlerts = bundle?.reminders.filter((r) => r.severity === 'GREEN') ?? [];

  const sectionTiles: Array<{
    id: AppSection;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    iconToneClass: string;
    highlight?: boolean;
  }> = [
    {
      id: 'engine_oil',
      title: 'زيت المحرك',
      subtitle: 'تغيير الزيت والفلتر والمتابعة',
      icon: <Droplet className="h-8 w-8" />,
      iconToneClass: 'bg-white/20 text-white',
      highlight: true,
    },
    {
      id: 'fuel',
      title: 'الوقود والاستهلاك',
      subtitle: 'Full-to-Full والجزئي',
      icon: <Fuel className="h-8 w-8" />,
      iconToneClass: 'bg-sky-500/15 text-sky-500 group-hover:bg-sky-500/25',
    },
    {
      id: 'maintenance',
      title: 'الصيانة الدورية والمخصصة',
      subtitle: 'الفلاتر · الفرامل · البوجيهات',
      icon: <Wrench className="h-8 w-8" />,
      iconToneClass: 'bg-indigo-500/15 text-indigo-500 group-hover:bg-indigo-500/25',
    },
    {
      id: 'tires',
      title: 'الإطارات والطوارئ',
      subtitle: 'DOT 5/6 سنوات · الكوريك',
      icon: <Disc className="h-8 w-8" />,
      iconToneClass: 'bg-teal-500/15 text-teal-500 group-hover:bg-teal-500/25',
    },
    {
      id: 'faults',
      title: 'الأعطال والأعمال المطلوبة',
      subtitle: 'متابعة حتى «تم الإصلاح»',
      icon: <AlertTriangle className="h-8 w-8" />,
      iconToneClass: 'bg-amber-500/15 text-amber-500 group-hover:bg-amber-500/25',
    },
    {
      id: 'expenses',
      title: 'المصروفات',
      subtitle: 'التلقائية والإضافية',
      icon: <Receipt className="h-8 w-8" />,
      iconToneClass: 'bg-emerald-500/15 text-emerald-500 group-hover:bg-emerald-500/25',
    },
    {
      id: 'parts',
      title: 'قطع الغيار',
      subtitle: 'سجل القطع والربط',
      icon: <Cog className="h-8 w-8" />,
      iconToneClass: 'bg-violet-500/15 text-violet-500 group-hover:bg-violet-500/25',
    },
    {
      id: 'documents',
      title: 'الأوراق والتراخيص',
      subtitle: 'الترخيص · الفحص · التوكيل',
      icon: <FileCheck className="h-8 w-8" />,
      iconToneClass: 'bg-blue-500/15 text-blue-500 group-hover:bg-blue-500/25',
    },
    {
      id: 'reports',
      title: 'تقرير هذه السيارة',
      subtitle: 'تقرير مستقل شهري وسنوي',
      icon: <BarChart3 className="h-8 w-8" />,
      iconToneClass: 'bg-cyan-500/15 text-cyan-500 group-hover:bg-cyan-500/25',
    },
    {
      id: 'backup',
      title: 'النسخ الاحتياطي',
      subtitle: 'نسخ واستعادة يدوية',
      icon: <HardDrive className="h-8 w-8" />,
      iconToneClass: 'bg-slate-500/15 text-slate-400 group-hover:bg-slate-500/25',
    },
    {
      id: 'about',
      title: 'حول التطبيق',
      subtitle: 'بيانات المطور والإصدار',
      icon: <Info className="h-8 w-8" />,
      iconToneClass: 'bg-rose-500/15 text-rose-500 group-hover:bg-rose-500/25',
    },
  ];

  const sectionTitlesMap: Record<AppSection, string> = {
    home: 'الرئيسية',
    vehicles: 'مبدّل السيارات وإدارة المركبات',
    odometer: 'العداد',
    engine_oil: 'زيت المحرك والفلتر',
    fuel: 'الوقود والاستهلاك',
    maintenance: 'الصيانة الدورية',
    faults: 'الأعطال والأعمال المطلوبة',
    expenses: 'المصروفات',
    parts: 'قطع الغيار',
    tires: 'الإطارات وتجهيزات الطوارئ',
    documents: 'الأوراق والتراخيص',
    reports: 'تقرير السيارة',
    backup: 'النسخ الاحتياطي والإعدادات',
    about: 'حول التطبيق',
    tests: 'مشروع Android والاختبارات',
  };

  return (
    <div className="min-h-screen bg-[#0D1015] text-[#F8FAFC] pb-20 lg:pb-10">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#262E3B] bg-[#0D1015]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSection('home')}
              className="text-right focus:outline-none"
            >
              <span className="block text-lg font-bold tracking-tight text-white whitespace-nowrap">
                عربيتي | MY CAR
              </span>
              {/* Very small, visually calm byline on Home per Spec Section 4 (NO phone number here!) */}
              <span className="block text-[10px] leading-none text-slate-400/75 font-normal">
                by Ahmed Ali
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <OfflineIndicator />
            <PWAInstallButton />
            <div className="relative" ref={themeMenuRef}>
              <button
                type="button"
                onClick={() => setThemeMenuOpen((v) => !v)}
                title="مظهر التطبيق (فاتح / داكن / حسب الموبايل)"
                aria-label="مظهر التطبيق"
                className="flex h-10 items-center gap-1.5 rounded-xl border border-[#262E3B] bg-[#171C24] px-2.5 text-amber-400 transition-colors hover:border-[#E11D2E] shrink-0"
              >
                {themePref === 'system' ? (
                  <Smartphone className="h-4 w-4 text-sky-400" />
                ) : themePref === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4 text-[#E11D2E]" />
                )}
                <span className="hidden sm:inline text-[11px] font-bold text-slate-300">
                  {themePref === 'system' ? 'تلقائي' : themePref === 'dark' ? 'داكن' : 'فاتح'}
                </span>
              </button>

              {themeMenuOpen && (
                <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-[#262E3B] bg-[#171C24] p-1.5 shadow-xl z-50">
                  {[
                    {
                      id: 'light' as ThemePreference,
                      label: 'الوضع الفاتح',
                      icon: <Sun className="h-4 w-4 text-amber-400" />,
                    },
                    {
                      id: 'dark' as ThemePreference,
                      label: 'الوضع الداكن',
                      icon: <Moon className="h-4 w-4 text-[#E11D2E]" />,
                    },
                    {
                      id: 'system' as ThemePreference,
                      label: `حسب الموبايل (${systemIsDark ? 'داكن' : 'فاتح'})`,
                      icon: <Smartphone className="h-4 w-4 text-sky-400" />,
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectTheme(opt.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${
                        themePref === opt.id
                          ? 'bg-[#E11D2E] text-white'
                          : 'text-slate-200 hover:bg-[#1D232E]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {opt.icon}
                        <span>{opt.label}</span>
                      </span>
                      {themePref === opt.id && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {activeVehiclesList.length === 0 ? (
              <button
                type="button"
                onClick={() => {
                  setEditingVehicle(null);
                  setShowVehicleModal(true);
                }}
                title="إضافة سيارة جديدة"
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E11D2E] px-3 py-2 text-xs font-bold text-white hover:bg-[#C81625] whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                <Car className="h-4 w-4" />
                <span className="hidden sm:inline">إضافة سيارة</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingVehicle(null);
                  setShowVehicleModal(true);
                }}
                title="إضافة سيارة جديدة"
                aria-label="إضافة سيارة جديدة"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#262E3B] bg-[#171C24] text-[#E11D2E] transition-colors hover:border-[#E11D2E] shrink-0"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSection('vehicles')}
              className="flex min-h-[40px] items-center gap-2 rounded-xl border border-[#262E3B] bg-[#171C24] px-3 py-2 text-xs font-bold text-white hover:border-[#E11D2E] whitespace-nowrap shrink-0"
            >
              <Car className="h-4 w-4 text-[#E11D2E]" />
              <span>
                {activeVehicle
                  ? `${activeVehicle.brand.split(' ')[0]} · ${activeVehicle.plateNormalized}`
                  : `السيارات (${activeVehiclesList.length})`}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {section !== 'home' && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#262E3B] pb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSection('home')}
                className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#262E3B] bg-[#171C24] px-3.5 text-xs font-bold text-white hover:border-[#E11D2E]"
              >
                <ArrowRight className="h-4 w-4 text-[#E11D2E]" />
                <span>العودة للرئيسية</span>
              </button>
              <h2 className="text-lg font-bold text-white">{sectionTitlesMap[section]}</h2>
            </div>

            {activeVehicle && (
              <span className="font-mono-nums text-xs text-slate-400">
                {activeVehicle.brand} {activeVehicle.model} ({activeVehicle.year}) ·{' '}
                {activeVehicle.hasOdometerReading === false
                  ? 'العداد غير مسجل بعد'
                  : formatDistance(activeVehicle.currentOdometerKm, activeVehicle.odometerUnit)}
              </span>
            )}
          </div>
        )}

        {/* MAIN DASHBOARD (Always displays all large icon tiles directly without an empty splash/welcome gate) */}
        {section === 'home' && (
          <div className="space-y-6">
            {!activeVehicle ? (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#262E3B] bg-[#171C24] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E11D2E]/15 text-[#E11D2E]">
                    <Car className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">لم يتم اختيار سيارة بعد</h2>
                    <p className="text-xs text-slate-400">
                      اضغط على أيقونة <strong className="text-white">+ إضافة سيارة</strong> بالأعلى لإضافة سيارتك، أو اختر من الأقسام أدناه.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVehicle(null);
                      setShowVehicleModal(true);
                    }}
                    className="flex min-h-[42px] items-center gap-2 rounded-xl bg-[#E11D2E] px-4 text-xs font-bold text-white hover:bg-[#C81625]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>إضافة سيارة الآن</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('backup')}
                    className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#262E3B] bg-[#0D1015] px-4 text-xs font-bold text-white hover:border-[#E11D2E]"
                  >
                    <HardDrive className="h-4 w-4 text-[#E11D2E]" />
                    <span>استعادة نسخة</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 lg:col-span-7 flex flex-col justify-between">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">السيارة المختارة حاليًا</p>
                      <h2 className="mt-1 text-2xl font-bold text-white">
                        {activeVehicle.brand} — {activeVehicle.model} ({activeVehicle.year})
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <span className="font-mono-nums font-bold text-white">
                          لوحة: {activeVehicle.plateNormalized}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span>
                          {activeVehicle.ownershipType === 'POWER_OF_ATTORNEY'
                            ? activeVehicle.poaRegisteredContractDone
                              ? 'شراء بتوكيل (تم العقد المسجل)'
                              : 'شراء بتوكيل (بدون عقد مسجل)'
                            : 'عقد مسجل'}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span>الوحدة: {activeVehicle.odometerUnit}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVehicle(activeVehicle);
                          setShowVehicleModal(true);
                        }}
                        className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 text-xs font-semibold text-slate-200 hover:border-[#E11D2E]"
                      >
                        <Edit3 className="h-4 w-4 text-[#E11D2E]" />
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSection('vehicles')}
                        className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 text-xs font-semibold text-slate-200 hover:border-[#E11D2E]"
                      >
                        <span>تبديل السيارة</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#262E3B] bg-[#0D1015] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E11D2E]/15 text-[#E11D2E]">
                        <Gauge className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">قراءة العداد الحالية</p>
                        {activeVehicle.hasOdometerReading === false ? (
                          <p className="text-base font-bold text-amber-300">
                            غير مسجلة بعد (سجّلها عند التواجد بالسيارة)
                          </p>
                        ) : (
                          <p className="font-mono-nums text-2xl font-bold text-white sm:text-3xl">
                            {formatDistance(
                              activeVehicle.currentOdometerKm,
                              activeVehicle.odometerUnit
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowOdometerModal(true)}
                      className="min-h-[46px] rounded-xl bg-[#E11D2E] px-5 text-sm font-bold text-white hover:bg-[#C81625]"
                    >
                      {activeVehicle.hasOdometerReading === false
                        ? 'إدخال قراءة العداد'
                        : 'تحديث قراءة العداد'}
                    </button>
                  </div>
                </div>

                {/* Selected Vehicle Alerts Summary */}
                <div className="rounded-2xl border border-[#262E3B] bg-[#171C24] p-5 lg:col-span-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#262E3B] pb-3">
                      <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-[#E11D2E]" />
                        <h3 className="text-base font-bold text-white">ملخص تنبيهات هذه السيارة</h3>
                      </div>
                      <span className="font-mono-nums text-xs text-slate-400">
                        {redAlerts.length} أحمر · {yellowAlerts.length} أصفر · {greenAlerts.length} سليم
                      </span>
                    </div>

                    <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                      {bundle?.reminders.length === 0 ? (
                        <p className="text-xs text-slate-400">لا توجد تنبيهات مسجلة.</p>
                      ) : (
                        bundle?.reminders.map((rem) => {
                          const dotStyle =
                            rem.severity === 'RED'
                              ? 'border-red-500/50 bg-red-500/10 text-red-200'
                              : rem.severity === 'YELLOW'
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                              : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300';
                          const badgeText =
                            rem.severity === 'RED'
                              ? 'عاجل / متأخر'
                              : rem.severity === 'YELLOW'
                              ? 'قريب'
                              : 'سليم';

                          return (
                            <button
                              key={rem.id}
                              type="button"
                              onClick={() => setSection(rem.targetSection)}
                              className={`w-full rounded-xl border p-2.5 text-right transition-colors hover:brightness-110 ${dotStyle}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold">{rem.title}</span>
                                <span className="text-[10px] font-bold opacity-90 shrink-0">
                                  {badgeText}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] opacity-85">{rem.message}</p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ALL Large, Clear Icons Always Directly on the Main Screen */}
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-300">أقسام إدارة السيارة</h3>
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
                {sectionTiles.map((tile) => {
                  const requiresVehicle =
                    tile.id !== 'backup' && tile.id !== 'about' && tile.id !== 'tests' && tile.id !== 'vehicles';
                  const counts = sectionActionCounts[tile.id];
                  const redCount = counts?.red ?? 0;
                  const yellowCount = counts?.yellow ?? 0;
                  const totalActions = redCount + yellowCount;
                  const hasRed = redCount > 0;
                  const hasAction = totalActions > 0;

                  const borderClass = tile.highlight
                    ? 'border-[#E62E3D] bg-gradient-to-b from-[#F43F5E] to-[#E11D2E] text-white shadow-md shadow-rose-500/20 hover:brightness-105'
                    : hasRed
                    ? 'border-red-500/70 bg-[#171C24] text-white hover:border-[#E11D2E]'
                    : hasAction
                    ? 'border-amber-500/60 bg-[#171C24] text-white hover:border-[#E11D2E]'
                    : 'border-[#262E3B] bg-[#171C24] text-white hover:border-[#E11D2E]';

                  const badgeClass = tile.highlight
                    ? hasRed
                      ? 'tile-badge tile-badge-highlight-red bg-white text-[#E11D2E]'
                      : 'tile-badge tile-badge-yellow bg-amber-400 text-slate-950'
                    : hasRed
                    ? 'tile-badge tile-badge-red bg-red-600 text-white'
                    : 'tile-badge tile-badge-yellow bg-amber-500 text-slate-950';

                  return (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => {
                        if (requiresVehicle && !activeVehicle) {
                          setEditingVehicle(null);
                          setShowVehicleModal(true);
                          return;
                        }
                        setSection(tile.id);
                      }}
                      className={`group relative flex min-h-[132px] flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all ${borderClass}`}
                    >
                      {hasAction && (
                        <span
                          title={`${totalActions} إجراء مطلوب`}
                          className={`absolute top-2.5 left-2.5 flex items-center gap-1 rounded-lg px-1.5 py-0.5 font-mono-nums text-[10px] font-bold shadow-sm ${badgeClass}`}
                        >
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span>{totalActions}</span>
                        </span>
                      )}
                      <div
                        className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${tile.iconToneClass}`}
                      >
                        {tile.icon}
                      </div>
                      <span className="text-sm font-bold">{tile.title}</span>
                      <span
                        className={`mt-1 text-[11px] ${
                          tile.highlight ? 'text-white/85' : 'text-slate-400'
                        }`}
                      >
                        {tile.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VEHICLE SWITCHER & MANAGEMENT */}
        {section === 'vehicles' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-300">
                اختر سيارة للتبديل إلى ملفها وسجلاتها المعزولة تمامًا، أو أضف سيارة جديدة.
              </p>
              <div className="flex items-center gap-2">
                {archivedVehiclesList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowArchived((v) => !v)}
                    className="min-h-[42px] rounded-xl border border-[#262E3B] bg-[#171C24] px-4 text-xs font-bold text-slate-300"
                  >
                    {showArchived
                      ? 'إخفاء المؤرشفة'
                      : `عرض المؤرشفة (${archivedVehiclesList.length})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingVehicle(null);
                    setShowVehicleModal(true);
                  }}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E11D2E] px-5 text-xs font-bold text-white hover:bg-[#C81625]"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة سيارة جديدة</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeVehiclesList.map((v) => {
                const isSelected = activeVehicle?.id === v.id;
                return (
                  <div
                    key={v.id}
                    className={`rounded-2xl border bg-[#171C24] p-5 flex flex-col justify-between ${
                      isSelected ? 'border-[#E11D2E]' : 'border-[#262E3B]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0D1015] text-[#E11D2E]">
                            <Car className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white">
                              {v.brand} {v.model}
                            </h3>
                            <p className="font-mono-nums text-xs text-slate-400">
                              {v.year} · {v.plateNormalized}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>النشطة</span>
                          </span>
                        )}
                      </div>

                      <p className="font-mono-nums mt-4 text-sm font-bold text-slate-200">
                        العداد:{' '}
                        {v.hasOdometerReading === false
                          ? 'غير مسجلة بعد'
                          : formatDistance(v.currentOdometerKm, v.odometerUnit)}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#262E3B] pt-3">
                      {!isSelected && (
                        <button
                          type="button"
                          onClick={() => handleSelectVehicle(v.id)}
                          className="min-h-[38px] flex-1 rounded-xl bg-[#E11D2E] px-3 text-xs font-bold text-white"
                        >
                          اختيار السيارة
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVehicle(v);
                          setShowVehicleModal(true);
                        }}
                        className="min-h-[38px] rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 text-xs text-slate-200"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await defaultRepository.archiveVehicle(v.id, true);
                          await loadAppState();
                        }}
                        className="flex min-h-[38px] items-center gap-1 rounded-xl border border-[#262E3B] bg-[#0D1015] px-3 text-xs text-amber-300"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span>أرشفة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteVehicle(v)}
                        className="flex min-h-[38px] items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-xs text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {showArchived && archivedVehiclesList.length > 0 && (
              <div className="space-y-3 border-t border-[#262E3B] pt-5">
                <h3 className="text-sm font-bold text-slate-400">السيارات المؤرشفة (السجلات محفوظة)</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {archivedVehiclesList.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-xl border border-[#262E3B] bg-[#171C24] p-4"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">
                          {v.brand} {v.model} ({v.year})
                        </p>
                        <p className="font-mono-nums text-xs text-slate-400">{v.plateNormalized}</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await defaultRepository.archiveVehicle(v.id, false);
                          await loadAppState(v.id);
                        }}
                        className="min-h-[38px] rounded-xl bg-[#1D232E] px-4 text-xs font-bold text-white"
                      >
                        استرجاع من الأرشيف
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VEHICLE-SCOPED SCREENS */}
        {section === 'fuel' && bundle && (
          <FuelScreen
            vehicle={bundle.vehicle}
            fuelEntries={bundle.fuelEntries}
            customFuelTypes={settings.customFuelTypes}
            currencySymbol={settings.currencySymbol}
            onAddFuel={async (input) => {
              await defaultRepository.saveFuelEntry(input);
              await loadAppState(bundle.vehicle.id);
            }}
          />
        )}

        {(section === 'engine_oil' || section === 'maintenance') && bundle && (
          <MaintenanceScreen
            key={section}
            mode={section === 'engine_oil' ? 'ENGINE_OIL' : 'GENERAL'}
            vehicle={bundle.vehicle}
            maintenanceTypes={bundle.maintenanceTypes}
            maintenanceRecords={bundle.maintenanceRecords}
            currencySymbol={settings.currencySymbol}
            onSaveRecord={async (input) => {
              await defaultRepository.saveMaintenanceRecord(input);
              await loadAppState(bundle.vehicle.id);
            }}
            onAddCustomType={async (name, desc) => {
              const created = await defaultRepository.addCustomMaintenanceType(
                bundle.vehicle.id,
                name,
                desc
              );
              await loadAppState(bundle.vehicle.id);
              return created;
            }}
          />
        )}

        {section === 'faults' && bundle && (
          <FaultsAndTasksScreen
            vehicle={bundle.vehicle}
            faultRecords={bundle.faultRecords}
            pendingTasks={bundle.pendingTasks}
            currencySymbol={settings.currencySymbol}
            onAddPendingTask={async (input) => {
              await defaultRepository.addPendingTask(input);
              await loadAppState(bundle.vehicle.id);
            }}
            onCompletePendingTask={async (params) => {
              await defaultRepository.completePendingTask(params);
              await loadAppState(bundle.vehicle.id);
            }}
            onSaveFault={async (input) => {
              await defaultRepository.saveFaultRecord(input);
              await loadAppState(bundle.vehicle.id);
            }}
          />
        )}

        {(section === 'expenses' || section === 'parts') && bundle && (
          <ExpensesAndPartsScreen
            key={section}
            initialTab={section === 'parts' ? 'PARTS' : 'EXPENSES'}
            vehicle={bundle.vehicle}
            expenses={bundle.expenses}
            spareParts={bundle.spareParts}
            maintenanceRecords={bundle.maintenanceRecords}
            faultRecords={bundle.faultRecords}
            currencySymbol={settings.currencySymbol}
            onAddAdditionalExpense={async (params) => {
              await defaultRepository.saveAdditionalExpense(params);
              await loadAppState(bundle.vehicle.id);
            }}
            onAddSparePart={async (input) => {
              await defaultRepository.saveSparePart(input);
              await loadAppState(bundle.vehicle.id);
            }}
          />
        )}

        {(section === 'tires' || section === 'documents') && bundle && (
          <TiresAndDocsScreen
            key={section}
            initialTab={section === 'documents' ? 'DOCS' : 'TIRES'}
            vehicle={bundle.vehicle}
            tireRecords={bundle.tireRecords}
            emergencyEquipment={bundle.emergencyEquipment}
            documentRecords={bundle.documentRecords}
            onSaveTire={async (tire) => {
              await defaultRepository.saveTireRecord(tire);
              await loadAppState(bundle.vehicle.id);
            }}
            onSaveEmergency={async (eq) => {
              await defaultRepository.saveEmergencyEquipment(eq);
              await loadAppState(bundle.vehicle.id);
            }}
            onRenewDocument={async (params) => {
              await defaultRepository.renewDocument(params);
              await loadAppState(bundle.vehicle.id);
            }}
            onTogglePoaRegistered={async (done) => {
              await defaultRepository.updateVehicle({
                ...bundle.vehicle,
                poaRegisteredContractDone: done,
                poaStatusUpdatedAt: new Date().toISOString(),
              });
              await loadAppState(bundle.vehicle.id);
            }}
          />
        )}

        {section === 'reports' && bundle && (
          <VehicleReportScreen
            vehicle={bundle.vehicle}
            expenses={bundle.expenses}
            fuelEntries={bundle.fuelEntries}
            odometerEntries={bundle.odometerEntries}
            currencySymbol={settings.currencySymbol}
          />
        )}

        {(section === 'backup' || section === 'about' || section === 'tests') && (
          <BackupAndMoreScreen
            key={section}
            initialTab={
              section === 'about' ? 'ABOUT' : section === 'tests' ? 'TESTS' : 'BACKUP'
            }
            backupMeta={backupMeta}
            settings={settings}
            themePref={themePref}
            systemIsDark={systemIsDark}
            onChangeTheme={handleSelectTheme}
            onUpdateCurrency={async (code, symbol) => {
              await defaultRepository.updateSettings({
                currencyCode: code,
                currencySymbol: symbol,
              });
              await loadAppState();
            }}
            onCreateBackup={async () => {
              const payload = await defaultRepository.createManualBackup();
              await loadAppState();
              return payload;
            }}
            onPreviewBackupFile={(raw) => defaultRepository.previewBackupFile(raw)}
            onConfirmRestore={async (payload, allowDup) => {
              await defaultRepository.restoreFromValidatedBackup(payload, allowDup);
              await loadAppState();
            }}
          />
        )}
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation Bar (<= 15% height) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#262E3B] bg-[#0D1015]/95 backdrop-blur-md lg:hidden">
        <div className="grid h-16 grid-cols-5 items-center">
          {[
            { id: 'home' as AppSection, label: 'الرئيسية', icon: <Home className="h-5 w-5" /> },
            { id: 'engine_oil' as AppSection, label: 'زيت المحرك', icon: <Droplet className="h-5 w-5" /> },
            { id: 'fuel' as AppSection, label: 'الوقود', icon: <Fuel className="h-5 w-5" /> },
            {
              id: 'maintenance' as AppSection,
              label: 'الصيانة',
              icon: <Wrench className="h-5 w-5" />,
            },
            { id: 'backup' as AppSection, label: 'المزيد', icon: <HardDrive className="h-5 w-5" /> },
          ].map((navItem) => {
            const active = section === navItem.id;
            const navCounts = sectionActionCounts[navItem.id];
            const navAlertCount = (navCounts?.red ?? 0) + (navCounts?.yellow ?? 0);
            const navHasRed = (navCounts?.red ?? 0) > 0;
            return (
              <button
                key={navItem.id}
                type="button"
                onClick={() => setSection(navItem.id)}
                className={`relative flex flex-col items-center justify-center gap-1 ${
                  active ? 'text-[#E11D2E]' : 'text-slate-400'
                }`}
              >
                <div className="relative">
                  {navItem.icon}
                  {navAlertCount > 0 && (
                    <span
                      className={`absolute -top-1 -left-1.5 h-2.5 w-2.5 rounded-full border border-[#0D1015] ${
                        navHasRed ? 'bg-red-500' : 'bg-amber-400'
                      }`}
                    />
                  )}
                </div>
                <span className="text-[10px] font-bold">{navItem.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      {showVehicleModal && (
        <VehicleModal
          isOpen={showVehicleModal}
          editingVehicle={editingVehicle}
          customCatalog={customCatalog}
          onClose={() => {
            setShowVehicleModal(false);
            setEditingVehicle(null);
          }}
          onCreate={async (data) => {
            const created = await defaultRepository.createVehicle(data);
            await loadAppState(created.id);
          }}
          onUpdate={async (v) => {
            await defaultRepository.updateVehicle(v);
            await loadAppState(v.id);
          }}
        />
      )}

      {showOdometerModal && bundle && (
        <OdometerModal
          isOpen={showOdometerModal}
          vehicle={bundle.vehicle}
          odometerEntries={bundle.odometerEntries}
          fuelEntries={bundle.fuelEntries}
          onClose={() => setShowOdometerModal(false)}
          onNormalUpdate={async (newKm) => {
            await defaultRepository.updateOdometerNormal(bundle.vehicle.id, newKm);
            await loadAppState(bundle.vehicle.id);
          }}
          onCorrectOdometer={async (params) => {
            await defaultRepository.correctOdometer({
              vehicleId: bundle.vehicle.id,
              ...params,
            });
            await loadAppState(bundle.vehicle.id);
          }}
        />
      )}

      {confirmDeleteVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-[#171C24] p-5 space-y-4">
            <h3 className="text-base font-bold text-white">
              تأكيد حذف السيارة نهائيًا: {confirmDeleteVehicle.brand} {confirmDeleteVehicle.model}
            </h3>
            <p className="text-xs leading-relaxed text-slate-300">
              سيتم حذف السيارة وجميع سجلاتها (الوقود، الصيانة، المصروفات، الإطارات، التراخيص) نهائيًا. إذا أردت الحفاظ على السجلات يمكنك استخدام «أرشفة» بدلًا من الحذف.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteVehicle(null)}
                className="min-h-[42px] rounded-xl border border-[#262E3B] px-4 text-xs text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  await defaultRepository.deleteVehiclePermanently(confirmDeleteVehicle.id);
                  setConfirmDeleteVehicle(null);
                  await loadAppState();
                }}
                className="min-h-[42px] rounded-xl bg-red-600 px-5 text-xs font-bold text-white"
              >
                نعم، حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

package com.ahmedali.mycar

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ahmedali.mycar.data.VehicleBundle
import com.ahmedali.mycar.data.db.DocumentRecordEntity
import com.ahmedali.mycar.data.db.EmergencyEquipmentEntity
import com.ahmedali.mycar.data.db.FaultRecordEntity
import com.ahmedali.mycar.data.db.MaintenanceRecordEntity
import com.ahmedali.mycar.data.db.PendingTaskEntity
import com.ahmedali.mycar.data.db.SparePartEntity
import com.ahmedali.mycar.data.db.TireRecordEntity
import com.ahmedali.mycar.data.db.VehicleEntity
import com.ahmedali.mycar.domain.EgyptianCarCatalog
import com.ahmedali.mycar.domain.FuelCalculator
import com.ahmedali.mycar.domain.UnitConverter
import com.ahmedali.mycar.ui.theme.*
import com.ahmedali.mycar.worker.NotificationHelper
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.YearMonth
import java.util.UUID
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as MyCarApplication
        setContent {
            val prefs = remember { getSharedPreferences("mycar_prefs", Context.MODE_PRIVATE) }
            val initialMode = remember {
                prefs.getString("theme_mode", null)
                    ?: if (prefs.getBoolean("is_dark_theme", false)) "dark" else "light"
            }
            var themeMode by remember { mutableStateOf(initialMode) }
            val systemIsDark = isSystemInDarkTheme()
            val effectiveDark = when (themeMode) {
                "dark" -> true
                "light" -> false
                else -> systemIsDark
            }
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                MyCarTheme(isDarkTheme = effectiveDark) {
                    MyCarAppRoot(
                        app = app,
                        themeMode = themeMode,
                        systemIsDark = systemIsDark,
                        onSelectThemeMode = { nextMode ->
                            themeMode = nextMode
                            prefs.edit()
                                .putString("theme_mode", nextMode)
                                .putBoolean("is_dark_theme", nextMode == "dark")
                                .apply()
                        }
                    )
                }
            }
        }
    }
}

enum class ScreenRoute {
    SPLASH, HOME, VEHICLES, ODOMETER, ENGINE_OIL, FUEL, MAINTENANCE, FAULTS, EXPENSES, PARTS, TIRES, DOCUMENTS, REPORTS, BACKUP, ABOUT
}

@Composable
fun ThemeModeMenuButton(
    themeMode: String,
    systemIsDark: Boolean,
    onSelectThemeMode: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        FilledTonalIconButton(
            onClick = { expanded = true },
            colors = IconButtonDefaults.filledTonalIconButtonColors(containerColor = GraphiteSurface)
        ) {
            Icon(
                imageVector = when (themeMode) {
                    "system" -> Icons.Filled.BrightnessAuto
                    "dark" -> Icons.Filled.LightMode
                    else -> Icons.Filled.DarkMode
                },
                contentDescription = "مظهر التطبيق",
                tint = when (themeMode) {
                    "system" -> Color(0xFF0EA5E9)
                    "dark" -> AlertYellow
                    else -> CrimsonAccent
                }
            )
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(GraphiteSurface)
        ) {
            DropdownMenuItem(
                text = { Text("الوضع الفاتح", color = if (themeMode == "light") CrimsonAccent else TextPrimary, fontWeight = if (themeMode == "light") FontWeight.Bold else FontWeight.Normal) },
                leadingIcon = { Icon(Icons.Filled.LightMode, contentDescription = null, tint = AlertYellow) },
                onClick = { expanded = false; onSelectThemeMode("light") }
            )
            DropdownMenuItem(
                text = { Text("الوضع الداكن", color = if (themeMode == "dark") CrimsonAccent else TextPrimary, fontWeight = if (themeMode == "dark") FontWeight.Bold else FontWeight.Normal) },
                leadingIcon = { Icon(Icons.Filled.DarkMode, contentDescription = null, tint = CrimsonAccent) },
                onClick = { expanded = false; onSelectThemeMode("dark") }
            )
            DropdownMenuItem(
                text = { Text("حسب الموبايل (${if (systemIsDark) "داكن" else "فاتح"})", color = if (themeMode == "system") CrimsonAccent else TextPrimary, fontWeight = if (themeMode == "system") FontWeight.Bold else FontWeight.Normal) },
                leadingIcon = { Icon(Icons.Filled.BrightnessAuto, contentDescription = null, tint = Color(0xFF0EA5E9)) },
                onClick = { expanded = false; onSelectThemeMode("system") }
            )
        }
    }
}

@Composable
fun MyCarAppRoot(
    app: MyCarApplication,
    themeMode: String,
    systemIsDark: Boolean,
    onSelectThemeMode: (String) -> Unit
) {
    val repo = app.repository
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var currentScreen by remember { mutableStateOf(ScreenRoute.SPLASH) }
    val vehicles by repo.observeVehicles().collectAsState(initial = emptyList())
    var activeVehicleId by remember { mutableStateOf<String?>(null) }
    var bundle by remember { mutableStateOf<VehicleBundle?>(null) }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var hasNotifPermission by remember { mutableStateOf(NotificationHelper.hasNotificationPermission(context)) }

    val notifLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasNotifPermission = granted
    }

    suspend fun refreshActiveBundle() {
        val settings = repo.getSettings()
        val chosen = vehicles.firstOrNull { it.id == settings.activeVehicleId && !it.isArchived }
            ?: vehicles.firstOrNull { !it.isArchived }
        activeVehicleId = chosen?.id
        bundle = chosen?.let { repo.getVehicleBundle(it.id) }
    }

    LaunchedEffect(Unit) {
        delay(900)
        refreshActiveBundle()
        currentScreen = ScreenRoute.HOME
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotifPermission) {
            notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    LaunchedEffect(vehicles, activeVehicleId) {
        refreshActiveBundle()
    }

    if (currentScreen == ScreenRoute.SPLASH) {
        Box(
            modifier = Modifier.fillMaxSize().background(ObsidianCanvas),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.Speed, contentDescription = null, tint = CrimsonAccent, modifier = Modifier.size(64.dp))
                Spacer(Modifier.height(16.dp))
                Text("عربيتي | MY CAR", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            }
        }
        return
    }

    Scaffold(
        containerColor = ObsidianCanvas,
        snackbarHost = {
            statusMessage?.let { msg ->
                Snackbar(
                    modifier = Modifier.padding(16.dp),
                    containerColor = ElevatedSlate,
                    contentColor = TextPrimary,
                    action = { TextButton(onClick = { statusMessage = null }) { Text("إغلاق", color = CrimsonAccent) } }
                ) { Text(msg) }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (currentScreen != ScreenRoute.HOME) {
                Row(
                    modifier = Modifier.fillMaxWidth().background(GraphiteSurface).padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { currentScreen = ScreenRoute.HOME }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع", tint = TextPrimary)
                    }
                    Text(
                        text = when (currentScreen) {
                            ScreenRoute.VEHICLES -> "مبدّل السيارات وإدارة المركبات"
                            ScreenRoute.ODOMETER -> "العداد وسجل التصحيحات"
                            ScreenRoute.ENGINE_OIL -> "زيت المحرك والفلتر"
                            ScreenRoute.FUEL -> "الوقود والاستهلاك (Full-to-Full)"
                            ScreenRoute.MAINTENANCE -> "الصيانة والبنود المخصصة"
                            ScreenRoute.FAULTS -> "الأعطال والأعمال المطلوبة"
                            ScreenRoute.EXPENSES -> "المصروفات"
                            ScreenRoute.PARTS -> "قطع الغيار"
                            ScreenRoute.TIRES -> "الإطارات وتجهيزات الطوارئ"
                            ScreenRoute.DOCUMENTS -> "الأوراق والتراخيص"
                            ScreenRoute.REPORTS -> "تقرير السيارة"
                            ScreenRoute.BACKUP -> "النسخ الاحتياطي والاستعادة"
                            ScreenRoute.ABOUT -> "حول التطبيق"
                            else -> "عربيتي | MY CAR"
                        },
                        color = TextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    ThemeModeMenuButton(
                        themeMode = themeMode,
                        systemIsDark = systemIsDark,
                        onSelectThemeMode = onSelectThemeMode
                    )
                }
            }

            when (currentScreen) {
                ScreenRoute.HOME -> HomeScreen(
                    vehicles = vehicles.filter { !it.isArchived },
                    bundle = bundle,
                    hasNotifPermission = hasNotifPermission,
                    themeMode = themeMode,
                    systemIsDark = systemIsDark,
                    onSelectThemeMode = onSelectThemeMode,
                    onOpenNotifSettings = {
                        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        }
                        context.startActivity(intent)
                    },
                    onNavigate = { route ->
                        val needsVehicle = route !in listOf(ScreenRoute.VEHICLES, ScreenRoute.BACKUP, ScreenRoute.ABOUT)
                        if (bundle == null && needsVehicle) {
                            statusMessage = "يرجى إضافة سيارة أولاً"
                            currentScreen = ScreenRoute.VEHICLES
                        } else {
                            currentScreen = route
                        }
                    },
                    onQuickOdometerUpdate = { newDisplayVal ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            try {
                                val km = UnitConverter.toInternalKm(newDisplayVal, v.odometerUnit)
                                repo.updateOdometerNormal(v.id, km)
                                refreshActiveBundle()
                                statusMessage = "تم تحديث قراءة العداد"
                            } catch (e: Exception) {
                                statusMessage = e.message
                            }
                        }
                    }
                )
                ScreenRoute.VEHICLES -> VehiclesScreen(
                    vehicles = vehicles,
                    activeId = activeVehicleId,
                    onSelect = { id ->
                        scope.launch {
                            repo.setActiveVehicle(id)
                            activeVehicleId = id
                            refreshActiveBundle()
                            currentScreen = ScreenRoute.HOME
                        }
                    },
                    onCreate = { brand, model, year, plate, unit, odoDisplay, ownership, poaDone, licExp, inspExp, drvExp, hasJack, hasLugWrench, hasAirPump, tireBrand, tireSize, tireDotWeek, tireDotYear ->
                        scope.launch {
                            try {
                                val km = odoDisplay?.let { UnitConverter.toInternalKm(it, unit) }
                                val created = repo.createVehicle(
                                    brand = brand,
                                    model = model,
                                    year = year,
                                    plateRaw = plate,
                                    odometerUnit = unit,
                                    initialOdometerKm = km,
                                    ownershipType = ownership,
                                    poaRegisteredContractDone = poaDone,
                                    vehicleLicenseExpiry = licExp,
                                    technicalInspectionDate = inspExp,
                                    driverLicenseExpiry = drvExp,
                                    hasJack = hasJack,
                                    hasLugWrench = hasLugWrench,
                                    hasAirPump = hasAirPump,
                                    tireBrand = tireBrand,
                                    tireSize = tireSize,
                                    tireDotWeek = tireDotWeek,
                                    tireDotYear = tireDotYear
                                )
                                repo.setActiveVehicle(created.id)
                                activeVehicleId = created.id
                                refreshActiveBundle()
                                statusMessage = "تمت إضافة السيارة بنجاح"
                                currentScreen = ScreenRoute.HOME
                            } catch (e: Exception) {
                                statusMessage = e.message
                            }
                        }
                    }
                )
                ScreenRoute.ODOMETER -> OdometerScreen(
                    bundle = bundle,
                    onNormalUpdate = { valDisplay ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            try {
                                repo.updateOdometerNormal(v.id, UnitConverter.toInternalKm(valDisplay, v.odometerUnit))
                                refreshActiveBundle()
                                statusMessage = "تم تسجيل قراءة العداد"
                            } catch (e: Exception) { statusMessage = e.message }
                        }
                    },
                    onCorrection = { valDisplay, reason ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            repo.correctOdometer(v.id, UnitConverter.toInternalKm(valDisplay, v.odometerUnit), reason)
                            refreshActiveBundle()
                            statusMessage = "تم تصحيح العداد وحفظ سجل التصحيح دون تغيير المصروفات"
                        }
                    }
                )
                ScreenRoute.FUEL -> FuelScreen(
                    bundle = bundle,
                    onAddFuel = { fuelType, liters, totalEgp, odoDisplay, fillType ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            try {
                                repo.saveFuelEntry(
                                    v.id,
                                    LocalDateTime.now().toString().take(16),
                                    UnitConverter.toInternalKm(odoDisplay, v.odometerUnit),
                                    fuelType,
                                    liters,
                                    UnitConverter.toPiastres(totalEgp),
                                    fillType
                                )
                                refreshActiveBundle()
                                statusMessage = "تم تسجيل التعبئة والمصروف التلقائي"
                            } catch (e: Exception) { statusMessage = e.message }
                        }
                    }
                )
                ScreenRoute.ENGINE_OIL -> EngineOilScreen(
                    bundle = bundle,
                    onSaveOil = { date, odoDisplay, brand, visc, intervalKmInput, costEgp, filterChanged, filterCostEgp, source, mech ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            val odoKm = UnitConverter.toInternalKm(odoDisplay, v.odometerUnit)
                            val intervalKm = intervalKmInput
                            val intervalMonths = 12
                            val nextDueDate = try { LocalDate.parse(date).plusMonths(12L).toString() } catch (_: Exception) { null }
                            val rec = MaintenanceRecordEntity(
                                id = "maint_${UUID.randomUUID()}",
                                vehicleId = v.id,
                                maintenanceTypeId = "mt_${v.id}_ENGINE_OIL",
                                typeCode = "ENGINE_OIL",
                                date = date,
                                odometerKm = odoKm,
                                costPiastres = UnitConverter.toPiastres(costEgp),
                                brandOrType = brand.ifBlank { null },
                                viscosity = visc.ifBlank { null },
                                intervalKm = intervalKm,
                                intervalMonths = intervalMonths,
                                nextDueKm = intervalKm?.let { odoKm + it },
                                nextDueDate = nextDueDate,
                                scheduleSource = source,
                                oilFilterChanged = filterChanged,
                                oilFilterCostPiastres = UnitConverter.toPiastres(filterCostEgp),
                                mechanicOrCenter = mech.ifBlank { null },
                                createdAt = java.time.Instant.now().toString()
                            )
                            repo.saveMaintenanceRecord(rec, filterChanged, UnitConverter.toPiastres(filterCostEgp))
                            refreshActiveBundle()
                            statusMessage = "تم حفظ تغيير زيت المحرك"
                        }
                    }
                )
                ScreenRoute.MAINTENANCE -> MaintenanceScreen(
                    bundle = bundle,
                    onSaveMaintenance = { typeId, typeCode, customName, date, odoDisplay, brand, intervalDisplay, costEgp, source, mech ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            val odoKm = UnitConverter.toInternalKm(odoDisplay, v.odometerUnit)
                            val intervalKm = intervalDisplay?.let { UnitConverter.toInternalKm(it, v.odometerUnit) }
                            val rec = MaintenanceRecordEntity(
                                id = "maint_${UUID.randomUUID()}",
                                vehicleId = v.id,
                                maintenanceTypeId = typeId,
                                typeCode = typeCode,
                                customName = customName,
                                date = date,
                                odometerKm = odoKm,
                                costPiastres = UnitConverter.toPiastres(costEgp),
                                brandOrType = brand.ifBlank { null },
                                intervalKm = intervalKm,
                                nextDueKm = intervalKm?.let { odoKm + it },
                                scheduleSource = source,
                                mechanicOrCenter = mech.ifBlank { null },
                                createdAt = java.time.Instant.now().toString()
                            )
                            repo.saveMaintenanceRecord(rec, false, 0L)
                            refreshActiveBundle()
                            statusMessage = "تم حفظ سجل الصيانة"
                        }
                    }
                )
                ScreenRoute.FAULTS -> FaultsAndTasksScreen(
                    bundle = bundle,
                    onAddTask = { issue, desc, urgent ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            repo.addPendingTask(v.id, issue, desc, v.currentOdometerKm, if (urgent) "URGENT" else "NORMAL")
                            refreshActiveBundle()
                            statusMessage = "تم تسجيل العمل المطلوب"
                        }
                    },
                    onCompleteTask = { task, repair, partsEgp, laborEgp, mech ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            repo.completePendingTask(
                                task = task,
                                repairPerformed = repair,
                                partsCostPiastres = UnitConverter.toPiastres(partsEgp),
                                laborCostPiastres = UnitConverter.toPiastres(laborEgp),
                                mechanicOrCenter = mech,
                                repairedAt = LocalDate.now().toString(),
                                odometerKm = v.currentOdometerKm
                            )
                            refreshActiveBundle()
                            statusMessage = "تم تأكيد الإصلاح وتحويله لسجل الأعطال"
                        }
                    },
                    onAddFault = { title, desc, status, partsEgp, laborEgp, mech ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            val p = UnitConverter.toPiastres(partsEgp)
                            val l = UnitConverter.toPiastres(laborEgp)
                            val total = p + l
                            val fault = FaultRecordEntity(
                                id = "fault_${UUID.randomUUID()}",
                                vehicleId = v.id,
                                title = title,
                                appearedAt = LocalDate.now().toString(),
                                odometerKm = v.currentOdometerKm,
                                description = desc,
                                repairPerformed = if (status == "REPAIRED") desc else null,
                                partsCostPiastres = p,
                                laborCostPiastres = l,
                                totalCostPiastres = total,
                                mechanicOrCenter = mech.ifBlank { null },
                                status = status,
                                repairedAt = if (status == "REPAIRED") LocalDate.now().toString() else null,
                                createdAt = Instant.now().toString()
                            )
                            repo.saveFaultRecord(fault)
                            refreshActiveBundle()
                            statusMessage = "تم حفظ العطل"
                        }
                    }
                )
                ScreenRoute.EXPENSES -> ExpensesScreen(
                    bundle = bundle,
                    onAddAdditional = { cat, date, amountEgp, notes ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            repo.saveAdditionalExpense(v.id, cat, date, UnitConverter.toPiastres(amountEgp), v.currentOdometerKm, notes)
                            refreshActiveBundle()
                            statusMessage = "تم إضافة المصروف الإضافي"
                        }
                    }
                )
                ScreenRoute.PARTS -> SparePartsScreen(
                    bundle = bundle,
                    onAddPart = { name, brand, priceEgp, vendor, includedInParent ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            val today = LocalDate.now().toString()
                            repo.saveSparePart(
                                SparePartEntity(
                                    id = "part_${UUID.randomUUID()}",
                                    vehicleId = v.id,
                                    partName = name,
                                    brand = brand,
                                    purchaseDate = today,
                                    installDate = today,
                                    odometerKm = v.currentOdometerKm,
                                    pricePiastres = UnitConverter.toPiastres(priceEgp),
                                    vendorOrCenter = vendor.ifBlank { null },
                                    linkedRecordType = "STANDALONE",
                                    includedInParentCost = includedInParent,
                                    createdAt = Instant.now().toString()
                                )
                            )
                            refreshActiveBundle()
                            statusMessage = "تم تسجيل قطعة الغيار"
                        }
                    }
                )
                ScreenRoute.TIRES -> TiresScreen(
                    bundle = bundle,
                    onUpdateTire = { tire ->
                        scope.launch {
                            repo.saveTireRecord(tire)
                            refreshActiveBundle()
                            statusMessage = "تم تحديث بيانات الإطار"
                        }
                    },
                    onUpdateEmergency = { eq ->
                        scope.launch {
                            repo.saveEmergencyEquipment(eq)
                            refreshActiveBundle()
                            statusMessage = "تم تحديث تجهيزات الطوارئ"
                        }
                    }
                )
                ScreenRoute.DOCUMENTS -> DocumentsScreen(
                    bundle = bundle,
                    onRenewDoc = { doc, newDate ->
                        scope.launch {
                            repo.renewDocument(doc, newDate)
                            refreshActiveBundle()
                            statusMessage = "تم تجديد الوثيقة وحفظ التاريخ السابق"
                        }
                    },
                    onTogglePoa = { done ->
                        scope.launch {
                            val v = bundle?.vehicle ?: return@launch
                            repo.togglePoaRegistered(v.id, done)
                            refreshActiveBundle()
                            statusMessage = "تم تحديث حالة التوكيل"
                        }
                    }
                )
                ScreenRoute.REPORTS -> ReportsScreen(bundle = bundle)
                ScreenRoute.BACKUP -> BackupScreen(
                    onExport = { uri ->
                        scope.launch {
                            val jsonStr = repo.exportBackupJson()
                            context.contentResolver.openOutputStream(uri)?.use { it.write(jsonStr.toByteArray(Charsets.UTF_8)) }
                            statusMessage = "تم إنشاء النسخة الاحتياطية بنجاح"
                        }
                    },
                    onImportPreview = { uri, onResult ->
                        scope.launch {
                            val txt = context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } ?: ""
                            val res = repo.previewBackup(txt)
                            val msg = if (res.valid) {
                                "نسخة سليمة (${res.payload?.data?.vehicles?.size ?: 0} سيارات)"
                            } else {
                                res.error ?: "ملف غير صالح"
                            }
                            onResult(res.valid, txt, msg, res.isDuplicateRestore)
                        }
                    },
                    onConfirmRestore = { rawJson, allowDup ->
                        scope.launch {
                            try {
                                repo.restoreFromBackup(rawJson, allowDup)
                                refreshActiveBundle()
                                statusMessage = "تمت استعادة جميع البيانات بنجاح"
                            } catch (e: Exception) {
                                statusMessage = e.message
                            }
                        }
                    }
                )
                ScreenRoute.ABOUT -> AboutScreen()
                ScreenRoute.SPLASH -> Unit
            }
        }
    }
}

data class HomeTile(
    val title: String,
    val icon: ImageVector,
    val route: ScreenRoute,
    val sectionKey: String,
    val iconColor: Color = CrimsonAccent,
    val highlight: Boolean = false
)

@Composable
fun HomeScreen(
    vehicles: List<VehicleEntity>,
    bundle: VehicleBundle?,
    hasNotifPermission: Boolean,
    themeMode: String,
    systemIsDark: Boolean,
    onSelectThemeMode: (String) -> Unit,
    onOpenNotifSettings: () -> Unit,
    onNavigate: (ScreenRoute) -> Unit,
    onQuickOdometerUpdate: (Double) -> Unit
) {
    var showOdoDialog by remember { mutableStateOf(false) }
    var odoInput by remember { mutableStateOf("") }

    val tiles = listOf(
        HomeTile("زيت المحرك", Icons.Filled.WaterDrop, ScreenRoute.ENGINE_OIL, "engine_oil", Color.White, highlight = true),
        HomeTile("الوقود", Icons.Filled.LocalGasStation, ScreenRoute.FUEL, "fuel", Color(0xFF0EA5E9)),
        HomeTile("الصيانة", Icons.Filled.Build, ScreenRoute.MAINTENANCE, "maintenance", Color(0xFF6366F1)),
        HomeTile("الإطارات والطوارئ", Icons.Filled.TireRepair, ScreenRoute.TIRES, "tires", Color(0xFF14B8A6)),
        HomeTile("الأعطال والأعمال", Icons.Filled.Warning, ScreenRoute.FAULTS, "faults", Color(0xFFF59E0B)),
        HomeTile("المصروفات", Icons.Filled.ReceiptLong, ScreenRoute.EXPENSES, "expenses", Color(0xFF10B981)),
        HomeTile("قطع الغيار", Icons.Filled.Settings, ScreenRoute.PARTS, "parts", Color(0xFF8B5CF6)),
        HomeTile("الأوراق والتراخيص", Icons.Filled.Description, ScreenRoute.DOCUMENTS, "documents", Color(0xFF3B82F6)),
        HomeTile("تقرير السيارة", Icons.Filled.Assessment, ScreenRoute.REPORTS, "reports", Color(0xFF06B6D4)),
        HomeTile("النسخ الاحتياطي", Icons.Filled.Backup, ScreenRoute.BACKUP, "backup", Color(0xFF64748B)),
        HomeTile("حول التطبيق", Icons.Filled.Info, ScreenRoute.ABOUT, "about", Color(0xFFF43F5E))
    )

    val sectionRedCounts = remember(bundle) {
        val map = mutableMapOf<String, Int>()
        bundle?.reminders?.filter { it.severity == "RED" }?.forEach { rem ->
            map[rem.targetSection] = (map[rem.targetSection] ?: 0) + 1
        }
        val unrepaired = bundle?.faultRecords?.count { it.status != "REPAIRED" } ?: 0
        if (unrepaired > 0) map["faults"] = (map["faults"] ?: 0) + unrepaired
        map
    }
    val sectionYellowCounts = remember(bundle) {
        val map = mutableMapOf<String, Int>()
        bundle?.reminders?.filter { it.severity == "YELLOW" }?.forEach { rem ->
            map[rem.targetSection] = (map[rem.targetSection] ?: 0) + 1
        }
        map
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("عربيتي | MY CAR", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    // Very small, quiet byline per spec Section 4 (NO phone number on Home!)
                    Text("by Ahmed Ali", fontSize = 9.sp, color = TextSecondary.copy(alpha = 0.65f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    ThemeModeMenuButton(
                        themeMode = themeMode,
                        systemIsDark = systemIsDark,
                        onSelectThemeMode = onSelectThemeMode
                    )
                    if (vehicles.isEmpty()) {
                        Button(
                            onClick = { onNavigate(ScreenRoute.VEHICLES) },
                            colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("إضافة سيارة", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        FilledTonalIconButton(
                            onClick = { onNavigate(ScreenRoute.VEHICLES) },
                            modifier = Modifier.size(34.dp),
                            colors = IconButtonDefaults.filledTonalIconButtonColors(containerColor = GraphiteSurface)
                        ) {
                            Icon(Icons.Filled.Add, contentDescription = "إضافة سيارة", tint = CrimsonAccent, modifier = Modifier.size(18.dp))
                        }
                        FilledTonalButton(
                            onClick = { onNavigate(ScreenRoute.VEHICLES) },
                            colors = ButtonDefaults.filledTonalButtonColors(containerColor = GraphiteSurface),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Icon(Icons.Filled.DirectionsCar, contentDescription = null, tint = CrimsonAccent, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("(${vehicles.size})", color = TextPrimary, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        if (!hasNotifPermission) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = GraphiteSurface),
                    border = BorderStroke(1.dp, AlertYellow)
                ) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.NotificationsOff, contentDescription = null, tint = AlertYellow)
                        Spacer(Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("صلاحية الإشعارات غير مفعلة", fontWeight = FontWeight.Bold, color = TextPrimary, fontSize = 13.sp)
                            Text("لن تصلك التنبيهات الحمراء العاجلة خارج التطبيق عند رفض الصلاحية.", color = TextSecondary, fontSize = 11.sp)
                        }
                        TextButton(onClick = onOpenNotifSettings) { Text("تفعيل", color = CrimsonAccent) }
                    }
                }
            }
        }

        if (bundle != null) {
            val v = bundle.vehicle
            val hasOdo = v.hasOdometerReading
            val displayOdo = UnitConverter.fromInternalKm(v.currentOdometerKm, v.odometerUnit)
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = GraphiteSurface),
                    border = BorderStroke(1.dp, SubtleBorder),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("${v.brand} ${v.model} (${v.year})", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Text("اللوحة: ${v.plateNormalized}", fontSize = 13.sp, color = TextSecondary)
                        Spacer(Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("قراءة العداد الحالية", fontSize = 12.sp, color = TextSecondary)
                                Text(
                                    text = if (hasOdo) "${displayOdo.toInt()} ${v.odometerUnit}" else "غير مسجلة بعد",
                                    fontSize = if (hasOdo) 26.sp else 17.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (hasOdo) TextPrimary else AlertYellow
                                )
                            }
                            Button(
                                onClick = {
                                    odoInput = if (hasOdo) displayOdo.toInt().toString() else ""
                                    showOdoDialog = true
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent)
                            ) {
                                Text(if (hasOdo) "تحديث العداد" else "تسجيل العداد")
                            }
                        }
                    }
                }
            }

            val redCount = bundle.reminders.count { it.severity == "RED" }
            val yellowCount = bundle.reminders.count { it.severity == "YELLOW" }
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = GraphiteSurface),
                    border = BorderStroke(1.dp, if (redCount > 0) AlertRed else SubtleBorder)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("ملخص تنبيهات السيارة ($redCount عاجل · $yellowCount قريب)", fontWeight = FontWeight.Bold, color = TextPrimary, fontSize = 14.sp)
                        bundle.reminders.take(3).forEach { rem ->
                            val badgeColor = when (rem.severity) {
                                "RED" -> AlertRed
                                "YELLOW" -> AlertYellow
                                else -> AlertGreen
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth().clickable {
                                    when (rem.targetSection) {
                                        "documents" -> onNavigate(ScreenRoute.DOCUMENTS)
                                        "tires" -> onNavigate(ScreenRoute.TIRES)
                                        "engine_oil" -> onNavigate(ScreenRoute.ENGINE_OIL)
                                        "faults" -> onNavigate(ScreenRoute.FAULTS)
                                        else -> onNavigate(ScreenRoute.MAINTENANCE)
                                    }
                                },
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Filled.Circle, contentDescription = null, tint = badgeColor, modifier = Modifier.size(10.dp))
                                Spacer(Modifier.width(8.dp))
                                Text(rem.title, color = TextPrimary, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
        }

        item {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxWidth().height(660.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                userScrollEnabled = false
            ) {
                items(tiles) { tile ->
                    val redN = sectionRedCounts[tile.sectionKey] ?: 0
                    val yellowN = sectionYellowCounts[tile.sectionKey] ?: 0
                    val totalN = redN + yellowN
                    val hasAction = totalN > 0
                    val tileBorderColor = when {
                        tile.highlight -> CrimsonAccent
                        redN > 0 -> AlertRed
                        yellowN > 0 -> AlertYellow
                        else -> SubtleBorder
                    }
                    Card(
                        modifier = Modifier.fillMaxWidth().height(98.dp).clickable { onNavigate(tile.route) },
                        colors = CardDefaults.cardColors(
                            containerColor = if (tile.highlight) CrimsonAccent else GraphiteSurface
                        ),
                        border = BorderStroke(if (hasAction && !tile.highlight) 1.5.dp else 1.dp, tileBorderColor),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Box(modifier = Modifier.fillMaxSize()) {
                            Column(
                                modifier = Modifier.fillMaxSize().padding(12.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .background(
                                            color = if (tile.highlight) Color.White.copy(alpha = 0.2f) else tile.iconColor.copy(alpha = 0.14f),
                                            shape = RoundedCornerShape(12.dp)
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = tile.icon,
                                        contentDescription = tile.title,
                                        tint = if (tile.highlight) Color.White else tile.iconColor,
                                        modifier = Modifier.size(26.dp)
                                    )
                                }
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    text = tile.title,
                                    color = if (tile.highlight) Color.White else TextPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                            if (hasAction) {
                                val badgeBg = when {
                                    tile.highlight && redN > 0 -> Color.White
                                    redN > 0 -> AlertRed
                                    else -> AlertYellow
                                }
                                val badgeFg = when {
                                    tile.highlight && redN > 0 -> CrimsonAccent
                                    redN > 0 -> Color.White
                                    else -> Color(0xFF0F172A)
                                }
                                Surface(
                                    color = badgeBg,
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.align(Alignment.TopEnd).padding(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Filled.Warning,
                                            contentDescription = "إجراء مطلوب",
                                            tint = badgeFg,
                                            modifier = Modifier.size(11.dp)
                                        )
                                        Text(
                                            text = "$totalN",
                                            color = badgeFg,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showOdoDialog) {
        AlertDialog(
            onDismissRequest = { showOdoDialog = false },
            containerColor = GraphiteSurface,
            title = { Text("تحديث قراءة العداد", color = TextPrimary) },
            text = {
                OutlinedTextField(
                    value = odoInput,
                    onValueChange = { odoInput = it },
                    label = { Text("القراءة الجديدة (${bundle?.vehicle?.odometerUnit ?: "KM"})") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        odoInput.toDoubleOrNull()?.let { onQuickOdometerUpdate(it) }
                        showOdoDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent)
                ) { Text("حفظ") }
            },
            dismissButton = {
                TextButton(onClick = { showOdoDialog = false }) { Text("إلغاء", color = TextSecondary) }
            }
        )
    }
}

@Composable
fun VehiclesScreen(
    vehicles: List<VehicleEntity>,
    activeId: String?,
    onSelect: (String) -> Unit,
    onCreate: (String, String, Int, String, String, Double?, String, Boolean, String, String, String, Boolean?, Boolean?, Boolean?, String, String, Int?, Int?) -> Unit
) {
    var brand by remember { mutableStateOf(EgyptianCarCatalog.defaults.first().brand) }
    var model by remember { mutableStateOf(EgyptianCarCatalog.defaults.first().models.first().name) }
    var year by remember { mutableStateOf("2023") }

    // 3 letter boxes + 4 digit boxes
    var l0 by remember { mutableStateOf("") }
    var l1 by remember { mutableStateOf("") }
    var l2 by remember { mutableStateOf("") }
    var d0 by remember { mutableStateOf("") }
    var d1 by remember { mutableStateOf("") }
    var d2 by remember { mutableStateOf("") }
    var d3 by remember { mutableStateOf("") }

    var unit by remember { mutableStateOf("KM") }
    var odometer by remember { mutableStateOf("") } // Optional!
    var ownership by remember { mutableStateOf("REGISTERED_CONTRACT") }
    var poaDone by remember { mutableStateOf(false) }

    val defaultLicDate = remember { LocalDate.now().plusYears(1) }
    var licExpiry by remember { mutableStateOf(defaultLicDate.toString()) }
    var inspYear by remember { mutableStateOf((defaultLicDate.year + 1).toString()) }
    var drvExpiry by remember { mutableStateOf(defaultLicDate.plusYears(2).toString()) }

    // Explicit non-assumed emergency equipment
    var hasJack by remember { mutableStateOf<Boolean?>(null) }
    var hasLugWrench by remember { mutableStateOf<Boolean?>(null) }
    var hasAirPump by remember { mutableStateOf<Boolean?>(null) }

    // Explicit non-assumed tires
    var tiresVaryLater by remember { mutableStateOf(false) }
    var tireBrand by remember { mutableStateOf("") }
    var tireSize by remember { mutableStateOf("") }
    var tireDotWeek by remember { mutableStateOf("") }
    var tireDotYear by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    var wizardStep by remember { mutableStateOf(1) }
    val stepTitles = listOf("السيارة واللوحة", "العداد والملكية", "التراخيص والفحص", "الطوارئ والإطارات")

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(vehicles) { v ->
            Card(
                modifier = Modifier.fillMaxWidth().clickable { onSelect(v.id) },
                colors = CardDefaults.cardColors(containerColor = GraphiteSurface),
                border = BorderStroke(1.dp, if (v.id == activeId) CrimsonAccent else SubtleBorder)
            ) {
                Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.DirectionsCar, contentDescription = null, tint = CrimsonAccent, modifier = Modifier.size(32.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${v.brand} ${v.model} (${v.year})", fontWeight = FontWeight.Bold, color = TextPrimary)
                        Text("اللوحة: ${v.plateNormalized}", color = TextSecondary, fontSize = 12.sp)
                    }
                    if (v.id == activeId) Text("النشطة", color = CrimsonAccent, fontWeight = FontWeight.Bold)
                }
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, SubtleBorder)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("إضافة سيارة جديدة — الخطوة $wizardStep من 4 (${stepTitles[wizardStep - 1]})", fontWeight = FontWeight.Bold, color = TextPrimary, fontSize = 15.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                        stepTitles.forEachIndexed { idx, label ->
                            val sNum = idx + 1
                            FilterChip(
                                selected = wizardStep == sNum,
                                onClick = { if (sNum <= wizardStep) { formError = null; wizardStep = sNum } },
                                label = { Text("$sNum", fontSize = 11.sp) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    if (wizardStep == 1) {
                        OutlinedTextField(value = brand, onValueChange = { brand = it }, label = { Text("الماركة (Brand)") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = model, onValueChange = { model = it }, label = { Text("الموديل (Model)") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = year, onValueChange = { year = it }, label = { Text("سنة الصنع") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())

                        Text("رقم اللوحة", color = TextSecondary, fontSize = 12.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                            listOf(
                                l0 to { s: String -> l0 = s.take(1) },
                                l1 to { s: String -> l1 = s.take(1) },
                                l2 to { s: String -> l2 = s.take(1) }
                            ).forEach { (v, setter) ->
                                OutlinedTextField(
                                    value = v,
                                    onValueChange = setter,
                                    singleLine = true,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            listOf(
                                d0 to { s: String -> d0 = s.take(1) },
                                d1 to { s: String -> d1 = s.take(1) },
                                d2 to { s: String -> d2 = s.take(1) },
                                d3 to { s: String -> d3 = s.take(1) }
                            ).forEach { (v, setter) ->
                                OutlinedTextField(
                                    value = v,
                                    onValueChange = setter,
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    } else if (wizardStep == 2) {
                        OutlinedTextField(
                            value = odometer,
                            onValueChange = { odometer = it },
                            label = { Text("قراءة العداد الحالية (اختياري الآن)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = unit == "KM", onClick = { unit = "KM" }, label = { Text("KM") })
                            FilterChip(selected = unit == "MILE", onClick = { unit = "MILE" }, label = { Text("Mile") })
                            FilterChip(selected = ownership == "REGISTERED_CONTRACT", onClick = { ownership = "REGISTERED_CONTRACT" }, label = { Text("عقد مسجل") })
                            FilterChip(selected = ownership == "POWER_OF_ATTORNEY", onClick = { ownership = "POWER_OF_ATTORNEY" }, label = { Text("توكيل") })
                        }
                        if (ownership == "POWER_OF_ATTORNEY") {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(checked = poaDone, onCheckedChange = { poaDone = it })
                                Text("تم عمل عقد مسجل؟", color = TextPrimary)
                            }
                        }
                    } else if (wizardStep == 3) {
                        OutlinedTextField(value = licExpiry, onValueChange = { licExpiry = it }, label = { Text("تاريخ انتهاء ترخيص السيارة (YYYY-MM-DD)") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = inspYear, onValueChange = { inspYear = it.take(4) }, label = { Text("سنة الفحص الفني") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = drvExpiry, onValueChange = { drvExpiry = it }, label = { Text("تاريخ انتهاء رخصة القيادة الشخصية (YYYY-MM-DD)") }, modifier = Modifier.fillMaxWidth())
                    } else if (wizardStep == 4) {
                        Text("تجهيزات الطوارئ", fontWeight = FontWeight.Bold, color = TextPrimary, fontSize = 13.sp)
                        listOf(
                            Triple("الكوريك", hasJack) { v: Boolean -> hasJack = v },
                            Triple("مفتاح العجل", hasLugWrench) { v: Boolean -> hasLugWrench = v },
                            Triple("منفاخ كهربائي", hasAirPump) { v: Boolean -> hasAirPump = v }
                        ).forEach { (label, current, setter) ->
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text(label, color = TextPrimary, fontSize = 13.sp)
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    FilterChip(selected = current == true, onClick = { setter(true) }, label = { Text("متوفر") })
                                    FilterChip(selected = current == false, onClick = { setter(false) }, label = { Text("غير متوفر") })
                                }
                            }
                        }
                        if (hasJack == false || hasLugWrench == false) {
                            Text("تنبيه: لابد من توافرهما لسلامتك أثناء السفر", color = AlertRed, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                        if (hasAirPump == false) {
                            Text("نصيحة: من الضروري امتلاك منفاخ كهربائي للطوارئ", color = AlertYellow, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }

                        HorizontalDivider(color = SubtleBorder)
                        Text("بيانات الإطارات", fontWeight = FontWeight.Bold, color = TextPrimary, fontSize = 13.sp)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = tiresVaryLater, onCheckedChange = { tiresVaryLater = it })
                            Text("الإطارات مختلفة (تُدخل لكل إطار لاحقًا)", color = TextSecondary, fontSize = 12.sp)
                        }
                        if (!tiresVaryLater) {
                            OutlinedTextField(value = tireBrand, onValueChange = { tireBrand = it }, label = { Text("ماركة الإطارات") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = tireSize, onValueChange = { tireSize = it }, label = { Text("مقاس الإطارات (مثال: 205/55 R16)") }, modifier = Modifier.fillMaxWidth())
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(value = tireDotWeek, onValueChange = { tireDotWeek = it }, label = { Text("أسبوع DOT (1-53)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
                                OutlinedTextField(value = tireDotYear, onValueChange = { tireDotYear = it }, label = { Text("سنة DOT (مثال 2024)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
                            }
                        }
                    }

                    formError?.let { Text(it, color = AlertRed, fontSize = 12.sp) }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        if (wizardStep > 1) {
                            OutlinedButton(
                                onClick = { formError = null; wizardStep -= 1 },
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("السابق", color = TextPrimary) }
                        }
                        if (wizardStep < 4) {
                            Button(
                                onClick = {
                                    formError = null
                                    if (wizardStep == 1 && (brand.isBlank() || model.isBlank() || (l0 + l1 + l2).isBlank() || (d0 + d1 + d2 + d3).isBlank())) {
                                        formError = "يرجى إدخال الماركة والموديل ورقم اللوحة."
                                        return@Button
                                    }
                                    wizardStep += 1
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("التالي") }
                        } else {
                            Button(
                                onClick = {
                                    formError = null
                                    if (hasJack == null || hasLugWrench == null || hasAirPump == null) {
                                        formError = "يرجى تحديد حالة الكوريك ومفتاح العجل والمنفاخ الكهربائي."
                                        return@Button
                                    }
                                    if (!tiresVaryLater && (tireBrand.isBlank() || tireSize.isBlank() || tireDotWeek.toIntOrNull() !in 1..53 || (tireDotYear.toIntOrNull() ?: 0) !in 2000..2100)) {
                                        formError = "يرجى إدخال بيانات الإطارات (الماركة، المقاس، أسبوع وسنة DOT) أو اختيار إدخال كل إطار لاحقًا."
                                        return@Button
                                    }
                                    val letters = (l0 + l1 + l2).trim()
                                    val digits = (d0 + d1 + d2 + d3).trim()
                                    val combinedPlate = "$letters $digits"
                                    val iYr = inspYear.toIntOrNull() ?: defaultLicDate.plusYears(1).year
                                    val parsedLic = try { LocalDate.parse(licExpiry.take(10)) } catch (_: Exception) { defaultLicDate }
                                    val computedInsp = parsedLic.withYear(iYr).toString()
                                    val y = year.toIntOrNull() ?: 2023
                                    val odo = odometer.trim().takeIf { it.isNotEmpty() }?.toDoubleOrNull()
                                    onCreate(
                                        brand, model, y, combinedPlate, unit, odo, ownership, poaDone,
                                        licExpiry, computedInsp, drvExpiry,
                                        hasJack, hasLugWrench, hasAirPump,
                                        if (tiresVaryLater) "" else tireBrand,
                                        if (tiresVaryLater) "" else tireSize,
                                        if (tiresVaryLater) null else tireDotWeek.toIntOrNull(),
                                        if (tiresVaryLater) null else tireDotYear.toIntOrNull()
                                    )
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("حفظ السيارة") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun OdometerScreen(bundle: VehicleBundle?, onNormalUpdate: (Double) -> Unit, onCorrection: (Double, String) -> Unit) {
    val v = bundle?.vehicle ?: return
    var valStr by remember { mutableStateOf("") }
    var corrStr by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, SubtleBorder)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("تحديث العداد (يرفض القراءة الأقل)", fontWeight = FontWeight.Bold, color = TextPrimary)
                    OutlinedTextField(value = valStr, onValueChange = { valStr = it }, label = { Text("القراءة (${v.odometerUnit})") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                    Button(onClick = { valStr.toDoubleOrNull()?.let(onNormalUpdate) }, colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent)) { Text("تحديث") }
                }
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, AlertYellow)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("تصحيح قراءة العداد (يُحفظ في سجل التصحيحات)", fontWeight = FontWeight.Bold, color = TextPrimary)
                    OutlinedTextField(value = corrStr, onValueChange = { corrStr = it }, label = { Text("القراءة المصححة") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = reason, onValueChange = { reason = it }, label = { Text("سبب التصحيح") }, modifier = Modifier.fillMaxWidth())
                    Button(onClick = { corrStr.toDoubleOrNull()?.let { onCorrection(it, reason) } }, colors = ButtonDefaults.buttonColors(containerColor = ElevatedSlate)) { Text("تأكيد التصحيح") }
                }
            }
        }
        items(bundle.odometerEntries) { entry ->
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("${UnitConverter.fromInternalKm(entry.readingKm, v.odometerUnit)} ${v.odometerUnit} — ${entry.entryType}", color = if (entry.entryType == "CORRECTION") AlertYellow else TextPrimary, fontWeight = FontWeight.Bold)
                    if (entry.previousReadingKm != null) Text("السابقة: ${UnitConverter.fromInternalKm(entry.previousReadingKm, v.odometerUnit)}", color = TextSecondary, fontSize = 12.sp)
                    Text(entry.recordedAt, color = TextSecondary, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
fun FuelScreen(bundle: VehicleBundle?, onAddFuel: (String, Double, Double, Double, String) -> Unit) {
    val v = bundle?.vehicle ?: return
    val analytics = remember(bundle.fuelEntries) { FuelCalculator.calculate(bundle.fuelEntries) }
    var fuelStep by remember { mutableStateOf(1) }
    var fuelType by remember { mutableStateOf("92") }
    var liters by remember { mutableStateOf("") }
    var cost by remember { mutableStateOf("") }
    var odo by remember {
        mutableStateOf(
            if (v.hasOdometerReading) UnitConverter.fromInternalKm(v.currentOdometerKm, v.odometerUnit).toInt().toString()
            else ""
        )
    }
    var fillType by remember { mutableStateOf("FULL") }
    var formError by remember { mutableStateOf<String?>(null) }
    val listState = rememberLazyListState()

    LaunchedEffect(fuelStep, v.id) {
        listState.scrollToItem(0)
    }

    val lVal = liters.toDoubleOrNull()
    val cVal = cost.toDoubleOrNull()
    val pricePerLiter = if (lVal != null && lVal > 0 && cVal != null && cVal >= 0) cVal / lVal else null

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, SubtleBorder)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("المتوسط العام المرجح (Full-to-Full)", color = TextSecondary, fontSize = 12.sp)
                    Text(
                        analytics.overallKmPerLiter?.let { String.format("%.2f كم/لتر", it) } ?: "تحتاج تفويلتين كاملتين متتاليتين",
                        color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold
                    )
                    Text("إجمالي اللترات: ${analytics.totalLiters} · إجمالي المصروف: ${UnitConverter.formatMoney(analytics.totalCostPiastres)}", color = TextSecondary, fontSize = 12.sp)
                }
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, SubtleBorder)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("تسجيل تعبئة وقود — الخطوة $fuelStep من 3", fontWeight = FontWeight.Bold, color = TextPrimary)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                        FilterChip(
                            selected = fuelStep == 1,
                            onClick = { formError = null; fuelStep = 1 },
                            label = { Text("01 النوع والعداد", fontSize = 10.sp) },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = fuelStep == 2,
                            onClick = { if (fuelStep >= 2) { formError = null; fuelStep = 2 } },
                            label = { Text("02 الكمية والتكلفة", fontSize = 10.sp) },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = fuelStep == 3,
                            onClick = { if (fuelStep >= 3) { formError = null; fuelStep = 3 } },
                            label = { Text("03 المراجعة والحفظ", fontSize = 10.sp) },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    if (fuelStep == 1) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = fillType == "FULL", onClick = { fillType = "FULL" }, label = { Text("تفويلة كاملة") })
                            FilterChip(selected = fillType == "PARTIAL", onClick = { fillType = "PARTIAL" }, label = { Text("تعبئة جزئية") })
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("80", "92", "95", "سولار").forEach { ft ->
                                FilterChip(selected = fuelType == ft, onClick = { fuelType = ft }, label = { Text(ft) })
                            }
                        }
                        OutlinedTextField(value = odo, onValueChange = { odo = it }, label = { Text("قراءة العداد (${v.odometerUnit})") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                        formError?.let { Text(it, color = AlertRed, fontSize = 12.sp) }
                        Button(
                            onClick = {
                                val o = odo.toDoubleOrNull()
                                if (o == null || o < 0) {
                                    formError = "يرجى إدخال قراءة عداد صحيحة."
                                } else {
                                    formError = null
                                    fuelStep = 2
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                            modifier = Modifier.fillMaxWidth().height(48.dp)
                        ) { Text("التالي: الكمية والتكلفة") }
                    } else if (fuelStep == 2) {
                        OutlinedTextField(value = liters, onValueChange = { liters = it }, label = { Text("اللترات") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = cost, onValueChange = { cost = it }, label = { Text("المبلغ الإجمالي") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                        if (pricePerLiter != null) {
                            Text("سعر اللتر المحسوب: ${String.format("%.2f", pricePerLiter)}", color = AlertGreen, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        formError?.let { Text(it, color = AlertRed, fontSize = 12.sp) }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            OutlinedButton(
                                onClick = { formError = null; fuelStep = 1 },
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("السابق", color = TextPrimary) }
                            Button(
                                onClick = {
                                    if (lVal == null || lVal <= 0 || cVal == null || cVal < 0) {
                                        formError = "يرجى إدخال عدد اللترات والمبلغ الإجمالي."
                                    } else {
                                        formError = null
                                        fuelStep = 3
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("التالي: المراجعة") }
                        }
                    } else {
                        Card(colors = CardDefaults.cardColors(containerColor = ObsidianCanvas), border = BorderStroke(1.dp, SubtleBorder)) {
                            Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("وقود $fuelType (${if (fillType == "FULL") "تفويلة كاملة" else "تعبئة جزئية"})", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("العداد: $odo ${v.odometerUnit} · الكمية: $liters لتر · الإجمالي: $cost", color = TextSecondary, fontSize = 12.sp)
                                if (pricePerLiter != null) {
                                    Text("سعر اللتر التاريخي: ${String.format("%.2f", pricePerLiter)}", color = AlertGreen, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            OutlinedButton(
                                onClick = { fuelStep = 2 },
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("السابق", color = TextPrimary) }
                            Button(
                                onClick = {
                                    val l = liters.toDoubleOrNull() ?: return@Button
                                    val c = cost.toDoubleOrNull() ?: return@Button
                                    val o = odo.toDoubleOrNull() ?: return@Button
                                    onAddFuel(fuelType, l, c, o, fillType)
                                    liters = ""; cost = ""; fuelStep = 1
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("حفظ التعبئة") }
                        }
                    }
                }
            }
        }
        items(analytics.periods.reversed()) { p ->
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("${p.fuelType} (${if (p.fillType == "FULL") "كاملة" else "جزئية"}) — ${p.liters} لتر", color = TextPrimary, fontWeight = FontWeight.Bold)
                    Text("المبلغ: ${UnitConverter.formatMoney(p.totalCostPiastres)} · سعر اللتر: ${UnitConverter.formatMoney(p.pricePerLiterPiastres)}", color = TextSecondary, fontSize = 12.sp)
                    p.kmPerLiter?.let { Text("الاستهلاك الفعلي: ${String.format("%.2f كم/لتر", it)}", color = AlertGreen, fontSize = 12.sp) }
                    p.excludedReason?.let { Text(it, color = TextSecondary, fontSize = 11.sp) }
                }
            }
        }
    }
}

@Composable
fun EngineOilScreen(bundle: VehicleBundle?, onSaveOil: (String, Double, String, String, Double?, Double, Boolean, Double, String, String) -> Unit) {
    val v = bundle?.vehicle ?: return
    val currentOdoDisplay = if (v.hasOdometerReading) UnitConverter.fromInternalKm(v.currentOdometerKm, v.odometerUnit).toInt().toString() else ""
    var odoText by remember(v.id) { mutableStateOf(currentOdoDisplay) }
    var brand by remember { mutableStateOf("") }
    var visc by remember { mutableStateOf("5W-30") }
    var interval by remember { mutableStateOf("") }
    var cost by remember { mutableStateOf("") }
    var filterChanged by remember { mutableStateOf(true) }
    var filterCost by remember { mutableStateOf("") }
    var source by remember { mutableStateOf("MANUAL") }
    var mech by remember { mutableStateOf("") }
    var oilWizardStep by remember { mutableStateOf(1) }
    val todayStr = remember { LocalDate.now().toString() }
    val oilRecords = bundle.maintenanceRecords.filter { it.typeCode == "ENGINE_OIL" || it.typeCode == "OIL_FILTER" }
    val listState = rememberLazyListState()

    LaunchedEffect(oilWizardStep) {
        listState.scrollToItem(0)
    }

    val odoNum = odoText.toDoubleOrNull()
    val intervalKmNum = interval.toDoubleOrNull()?.takeIf { it > 0 }
    val intervalInUnit = intervalKmNum?.let { UnitConverter.fromInternalKm(it, v.odometerUnit) }
    val previewNextOdo = if (odoNum != null && intervalInUnit != null) (odoNum + intervalInUnit).roundToInt() else null
    val previewNextDate = remember(todayStr) {
        try { LocalDate.parse(todayStr).plusMonths(12L).toString() } catch (_: Exception) { null }
    }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, SubtleBorder)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("تسجيل تغيير زيت المحرك — الخطوة $oilWizardStep من 3", fontWeight = FontWeight.Bold, color = TextPrimary)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                        FilterChip(
                            selected = oilWizardStep == 1,
                            onClick = { oilWizardStep = 1 },
                            label = { Text("01 الزيت والعداد", fontSize = 10.sp) },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = oilWizardStep == 2,
                            onClick = { if (oilWizardStep >= 2) oilWizardStep = 2 },
                            label = { Text("02 الموعد القادم", fontSize = 10.sp) },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = oilWizardStep == 3,
                            onClick = { if (oilWizardStep >= 3) oilWizardStep = 3 },
                            label = { Text("03 التكلفة والحفظ", fontSize = 10.sp) },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    if (oilWizardStep == 1) {
                        OutlinedTextField(value = odoText, onValueChange = { odoText = it }, label = { Text("قراءة العداد (${v.odometerUnit})") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = brand, onValueChange = { brand = it }, label = { Text("نوع وماركة الزيت") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = visc, onValueChange = { visc = it }, label = { Text("اللزوجة") }, modifier = Modifier.fillMaxWidth())
                        Button(
                            onClick = { oilWizardStep = 2 },
                            colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                            modifier = Modifier.fillMaxWidth().height(48.dp)
                        ) { Text("التالي: الكيلومترات والموعد") }
                    } else if (oilWizardStep == 2) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = source == "OEM", onClick = { source = "OEM" }, label = { Text("توصية الشركة المصنعة") })
                            FilterChip(selected = source == "MANUAL", onClick = { source = "MANUAL" }, label = { Text("إدخال يدوي") })
                        }
                        Text("عدد كيلومترات الزيت (كم / KM)", color = TextSecondary, fontSize = 12.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("5000", "10000", "15000").forEach { preset ->
                                FilterChip(selected = interval == preset, onClick = { interval = preset }, label = { Text(preset) })
                            }
                        }
                        OutlinedTextField(value = interval, onValueChange = { interval = it }, label = { Text("مسافة الزيت بالكيلومتر (مثال: 10000)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                        if (v.odometerUnit == "MILE") {
                            Text("وحدة السيارة بالميل (Mile): أدخل مسافة الزيت بالكيلومتر وسيتم تحويلها تلقائيًا للميل.", color = AlertYellow, fontSize = 11.sp)
                        }

                        Card(
                            colors = CardDefaults.cardColors(containerColor = ObsidianCanvas),
                            border = BorderStroke(1.dp, AlertGreen)
                        ) {
                            Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("موعد التغيير القادم المحسوب:", color = AlertGreen, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                if (v.odometerUnit == "MILE" && intervalKmNum != null && intervalInUnit != null) {
                                    Text("تحويل مسافة الزيت: ${intervalKmNum.roundToInt()} كم ≈ ${intervalInUnit.roundToInt()} ميل (Mile)", color = AlertYellow, fontSize = 12.sp)
                                }
                                previewNextOdo?.let { Text("عند عداد: $it ${v.odometerUnit}", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp) }
                                previewNextDate?.let { d ->
                                    Text(
                                        text = (if (previewNextOdo != null) "أو بتاريخ: $d (تلقائي: سنة واحدة) — أيهما أقرب" else "بتاريخ: $d (تلقائي: سنة واحدة)"),
                                        color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp
                                    )
                                }
                                Text("تحذير: المدة الزمنية المحددة (سنة واحدة) هي مدة تقديرية فقط؛ يُرجى مراعاة توصية الشركة المصنعة وظروف القيادة.", color = AlertYellow, fontSize = 11.sp)
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            OutlinedButton(
                                onClick = { oilWizardStep = 1 },
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("السابق", color = TextPrimary) }
                            Button(
                                onClick = { oilWizardStep = 3 },
                                colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("التالي: التكلفة والحفظ") }
                        }
                    } else {
                        Card(colors = CardDefaults.cardColors(containerColor = ObsidianCanvas), border = BorderStroke(1.dp, SubtleBorder)) {
                            Column(modifier = Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text("${brand.ifBlank { "زيت المحرك" }} ($visc) · عداد ${odoText.ifBlank { "-" }} ${v.odometerUnit}", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                previewNextOdo?.let { Text("التغيير القادم: $it ${v.odometerUnit} أو ${previewNextDate ?: ""}", color = AlertGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            }
                        }
                        OutlinedTextField(value = cost, onValueChange = { cost = it }, label = { Text("تكلفة الزيت") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = filterChanged, onCheckedChange = { filterChanged = it })
                            Text("هل تم تغيير فلتر الزيت؟", color = TextPrimary)
                        }
                        if (filterChanged) {
                            OutlinedTextField(value = filterCost, onValueChange = { filterCost = it }, label = { Text("تكلفة الفلتر (اختياري)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                        }
                        OutlinedTextField(value = mech, onValueChange = { mech = it }, label = { Text("اسم الميكانيكي/المركز (اختياري)") }, modifier = Modifier.fillMaxWidth())
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            OutlinedButton(
                                onClick = { oilWizardStep = 2 },
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("السابق", color = TextPrimary) }
                            Button(
                                onClick = {
                                    val odoSubmit = odoText.toDoubleOrNull() ?: UnitConverter.fromInternalKm(v.currentOdometerKm, v.odometerUnit)
                                    onSaveOil(
                                        todayStr,
                                        odoSubmit,
                                        brand,
                                        visc,
                                        interval.toDoubleOrNull()?.takeIf { it > 0 },
                                        cost.toDoubleOrNull() ?: 0.0,
                                        filterChanged,
                                        filterCost.toDoubleOrNull() ?: 0.0,
                                        source,
                                        mech
                                    )
                                    cost = ""; filterCost = ""; oilWizardStep = 1
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("حفظ تغيير الزيت") }
                        }
                    }
                }
            }
        }
        items(oilRecords) { rec ->
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        "${if (rec.typeCode == "OIL_FILTER") "فلتر الزيت" else rec.brandOrType ?: "زيت المحرك"} — ${rec.date}",
                        color = TextPrimary, fontWeight = FontWeight.Bold
                    )
                    if (v.odometerUnit == "MILE" && rec.intervalKm != null) {
                        val intervalMiles = UnitConverter.fromInternalKm(rec.intervalKm, "MILE").roundToInt()
                        Text("المسافة: ${rec.intervalKm.roundToInt()} كم (≈ $intervalMiles ميل)", color = TextSecondary, fontSize = 12.sp)
                    }
                    rec.nextDueKm?.let { dueKm ->
                        val dueDisplay = UnitConverter.fromInternalKm(dueKm, v.odometerUnit).roundToInt()
                        Text("التغيير القادم عند عداد: $dueDisplay ${v.odometerUnit}", color = AlertGreen, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    rec.nextDueDate?.let { dueDate ->
                        val note = if (rec.typeCode == "ENGINE_OIL") " (سنة واحدة - تقديرية)" else ""
                        Text("أو بتاريخ: $dueDate$note", color = AlertGreen, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Text("التكلفة: ${UnitConverter.formatMoney(rec.costPiastres)}", color = TextSecondary, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun MaintenanceScreen(
    bundle: VehicleBundle?,
    onSaveMaintenance: (String, String, String?, String, Double, String, Double?, Double, String, String) -> Unit
) {
    val v = bundle?.vehicle ?: return
    val rankMap = mapOf(
        "AIR_FILTER" to 1,
        "AC_FILTER" to 2,
        "BRAKE_PADS" to 3,
        "SPARK_PLUGS" to 4,
        "BATTERY" to 5,
        "BELTS" to 6,
        "SUSPENSION" to 7,
        "TRANSMISSION_OIL" to 8,
        "CUSTOM" to 9,
        "COOLANT" to 10,
        "AC_FREON" to 11
    )
    val generalTypes = bundle.maintenanceTypes
        .filter { it.code != "ENGINE_OIL" && it.code != "OIL_FILTER" }
        .sortedBy { rankMap[it.code] ?: 50 }
    var selectedType by remember(generalTypes) { mutableStateOf(generalTypes.firstOrNull()) }
    var brand by remember { mutableStateOf("") }
    var interval by remember { mutableStateOf("") }
    var cost by remember { mutableStateOf("") }
    var source by remember { mutableStateOf("MANUAL") }
    var mech by remember { mutableStateOf("") }
    var maintStep by remember { mutableStateOf(1) }
    val generalRecords = bundle.maintenanceRecords.filter { it.typeCode != "ENGINE_OIL" && it.typeCode != "OIL_FILTER" }
    val listState = rememberLazyListState()

    LaunchedEffect(maintStep) {
        listState.scrollToItem(0)
    }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, SubtleBorder)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        if (maintStep == 1) "بنود الصيانة — الخطوة 1 من 3 (اختيار البند)"
                        else "تسجيل: ${selectedType?.name ?: "صيانة"} — الخطوة $maintStep من 3",
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        fontSize = 14.sp
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                        FilterChip(
                            selected = maintStep == 1,
                            onClick = { maintStep = 1 },
                            label = { Text("01 البند", fontSize = 11.sp) },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = maintStep == 2,
                            onClick = { if (maintStep >= 2) maintStep = 2 },
                            label = { Text("02 التفاصيل", fontSize = 11.sp) },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = maintStep == 3,
                            onClick = { if (maintStep >= 3) maintStep = 3 },
                            label = { Text("03 التكلفة", fontSize = 11.sp) },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    if (maintStep == 1) {
                        generalTypes.chunked(2).forEach { rowItems ->
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                                rowItems.forEach { mt ->
                                    FilterChip(
                                        selected = selectedType?.id == mt.id,
                                        onClick = { selectedType = mt },
                                        label = { Text(mt.name, fontSize = 11.sp) },
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                                if (rowItems.size == 1) Spacer(Modifier.weight(1f))
                            }
                        }
                        Button(
                            onClick = { if (selectedType != null) maintStep = 2 },
                            colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                            modifier = Modifier.fillMaxWidth().height(48.dp)
                        ) { Text("التالي: التفاصيل والموعد") }
                    } else if (maintStep == 2) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = source == "OEM", onClick = { source = "OEM" }, label = { Text("توصية الشركة المصنعة") })
                            FilterChip(selected = source == "MANUAL", onClick = { source = "MANUAL" }, label = { Text("إدخال يدوي") })
                        }
                        OutlinedTextField(value = brand, onValueChange = { brand = it }, label = { Text("النوع / الماركة") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = interval, onValueChange = { interval = it }, label = { Text("فترة التغيير (${v.odometerUnit}) اختياري") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            OutlinedButton(
                                onClick = { maintStep = 1 },
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("السابق", color = TextPrimary) }
                            Button(
                                onClick = { maintStep = 3 },
                                colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("التالي: التكلفة والحفظ") }
                        }
                    } else {
                        Card(colors = CardDefaults.cardColors(containerColor = ObsidianCanvas), border = BorderStroke(1.dp, SubtleBorder)) {
                            Column(modifier = Modifier.fillMaxWidth().padding(10.dp)) {
                                Text("${selectedType?.name ?: "صيانة"}${if (brand.isNotBlank()) " · $brand" else ""}", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                if (interval.isNotBlank()) Text("الفترة: $interval ${v.odometerUnit}", color = AlertGreen, fontSize = 11.sp)
                            }
                        }
                        OutlinedTextField(value = cost, onValueChange = { cost = it }, label = { Text("التكلفة") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = mech, onValueChange = { mech = it }, label = { Text("اسم الميكانيكي/المركز (اختياري)") }, modifier = Modifier.fillMaxWidth())
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            OutlinedButton(
                                onClick = { maintStep = 2 },
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("السابق", color = TextPrimary) }
                            Button(
                                onClick = {
                                    val mt = selectedType ?: return@Button
                                    onSaveMaintenance(
                                        mt.id,
                                        mt.code,
                                        if (mt.isCustom) mt.name else null,
                                        LocalDate.now().toString(),
                                        UnitConverter.fromInternalKm(v.currentOdometerKm, v.odometerUnit),
                                        brand,
                                        interval.toDoubleOrNull(),
                                        cost.toDoubleOrNull() ?: 0.0,
                                        source,
                                        mech
                                    )
                                    brand = ""; cost = ""; interval = ""; maintStep = 1
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                                modifier = Modifier.weight(1f).height(48.dp)
                            ) { Text("حفظ سجل الصيانة") }
                        }
                    }
                }
            }
        }
        items(generalRecords) { rec ->
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("${rec.customName ?: rec.typeCode} — ${rec.date}", color = TextPrimary, fontWeight = FontWeight.Bold)
                    Text("التكلفة: ${UnitConverter.formatMoney(rec.costPiastres)}", color = TextSecondary, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun ExpensesScreen(bundle: VehicleBundle?, onAddAdditional: (String, String, Double, String) -> Unit) {
    if (bundle == null) return
    var category by remember { mutableStateOf("غسيل") }
    var amount by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("إضافة مصروف إضافي (غير تلقائي)", fontWeight = FontWeight.Bold, color = TextPrimary)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("غسيل", "معطرات ومنظفات", "إكسسوارات", "ركنة وجراج", "أخرى").forEach { c ->
                            FilterChip(selected = category == c, onClick = { category = c }, label = { Text(c, fontSize = 11.sp) })
                        }
                    }
                    OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("المبلغ") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("ملاحظات") }, modifier = Modifier.fillMaxWidth())
                    Button(
                        onClick = { amount.toDoubleOrNull()?.let { onAddAdditional(category, LocalDate.now().toString(), it, notes); amount = ""; notes = "" } },
                        colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("حفظ المصروف") }
                }
            }
        }
        items(bundle.expenses) { exp ->
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text(exp.categoryLabel, color = TextPrimary, fontWeight = FontWeight.Bold)
                        Text("${exp.date} · ${if (exp.isAutomatic) "تلقائي" else "إضافي"}", color = TextSecondary, fontSize = 11.sp)
                    }
                    Text(UnitConverter.formatMoney(exp.amountPiastres), color = CrimsonAccent, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

private data class AndroidMonthChartPoint(
    val monthKey: String,
    val shortLabel: String,
    val fuel: Long,
    val maint: Long,
    val repairs: Long
)

@Composable
fun ReportsScreen(bundle: VehicleBundle?) {
    if (bundle == null) return
    val total = bundle.expenses.sumOf { it.amountPiastres }
    val fuel = bundle.expenses.filter { it.sourceType == "FUEL" }.sumOf { it.amountPiastres }
    val maint = bundle.expenses.filter { it.sourceType == "MAINTENANCE" || it.sourceType == "OIL_FILTER" }.sumOf { it.amountPiastres }
    val repairs = bundle.expenses.filter { it.sourceType == "FAULT_REPAIR" }.sumOf { it.amountPiastres }
    val parts = bundle.expenses.filter { it.sourceType == "SPARE_PART" }.sumOf { it.amountPiastres }
    val additional = bundle.expenses.filter { it.sourceType == "ADDITIONAL" }.sumOf { it.amountPiastres }

    val fuelColor = Color(0xFF0EA5E9)
    val maintColor = Color(0xFF10B981)
    val repairColor = Color(0xFFF59E0B)

    var showFuel by remember { mutableStateOf(true) }
    var showMaint by remember { mutableStateOf(true) }
    var showRepairs by remember { mutableStateOf(true) }
    var selectedMonthIdx by remember { mutableStateOf(5) }

    val monthNames = remember {
        listOf("يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر")
    }

    val sixMonths = remember(bundle.expenses) {
        var anchor = YearMonth.now()
        bundle.expenses.forEach { e ->
            if (e.date.length >= 7) {
                try {
                    val ym = YearMonth.parse(e.date.take(7))
                    if (ym.isAfter(anchor)) anchor = ym
                } catch (_: Exception) {}
            }
        }
        (5 downTo 0).map { offset ->
            val ym = anchor.minusMonths(offset.toLong())
            val key = ym.toString()
            val matching = bundle.expenses.filter { it.date.startsWith(key) }
            val f = matching.filter { it.sourceType == "FUEL" }.sumOf { it.amountPiastres }
            val m = matching.filter { it.sourceType == "MAINTENANCE" || it.sourceType == "OIL_FILTER" }.sumOf { it.amountPiastres }
            val r = matching.filter { it.sourceType == "FAULT_REPAIR" || it.sourceType == "SPARE_PART" }.sumOf { it.amountPiastres }
            AndroidMonthChartPoint(
                monthKey = key,
                shortLabel = monthNames[(ym.monthValue - 1).coerceIn(0, 11)],
                fuel = f,
                maint = m,
                repairs = r
            )
        }
    }

    val maxMonthVal = remember(sixMonths, showFuel, showMaint, showRepairs) {
        sixMonths.maxOfOrNull {
            (if (showFuel) it.fuel else 0L) +
                (if (showMaint) it.maint else 0L) +
                (if (showRepairs) it.repairs else 0L)
        }?.coerceAtLeast(1L) ?: 1L
    }

    val sixTotalFuel = sixMonths.sumOf { it.fuel }
    val sixTotalMaint = sixMonths.sumOf { it.maint }
    val sixTotalRepairs = sixMonths.sumOf { it.repairs }
    val sixGrandTotal = (sixTotalFuel + sixTotalMaint + sixTotalRepairs).coerceAtLeast(0L)

    val listState = rememberLazyListState()
    LaunchedEffect(bundle.vehicle.id) {
        listState.scrollToItem(0)
    }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                "تقرير السيارة المستقل: ${bundle.vehicle.brand} ${bundle.vehicle.model}",
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                fontSize = 16.sp
            )
        }

        // Interactive 6-Month Stacked Distribution Chart
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, SubtleBorder)) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("توزيع المصروفات خلال الـ 6 أشهر الماضية", fontWeight = FontWeight.Bold, color = TextPrimary, fontSize = 14.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(
                            selected = showFuel,
                            onClick = { if (!showFuel || showMaint || showRepairs) showFuel = !showFuel },
                            label = { Text("الوقود", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                        )
                        FilterChip(
                            selected = showMaint,
                            onClick = { if (!showMaint || showFuel || showRepairs) showMaint = !showMaint },
                            label = { Text("الصيانة", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                        )
                        FilterChip(
                            selected = showRepairs,
                            onClick = { if (!showRepairs || showFuel || showMaint) showRepairs = !showRepairs },
                            label = { Text("الإصلاحات", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth().height(150.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.Bottom
                    ) {
                        sixMonths.forEachIndexed { idx, pt ->
                            val fVal = if (showFuel) pt.fuel else 0L
                            val mVal = if (showMaint) pt.maint else 0L
                            val rVal = if (showRepairs) pt.repairs else 0L
                            val barTotal = fVal + mVal + rVal
                            val totalFraction = (barTotal.toFloat() / maxMonthVal.toFloat()).coerceIn(0f, 1f)
                            val isSelected = selectedMonthIdx == idx

                            Column(
                                modifier = Modifier.weight(1f).clickable { selectedMonthIdx = idx },
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Bottom
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(115.dp),
                                    contentAlignment = Alignment.BottomCenter
                                ) {
                                    if (barTotal > 0) {
                                        val barHeight = (110f * totalFraction).coerceAtLeast(10f).dp
                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth(0.72f)
                                                .height(barHeight)
                                                .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                                        ) {
                                            if (rVal > 0) {
                                                Box(
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .weight(rVal.toFloat())
                                                        .background(repairColor)
                                                )
                                            }
                                            if (mVal > 0) {
                                                Box(
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .weight(mVal.toFloat())
                                                        .background(maintColor)
                                                )
                                            }
                                            if (fVal > 0) {
                                                Box(
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .weight(fVal.toFloat())
                                                        .background(fuelColor)
                                                )
                                            }
                                        }
                                    } else {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth(0.72f)
                                                .height(4.dp)
                                                .clip(RoundedCornerShape(2.dp))
                                                .background(SubtleBorder)
                                        )
                                    }
                                }
                                Spacer(Modifier.height(6.dp))
                                Text(
                                    text = pt.shortLabel,
                                    fontSize = 10.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) CrimsonAccent else TextSecondary
                                )
                            }
                        }
                    }

                    val activePt = sixMonths.getOrNull(selectedMonthIdx)
                    if (activePt != null) {
                        Card(colors = CardDefaults.cardColors(containerColor = ObsidianCanvas), border = BorderStroke(1.dp, SubtleBorder)) {
                            Column(modifier = Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("تفاصيل ${activePt.shortLabel} (${activePt.monthKey})", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("وقود: ${UnitConverter.formatMoney(activePt.fuel)}", color = fuelColor, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                                    Text("صيانة: ${UnitConverter.formatMoney(activePt.maint)}", color = maintColor, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                                    Text("إصلاحات: ${UnitConverter.formatMoney(activePt.repairs)}", color = repairColor, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Donut Chart Share (Last 6 Months)
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, SubtleBorder)) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Box(modifier = Modifier.size(104.dp), contentAlignment = Alignment.Center) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val strokeW = 16.dp.toPx()
                            if (sixGrandTotal <= 0L) {
                                drawArc(
                                    color = Color(0xFF94A3B8).copy(alpha = 0.25f),
                                    startAngle = 0f,
                                    sweepAngle = 360f,
                                    useCenter = false,
                                    style = Stroke(width = strokeW)
                                )
                            } else {
                                var start = -90f
                                listOf(
                                    sixTotalFuel to fuelColor,
                                    sixTotalMaint to maintColor,
                                    sixTotalRepairs to repairColor
                                ).forEach { (amt, col) ->
                                    if (amt > 0) {
                                        val sweep = (amt.toFloat() / sixGrandTotal.toFloat()) * 360f
                                        drawArc(
                                            color = col,
                                            startAngle = start,
                                            sweepAngle = sweep,
                                            useCenter = false,
                                            style = Stroke(width = strokeW, cap = StrokeCap.Butt)
                                        )
                                        start += sweep
                                    }
                                }
                            }
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("6 أشهر", fontSize = 10.sp, color = TextSecondary)
                            Text(
                                UnitConverter.formatMoney(sixGrandTotal),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                        }
                    }

                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("نسب التوزيع (6 أشهر)", fontWeight = FontWeight.Bold, color = TextPrimary, fontSize = 13.sp)
                        listOf(
                            Triple("الوقود", sixTotalFuel, fuelColor),
                            Triple("الصيانة", sixTotalMaint, maintColor),
                            Triple("الإصلاحات", sixTotalRepairs, repairColor)
                        ).forEach { (label, amt, col) ->
                            val pct = if (sixGrandTotal > 0L) ((amt * 100.0) / sixGrandTotal).roundToInt() else 0
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Box(modifier = Modifier.size(9.dp).clip(CircleShape).background(col))
                                    Text(label, fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.Bold)
                                }
                                Text("${UnitConverter.formatMoney(amt)} ($pct%)", fontSize = 11.sp, color = TextSecondary, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        items(
            listOf(
                "إجمالي تكلفة التشغيل" to total,
                "الوقود" to fuel,
                "الصيانة" to maint,
                "الإصلاحات" to repairs,
                "قطع الغيار المنفصلة" to parts,
                "المصروفات الإضافية" to additional
            )
        ) { (label, valPiastres) ->
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Row(modifier = Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(label, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                    Text(UnitConverter.formatMoney(valPiastres), color = CrimsonAccent, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun BackupScreen(
    onExport: (Uri) -> Unit,
    onImportPreview: (Uri, (Boolean, String, String, Boolean) -> Unit) -> Unit,
    onConfirmRestore: (String, Boolean) -> Unit
) {
    var previewMessage by remember { mutableStateOf<String?>(null) }
    var pendingJson by remember { mutableStateOf<String?>(null) }
    var pendingIsDup by remember { mutableStateOf(false) }
    var allowDup by remember { mutableStateOf(false) }

    val createDoc = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        uri?.let(onExport)
    }
    val openDoc = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let {
            onImportPreview(it) { valid, raw, msg, isDup ->
                previewMessage = msg
                pendingJson = if (valid) raw else null
                pendingIsDup = isDup
                allowDup = false
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("النسخ الاحتياطي يدوي فقط لحماية بياناتك عبر Storage Access Framework.", color = TextSecondary)
        Button(
            onClick = { createDoc.launch("MyCar-Backup-${LocalDate.now()}.json") },
            colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
            modifier = Modifier.fillMaxWidth().height(50.dp)
        ) { Text("إنشاء نسخة احتياطية") }
        OutlinedButton(
            onClick = { openDoc.launch(arrayOf("application/json")) },
            modifier = Modifier.fillMaxWidth().height(50.dp)
        ) { Text("فحص واستعادة نسخة احتياطية", color = TextPrimary) }
        previewMessage?.let { Text(it, color = AlertYellow) }
        if (pendingJson != null) {
            if (pendingIsDup) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = allowDup, onCheckedChange = { allowDup = it })
                    Text("نسخة مستعادة سابقًا — السماح بإعادة الاستعادة", color = AlertYellow, fontSize = 12.sp)
                }
            }
            Button(
                onClick = {
                    pendingJson?.let { onConfirmRestore(it, allowDup) }
                    pendingJson = null
                },
                enabled = !pendingIsDup || allowDup,
                colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                modifier = Modifier.fillMaxWidth()
            ) { Text("تأكيد واستبدال البيانات الحالية") }
        }
    }
}

@Composable
fun AboutScreen() {
    Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, SubtleBorder)) {
            Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("عربيتي | MY CAR", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text("الإصدار 2.0.0", fontSize = 13.sp, color = TextSecondary)
                HorizontalDivider(color = SubtleBorder)
                Text("Programmed and Developed by Mr. Ahmed Ali Hassab Allah", color = TextPrimary, textAlign = TextAlign.Center, fontWeight = FontWeight.Medium)
                Text("Phone: 01002277232", color = CrimsonAccent, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun FaultsAndTasksScreen(
    bundle: VehicleBundle?,
    onAddTask: (String, String, Boolean) -> Unit,
    onCompleteTask: (PendingTaskEntity, String, Double, Double, String) -> Unit,
    onAddFault: (String, String, String, Double, Double, String) -> Unit
) {
    if (bundle == null) return
    var issue by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var urgent by remember { mutableStateOf(false) }
    var completingTask by remember { mutableStateOf<PendingTaskEntity?>(null) }
    var repairText by remember { mutableStateOf("") }
    var partsCost by remember { mutableStateOf("") }
    var laborCost by remember { mutableStateOf("") }
    var mech by remember { mutableStateOf("") }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("إضافة عمل مطلوب مستقبلي", fontWeight = FontWeight.Bold, color = TextPrimary)
                    OutlinedTextField(value = issue, onValueChange = { issue = it }, label = { Text("الجزء / المشكلة") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("الوصف (اختياري)") }, modifier = Modifier.fillMaxWidth())
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = urgent, onCheckedChange = { urgent = it })
                        Text("أولوية عاجلة (تنبيه أحمر)", color = TextPrimary)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                if (issue.isNotBlank()) {
                                    onAddTask(issue, desc, urgent)
                                    issue = ""; desc = ""; urgent = false
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                            modifier = Modifier.weight(1f)
                        ) { Text("حفظ كعمل مطلوب") }
                        OutlinedButton(
                            onClick = {
                                if (issue.isNotBlank()) {
                                    onAddFault(issue, desc, "UNREPAIRED", 0.0, 0.0, "")
                                    issue = ""; desc = ""
                                }
                            },
                            modifier = Modifier.weight(1f)
                        ) { Text("تسجيل كعطل", color = TextPrimary) }
                    }
                }
            }
        }
        items(bundle.pendingTasks.filter { it.status == "PENDING" }) { task ->
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, if (task.priority == "URGENT") AlertRed else AlertYellow)) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(task.partOrIssue, color = TextPrimary, fontWeight = FontWeight.Bold)
                    task.description?.let { Text(it, color = TextSecondary, fontSize = 12.sp) }
                    Button(
                        onClick = { completingTask = task; repairText = "تم الإصلاح"; partsCost = "0"; laborCost = "0"; mech = "" },
                        colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent)
                    ) { Text("تم الإصلاح") }
                }
            }
        }
        items(bundle.faultRecords) { fault ->
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("${fault.title} (${fault.status})", color = TextPrimary, fontWeight = FontWeight.Bold)
                    Text("${fault.appearedAt} · ${UnitConverter.formatMoney(fault.totalCostPiastres)}", color = TextSecondary, fontSize = 12.sp)
                }
            }
        }
    }

    completingTask?.let { task ->
        AlertDialog(
            onDismissRequest = { completingTask = null },
            containerColor = GraphiteSurface,
            title = { Text("تأكيد إصلاح: ${task.partOrIssue}", color = TextPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = repairText, onValueChange = { repairText = it }, label = { Text("ما تم إصلاحه") })
                    OutlinedTextField(value = partsCost, onValueChange = { partsCost = it }, label = { Text("تكلفة القطع") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                    OutlinedTextField(value = laborCost, onValueChange = { laborCost = it }, label = { Text("المصنعية") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                    OutlinedTextField(value = mech, onValueChange = { mech = it }, label = { Text("الميكانيكي (اختياري)") })
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onCompleteTask(task, repairText, partsCost.toDoubleOrNull() ?: 0.0, laborCost.toDoubleOrNull() ?: 0.0, mech)
                        completingTask = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent)
                ) { Text("تأكيد الإصلاح") }
            },
            dismissButton = {
                TextButton(onClick = { completingTask = null }) { Text("إلغاء", color = TextSecondary) }
            }
        )
    }
}

@Composable
fun SparePartsScreen(
    bundle: VehicleBundle?,
    onAddPart: (String, String, Double, String, Boolean) -> Unit
) {
    if (bundle == null) return
    var name by remember { mutableStateOf("") }
    var brand by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var vendor by remember { mutableStateOf("") }
    var includedInParent by remember { mutableStateOf(false) }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("إضافة قطعة غيار", fontWeight = FontWeight.Bold, color = TextPrimary)
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("اسم القطعة") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = brand, onValueChange = { brand = it }, label = { Text("الماركة") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = price, onValueChange = { price = it }, label = { Text("السعر") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = vendor, onValueChange = { vendor = it }, label = { Text("المتجر / المركز (اختياري)") }, modifier = Modifier.fillMaxWidth())
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = includedInParent, onCheckedChange = { includedInParent = it })
                        Text("التكلفة محسوبة ضمن صيانة/عطل آخر (عدم تكرار المصروف)", color = TextSecondary, fontSize = 12.sp)
                    }
                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                onAddPart(name, brand.ifBlank { "أصلي" }, price.toDoubleOrNull() ?: 0.0, vendor, includedInParent)
                                name = ""; brand = ""; price = ""; vendor = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("حفظ قطعة الغيار") }
                }
            }
        }
        items(bundle.spareParts) { part ->
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("${part.partName} (${part.brand})", color = TextPrimary, fontWeight = FontWeight.Bold)
                        Text(part.installDate, color = TextSecondary, fontSize = 11.sp)
                    }
                    Text(UnitConverter.formatMoney(part.pricePiastres), color = CrimsonAccent, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun TiresScreen(
    bundle: VehicleBundle?,
    onUpdateTire: (TireRecordEntity) -> Unit,
    onUpdateEmergency: (EmergencyEquipmentEntity) -> Unit
) {
    if (bundle == null) return
    val eq = bundle.emergencyEquipment
    var editingTire by remember { mutableStateOf<TireRecordEntity?>(null) }
    var dotWeek by remember { mutableStateOf("") }
    var dotYear by remember { mutableStateOf("") }
    var brand by remember { mutableStateOf("") }
    var size by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(bundle.vehicle.id) {
        listState.scrollToItem(0)
    }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        if (eq != null) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("تجهيزات الطوارئ", fontWeight = FontWeight.Bold, color = TextPrimary)
                        listOf(
                            Triple("الكوريك (تنبيه أحمر عند النقص)", eq.hasJack) { v: Boolean -> onUpdateEmergency(eq.copy(hasJack = v)) },
                            Triple("مفتاح العجل (تنبيه أحمر عند النقص)", eq.hasLugWrench) { v: Boolean -> onUpdateEmergency(eq.copy(hasLugWrench = v)) },
                            Triple("منفاخ الإطارات (نصيحة باقتنائه للطوارئ)", eq.hasAirPump) { v: Boolean -> onUpdateEmergency(eq.copy(hasAirPump = v)) }
                        ).forEach { (label, valState, onSelectState) ->
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(label, color = TextPrimary, fontSize = 13.sp)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    FilterChip(selected = valState == true, onClick = { onSelectState(true) }, label = { Text("متوفر") })
                                    FilterChip(selected = valState == false, onClick = { onSelectState(false) }, label = { Text("غير متوفر") })
                                }
                            }
                        }
                        if (eq.hasJack == false || eq.hasLugWrench == false) {
                            Text(
                                "تنبيه هام: لابد من توافرهما لسلامتك أثناء السفر",
                                color = AlertRed,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }
        }
        items(bundle.tireRecords) { tire ->
            val configured = tire.isConfigured && tire.dotWeek != null && tire.dotYear != null
            Card(
                modifier = Modifier.fillMaxWidth().clickable {
                    editingTire = tire
                    dotWeek = tire.dotWeek?.toString() ?: ""
                    dotYear = tire.dotYear?.toString() ?: ""
                    brand = tire.brand
                    size = tire.size
                },
                colors = CardDefaults.cardColors(containerColor = GraphiteSurface)
            ) {
                Row(modifier = Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text(tire.positionLabel, color = TextPrimary, fontWeight = FontWeight.Bold)
                        Text(
                            if (configured) "${tire.brand.ifBlank { "—" }} · ${tire.size.ifBlank { "—" }}" else "لم تُدخل بياناته بعد",
                            color = TextSecondary,
                            fontSize = 12.sp
                        )
                    }
                    Text(
                        if (configured) "DOT ${"%02d".format(tire.dotWeek)}/${tire.dotYear}" else "إدخال DOT",
                        color = if (configured) CrimsonAccent else AlertYellow,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }

    editingTire?.let { tire ->
        AlertDialog(
            onDismissRequest = { editingTire = null },
            containerColor = GraphiteSurface,
            title = { Text("تعديل إطار: ${tire.positionLabel}", color = TextPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = dotWeek, onValueChange = { dotWeek = it }, label = { Text("أسبوع الصنع (DOT Week)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                    OutlinedTextField(value = dotYear, onValueChange = { dotYear = it }, label = { Text("سنة الصنع (DOT Year)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                    OutlinedTextField(value = brand, onValueChange = { brand = it }, label = { Text("الماركة") })
                    OutlinedTextField(value = size, onValueChange = { size = it }, label = { Text("المقاس") })
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val w = dotWeek.toIntOrNull()?.coerceIn(1, 53)
                        val y = dotYear.toIntOrNull()
                        if (w != null && y != null && brand.isNotBlank() && size.isNotBlank()) {
                            onUpdateTire(
                                tire.copy(
                                    dotWeek = w,
                                    dotYear = y,
                                    isConfigured = true,
                                    brand = brand.trim(),
                                    size = size.trim()
                                )
                            )
                            editingTire = null
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent)
                ) { Text("حفظ") }
            },
            dismissButton = {
                TextButton(onClick = { editingTire = null }) { Text("إلغاء", color = TextSecondary) }
            }
        )
    }
}

@Composable
fun DocumentsScreen(
    bundle: VehicleBundle?,
    onRenewDoc: (DocumentRecordEntity, String) -> Unit,
    onTogglePoa: (Boolean) -> Unit
) {
    if (bundle == null) return
    val v = bundle.vehicle
    var renewingDoc by remember { mutableStateOf<DocumentRecordEntity?>(null) }
    var newDate by remember { mutableStateOf("") }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (v.ownershipType == "POWER_OF_ATTORNEY") {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface), border = BorderStroke(1.dp, if (v.poaRegisteredContractDone) AlertGreen else AlertRed)) {
                    Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = v.poaRegisteredContractDone, onCheckedChange = onTogglePoa)
                        Text("ملكية بتوكيل — تم عمل عقد مسجل؟", color = TextPrimary, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        items(bundle.documentRecords) { doc ->
            val label = when (doc.docType) {
                "VEHICLE_LICENSE" -> "ترخيص السيارة"
                "TECHNICAL_INSPECTION" -> "الفحص الفني"
                else -> "رخصة القيادة"
            }
            Card(colors = CardDefaults.cardColors(containerColor = GraphiteSurface)) {
                Row(modifier = Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text(label, color = TextPrimary, fontWeight = FontWeight.Bold)
                        Text("الانتهاء: ${doc.expiryDate}", color = TextSecondary, fontSize = 12.sp)
                    }
                    Button(
                        onClick = { renewingDoc = doc; newDate = LocalDate.now().plusYears(1).toString() },
                        colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent)
                    ) { Text("تجديد") }
                }
            }
        }
    }

    renewingDoc?.let { doc ->
        AlertDialog(
            onDismissRequest = { renewingDoc = null },
            containerColor = GraphiteSurface,
            title = { Text("تجديد الوثيقة", color = TextPrimary) },
            text = {
                OutlinedTextField(value = newDate, onValueChange = { newDate = it }, label = { Text("تاريخ الانتهاء الجديد (YYYY-MM-DD)") })
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newDate.isNotBlank()) onRenewDoc(doc, newDate)
                        renewingDoc = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonAccent)
                ) { Text("حفظ التجديد") }
            },
            dismissButton = {
                TextButton(onClick = { renewingDoc = null }) { Text("إلغاء", color = TextSecondary) }
            }
        )
    }
}

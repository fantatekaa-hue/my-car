package com.ahmedali.mycar.data

import android.content.Context
import com.ahmedali.mycar.data.backup.BackupDataContainer
import com.ahmedali.mycar.data.backup.BackupManager
import com.ahmedali.mycar.data.backup.BackupPreviewResult
import com.ahmedali.mycar.data.db.*
import com.ahmedali.mycar.domain.AlertEngine
import com.ahmedali.mycar.domain.EgyptianPlateValidator
import com.ahmedali.mycar.worker.NotificationHelper
import kotlinx.coroutines.flow.Flow
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

data class VehicleBundle(
    val vehicle: VehicleEntity,
    val odometerEntries: List<OdometerEntryEntity>,
    val fuelEntries: List<FuelEntryEntity>,
    val maintenanceTypes: List<MaintenanceTypeEntity>,
    val maintenanceRecords: List<MaintenanceRecordEntity>,
    val faultRecords: List<FaultRecordEntity>,
    val pendingTasks: List<PendingTaskEntity>,
    val expenses: List<ExpenseEntity>,
    val spareParts: List<SparePartEntity>,
    val tireRecords: List<TireRecordEntity>,
    val documentRecords: List<DocumentRecordEntity>,
    val reminders: List<ReminderEntity>,
    val emergencyEquipment: EmergencyEquipmentEntity?
)

class MyCarRepository(private val context: Context, private val db: MyCarDatabase) {
    private val dao = db.dao()

    fun observeVehicles(): Flow<List<VehicleEntity>> = dao.observeAllVehicles()

    suspend fun getSettings(): AppSettingsEntity {
        return dao.getSettings() ?: AppSettingsEntity(updatedAt = Instant.now().toString()).also {
            dao.upsertSettings(it)
        }
    }

    suspend fun setActiveVehicle(vehicleId: String?) {
        val current = getSettings()
        dao.upsertSettings(current.copy(activeVehicleId = vehicleId, updatedAt = Instant.now().toString()))
    }

    suspend fun updateCurrencySettings(code: String, symbol: String) {
        val current = getSettings()
        dao.upsertSettings(
            current.copy(
                currencyCode = code.trim().ifBlank { "EGP" },
                currencySymbol = symbol.trim().ifBlank { "ج.م" },
                updatedAt = Instant.now().toString()
            )
        )
    }

    suspend fun getCustomCatalog(): List<CustomCatalogEntity> = dao.getCustomCatalog()

    suspend fun saveCustomCatalogEntry(brand: String, model: String, year: Int) {
        dao.insertCustomCatalog(
            CustomCatalogEntity(
                id = "cat_${UUID.randomUUID()}",
                brand = brand.trim(),
                model = model.trim(),
                year = year,
                createdAt = Instant.now().toString()
            )
        )
    }

    suspend fun getVehicleBundle(vehicleId: String): VehicleBundle? {
        val vehicle = dao.getVehicleById(vehicleId) ?: return null
        return VehicleBundle(
            vehicle = vehicle,
            odometerEntries = dao.getOdometerEntries(vehicleId),
            fuelEntries = dao.getFuelEntries(vehicleId),
            maintenanceTypes = dao.getMaintenanceTypes(vehicleId),
            maintenanceRecords = dao.getMaintenanceRecords(vehicleId),
            faultRecords = dao.getFaultRecords(vehicleId),
            pendingTasks = dao.getPendingTasks(vehicleId),
            expenses = dao.getExpenses(vehicleId),
            spareParts = dao.getSpareParts(vehicleId),
            tireRecords = dao.getTireRecords(vehicleId),
            documentRecords = dao.getDocumentRecords(vehicleId),
            reminders = dao.getReminders(vehicleId),
            emergencyEquipment = dao.getEmergencyEquipment(vehicleId)
        )
    }

    suspend fun createVehicle(
        brand: String,
        model: String,
        year: Int,
        plateRaw: String,
        odometerUnit: String,
        initialOdometerKm: Double?,
        ownershipType: String,
        poaRegisteredContractDone: Boolean,
        vehicleLicenseExpiry: String,
        technicalInspectionDate: String,
        driverLicenseExpiry: String,
        hasJack: Boolean? = null,
        hasLugWrench: Boolean? = null,
        hasAirPump: Boolean? = null,
        tireBrand: String = "",
        tireSize: String = "",
        tireDotWeek: Int? = null,
        tireDotYear: Int? = null
    ): VehicleEntity {
        val plate = EgyptianPlateValidator.validate(plateRaw)
        require(plate.valid) { plate.error ?: "رقم اللوحة غير صالح." }

        val hasOdo = initialOdometerKm != null
        val startingOdoKm = initialOdometerKm ?: 0.0
        val now = Instant.now().toString()
        val id = "veh_${UUID.randomUUID()}"
        val vehicle = VehicleEntity(
            id = id,
            brand = brand.trim(),
            model = model.trim(),
            year = year,
            plateRaw = plateRaw.trim(),
            plateNormalized = plate.normalized,
            odometerUnit = odometerUnit,
            currentOdometerKm = startingOdoKm,
            hasOdometerReading = hasOdo,
            ownershipType = ownershipType,
            poaRegisteredContractDone = if (ownershipType == "REGISTERED_CONTRACT") true else poaRegisteredContractDone,
            poaStatusUpdatedAt = now,
            createdAt = now,
            updatedAt = now
        )

        val initialOdo = if (hasOdo) {
            OdometerEntryEntity(
                id = "odo_${UUID.randomUUID()}",
                vehicleId = id,
                readingKm = startingOdoKm,
                recordedAt = now.take(16),
                entryType = "INITIAL",
                reason = "قراءة البداية",
                createdAt = now
            )
        } else null

        val maintCodes = listOf(
            "ENGINE_OIL" to "زيت المحرك",
            "OIL_FILTER" to "فلتر الزيت",
            "AIR_FILTER" to "فلتر الهواء",
            "AC_FILTER" to "فلتر التكييف",
            "BRAKE_PADS" to "تيل الفرامل",
            "SPARK_PLUGS" to "البوجيهات",
            "BATTERY" to "البطارية",
            "BELTS" to "السيور",
            "SUSPENSION" to "العفشة والمساعدين",
            "TRANSMISSION_OIL" to "زيت الفتيس",
            "COOLANT" to "سائل التبريد",
            "AC_FREON" to "فريون التكييف"
        )
        val types = maintCodes.map { (code, name) ->
            MaintenanceTypeEntity("mt_${id}_$code", id, code, name, null, false, now)
        }

        val docs = listOf(
            DocumentRecordEntity("doc_${id}_VEHICLE_LICENSE", id, "VEHICLE_LICENSE", vehicleLicenseExpiry, "[]", now),
            DocumentRecordEntity("doc_${id}_TECHNICAL_INSPECTION", id, "TECHNICAL_INSPECTION", technicalInspectionDate, "[]", now),
            DocumentRecordEntity("doc_${id}_DRIVER_LICENSE", id, "DRIVER_LICENSE", driverLicenseExpiry, "[]", now)
        )

        val tiresConfigured = tireBrand.isNotBlank() && tireSize.isNotBlank() && tireDotWeek != null && tireDotYear != null
        val tirePos = listOf("FL" to "أمامي يسار", "FR" to "أمامي يمين", "RL" to "خلفي يسار", "RR" to "خلفي يمين", "SPARE" to "الاستبن")
        val tires = tirePos.map { (pos, label) ->
            TireRecordEntity(
                id = "tire_${id}_$pos",
                vehicleId = id,
                position = pos,
                positionLabel = label,
                dotWeek = if (tiresConfigured) tireDotWeek else null,
                dotYear = if (tiresConfigured) tireDotYear else null,
                isConfigured = tiresConfigured,
                installDate = LocalDate.now().toString(),
                installOdometerKm = startingOdoKm,
                brand = if (tiresConfigured) tireBrand.trim() else "",
                size = if (tiresConfigured) tireSize.trim() else "",
                conditionNotes = "",
                treadStatus = "GOOD",
                updatedAt = now
            )
        }

        val emergency = EmergencyEquipmentEntity("emerg_$id", id, hasJack, hasLugWrench, hasAirPump, now)

        dao.insertVehicleWithDefaults(vehicle, initialOdo, types, docs, tires, emergency)

        val settings = getSettings()
        if (settings.activeVehicleId == null) {
            setActiveVehicle(id)
        }
        recomputeAlerts(id)
        return vehicle
    }

    suspend fun updateVehicle(updated: VehicleEntity) {
        val plate = EgyptianPlateValidator.validate(updated.plateRaw)
        require(plate.valid) { plate.error ?: "رقم اللوحة غير صالح." }
        val now = Instant.now().toString()
        val finalVehicle = updated.copy(
            brand = updated.brand.trim(),
            model = updated.model.trim(),
            plateRaw = updated.plateRaw.trim(),
            plateNormalized = plate.normalized,
            poaRegisteredContractDone = if (updated.ownershipType == "REGISTERED_CONTRACT") true else updated.poaRegisteredContractDone,
            updatedAt = now
        )
        dao.upsertVehicle(finalVehicle)
        recomputeAlerts(finalVehicle.id)
    }

    suspend fun archiveVehicle(vehicleId: String, archived: Boolean) {
        val vehicle = dao.getVehicleById(vehicleId) ?: return
        val now = Instant.now().toString()
        dao.upsertVehicle(vehicle.copy(isArchived = archived, updatedAt = now))
        val settings = getSettings()
        if (archived && settings.activeVehicleId == vehicleId) {
            val nextActive = dao.getAllVehicles().firstOrNull { !it.isArchived && it.id != vehicleId }?.id
            setActiveVehicle(nextActive)
        } else if (!archived && settings.activeVehicleId == null) {
            setActiveVehicle(vehicleId)
        }
    }

    suspend fun deleteVehiclePermanently(vehicleId: String) {
        val settings = getSettings()
        dao.deleteVehicleById(vehicleId)
        if (settings.activeVehicleId == vehicleId) {
            val nextActive = dao.getAllVehicles().firstOrNull { !it.isArchived }?.id
            setActiveVehicle(nextActive)
        }
    }

    suspend fun updateOdometerNormal(vehicleId: String, newReadingKm: Double) {
        val vehicle = dao.getVehicleById(vehicleId) ?: error("السيارة غير موجودة.")
        val isFirstReading = !vehicle.hasOdometerReading
        if (!isFirstReading) {
            require(newReadingKm >= vehicle.currentOdometerKm) {
                "القراءة الجديدة أقل من آخر قراءة معتمدة. استخدم «تصحيح العداد» مع التأكيد."
            }
        }
        val now = Instant.now().toString()
        dao.insertOdometerEntry(
            OdometerEntryEntity(
                "odo_${UUID.randomUUID()}",
                vehicleId,
                newReadingKm,
                now.take(16),
                if (isFirstReading) "INITIAL" else "NORMAL",
                if (isFirstReading) null else vehicle.currentOdometerKm,
                if (isFirstReading) "قراءة البداية" else null,
                now
            )
        )
        dao.upsertVehicle(vehicle.copy(currentOdometerKm = newReadingKm, hasOdometerReading = true, updatedAt = now))
        recomputeAlerts(vehicleId)
    }

    suspend fun correctOdometer(vehicleId: String, correctedKm: Double, reason: String) {
        val vehicle = dao.getVehicleById(vehicleId) ?: error("السيارة غير موجودة.")
        val now = Instant.now().toString()
        dao.insertOdometerEntry(
            OdometerEntryEntity("odo_corr_${UUID.randomUUID()}", vehicleId, correctedKm, now.take(16), "CORRECTION", vehicle.currentOdometerKm, reason, now)
        )
        dao.upsertVehicle(vehicle.copy(currentOdometerKm = correctedKm, hasOdometerReading = true, updatedAt = now))
        // Original expenses are preserved untouched
        recomputeAlerts(vehicleId)
    }

    suspend fun saveFuelEntry(
        vehicleId: String,
        dateTime: String,
        odometerKm: Double,
        fuelType: String,
        liters: Double,
        totalCostPiastres: Long,
        fillType: String
    ) {
        val vehicle = dao.getVehicleById(vehicleId) ?: error("السيارة غير موجودة.")
        require(liters > 0.0) { "اللترات يجب أن تكون أكبر من صفر." }
        val now = Instant.now().toString()
        val id = "fuel_${UUID.randomUUID()}"
        val pricePerLiter = kotlin.math.round(totalCostPiastres / liters).toLong()
        val fuel = FuelEntryEntity(id, vehicleId, dateTime, odometerKm, fuelType, liters, totalCostPiastres, pricePerLiter, fillType, null, now)
        val expense = ExpenseEntity("exp_${vehicleId}_FUEL_$id", vehicleId, "FUEL", id, "وقود ($fuelType)", dateTime.take(10), totalCostPiastres, odometerKm, "$liters لتر", true, now)

        val isFirst = !vehicle.hasOdometerReading
        val shouldUpdateVeh = odometerKm > vehicle.currentOdometerKm || isFirst
        val updatedVehicle = if (shouldUpdateVeh) vehicle.copy(currentOdometerKm = odometerKm, hasOdometerReading = true, updatedAt = now) else null
        val odoEntry = if (updatedVehicle != null) OdometerEntryEntity("odo_${UUID.randomUUID()}", vehicleId, odometerKm, dateTime, if (isFirst) "INITIAL" else "NORMAL", if (isFirst) null else vehicle.currentOdometerKm, "مع تعبئة وقود", now) else null

        dao.saveFuelWithExpense(fuel, expense, updatedVehicle, odoEntry)
        recomputeAlerts(vehicleId)
    }

    suspend fun saveMaintenanceRecord(
        record: MaintenanceRecordEntity,
        includeOilFilter: Boolean = false,
        oilFilterCostPiastres: Long = 0L
    ) {
        val vehicle = dao.getVehicleById(record.vehicleId) ?: error("السيارة غير موجودة.")
        val now = Instant.now().toString()
        val expense = if (record.costPiastres > 0) {
            ExpenseEntity("exp_${record.vehicleId}_MAINTENANCE_${record.id}", record.vehicleId, "MAINTENANCE", record.id, "صيانة: ${record.customName ?: record.typeCode}", record.date, record.costPiastres, record.odometerKm, record.mechanicOrCenter, true, now)
        } else null

        var filterRec: MaintenanceRecordEntity? = null
        var filterExp: ExpenseEntity? = null
        if (record.typeCode == "ENGINE_OIL" && includeOilFilter) {
            filterRec = MaintenanceRecordEntity(
                id = "maint_filter_${record.id}",
                vehicleId = record.vehicleId,
                maintenanceTypeId = "mt_${record.vehicleId}_OIL_FILTER",
                typeCode = "OIL_FILTER",
                date = record.date,
                odometerKm = record.odometerKm,
                costPiastres = oilFilterCostPiastres,
                intervalKm = record.intervalKm,
                nextDueKm = record.nextDueKm,
                nextDueDate = record.nextDueDate,
                scheduleSource = record.scheduleSource,
                linkedOilRecordId = record.id,
                createdAt = now
            )
            if (oilFilterCostPiastres > 0) {
                filterExp = ExpenseEntity("exp_${record.vehicleId}_OIL_FILTER_${record.id}", record.vehicleId, "OIL_FILTER", record.id, "صيانة: فلتر الزيت", record.date, oilFilterCostPiastres, record.odometerKm, null, true, now)
            }
        }

        val updatedVeh = if (record.odometerKm > vehicle.currentOdometerKm || !vehicle.hasOdometerReading) {
            vehicle.copy(currentOdometerKm = record.odometerKm, hasOdometerReading = true, updatedAt = now)
        } else null
        dao.saveMaintenanceWithOptionalFilter(record, expense, filterRec, filterExp, null, null, updatedVeh)
        recomputeAlerts(record.vehicleId)
    }

    suspend fun saveAdditionalExpense(vehicleId: String, category: String, date: String, amountPiastres: Long, odometerKm: Double?, notes: String?) {
        val id = "exp_add_${UUID.randomUUID()}"
        dao.upsertExpense(ExpenseEntity(id, vehicleId, "ADDITIONAL", id, category, date, amountPiastres, odometerKm, notes, false, Instant.now().toString()))
    }

    suspend fun addCustomMaintenanceType(vehicleId: String, name: String, description: String?): MaintenanceTypeEntity {
        val now = Instant.now().toString()
        val entry = MaintenanceTypeEntity(
            id = "mt_${vehicleId}_custom_${UUID.randomUUID()}",
            vehicleId = vehicleId,
            code = "CUSTOM",
            name = name.trim(),
            description = description?.trim()?.ifBlank { null },
            isCustom = true,
            createdAt = now
        )
        dao.upsertMaintenanceType(entry)
        return entry
    }

    suspend fun addPendingTask(
        vehicleId: String,
        partOrIssue: String,
        description: String?,
        odometerKm: Double,
        priority: String
    ) {
        val now = Instant.now().toString()
        dao.upsertPendingTask(
            PendingTaskEntity(
                id = "task_${UUID.randomUUID()}",
                vehicleId = vehicleId,
                partOrIssue = partOrIssue.trim(),
                description = description?.trim()?.ifBlank { null },
                odometerKm = odometerKm,
                priority = priority,
                status = "PENDING",
                createdAt = now
            )
        )
        recomputeAlerts(vehicleId)
    }

    suspend fun completePendingTask(
        task: PendingTaskEntity,
        repairPerformed: String,
        partsCostPiastres: Long,
        laborCostPiastres: Long,
        mechanicOrCenter: String?,
        repairedAt: String,
        odometerKm: Double
    ) {
        val now = Instant.now().toString()
        val total = partsCostPiastres + laborCostPiastres
        val faultId = "fault_${UUID.randomUUID()}"
        val fault = FaultRecordEntity(
            id = faultId,
            vehicleId = task.vehicleId,
            title = task.partOrIssue,
            appearedAt = task.createdAt.take(10),
            odometerKm = odometerKm,
            description = task.description ?: task.partOrIssue,
            diagnosis = task.description,
            repairPerformed = repairPerformed,
            partsCostPiastres = partsCostPiastres,
            laborCostPiastres = laborCostPiastres,
            totalCostPiastres = total,
            mechanicOrCenter = mechanicOrCenter?.ifBlank { null },
            status = "REPAIRED",
            repairedAt = repairedAt,
            createdAt = now
        )
        dao.upsertFaultRecord(fault)
        if (total > 0L) {
            dao.upsertExpense(
                ExpenseEntity(
                    id = "exp_${task.vehicleId}_FAULT_REPAIR_$faultId",
                    vehicleId = task.vehicleId,
                    sourceType = "FAULT_REPAIR",
                    sourceId = faultId,
                    categoryLabel = "إصلاح عطل: ${task.partOrIssue}",
                    date = repairedAt,
                    amountPiastres = total,
                    odometerKm = odometerKm,
                    notes = mechanicOrCenter?.ifBlank { null },
                    isAutomatic = true,
                    createdAt = now
                )
            )
        }
        dao.upsertPendingTask(
            task.copy(
                status = "COMPLETED",
                completedAt = repairedAt,
                convertedFaultId = faultId
            )
        )
        recomputeAlerts(task.vehicleId)
    }

    suspend fun saveFaultRecord(fault: FaultRecordEntity) {
        val now = Instant.now().toString()
        dao.upsertFaultRecord(fault)
        if (fault.status == "REPAIRED" && fault.totalCostPiastres > 0L) {
            dao.upsertExpense(
                ExpenseEntity(
                    id = "exp_${fault.vehicleId}_FAULT_REPAIR_${fault.id}",
                    vehicleId = fault.vehicleId,
                    sourceType = "FAULT_REPAIR",
                    sourceId = fault.id,
                    categoryLabel = "إصلاح عطل: ${fault.title}",
                    date = fault.repairedAt ?: fault.appearedAt,
                    amountPiastres = fault.totalCostPiastres,
                    odometerKm = fault.odometerKm,
                    notes = fault.mechanicOrCenter,
                    isAutomatic = true,
                    createdAt = now
                )
            )
        }
        recomputeAlerts(fault.vehicleId)
    }

    suspend fun saveSparePart(part: SparePartEntity) {
        val now = Instant.now().toString()
        dao.upsertSparePart(part)
        if (!part.includedInParentCost && part.pricePiastres > 0L) {
            dao.upsertExpense(
                ExpenseEntity(
                    id = "exp_${part.vehicleId}_SPARE_PART_${part.id}",
                    vehicleId = part.vehicleId,
                    sourceType = "SPARE_PART",
                    sourceId = part.id,
                    categoryLabel = "قطعة غيار: ${part.partName}",
                    date = part.purchaseDate,
                    amountPiastres = part.pricePiastres,
                    odometerKm = part.odometerKm,
                    notes = part.vendorOrCenter,
                    isAutomatic = true,
                    createdAt = now
                )
            )
        }
    }

    suspend fun saveTireRecord(tire: TireRecordEntity) {
        val configured = tire.dotWeek != null && tire.dotYear != null
        dao.upsertTireRecord(tire.copy(isConfigured = configured, updatedAt = Instant.now().toString()))
        recomputeAlerts(tire.vehicleId)
    }

    suspend fun saveEmergencyEquipment(equipment: EmergencyEquipmentEntity) {
        dao.upsertEmergencyEquipment(equipment.copy(updatedAt = Instant.now().toString()))
        recomputeAlerts(equipment.vehicleId)
    }

    suspend fun renewDocument(doc: DocumentRecordEntity, newExpiryDate: String) {
        val cleanNew = newExpiryDate.trim()
        val historyList = org.json.JSONArray(doc.previousHistoryJson.ifBlank { "[]" })
        if (doc.expiryDate.isNotBlank() && doc.expiryDate != cleanNew) {
            historyList.put(doc.expiryDate)
        }
        dao.upsertDocumentRecord(
            doc.copy(
                expiryDate = cleanNew,
                previousHistoryJson = historyList.toString(),
                updatedAt = Instant.now().toString()
            )
        )
        recomputeAlerts(doc.vehicleId)
    }

    suspend fun togglePoaRegistered(vehicleId: String, done: Boolean) {
        val vehicle = dao.getVehicleById(vehicleId) ?: return
        val now = Instant.now().toString()
        dao.upsertVehicle(
            vehicle.copy(
                poaRegisteredContractDone = done,
                poaStatusUpdatedAt = now,
                updatedAt = now
            )
        )
        recomputeAlerts(vehicleId)
    }

    suspend fun recomputeAlerts(vehicleId: String) {
        val vehicle = dao.getVehicleById(vehicleId) ?: return
        val evaluated = AlertEngine.evaluate(
            vehicle = vehicle,
            maintenanceRecords = dao.getMaintenanceRecords(vehicleId),
            pendingTasks = dao.getPendingTasks(vehicleId),
            tireRecords = dao.getTireRecords(vehicleId),
            documentRecords = dao.getDocumentRecords(vehicleId),
            emergencyEquipment = dao.getEmergencyEquipment(vehicleId)
        )
        val existing = dao.getReminders(vehicleId)
        val result = AlertEngine.reconcile(vehicleId, evaluated, existing, Instant.now().toString())
        dao.replaceRemindersForVehicle(vehicleId, result.updatedReminders)
        for (red in result.newlyTriggeredRedAlerts) {
            NotificationHelper.sendRedAlertNotification(context, red.id, "${vehicle.brand} ${vehicle.model}: ${red.title}", red.message)
        }
    }

    suspend fun exportBackupJson(): String {
        val container = BackupDataContainer(
            appSettings = getSettings(),
            customCatalog = dao.getCustomCatalog(),
            vehicles = dao.getAllVehicles(),
            odometerEntries = dao.exportOdometer(),
            fuelEntries = dao.exportFuel(),
            maintenanceTypes = dao.exportMaintTypes(),
            maintenanceRecords = dao.exportMaintRecords(),
            faultRecords = dao.exportFaults(),
            pendingTasks = dao.exportTasks(),
            expenses = dao.exportExpenses(),
            spareParts = dao.exportParts(),
            tireRecords = dao.exportTires(),
            documentRecords = dao.exportDocs(),
            reminders = dao.exportReminders(),
            emergencyEquipment = dao.exportEmergency()
        )
        val jsonStr = BackupManager.serializeBackup(container)
        dao.upsertBackupMetadata(BackupMetadataEntity(lastBackupAt = Instant.now().toString(), vehicleCount = container.vehicles.size))
        return jsonStr
    }

    suspend fun previewBackup(rawJson: String): BackupPreviewResult {
        return BackupManager.validateAndPreview(rawJson, dao.getBackupMetadata())
    }

    suspend fun restoreFromBackup(rawJson: String, allowDuplicate: Boolean): Boolean {
        val preview = previewBackup(rawJson)
        val payload = preview.payload ?: throw IllegalArgumentException(preview.error ?: "ملف غير صالح")
        if (!preview.valid) throw IllegalArgumentException(preview.error ?: "ملف غير صالح")
        if (preview.isDuplicateRestore && !allowDuplicate) {
            throw IllegalStateException("تمت استعادة هذه النسخة مسبقًا.")
        }
        val d = payload.data
        val existingMeta = dao.getBackupMetadata() ?: BackupMetadataEntity()
        dao.restoreBackupTransaction(
            settings = d.appSettings,
            customCatalog = d.customCatalog,
            vehicles = d.vehicles,
            odometerEntries = d.odometerEntries,
            fuelEntries = d.fuelEntries,
            maintenanceTypes = d.maintenanceTypes,
            maintenanceRecords = d.maintenanceRecords,
            faultRecords = d.faultRecords,
            pendingTasks = d.pendingTasks,
            expenses = d.expenses,
            spareParts = d.spareParts,
            tireRecords = d.tireRecords,
            documentRecords = d.documentRecords,
            reminders = d.reminders,
            emergencyEquipment = d.emergencyEquipment,
            backupMeta = existingMeta.copy(
                lastRestoredChecksum = payload.checksum,
                lastRestoredAt = Instant.now().toString()
            )
        )
        return true
    }
}

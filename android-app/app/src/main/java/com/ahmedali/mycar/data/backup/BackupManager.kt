package com.ahmedali.mycar.data.backup

import com.ahmedali.mycar.data.db.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.security.MessageDigest
import java.time.Instant

@Serializable
data class BackupDataContainer(
    val appSettings: AppSettingsEntity,
    val customCatalog: List<CustomCatalogEntity> = emptyList(),
    val vehicles: List<VehicleEntity>,
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
    val emergencyEquipment: List<EmergencyEquipmentEntity>
)

@Serializable
data class FullBackupPayload(
    val appName: String = "عربيتي | MY CAR",
    val schemaVersion: Int = 1,
    val exportedAt: String,
    val checksum: String,
    val data: BackupDataContainer
)

data class BackupPreviewResult(
    val valid: Boolean,
    val error: String? = null,
    val payload: FullBackupPayload? = null,
    val isDuplicateRestore: Boolean = false
)

object BackupManager {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = false
    }

    fun sha256Hex(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    fun serializeBackup(data: BackupDataContainer): String {
        val canonicalDataJson = json.encodeToString(data)
        val checksum = sha256Hex(canonicalDataJson)
        val payload = FullBackupPayload(
            appName = "عربيتي | MY CAR",
            schemaVersion = 1,
            exportedAt = Instant.now().toString(),
            checksum = checksum,
            data = data
        )
        return json.encodeToString(payload)
    }

    fun validateAndPreview(rawJson: String, meta: BackupMetadataEntity?): BackupPreviewResult {
        val parsed = try {
            json.decodeFromString<FullBackupPayload>(rawJson)
        } catch (_: Exception) {
            return BackupPreviewResult(false, error = "الملف تالف أو غير متوافق مع صيغة النسخة الاحتياطية.")
        }

        if (parsed.appName != "عربيتي | MY CAR") {
            return BackupPreviewResult(false, error = "هذا الملف لا يخص تطبيق عربيتي | MY CAR.")
        }
        if (parsed.schemaVersion < 1 || parsed.schemaVersion > 1) {
            return BackupPreviewResult(false, error = "إصدار النسخة (${parsed.schemaVersion}) غير متوافق.")
        }

        val recomputed = sha256Hex(json.encodeToString(parsed.data))
        if (parsed.checksum != recomputed) {
            return BackupPreviewResult(false, error = "فشل فحص سلامة الملف: النسخة تالفة أو معدّلة.")
        }

        val isDup = meta?.lastRestoredChecksum == parsed.checksum
        return BackupPreviewResult(
            valid = true,
            payload = parsed,
            isDuplicateRestore = isDup
        )
    }
}

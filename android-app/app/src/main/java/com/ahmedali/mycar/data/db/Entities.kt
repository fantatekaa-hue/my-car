package com.ahmedali.mycar.data.db

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "vehicles")
data class VehicleEntity(
    @PrimaryKey val id: String,
    val brand: String,
    val model: String,
    val year: Int,
    val plateRaw: String,
    val plateNormalized: String,
    val purchaseDate: String? = null,
    val odometerUnit: String = "KM", // "KM" | "MILE"
    val currentOdometerKm: Double,
    val hasOdometerReading: Boolean = true,
    val ownershipType: String = "REGISTERED_CONTRACT", // "REGISTERED_CONTRACT" | "POWER_OF_ATTORNEY"
    val poaRegisteredContractDone: Boolean = true,
    val poaStatusUpdatedAt: String? = null,
    val isArchived: Boolean = false,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
@Entity(
    tableName = "odometer_entries",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("vehicleId"), Index("recordedAt")]
)
data class OdometerEntryEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val readingKm: Double,
    val recordedAt: String,
    val entryType: String, // "INITIAL" | "NORMAL" | "CORRECTION"
    val previousReadingKm: Double? = null,
    val reason: String? = null,
    val createdAt: String
)

@Serializable
@Entity(
    tableName = "fuel_entries",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("vehicleId"), Index("odometerKm"), Index("dateTime")]
)
data class FuelEntryEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val dateTime: String,
    val odometerKm: Double,
    val fuelType: String,
    val liters: Double,
    val totalCostPiastres: Long,
    val pricePerLiterPiastres: Long,
    val fillType: String, // "FULL" | "PARTIAL"
    val notes: String? = null,
    val createdAt: String
)

@Serializable
@Entity(
    tableName = "maintenance_types",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("vehicleId")]
)
data class MaintenanceTypeEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val code: String,
    val name: String,
    val description: String? = null,
    val isCustom: Boolean = false,
    val createdAt: String
)

@Serializable
@Entity(
    tableName = "maintenance_records",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("vehicleId"), Index("maintenanceTypeId"), Index("date")]
)
data class MaintenanceRecordEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val maintenanceTypeId: String,
    val typeCode: String,
    val customName: String? = null,
    val date: String,
    val odometerKm: Double,
    val costPiastres: Long,
    val brandOrType: String? = null,
    val viscosity: String? = null,
    val quantity: String? = null,
    val intervalKm: Double? = null,
    val intervalMonths: Int? = null,
    val nextDueKm: Double? = null,
    val nextDueDate: String? = null,
    val scheduleSource: String = "MANUAL", // "OEM" | "MANUAL" | "INSPECTION_ONLY"
    val sourceLabel: String? = null,
    val oilFilterChanged: Boolean? = null,
    val oilFilterCostPiastres: Long? = null,
    val beltKind: String? = null,
    val conditionStatus: String? = null,
    val batteryCapacityAh: Int? = null,
    val warrantyMonths: Int? = null,
    val warrantyExpiryDate: String? = null,
    val suspensionPart: String? = null,
    val mechanicOrCenter: String? = null,
    val notes: String? = null,
    val linkedOilRecordId: String? = null,
    val createdAt: String
)

@Serializable
@Entity(
    tableName = "fault_records",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("vehicleId"), Index("appearedAt")]
)
data class FaultRecordEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val title: String,
    val appearedAt: String,
    val odometerKm: Double,
    val description: String,
    val diagnosis: String? = null,
    val repairPerformed: String? = null,
    val partsCostPiastres: Long = 0,
    val laborCostPiastres: Long = 0,
    val totalCostPiastres: Long = 0,
    val mechanicOrCenter: String? = null,
    val status: String, // "UNREPAIRED" | "DIAGNOSED_NOT_REPAIRED" | "REPAIRED"
    val repairedAt: String? = null,
    val createdAt: String
)

@Serializable
@Entity(
    tableName = "pending_tasks",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("vehicleId"), Index("status")]
)
data class PendingTaskEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val partOrIssue: String,
    val description: String? = null,
    val odometerKm: Double,
    val priority: String = "NORMAL", // "URGENT" | "NORMAL"
    val status: String = "PENDING", // "PENDING" | "COMPLETED"
    val createdAt: String,
    val completedAt: String? = null,
    val convertedFaultId: String? = null
)

@Serializable
@Entity(
    tableName = "expenses",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [
        Index("vehicleId"),
        Index("date"),
        Index(value = ["vehicleId", "sourceType", "sourceId"], unique = true)
    ]
)
data class ExpenseEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val sourceType: String, // "FUEL" | "MAINTENANCE" | "OIL_FILTER" | "FAULT_REPAIR" | "SPARE_PART" | "ADDITIONAL"
    val sourceId: String,
    val categoryLabel: String,
    val date: String,
    val amountPiastres: Long,
    val odometerKm: Double? = null,
    val notes: String? = null,
    val isAutomatic: Boolean,
    val createdAt: String
)

@Serializable
@Entity(
    tableName = "spare_parts",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("vehicleId")]
)
data class SparePartEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val partName: String,
    val brand: String,
    val purchaseDate: String,
    val installDate: String,
    val odometerKm: Double,
    val pricePiastres: Long,
    val vendorOrCenter: String? = null,
    val notes: String? = null,
    val linkedRecordType: String = "STANDALONE", // "MAINTENANCE" | "FAULT" | "STANDALONE"
    val linkedRecordId: String? = null,
    val includedInParentCost: Boolean = false,
    val createdAt: String
)

@Serializable
@Entity(
    tableName = "tire_records",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("vehicleId")]
)
data class TireRecordEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val position: String, // "FL" | "FR" | "RL" | "RR" | "SPARE"
    val positionLabel: String,
    val dotWeek: Int? = null,
    val dotYear: Int? = null,
    val isConfigured: Boolean = true,
    val installDate: String,
    val installOdometerKm: Double,
    val brand: String,
    val size: String,
    val conditionNotes: String,
    val treadStatus: String = "GOOD",
    val updatedAt: String
)

@Serializable
@Entity(
    tableName = "document_records",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("vehicleId")]
)
data class DocumentRecordEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val docType: String, // "VEHICLE_LICENSE" | "TECHNICAL_INSPECTION" | "DRIVER_LICENSE"
    val expiryDate: String,
    val previousHistoryJson: String = "[]",
    val updatedAt: String
)

@Serializable
@Entity(
    tableName = "reminders",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("vehicleId"), Index("alertKey")]
)
data class ReminderEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val alertKey: String,
    val severity: String, // "RED" | "YELLOW" | "GREEN"
    val title: String,
    val message: String,
    val targetSection: String,
    val redNotifiedExternally: Boolean = false,
    val lastEvaluatedAt: String,
    val resolvedAt: String? = null
)

@Serializable
@Entity(
    tableName = "emergency_equipment",
    foreignKeys = [ForeignKey(entity = VehicleEntity::class, parentColumns = ["id"], childColumns = ["vehicleId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("vehicleId")]
)
data class EmergencyEquipmentEntity(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val hasJack: Boolean? = null,
    val hasLugWrench: Boolean? = null,
    val hasAirPump: Boolean? = null,
    val updatedAt: String
)

@Serializable
@Entity(tableName = "backup_metadata")
data class BackupMetadataEntity(
    @PrimaryKey val id: String = "backup_meta",
    val lastBackupAt: String? = null,
    val fileName: String? = null,
    val checksum: String? = null,
    val vehicleCount: Int? = null,
    val recordCount: Int? = null,
    val lastRestoredChecksum: String? = null,
    val lastRestoredAt: String? = null
)

@Serializable
@Entity(tableName = "custom_catalog")
data class CustomCatalogEntity(
    @PrimaryKey val id: String,
    val brand: String,
    val model: String,
    val year: Int,
    val createdAt: String
)

@Serializable
@Entity(tableName = "app_settings")
data class AppSettingsEntity(
    @PrimaryKey val id: String = "app_settings",
    val activeVehicleId: String? = null,
    val currencyCode: String = "EGP",
    val currencySymbol: String = "ج.م",
    val customFuelTypesJson: String = "[]",
    val schemaVersion: Int = 1,
    val updatedAt: String
)

package com.ahmedali.mycar.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface MyCarDao {
    // --- Settings & Catalog ---
    @Query("SELECT * FROM app_settings WHERE id = 'app_settings' LIMIT 1")
    suspend fun getSettings(): AppSettingsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSettings(settings: AppSettingsEntity)

    @Query("SELECT * FROM backup_metadata WHERE id = 'backup_meta' LIMIT 1")
    suspend fun getBackupMetadata(): BackupMetadataEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertBackupMetadata(meta: BackupMetadataEntity)

    @Query("SELECT * FROM custom_catalog")
    suspend fun getCustomCatalog(): List<CustomCatalogEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCustomCatalog(entry: CustomCatalogEntity)

    // --- Vehicles ---
    @Query("SELECT * FROM vehicles ORDER BY createdAt ASC")
    fun observeAllVehicles(): Flow<List<VehicleEntity>>

    @Query("SELECT * FROM vehicles ORDER BY createdAt ASC")
    suspend fun getAllVehicles(): List<VehicleEntity>

    @Query("SELECT * FROM vehicles WHERE id = :vehicleId LIMIT 1")
    suspend fun getVehicleById(vehicleId: String): VehicleEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertVehicle(vehicle: VehicleEntity)

    @Query("DELETE FROM vehicles WHERE id = :vehicleId")
    suspend fun deleteVehicleById(vehicleId: String)

    // --- Strict vehicleId-scoped queries ---
    @Query("SELECT * FROM odometer_entries WHERE vehicleId = :vehicleId ORDER BY recordedAt DESC")
    suspend fun getOdometerEntries(vehicleId: String): List<OdometerEntryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOdometerEntry(entry: OdometerEntryEntity)

    @Query("SELECT * FROM fuel_entries WHERE vehicleId = :vehicleId ORDER BY odometerKm DESC, dateTime DESC")
    suspend fun getFuelEntries(vehicleId: String): List<FuelEntryEntity>

    @Query("SELECT * FROM fuel_entries WHERE id = :id AND vehicleId = :vehicleId LIMIT 1")
    suspend fun getFuelEntryById(id: String, vehicleId: String): FuelEntryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertFuelEntry(entry: FuelEntryEntity)

    @Query("SELECT * FROM maintenance_types WHERE vehicleId = :vehicleId")
    suspend fun getMaintenanceTypes(vehicleId: String): List<MaintenanceTypeEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMaintenanceTypes(types: List<MaintenanceTypeEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMaintenanceType(type: MaintenanceTypeEntity)

    @Query("SELECT * FROM maintenance_records WHERE vehicleId = :vehicleId ORDER BY date DESC")
    suspend fun getMaintenanceRecords(vehicleId: String): List<MaintenanceRecordEntity>

    @Query("SELECT * FROM maintenance_records WHERE vehicleId = :vehicleId AND linkedOilRecordId = :oilRecordId LIMIT 1")
    suspend fun getLinkedFilterRecord(vehicleId: String, oilRecordId: String): MaintenanceRecordEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMaintenanceRecord(record: MaintenanceRecordEntity)

    @Query("DELETE FROM maintenance_records WHERE id = :id")
    suspend fun deleteMaintenanceRecordById(id: String)

    @Query("SELECT * FROM fault_records WHERE vehicleId = :vehicleId ORDER BY appearedAt DESC")
    suspend fun getFaultRecords(vehicleId: String): List<FaultRecordEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertFaultRecord(record: FaultRecordEntity)

    @Query("SELECT * FROM pending_tasks WHERE vehicleId = :vehicleId ORDER BY createdAt DESC")
    suspend fun getPendingTasks(vehicleId: String): List<PendingTaskEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertPendingTask(task: PendingTaskEntity)

    @Query("SELECT * FROM expenses WHERE vehicleId = :vehicleId ORDER BY date DESC")
    suspend fun getExpenses(vehicleId: String): List<ExpenseEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertExpense(expense: ExpenseEntity)

    @Query("DELETE FROM expenses WHERE vehicleId = :vehicleId AND sourceType = :sourceType AND sourceId = :sourceId")
    suspend fun deleteExpenseBySource(vehicleId: String, sourceType: String, sourceId: String)

    @Query("SELECT * FROM spare_parts WHERE vehicleId = :vehicleId ORDER BY installDate DESC")
    suspend fun getSpareParts(vehicleId: String): List<SparePartEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSparePart(part: SparePartEntity)

    @Query("SELECT * FROM tire_records WHERE vehicleId = :vehicleId")
    suspend fun getTireRecords(vehicleId: String): List<TireRecordEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTireRecords(tires: List<TireRecordEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTireRecord(tire: TireRecordEntity)

    @Query("SELECT * FROM document_records WHERE vehicleId = :vehicleId")
    suspend fun getDocumentRecords(vehicleId: String): List<DocumentRecordEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDocumentRecords(docs: List<DocumentRecordEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDocumentRecord(doc: DocumentRecordEntity)

    @Query("SELECT * FROM reminders WHERE vehicleId = :vehicleId")
    suspend fun getReminders(vehicleId: String): List<ReminderEntity>

    @Query("DELETE FROM reminders WHERE vehicleId = :vehicleId")
    suspend fun deleteRemindersForVehicle(vehicleId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReminders(reminders: List<ReminderEntity>)

    @Query("SELECT * FROM emergency_equipment WHERE vehicleId = :vehicleId LIMIT 1")
    suspend fun getEmergencyEquipment(vehicleId: String): EmergencyEquipmentEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertEmergencyEquipment(equipment: EmergencyEquipmentEntity)

    // --- Full Table Exports for Manual Backup ---
    @Query("SELECT * FROM odometer_entries") suspend fun exportOdometer(): List<OdometerEntryEntity>
    @Query("SELECT * FROM fuel_entries") suspend fun exportFuel(): List<FuelEntryEntity>
    @Query("SELECT * FROM maintenance_types") suspend fun exportMaintTypes(): List<MaintenanceTypeEntity>
    @Query("SELECT * FROM maintenance_records") suspend fun exportMaintRecords(): List<MaintenanceRecordEntity>
    @Query("SELECT * FROM fault_records") suspend fun exportFaults(): List<FaultRecordEntity>
    @Query("SELECT * FROM pending_tasks") suspend fun exportTasks(): List<PendingTaskEntity>
    @Query("SELECT * FROM expenses") suspend fun exportExpenses(): List<ExpenseEntity>
    @Query("SELECT * FROM spare_parts") suspend fun exportParts(): List<SparePartEntity>
    @Query("SELECT * FROM tire_records") suspend fun exportTires(): List<TireRecordEntity>
    @Query("SELECT * FROM document_records") suspend fun exportDocs(): List<DocumentRecordEntity>
    @Query("SELECT * FROM reminders") suspend fun exportReminders(): List<ReminderEntity>
    @Query("SELECT * FROM emergency_equipment") suspend fun exportEmergency(): List<EmergencyEquipmentEntity>

    @Query("DELETE FROM vehicles") suspend fun clearVehicles()
    @Query("DELETE FROM custom_catalog") suspend fun clearCustomCatalog()
    @Query("DELETE FROM app_settings") suspend fun clearSettings()

    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertVehicles(items: List<VehicleEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertOdometerEntries(items: List<OdometerEntryEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertFuelEntries(items: List<FuelEntryEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertMaintenanceRecords(items: List<MaintenanceRecordEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertFaultRecords(items: List<FaultRecordEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertPendingTasks(items: List<PendingTaskEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertExpenses(items: List<ExpenseEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertSpareParts(items: List<SparePartEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertEmergencyEquipments(items: List<EmergencyEquipmentEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertCustomCatalogItems(items: List<CustomCatalogEntity>)

    // --- Atomic Composite Transactions ---
    @Transaction
    suspend fun insertVehicleWithDefaults(
        vehicle: VehicleEntity,
        initialOdometer: OdometerEntryEntity?,
        maintTypes: List<MaintenanceTypeEntity>,
        docs: List<DocumentRecordEntity>,
        tires: List<TireRecordEntity>,
        emergency: EmergencyEquipmentEntity
    ) {
        upsertVehicle(vehicle)
        if (initialOdometer != null) insertOdometerEntry(initialOdometer)
        insertMaintenanceTypes(maintTypes)
        insertDocumentRecords(docs)
        insertTireRecords(tires)
        upsertEmergencyEquipment(emergency)
    }

    @Transaction
    suspend fun saveFuelWithExpense(
        fuel: FuelEntryEntity,
        expense: ExpenseEntity,
        updatedVehicle: VehicleEntity?,
        odoEntry: OdometerEntryEntity?
    ) {
        upsertFuelEntry(fuel)
        upsertExpense(expense)
        if (updatedVehicle != null && odoEntry != null) {
            upsertVehicle(updatedVehicle)
            insertOdometerEntry(odoEntry)
        }
    }

    @Transaction
    suspend fun saveMaintenanceWithOptionalFilter(
        record: MaintenanceRecordEntity,
        expense: ExpenseEntity?,
        filterRecord: MaintenanceRecordEntity?,
        filterExpense: ExpenseEntity?,
        removeLinkedFilterId: String?,
        removeFilterExpenseSourceId: String?,
        updatedVehicle: VehicleEntity?
    ) {
        upsertMaintenanceRecord(record)
        if (expense != null) upsertExpense(expense)
        if (filterRecord != null) upsertMaintenanceRecord(filterRecord)
        if (filterExpense != null) upsertExpense(filterExpense)
        if (removeLinkedFilterId != null) deleteMaintenanceRecordById(removeLinkedFilterId)
        if (removeFilterExpenseSourceId != null) {
            deleteExpenseBySource(record.vehicleId, "OIL_FILTER", removeFilterExpenseSourceId)
        }
        if (updatedVehicle != null) upsertVehicle(updatedVehicle)
    }

    @Transaction
    suspend fun replaceRemindersForVehicle(vehicleId: String, reminders: List<ReminderEntity>) {
        deleteRemindersForVehicle(vehicleId)
        insertReminders(reminders)
    }

    @Transaction
    suspend fun restoreBackupTransaction(
        settings: AppSettingsEntity,
        customCatalog: List<CustomCatalogEntity>,
        vehicles: List<VehicleEntity>,
        odometerEntries: List<OdometerEntryEntity>,
        fuelEntries: List<FuelEntryEntity>,
        maintenanceTypes: List<MaintenanceTypeEntity>,
        maintenanceRecords: List<MaintenanceRecordEntity>,
        faultRecords: List<FaultRecordEntity>,
        pendingTasks: List<PendingTaskEntity>,
        expenses: List<ExpenseEntity>,
        spareParts: List<SparePartEntity>,
        tireRecords: List<TireRecordEntity>,
        documentRecords: List<DocumentRecordEntity>,
        reminders: List<ReminderEntity>,
        emergencyEquipment: List<EmergencyEquipmentEntity>,
        backupMeta: BackupMetadataEntity
    ) {
        clearVehicles()
        clearCustomCatalog()
        clearSettings()
        upsertSettings(settings)
        insertCustomCatalogItems(customCatalog)
        insertVehicles(vehicles)
        insertOdometerEntries(odometerEntries)
        insertFuelEntries(fuelEntries)
        insertMaintenanceTypes(maintenanceTypes)
        insertMaintenanceRecords(maintenanceRecords)
        insertFaultRecords(faultRecords)
        insertPendingTasks(pendingTasks)
        insertExpenses(expenses)
        insertSpareParts(spareParts)
        insertTireRecords(tireRecords)
        insertDocumentRecords(documentRecords)
        insertReminders(reminders)
        insertEmergencyEquipments(emergencyEquipment)
        upsertBackupMetadata(backupMeta)
    }
}

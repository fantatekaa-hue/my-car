package com.ahmedali.mycar.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        VehicleEntity::class,
        OdometerEntryEntity::class,
        FuelEntryEntity::class,
        MaintenanceTypeEntity::class,
        MaintenanceRecordEntity::class,
        FaultRecordEntity::class,
        PendingTaskEntity::class,
        ExpenseEntity::class,
        SparePartEntity::class,
        TireRecordEntity::class,
        DocumentRecordEntity::class,
        ReminderEntity::class,
        EmergencyEquipmentEntity::class,
        BackupMetadataEntity::class,
        CustomCatalogEntity::class,
        AppSettingsEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class MyCarDatabase : RoomDatabase() {
    abstract fun dao(): MyCarDao

    companion object {
        @Volatile
        private var INSTANCE: MyCarDatabase? = null

        fun getInstance(context: Context): MyCarDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    MyCarDatabase::class.java,
                    "my_car_arabety.db"
                )
                    // Future schema upgrades add explicit Migration(1, 2) objects here so user data is never lost
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}

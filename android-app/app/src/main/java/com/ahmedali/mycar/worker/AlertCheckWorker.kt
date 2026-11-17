package com.ahmedali.mycar.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.ahmedali.mycar.data.db.MyCarDatabase
import com.ahmedali.mycar.domain.AlertEngine
import java.time.Instant
import java.util.concurrent.TimeUnit

class AlertCheckWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val dao = MyCarDatabase.getInstance(applicationContext).dao()
        val vehicles = dao.getAllVehicles().filter { !it.isArchived }
        val nowIso = Instant.now().toString()

        for (vehicle in vehicles) {
            val evaluated = AlertEngine.evaluate(
                vehicle = vehicle,
                maintenanceRecords = dao.getMaintenanceRecords(vehicle.id),
                pendingTasks = dao.getPendingTasks(vehicle.id),
                tireRecords = dao.getTireRecords(vehicle.id),
                documentRecords = dao.getDocumentRecords(vehicle.id),
                emergencyEquipment = dao.getEmergencyEquipment(vehicle.id)
            )
            val existing = dao.getReminders(vehicle.id)
            val reconciled = AlertEngine.reconcile(vehicle.id, evaluated, existing, nowIso)
            dao.replaceRemindersForVehicle(vehicle.id, reconciled.updatedReminders)

            // Fire external Android notification ONCE per new independent RED alert
            for (redAlert in reconciled.newlyTriggeredRedAlerts) {
                NotificationHelper.sendRedAlertNotification(
                    context = applicationContext,
                    alertId = redAlert.id,
                    title = "${vehicle.brand} ${vehicle.model}: ${redAlert.title}",
                    message = redAlert.message
                )
            }
        }
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "my_car_alert_check_periodic"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<AlertCheckWorker>(12, TimeUnit.HOURS).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}

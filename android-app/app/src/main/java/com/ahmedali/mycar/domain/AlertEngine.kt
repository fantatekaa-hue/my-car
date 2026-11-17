package com.ahmedali.mycar.domain

import com.ahmedali.mycar.data.db.DocumentRecordEntity
import com.ahmedali.mycar.data.db.EmergencyEquipmentEntity
import com.ahmedali.mycar.data.db.MaintenanceRecordEntity
import com.ahmedali.mycar.data.db.PendingTaskEntity
import com.ahmedali.mycar.data.db.ReminderEntity
import com.ahmedali.mycar.data.db.TireRecordEntity
import com.ahmedali.mycar.data.db.VehicleEntity
import java.time.LocalDate
import java.time.temporal.ChronoUnit

data class EvaluatedAlert(
    val alertKey: String,
    val vehicleId: String,
    val severity: String, // "RED" | "YELLOW" | "GREEN"
    val title: String,
    val message: String,
    val targetSection: String,
    val isResolved: Boolean
)

data class AlertReconcileResult(
    val updatedReminders: List<ReminderEntity>,
    val newlyTriggeredRedAlerts: List<ReminderEntity>
)

object AlertEngine {

    private fun daysBetween(fromIso: String, toIso: String): Long {
        return try {
            val a = LocalDate.parse(fromIso.take(10))
            val b = LocalDate.parse(toIso.take(10))
            ChronoUnit.DAYS.between(a, b)
        } catch (_: Exception) {
            0L
        }
    }

    fun getTireAgeYearsFromDot(dotWeek: Int, dotYear: Int, refDateIso: String): Double {
        return try {
            val ref = LocalDate.parse(refDateIso.take(10))
            val jan4 = LocalDate.of(dotYear, 1, 4)
            val mfg = jan4.plusWeeks((dotWeek.coerceAtLeast(1) - 1).toLong())
            val days = ChronoUnit.DAYS.between(mfg, ref).coerceAtLeast(0L)
            days / 365.2425
        } catch (_: Exception) {
            0.0
        }
    }

    fun evaluate(
        vehicle: VehicleEntity,
        maintenanceRecords: List<MaintenanceRecordEntity>,
        pendingTasks: List<PendingTaskEntity>,
        tireRecords: List<TireRecordEntity>,
        documentRecords: List<DocumentRecordEntity>,
        emergencyEquipment: EmergencyEquipmentEntity?,
        referenceDateIso: String = LocalDate.now().toString()
    ): List<EvaluatedAlert> {
        val alerts = mutableListOf<EvaluatedAlert>()

        val docLabels = mapOf(
            "VEHICLE_LICENSE" to "ترخيص السيارة",
            "TECHNICAL_INSPECTION" to "الفحص الفني",
            "DRIVER_LICENSE" to "رخصة القيادة الشخصية"
        )

        for (doc in documentRecords) {
            if (doc.expiryDate.isBlank()) continue
            val daysLeft = daysBetween(referenceDateIso, doc.expiryDate)
            val label = docLabels[doc.docType] ?: doc.docType

            when {
                daysLeft <= 0 -> alerts.add(
                    EvaluatedAlert("doc_${doc.docType}", vehicle.id, "RED", "انتهى موعد $label", "انتهى بتاريخ ${doc.expiryDate}.", "documents", false)
                )
                daysLeft <= 30 -> alerts.add(
                    EvaluatedAlert("doc_${doc.docType}", vehicle.id, "RED", "قرب انتهاء $label ($daysLeft يوم)", "تنبيه الـ 30 يومًا: متبقي $daysLeft يومًا (${doc.expiryDate}).", "documents", false)
                )
                daysLeft <= 45 -> alerts.add(
                    EvaluatedAlert("doc_${doc.docType}", vehicle.id, "YELLOW", "موعد $label قريب ($daysLeft يوم)", "تاريخ الاستحقاق: ${doc.expiryDate}.", "documents", false)
                )
                else -> alerts.add(
                    EvaluatedAlert("doc_${doc.docType}", vehicle.id, "GREEN", "$label ساري", "ساري حتى ${doc.expiryDate}.", "documents", true)
                )
            }

            if (doc.docType == "VEHICLE_LICENSE" &&
                vehicle.ownershipType == "POWER_OF_ATTORNEY" &&
                !vehicle.poaRegisteredContractDone
            ) {
                if (daysLeft <= 60) {
                    alerts.add(
                        EvaluatedAlert(
                            "poa_registered_contract_60d",
                            vehicle.id,
                            "RED",
                            "ضرورة عمل عقد مسجل (شراء بتوكيل)",
                            "تنبيه الـ 60 يومًا قبل انتهاء الترخيص: لم يتم تأكيد عمل العقد المسجل بعد.",
                            "documents",
                            false
                        )
                    )
                } else if (daysLeft <= 90) {
                    alerts.add(
                        EvaluatedAlert(
                            "poa_registered_contract_60d",
                            vehicle.id,
                            "YELLOW",
                            "متابعة العقد المسجل (شراء بتوكيل)",
                            "متبقي $daysLeft يومًا للترخيص؛ يُنصح بإنهاء العقد المسجل مبكرًا.",
                            "documents",
                            false
                        )
                    )
                }
            }
        }

        val latestByType = linkedMapOf<String, MaintenanceRecordEntity>()
        val sortedMaint = maintenanceRecords.sortedWith(compareBy<MaintenanceRecordEntity> { it.date }.thenBy { it.odometerKm })
        for (rec in sortedMaint) {
            latestByType[rec.maintenanceTypeId] = rec
        }

        for (rec in latestByType.values) {
            val name = rec.customName ?: when (rec.typeCode) {
                "ENGINE_OIL" -> "زيت المحرك"
                "OIL_FILTER" -> "فلتر الزيت"
                "AIR_FILTER" -> "فلتر الهواء"
                "AC_FILTER" -> "فلتر التكييف"
                "SPARK_PLUGS" -> "البوجيهات"
                "BRAKE_PADS" -> "تيل الفرامل"
                "TRANSMISSION_OIL" -> "زيت الفتيس"
                "BELTS" -> "السيور"
                "COOLANT" -> "سائل التبريد"
                "AC_FREON" -> "فريون التكييف"
                "BATTERY" -> "البطارية"
                "SUSPENSION" -> "العفشة والمساعدين"
                else -> rec.typeCode
            }

            val maintTargetSection = if (rec.typeCode == "ENGINE_OIL" || rec.typeCode == "OIL_FILTER") "engine_oil" else "maintenance"

            if (rec.conditionStatus == "NEEDS_REPLACEMENT" || rec.conditionStatus == "NEEDS_REPAIR") {
                alerts.add(EvaluatedAlert("maint_cond_${rec.maintenanceTypeId}", vehicle.id, "RED", "$name: يحتاج تغيير/إصلاح", "مسجل بتاريخ ${rec.date}.", maintTargetSection, false))
            } else if (rec.conditionStatus == "FOLLOW_UP") {
                alerts.add(EvaluatedAlert("maint_cond_${rec.maintenanceTypeId}", vehicle.id, "YELLOW", "$name: يحتاج متابعة", "مسجل بتاريخ ${rec.date}.", maintTargetSection, false))
            }

            if (rec.typeCode == "BATTERY" && !rec.warrantyExpiryDate.isNullOrBlank()) {
                val wDays = daysBetween(referenceDateIso, rec.warrantyExpiryDate)
                if (wDays <= 0) {
                    alerts.add(EvaluatedAlert("battery_warranty", vehicle.id, "RED", "انتهى ضمان البطارية", "انتهى بتاريخ ${rec.warrantyExpiryDate}.", "maintenance", false))
                } else if (wDays <= 30) {
                    alerts.add(EvaluatedAlert("battery_warranty", vehicle.id, "YELLOW", "قرب انتهاء ضمان البطارية ($wDays يوم)", "ينتهي بتاريخ ${rec.warrantyExpiryDate}.", "maintenance", false))
                }
            }

            val remKm = rec.nextDueKm?.let { it - vehicle.currentOdometerKm }
            val remDays = rec.nextDueDate?.takeIf { it.isNotBlank() }?.let { daysBetween(referenceDateIso, it) }

            if (remKm != null || remDays != null) {
                val overKm = remKm != null && remKm <= 0.0
                val overDays = remDays != null && remDays <= 0L
                val soonKm = remKm != null && remKm > 0.0 && remKm <= 1000.0
                val soonDays = remDays != null && remDays > 0L && remDays <= 15L
                val srcLabel = if (rec.scheduleSource == "OEM") "توصية الشركة المصنعة" else "إدخال يدوي"

                when {
                    overKm || overDays -> alerts.add(
                        EvaluatedAlert("maint_due_${rec.maintenanceTypeId}", vehicle.id, "RED", "تجاوز موعد $name", "المصدر: $srcLabel.", maintTargetSection, false)
                    )
                    soonKm || soonDays -> alerts.add(
                        EvaluatedAlert("maint_due_${rec.maintenanceTypeId}", vehicle.id, "YELLOW", "موعد $name قريب", "تنبيه قبل الموعد — المصدر: $srcLabel.", maintTargetSection, false)
                    )
                    else -> alerts.add(
                        EvaluatedAlert("maint_due_${rec.maintenanceTypeId}", vehicle.id, "GREEN", "$name سليم", "ضمن الموعد المحدد ($srcLabel).", maintTargetSection, true)
                    )
                }
            }
        }

        val freonList = sortedMaint.filter { it.typeCode == "AC_FREON" }
        if (freonList.size >= 2) {
            val prev = freonList[freonList.size - 2]
            val latest = freonList.last()
            val gap = daysBetween(prev.date, latest.date)
            if (gap in 0..30) {
                alerts.add(
                    EvaluatedAlert(
                        "freon_repeat_${latest.id}",
                        vehicle.id,
                        "RED",
                        "تنبيه مراجعة فريون التكييف",
                        "تكرر شحن الفريون خلال $gap يومًا — يُنصح بفحص احتمال وجود تسريب (ليس تشخيصًا مؤكدًا).",
                        "maintenance",
                        false
                    )
                )
            }
        }

        for (task in pendingTasks) {
            if (task.status == "PENDING") {
                alerts.add(
                    EvaluatedAlert(
                        "pending_task_${task.id}",
                        vehicle.id,
                        if (task.priority == "URGENT") "RED" else "YELLOW",
                        "عمل مطلوب: ${task.partOrIssue}",
                        "يظل ظاهرًا حتى تأكيد «تم الإصلاح».",
                        "faults",
                        false
                    )
                )
            }
        }

        val incompleteTires = mutableListOf<String>()
        for (tire in tireRecords) {
            val isConfigured = tire.isConfigured && tire.dotWeek != null && tire.dotYear != null
            if (!isConfigured) {
                incompleteTires.add(tire.positionLabel)
                continue
            }
            val ageYears = getTireAgeYearsFromDot(tire.dotWeek!!, tire.dotYear!!, referenceDateIso)
            when {
                ageYears >= 6.0 || tire.treadStatus == "NEEDS_REPLACEMENT" -> alerts.add(
                    EvaluatedAlert("tire_${tire.position}", vehicle.id, "RED", "إطار (${tire.positionLabel}): عمر 6 سنوات أو يحتاج تغيير", "DOT ${tire.dotWeek}/${tire.dotYear}", "tires", false)
                )
                ageYears >= 5.0 || tire.treadStatus == "FOLLOW_UP" -> alerts.add(
                    EvaluatedAlert("tire_${tire.position}", vehicle.id, "YELLOW", "إطار (${tire.positionLabel}): عمر 5 سنوات / متابعة", "DOT ${tire.dotWeek}/${tire.dotYear}", "tires", false)
                )
                else -> alerts.add(
                    EvaluatedAlert("tire_${tire.position}", vehicle.id, "GREEN", "إطار (${tire.positionLabel}) سليم", "DOT ${tire.dotWeek}/${tire.dotYear}", "tires", true)
                )
            }
        }
        if (incompleteTires.isNotEmpty()) {
            alerts.add(
                EvaluatedAlert(
                    "tires_incomplete",
                    vehicle.id,
                    "YELLOW",
                    "بيانات الإطارات غير مكتملة (${incompleteTires.size})",
                    "يرجى إدخال الماركة والمقاس وتاريخ DOT لـ: ${incompleteTires.joinToString("، ")}.",
                    "tires",
                    false
                )
            )
        }

        if (emergencyEquipment != null) {
            val missingInput = mutableListOf<String>()
            if (emergencyEquipment.hasJack == null) missingInput.add("الكوريك")
            if (emergencyEquipment.hasLugWrench == null) missingInput.add("مفتاح العجل")
            if (emergencyEquipment.hasAirPump == null) missingInput.add("المنفاخ الكهربائي")
            if (missingInput.isNotEmpty()) {
                alerts.add(
                    EvaluatedAlert(
                        "emergency_incomplete",
                        vehicle.id,
                        "YELLOW",
                        "تجهيزات الطوارئ غير محددة",
                        "يرجى تحديد توفر: ${missingInput.joinToString("، ")}.",
                        "tires",
                        false
                    )
                )
            }

            if (emergencyEquipment.hasJack == false || emergencyEquipment.hasLugWrench == false) {
                alerts.add(
                    EvaluatedAlert("emergency_critical", vehicle.id, "RED", "نقص تجهيزات طوارئ مهمة", "لابد من توافرهما لسلامتك أثناء السفر — يجب توفر الكوريك ومفتاح العجل.", "tires", false)
                )
            } else if (emergencyEquipment.hasJack == true && emergencyEquipment.hasLugWrench == true) {
                alerts.add(
                    EvaluatedAlert("emergency_critical", vehicle.id, "GREEN", "الكوريك ومفتاح العجل متوفران", "تجهيزات الطوارئ الأساسية سليمة.", "tires", true)
                )
            }

            if (emergencyEquipment.hasAirPump == false) {
                alerts.add(
                    EvaluatedAlert(
                        "emergency_airpump",
                        vehicle.id,
                        "YELLOW",
                        "نصيحة: من الضروري امتلاك منفاخ كهربائي للطوارئ",
                        "يُنصح بتجهيز السيارة بمنفاخ كهربائي لمواجهة طوارئ انخفاض ضغط الإطارات على الطريق.",
                        "tires",
                        false
                    )
                )
            }
        }

        val rank = mapOf("RED" to 0, "YELLOW" to 1, "GREEN" to 2)
        return alerts.sortedBy { rank[it.severity] ?: 3 }
    }

    fun reconcile(
        vehicleId: String,
        evaluated: List<EvaluatedAlert>,
        existing: List<ReminderEntity>,
        nowIso: String
    ): AlertReconcileResult {
        val prevMap = existing.filter { it.vehicleId == vehicleId }.associateBy { it.alertKey }
        val updated = mutableListOf<ReminderEntity>()
        val newRed = mutableListOf<ReminderEntity>()

        for (ev in evaluated) {
            val prev = prevMap[ev.alertKey]
            val alreadyNotified = prev?.severity == "RED" && prev.redNotifiedExternally
            val isNewRed = ev.severity == "RED" && !alreadyNotified

            val reminder = ReminderEntity(
                id = prev?.id ?: "rem_${vehicleId}_${ev.alertKey}",
                vehicleId = vehicleId,
                alertKey = ev.alertKey,
                severity = ev.severity,
                title = ev.title,
                message = ev.message,
                targetSection = ev.targetSection,
                redNotifiedExternally = ev.severity == "RED",
                lastEvaluatedAt = nowIso,
                resolvedAt = if (ev.isResolved) prev?.resolvedAt ?: nowIso else null
            )
            updated.add(reminder)
            if (isNewRed) newRed.add(reminder)
        }

        return AlertReconcileResult(updated, newRed)
    }
}

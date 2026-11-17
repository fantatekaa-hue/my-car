package com.ahmedali.mycar.domain

import com.ahmedali.mycar.data.db.FuelEntryEntity

data class FuelPeriodResult(
    val entryId: String,
    val dateTime: String,
    val odometerKm: Double,
    val fuelType: String,
    val liters: Double,
    val totalCostPiastres: Long,
    val pricePerLiterPiastres: Long,
    val fillType: String,
    val distanceKm: Double?,
    val kmPerLiter: Double?,
    val litersPer100Km: Double?,
    val isBaseline: Boolean,
    val excludedReason: String? = null
)

data class FuelAnalyticsSummary(
    val totalFills: Int,
    val totalLiters: Double,
    val totalCostPiastres: Long,
    val completedPeriodsCount: Int,
    val completedDistanceKm: Double,
    val completedLiters: Double,
    val overallKmPerLiter: Double?,
    val overallLitersPer100Km: Double?,
    val costPerKmPiastres: Long?,
    val costPer100KmPiastres: Long?,
    val periods: List<FuelPeriodResult>
)

object FuelCalculator {
    fun calculate(entries: List<FuelEntryEntity>): FuelAnalyticsSummary {
        val sorted = entries.sortedWith(compareBy<FuelEntryEntity> { it.odometerKm }.thenBy { it.dateTime })
        val periods = mutableListOf<FuelPeriodResult>()
        var lastFull: FuelEntryEntity? = null
        var hadPartialSinceFull = false
        var completedCount = 0
        var completedDistKm = 0.0
        var completedLiters = 0.0
        var totalLiters = 0.0
        var totalCost = 0L

        for (entry in sorted) {
            totalLiters += entry.liters
            totalCost += entry.totalCostPiastres

            if (entry.fillType == "PARTIAL") {
                if (lastFull != null) hadPartialSinceFull = true
                periods.add(
                    FuelPeriodResult(
                        entryId = entry.id,
                        dateTime = entry.dateTime,
                        odometerKm = entry.odometerKm,
                        fuelType = entry.fuelType,
                        liters = entry.liters,
                        totalCostPiastres = entry.totalCostPiastres,
                        pricePerLiterPiastres = entry.pricePerLiterPiastres,
                        fillType = entry.fillType,
                        distanceKm = null,
                        kmPerLiter = null,
                        litersPer100Km = null,
                        isBaseline = false,
                        excludedReason = "تعبئة جزئية — مصروف فقط ولا تدخل المتوسط"
                    )
                )
                continue
            }

            if (lastFull == null) {
                lastFull = entry
                hadPartialSinceFull = false
                periods.add(
                    FuelPeriodResult(
                        entryId = entry.id,
                        dateTime = entry.dateTime,
                        odometerKm = entry.odometerKm,
                        fuelType = entry.fuelType,
                        liters = entry.liters,
                        totalCostPiastres = entry.totalCostPiastres,
                        pricePerLiterPiastres = entry.pricePerLiterPiastres,
                        fillType = entry.fillType,
                        distanceKm = null,
                        kmPerLiter = null,
                        litersPer100Km = null,
                        isBaseline = true,
                        excludedReason = "تفويلة بداية مرجعية"
                    )
                )
                continue
            }

            val dist = (entry.odometerKm - lastFull.odometerKm).coerceAtLeast(0.0)
            if (hadPartialSinceFull) {
                periods.add(
                    FuelPeriodResult(
                        entryId = entry.id,
                        dateTime = entry.dateTime,
                        odometerKm = entry.odometerKm,
                        fuelType = entry.fuelType,
                        liters = entry.liters,
                        totalCostPiastres = entry.totalCostPiastres,
                        pricePerLiterPiastres = entry.pricePerLiterPiastres,
                        fillType = entry.fillType,
                        distanceKm = dist,
                        kmPerLiter = null,
                        litersPer100Km = null,
                        isBaseline = true,
                        excludedReason = "سبقتها تعبئة جزئية — بداية مرجعية جديدة"
                    )
                )
            } else if (dist > 0.0 && entry.liters > 0.0) {
                val kpl = dist / entry.liters
                val l100 = (entry.liters / dist) * 100.0
                completedCount += 1
                completedDistKm += dist
                completedLiters += entry.liters
                periods.add(
                    FuelPeriodResult(
                        entryId = entry.id,
                        dateTime = entry.dateTime,
                        odometerKm = entry.odometerKm,
                        fuelType = entry.fuelType,
                        liters = entry.liters,
                        totalCostPiastres = entry.totalCostPiastres,
                        pricePerLiterPiastres = entry.pricePerLiterPiastres,
                        fillType = entry.fillType,
                        distanceKm = dist,
                        kmPerLiter = kpl,
                        litersPer100Km = l100,
                        isBaseline = false
                    )
                )
            }
            lastFull = entry
            hadPartialSinceFull = false
        }

        val overallKpl = if (completedDistKm > 0 && completedLiters > 0) completedDistKm / completedLiters else null
        val overallL100 = if (completedDistKm > 0 && completedLiters > 0) (completedLiters / completedDistKm) * 100.0 else null
        val spanDist = if (sorted.size >= 2) (sorted.last().odometerKm - sorted.first().odometerKm).coerceAtLeast(0.0) else 0.0
        val spanCost = if (sorted.size >= 2) sorted.drop(1).sumOf { it.totalCostPiastres } else 0L
        val costPerKm = if (spanDist > 0) kotlin.math.round(spanCost / spanDist).toLong() else null
        val costPer100Km = if (spanDist > 0) kotlin.math.round((spanCost / spanDist) * 100.0).toLong() else null

        return FuelAnalyticsSummary(
            totalFills = sorted.size,
            totalLiters = totalLiters,
            totalCostPiastres = totalCost,
            completedPeriodsCount = completedCount,
            completedDistanceKm = completedDistKm,
            completedLiters = completedLiters,
            overallKmPerLiter = overallKpl,
            overallLitersPer100Km = overallL100,
            costPerKmPiastres = costPerKm,
            costPer100KmPiastres = costPer100Km,
            periods = periods
        )
    }
}

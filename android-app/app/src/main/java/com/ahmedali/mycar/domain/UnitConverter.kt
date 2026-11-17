package com.ahmedali.mycar.domain

import kotlin.math.roundToLong

object UnitConverter {
    const val KM_PER_MILE = 1.609344

    fun toInternalKm(value: Double, unit: String): Double {
        if (!value.isFinite() || value < 0.0) return 0.0
        val km = if (unit == "MILE") value * KM_PER_MILE else value
        return (km * 1000.0).roundToLong() / 1000.0
    }

    fun fromInternalKm(km: Double, unit: String): Double {
        if (!km.isFinite()) return 0.0
        val converted = if (unit == "MILE") km / KM_PER_MILE else km
        return (converted * 100.0).roundToLong() / 100.0
    }

    fun toPiastres(majorAmount: Double): Long {
        if (!majorAmount.isFinite() || majorAmount < 0.0) return 0L
        return (majorAmount * 100.0).roundToLong()
    }

    fun formatMoney(piastres: Long, currencySymbol: String = "ج.م"): String {
        val whole = piastres / 100
        val frac = kotlin.math.abs(piastres % 100)
        return if (frac == 0L) "$whole $currencySymbol" else "$whole.${frac.toString().padStart(2, '0')} $currencySymbol"
    }
}

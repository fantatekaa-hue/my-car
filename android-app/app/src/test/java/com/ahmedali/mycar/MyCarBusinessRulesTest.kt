package com.ahmedali.mycar

import com.ahmedali.mycar.data.db.FuelEntryEntity
import com.ahmedali.mycar.domain.EgyptianPlateValidator
import com.ahmedali.mycar.domain.FuelCalculator
import com.ahmedali.mycar.domain.UnitConverter
import org.junit.Assert.*
import org.junit.Test

class MyCarBusinessRulesTest {

    @Test
    fun testEgyptianPlateValidation() {
        assertTrue(EgyptianPlateValidator.validate("س ب ع 1234").valid)
        assertTrue(EgyptianPlateValidator.validate("د هـ و 987").valid)
        assertTrue(EgyptianPlateValidator.validate("س ب 12").valid)
        assertTrue(EgyptianPlateValidator.validate("ABC 789").valid)
        assertTrue(EgyptianPlateValidator.validate("AB 1234").valid)
        assertTrue(EgyptianPlateValidator.validate("AB 12").valid)
        assertFalse(EgyptianPlateValidator.validate("A 123").valid)
        assertFalse(EgyptianPlateValidator.validate("AB 1").valid)
        assertFalse(EgyptianPlateValidator.validate("س ب C 123").valid)
    }

    @Test
    fun testKmMileInternalConversion() {
        val km = UnitConverter.toInternalKm(100.0, "MILE")
        assertEquals(160.934, km, 0.01)
        assertEquals(100.0, UnitConverter.fromInternalKm(km, "MILE"), 0.1)
    }

    @Test
    fun testFuelFullToFullAndPartialExclusion() {
        val entries = listOf(
            FuelEntryEntity("f1", "v1", "2026-10-01T08:00", 10000.0, "92", 40.0, 55000, 1375, "FULL", null, ""),
            FuelEntryEntity("f2", "v1", "2026-10-10T08:00", 10500.0, "92", 50.0, 75000, 1500, "FULL", null, ""),
            FuelEntryEntity("f3", "v1", "2026-10-15T08:00", 10700.0, "95", 15.0, 25500, 1700, "PARTIAL", null, ""),
            FuelEntryEntity("f4", "v1", "2026-10-20T08:00", 11000.0, "92", 25.0, 37500, 1500, "FULL", null, ""),
            FuelEntryEntity("f5", "v1", "2026-10-28T08:00", 11300.0, "92", 20.0, 30000, 1500, "FULL", null, "")
        )
        val result = FuelCalculator.calculate(entries)
        assertEquals(2, result.completedPeriodsCount)
        assertEquals(800.0, result.completedDistanceKm, 0.01)
        assertEquals(70.0, result.completedLiters, 0.01)
        assertEquals(800.0 / 70.0, result.overallKmPerLiter!!, 0.001)
        assertEquals(223000L, result.totalCostPiastres)
    }
}

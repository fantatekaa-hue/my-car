package com.ahmedali.mycar.domain

import com.ahmedali.mycar.data.db.CustomCatalogEntity

data class CatalogModel(val name: String, val years: List<Int>)
data class CatalogBrand(val brand: String, val sourceNote: String, val models: List<CatalogModel>)

object EgyptianCarCatalog {
    private fun years(start: Int, end: Int): List<Int> = (end downTo start).toList()

    fun mergeWithCustom(custom: List<CustomCatalogEntity>): List<CatalogBrand> {
        val merged = defaults.map { b ->
            b.copy(models = b.models.map { m -> m.copy(years = m.years.toList()) })
        }.toMutableList()

        for (entry in custom) {
            val brandIdx = merged.indexOfFirst { it.brand.equals(entry.brand.trim(), ignoreCase = true) }
            if (brandIdx == -1) {
                merged.add(
                    CatalogBrand(
                        brand = entry.brand.trim(),
                        sourceNote = "إدخال مخصص محفوظ محليًا",
                        models = listOf(CatalogModel(entry.model.trim(), listOf(entry.year)))
                    )
                )
            } else {
                val brandObj = merged[brandIdx]
                val models = brandObj.models.toMutableList()
                val modelIdx = models.indexOfFirst { it.name.equals(entry.model.trim(), ignoreCase = true) }
                if (modelIdx == -1) {
                    models.add(CatalogModel(entry.model.trim(), listOf(entry.year)))
                } else {
                    val mObj = models[modelIdx]
                    if (entry.year !in mObj.years) {
                        models[modelIdx] = mObj.copy(years = (mObj.years + entry.year).distinct().sortedDescending())
                    }
                }
                merged[brandIdx] = brandObj.copy(models = models)
            }
        }
        return merged
    }

    val defaults: List<CatalogBrand> = listOf(
        CatalogBrand("Hyundai", "GB Auto & Egyptian Market", listOf(
            CatalogModel("Elantra CN7", years(2021, 2026)),
            CatalogModel("Elantra AD", years(2016, 2026)),
            CatalogModel("Elantra HD", years(2007, 2025)),
            CatalogModel("Elantra MD", years(2011, 2016)),
            CatalogModel("Elantra (2000–2007)", years(2000, 2007)),
            CatalogModel("Accent RB", years(2011, 2026)),
            CatalogModel("Accent HCI", years(2018, 2026)),
            CatalogModel("Accent / New Accent", years(1998, 2011)),
            CatalogModel("Verna", years(2002, 2019)),
            CatalogModel("Tucson", years(2005, 2026)),
            CatalogModel("ix35", years(2010, 2016)),
            CatalogModel("Bayon", years(2022, 2026)),
            CatalogModel("Creta / Creta SU2", years(2016, 2026)),
            CatalogModel("Creta Grand", years(2022, 2026)),
            CatalogModel("i10 / Grand i10", years(2008, 2026)),
            CatalogModel("i20", years(2009, 2026)),
            CatalogModel("i30", years(2008, 2020)),
            CatalogModel("Matrix", years(2001, 2010)),
            CatalogModel("Getz", years(2003, 2011)),
            CatalogModel("Avante", years(2007, 2020)),
            CatalogModel("Solaris", years(2011, 2022)),
            CatalogModel("Atos", years(1999, 2008)),
            CatalogModel("Excel", years(1992, 1999)),
            CatalogModel("Sonata", years(2005, 2026)),
            CatalogModel("Santa Fe", years(2006, 2026)),
            CatalogModel("Kona", years(2019, 2026)),
            CatalogModel("Veloster", years(2012, 2020)),
            CatalogModel("Ioniq / Ioniq 5 / Ioniq 6", years(2017, 2026)),
            CatalogModel("H1", years(2008, 2023))
        )),
        CatalogBrand("Kia", "EIT & Egyptian Market", listOf(
            CatalogModel("Cerato", years(2004, 2020)),
            CatalogModel("Grand Cerato", years(2019, 2026)),
            CatalogModel("K3", years(2013, 2025)),
            CatalogModel("K4", years(2025, 2026)),
            CatalogModel("K5 / Optima", years(2006, 2026)),
            CatalogModel("Sportage", years(2005, 2026)),
            CatalogModel("Seltos", years(2020, 2026)),
            CatalogModel("Sonet", years(2021, 2026)),
            CatalogModel("XCeed", years(2021, 2026)),
            CatalogModel("Ceed", years(2008, 2025)),
            CatalogModel("Carens", years(2004, 2026)),
            CatalogModel("Soul", years(2009, 2024)),
            CatalogModel("Rio (Sedan / Hatchback)", years(2002, 2024)),
            CatalogModel("Picanto", years(2004, 2025)),
            CatalogModel("Pegas", years(2020, 2026)),
            CatalogModel("Sorento", years(2006, 2026)),
            CatalogModel("Carnival", years(2007, 2026)),
            CatalogModel("Sephia / Spectra / Shuma", years(1998, 2005)),
            CatalogModel("Pride", years(1996, 2005)),
            CatalogModel("Niro / EV6 / EV9", years(2018, 2026))
        )),
        CatalogBrand("Nissan", "Nissan Egypt & Egyptian Market", listOf(
            CatalogModel("Sunny N17", years(2013, 2026)),
            CatalogModel("Sunny N16 / Super Saloon", years(2000, 2014)),
            CatalogModel("Sentra", years(2014, 2026)),
            CatalogModel("Qashqai", years(2008, 2026)),
            CatalogModel("Juke", years(2011, 2026)),
            CatalogModel("Tiida (Sedan / Hatchback)", years(2006, 2016)),
            CatalogModel("X-Trail", years(2004, 2026)),
            CatalogModel("Kicks", years(2018, 2026)),
            CatalogModel("Navara / Pickup", years(2006, 2026)),
            CatalogModel("Patrol", years(2005, 2026)),
            CatalogModel("Bluebird / Sylphy", years(2006, 2022)),
            CatalogModel("Livina / Grand Livina", years(2008, 2016)),
            CatalogModel("Micra / March", years(2005, 2022)),
            CatalogModel("Altima / Maxima", years(2005, 2025)),
            CatalogModel("Urvan", years(2008, 2025))
        )),
        CatalogBrand("Mitsubishi", "Diamond Motors & Egyptian Market", listOf(
            CatalogModel("Lancer Shark", years(2008, 2019)),
            CatalogModel("Lancer Puma", years(2004, 2016)),
            CatalogModel("Lancer Kristala", years(1997, 2003)),
            CatalogModel("Lancer EX / Evo", years(2008, 2018)),
            CatalogModel("Eclipse Cross", years(2018, 2026)),
            CatalogModel("Xpander", years(2019, 2026)),
            CatalogModel("Xpander Cross", years(2021, 2026)),
            CatalogModel("Attrage", years(2014, 2026)),
            CatalogModel("Mirage", years(2013, 2026)),
            CatalogModel("Outlander / Outlander Sport", years(2007, 2026)),
            CatalogModel("ASX", years(2011, 2024)),
            CatalogModel("Pajero", years(2000, 2021)),
            CatalogModel("Montero Sport", years(2016, 2026)),
            CatalogModel("L200", years(2006, 2026)),
            CatalogModel("Colt / Galant / Grandis", years(1998, 2012))
        )),
        CatalogBrand("Toyota", "Toyota Egypt", listOf(
            CatalogModel("Corolla", years(2000, 2026)),
            CatalogModel("Yaris", years(2006, 2025)),
            CatalogModel("Belta", years(2022, 2025)),
            CatalogModel("Rumion", years(2022, 2026)),
            CatalogModel("Fortuner", years(2010, 2026)),
            CatalogModel("Rush", years(2018, 2025)),
            CatalogModel("Hilux", years(2005, 2026))
        )),
        CatalogBrand("Chevrolet", "Mansour Automotive", listOf(
            CatalogModel("Optra", years(2006, 2026)),
            CatalogModel("Aveo", years(2006, 2020)),
            CatalogModel("Lanos", years(2000, 2020)),
            CatalogModel("Cruze", years(2010, 2017)),
            CatalogModel("Captiva", years(2020, 2026))
        )),
        CatalogBrand("MG", "Mansour MG Automotive", listOf(
            CatalogModel("MG 5", years(2020, 2026)),
            CatalogModel("MG 6", years(2019, 2026)),
            CatalogModel("MG ZS", years(2019, 2026)),
            CatalogModel("MG HS", years(2020, 2026)),
            CatalogModel("MG RX5 / RX5 Plus", years(2019, 2026))
        )),
        CatalogBrand("Chery", "GB Auto - Chery Egypt", listOf(
            CatalogModel("Arrizo 5", years(2019, 2026)),
            CatalogModel("Tiggo 3 / 4 Pro / 7 Pro / 8 Pro", years(2018, 2026))
        )),
        CatalogBrand("Renault", "EIM - Renault Egypt", listOf(
            CatalogModel("Logan", years(2008, 2023)),
            CatalogModel("Sandero / Stepway", years(2010, 2024)),
            CatalogModel("Megane", years(2006, 2026)),
            CatalogModel("Duster", years(2012, 2026))
        )),
        CatalogBrand("Peugeot", "MANSCO - Peugeot Egypt", listOf(
            CatalogModel("301", years(2013, 2025)),
            CatalogModel("2008 / 3008 / 5008 / 508", years(2012, 2026))
        )),
        CatalogBrand("Opel", "Mansour Opel", listOf(
            CatalogModel("Astra / Corsa / Crossland / Mokka / Grandland", years(2006, 2026))
        )),
        CatalogBrand("Skoda", "Kayan Egypt", listOf(
            CatalogModel("Octavia", years(2000, 2026)),
            CatalogModel("Kodiaq / Karoq / Kamiq", years(2018, 2026))
        )),
        CatalogBrand("Suzuki", "Modern Motors", listOf(
            CatalogModel("Dzire", years(2018, 2026)),
            CatalogModel("Swift", years(2008, 2026)),
            CatalogModel("Ciaz / Baleno / Ertiga / Fronx", years(2015, 2026))
        )),
        CatalogBrand("Fiat", "Dynamics - Fiat Egypt", listOf(
            CatalogModel("Tipo", years(2016, 2026)),
            CatalogModel("500X / Punto", years(2008, 2025))
        )),
        CatalogBrand("BYD", "Al Amal - BYD Egypt", listOf(
            CatalogModel("F3 / L3", years(2010, 2026))
        )),
        CatalogBrand("BMW", "Global Auto - BMW Egypt", listOf(
            CatalogModel("318i / 320i / 330i / X1 / X3", years(2005, 2026))
        )),
        CatalogBrand("Mercedes-Benz", "Mercedes-Benz Egypt", listOf(
            CatalogModel("C180 / C200 / E200 / GLA / GLC", years(2005, 2026))
        ))
    )
}

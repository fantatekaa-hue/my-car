package com.ahmedali.mycar.domain

data class PlateValidationResult(
    val valid: Boolean,
    val normalized: String = "",
    val error: String? = null
)

object EgyptianPlateValidator {
    private val arabicDigitsMap = mapOf(
        '٠' to '0', '١' to '1', '٢' to '2', '٣' to '3', '٤' to '4',
        '٥' to '5', '٦' to '6', '٧' to '7', '٨' to '8', '٩' to '9'
    )

    private val patternAR = Regex("^([\\u0621-\\u064A]{2,3}[0-9]{2,4}|[0-9]{2,4}[\\u0621-\\u064A]{2,3})$")
    private val patternEN = Regex("^([A-Za-z]{2,3}[0-9]{2,4}|[0-9]{2,4}[A-Za-z]{2,3})$")

    fun validate(rawInput: String): PlateValidationResult {
        val trimmed = rawInput.trim()
        if (trimmed.isEmpty()) {
            return PlateValidationResult(false, error = "يرجى إدخال رقم اللوحة المصرية (2 إلى 3 حروف و2 إلى 4 أرقام).")
        }

        val compact = trimmed.replace(Regex("[\\s\\-\\u0640]+"), "")
        val normalizedChars = compact.map { arabicDigitsMap[it] ?: it }.joinToString("")

        val arLetters = normalizedChars.filter { it in '\u0621'..'\u064A' }
        val enLetters = normalizedChars.filter { it in 'A'..'Z' || it in 'a'..'z' }.uppercase()
        val digits = normalizedChars.filter { it in '0'..'9' }
        val other = normalizedChars.filterNot {
            it in '\u0621'..'\u064A' || it in 'A'..'Z' || it in 'a'..'z' || it in '0'..'9'
        }

        if (other.isNotEmpty()) {
            return PlateValidationResult(false, error = "اللوحة تحتوي على رموز غير مسموحة.")
        }
        if (arLetters.isNotEmpty() && enLetters.isNotEmpty()) {
            return PlateValidationResult(false, error = "لا تخلط بين الحروف العربية والإنجليزية في نفس اللوحة.")
        }

        val isValidPattern = patternAR.matches(normalizedChars) || patternEN.matches(normalizedChars)
        val letterCount = maxOf(arLetters.length, enLetters.length)
        if (!isValidPattern || letterCount !in 2..3 || digits.length !in 2..4) {
            return PlateValidationResult(
                false,
                error = "صيغة اللوحة المصرية الصحيحة: 2 أو 3 حروف مع 2 إلى 4 أرقام (مثال: س ب 12 أو س ب ع 1234)."
            )
        }

        val letters = (if (arLetters.isNotEmpty()) arLetters else enLetters).toCharArray().joinToString(" ")
        return PlateValidationResult(true, normalized = "$letters - $digits")
    }
}

package com.ahmedali.mycar.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

val CrimsonAccent = Color(0xFFE62E3D)
val CrimsonDark = Color(0xFFC81E2E)

@Immutable
data class MyCarColors(
    val canvas: Color,
    val surface: Color,
    val elevated: Color,
    val border: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val alertRed: Color,
    val alertYellow: Color,
    val alertGreen: Color
)

private val DarkMyCarColors = MyCarColors(
    canvas = Color(0xFF141D2B),
    surface = Color(0xFF1C2738),
    elevated = Color(0xFF25344A),
    border = Color(0xFF33445C),
    textPrimary = Color(0xFFF8FAFC),
    textSecondary = Color(0xFF9FB0C7),
    alertRed = Color(0xFFF87171),
    alertYellow = Color(0xFFFBBF24),
    alertGreen = Color(0xFF34D399)
)

private val LightMyCarColors = MyCarColors(
    canvas = Color(0xFFF3F7FC),
    surface = Color(0xFFFFFFFF),
    elevated = Color(0xFFEAF1FA),
    border = Color(0xFFD7E2F0),
    textPrimary = Color(0xFF0F172A),
    textSecondary = Color(0xFF475569),
    alertRed = Color(0xFFDC2626),
    alertYellow = Color(0xFFD97706),
    alertGreen = Color(0xFF059669)
)

val LocalMyCarColors = staticCompositionLocalOf { LightMyCarColors }

val ObsidianCanvas: Color
    @Composable get() = LocalMyCarColors.current.canvas

val GraphiteSurface: Color
    @Composable get() = LocalMyCarColors.current.surface

val ElevatedSlate: Color
    @Composable get() = LocalMyCarColors.current.elevated

val SubtleBorder: Color
    @Composable get() = LocalMyCarColors.current.border

val TextPrimary: Color
    @Composable get() = LocalMyCarColors.current.textPrimary

val TextSecondary: Color
    @Composable get() = LocalMyCarColors.current.textSecondary

val AlertRed: Color
    @Composable get() = LocalMyCarColors.current.alertRed

val AlertYellow: Color
    @Composable get() = LocalMyCarColors.current.alertYellow

val AlertGreen: Color
    @Composable get() = LocalMyCarColors.current.alertGreen

private val MyCarDarkColorScheme = darkColorScheme(
    primary = CrimsonAccent,
    onPrimary = Color.White,
    secondary = Color(0xFF25344A),
    onSecondary = Color(0xFFF8FAFC),
    background = Color(0xFF141D2B),
    onBackground = Color(0xFFF8FAFC),
    surface = Color(0xFF1C2738),
    onSurface = Color(0xFFF8FAFC),
    surfaceVariant = Color(0xFF25344A),
    onSurfaceVariant = Color(0xFF9FB0C7),
    outline = Color(0xFF33445C),
    error = Color(0xFFF87171)
)

private val MyCarLightColorScheme = lightColorScheme(
    primary = CrimsonAccent,
    onPrimary = Color.White,
    secondary = Color(0xFFEAF1FA),
    onSecondary = Color(0xFF0F172A),
    background = Color(0xFFF3F7FC),
    onBackground = Color(0xFF0F172A),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFEAF1FA),
    onSurfaceVariant = Color(0xFF475569),
    outline = Color(0xFFD7E2F0),
    error = Color(0xFFDC2626)
)

@Composable
fun MyCarTheme(isDarkTheme: Boolean = false, content: @Composable () -> Unit) {
    val customColors = if (isDarkTheme) DarkMyCarColors else LightMyCarColors
    val colorScheme = if (isDarkTheme) MyCarDarkColorScheme else MyCarLightColorScheme
    CompositionLocalProvider(LocalMyCarColors provides customColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            content = content
        )
    }
}


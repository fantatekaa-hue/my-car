-keepattributes *Annotation*
-keepclassmembers class * implements kotlinx.serialization.KSerializer {
    static ** INSTANCE;
}
-keep class com.ahmedali.mycar.data.backup.** { *; }

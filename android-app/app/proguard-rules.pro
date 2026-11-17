-keepattributes *Annotation*
-keepclassmembers class * implements kotlinx.serialization.KSerializer {
    static ** INSTANCE;
}
-keep class com.ahmedali.mycar.data.** { *; }
-keepclassmembers class com.ahmedali.mycar.data.** { *; }
-dontwarn kotlinx.serialization.**

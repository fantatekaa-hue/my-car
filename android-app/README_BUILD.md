# تعليمات بناء ملف APK النهائي — عربيتي | MY CAR

## لماذا لم يتم إخراج ملف APK داخل بيئة AI Studio؟
بيئة تنفيذ Google AI Studio Build الحالية هي حاوية **Linux (Debian 12) + Node.js / Vite** ولا تحتوي على **Java JDK** أو **Android SDK** أو **Gradle** أو **adb**.  
لذلك — والتزامًا بأمانة التسليم (البندان 1 و36.1 من الوثيقة) — لم يتم الادعاء بإنشاء APK داخل البيئة؛ وتم تجهيز مشروع Android الكامل في هذا المجلد ليكون جاهزًا للبناء الفوري.

---

## المواصفات المستهدفة
- **Package ID:** `com.ahmedali.mycar`
- **Minimum SDK:** Android 8.0 (`minSdk = 26`)
- **Target / Compile SDK:** Android 15 (`targetSdk = 35`, `compileSdk = 35`)
- **Version:** `versionCode = 1`, `versionName = "2.0.0"`

---

## خطوات بناء نسخة Release موقعة (`MyCar-Release.apk`)

### الطريقة الأولى: محليًا عبر Android Studio أو سطر الأوامر
1. افتح مجلد `android-app` في **Android Studio** (أو تأكد من تثبيت **JDK 17** و**Android SDK Platform 35**).
2. أنشئ مفتاح التوقيع (مرة واحدة فقط):
   ```bash
   keytool -genkey -v -keystore mycar-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias mycar_key
   ```
3. أنشئ ملف `keystore.properties` داخل `android-app/` بالمحتوى التالي:
   ```properties
   storeFile=mycar-release.jks
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=mycar_key
   keyPassword=YOUR_KEY_PASSWORD
   ```
4. شغّل الاختبارات وبناء Release APK:
   ```bash
   gradle testReleaseUnitTest
   gradle assembleRelease
   ```
   سيظهر الملف النهائي في:
   `app/build/outputs/apk/release/app-release.apk` (قم بإعادة تسميته إلى `MyCar-Release.apk`).

### الطريقة الثانية: البناء السحابي التلقائي عبر GitHub Actions (بدون تثبيت Android Studio)
تم تضمين ملف `.github/workflows/build-release-apk.yml` داخل جذر الأرشيف المضغوط:
1. فك الضغط عن `MyCar-Android-Project.zip` في مجلد على جهازك (تأكد من إظهار الملفات المخفية حتى يظهر مجلد `.github`).
2. أنشئ مستودعًا جديدًا (Repository) على GitHub (فرع `main`).
3. ارفع **كافة الملفات والمجلدات المستخرجة** (بما فيها مجلد `.github` وملف `build.gradle.kts` ومجلد `app/`) عبر `git push` أو GitHub Desktop أو رفع الملفات مباشرة في جذر المستودع.
4. افتح تبويب **Actions** داخل المستودع على GitHub: سيعمل Workflow باسم **Build MyCar APK** تلقائيًا (أو اضغط **Run workflow**).
5. بعد انتهاء البناء بالعلامة الخضراء، انزل إلى قسم **Artifacts** وحمّل ملف **`MyCar-Release-APK`** ثم فك ضغطه وثبّت **`MyCar-Release.apk`** على هاتفك.

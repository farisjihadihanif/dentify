# Dentify Mobile (Flutter, Android)

```bash
flutter pub get
flutter run                                                     # API produksi
flutter run --dart-define=API_URL=http://10.0.2.2:5000/api/v1   # emulator, API lokal
flutter analyze && flutter test
flutter test --dart-define=SHOTS=true --update-goldens          # cuplikan layar ke test/shots/
```

- `lib/config.dart`: `API_URL` (termasuk `/api/v1`), default API produksi.
- `lib/api.dart`: klien API; token Bearer disimpan di `flutter_secure_storage`.
- `lib/state.dart`: sesi, tab, tema.
- `lib/photo.dart`: kamera/galeri dan kompresi JPEG di bawah 3 MB.
- `lib/report_pdf.dart`: laporan PDF dibuat di perangkat. Server tidak menyimpan foto, jadi foto hanya ada di PDF tepat setelah scan.
- HTTP tanpa TLS hanya diizinkan di build debug.

## Rilis

1. Salin `android/key.properties.example` ke `android/key.properties` (tidak di-commit) dan isi password. Tanpa berkas itu APK memakai kunci debug; jangan diterbitkan.
2. Naikkan `version` di `pubspec.yaml` dan `appVersion` di `lib/config.dart`.
3. `flutter build apk --release`, lalu ubah nama `build/app/outputs/flutter-apk/app-release.apk` menjadi `Dentify.apk`.
4. Unggah ke GitHub Releases dengan tag `mobile-vX.Y.Z` (mis. `mobile-v1.0.0`).

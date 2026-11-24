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

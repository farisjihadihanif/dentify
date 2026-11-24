/// Alamat API (termasuk `/api/v1`). Ganti saat build/run:
///   flutter run --dart-define=API_URL=http://10.0.2.2:5000/api/v1
const String apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://dentifyd-api.vercel.app/api/v1',
);

String get apiBase => apiUrl.replaceAll(RegExp(r'/+$'), '');

const String appVersion = '1.0.0';
const String websiteUrl = 'https://dentifyd.vercel.app';

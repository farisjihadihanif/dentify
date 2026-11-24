import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'models.dart';

enum AuthStatus { unknown, signedOut, signedIn, offline }

class AppState extends ChangeNotifier {
  AppState(this.api) {
    api.onUnauthorized = () => unawaited(logout(expired: true));
  }

  final ApiClient api;
  AuthStatus status = AuthStatus.unknown;
  User? user;
  ThemeMode themeMode = ThemeMode.system;

  /// Pesan sekali tampil di layar masuk (mis. sesi berakhir).
  String? notice;

  int tab = 0;

  /// Naik setiap kali ada scan baru/terhapus supaya riwayat dimuat ulang.
  int scansVersion = 0;

  /// Hasil scan yang dibawa ke percakapan Deni baru.
  Scan? chatScan;
  int chatRequest = 0;

  Future<void> bootstrap() async {
    await _loadTheme();
    await api.loadToken();
    if (!api.hasToken) {
      _set(AuthStatus.signedOut);
      return;
    }
    await restore();
  }

  Future<void> restore() async {
    _set(AuthStatus.unknown);
    try {
      final r = await api.get('/auth/me');
      user = User((r['data'] as Json)['user'] as Json);
      _set(AuthStatus.signedIn);
    } on ApiException catch (e) {
      // 401 sudah ditangani onUnauthorized; selain itu token tetap disimpan.
      if (e.status != 401) _set(AuthStatus.offline);
    }
  }

  /// Bangunkan server dan layanan AI lebih awal; hasilnya tidak dipakai.
  Future<void> warmUp() async {
    try {
      await api.get('/health');
    } on ApiException {
      // Galat sebenarnya muncul saat fitur dipakai.
    }
  }

  Future<void> login(String email, String password) async =>
      _signIn(await api.post('/auth/login', {'email': email, 'password': password}, auth: false));

  Future<void> register(String name, String email, String password) async => _signIn(
    await api.post('/auth/register', {
      'full_name': name,
      'email': email,
      'password': password,
    }, auth: false),
  );

  Future<void> _signIn(Json r) async {
    final data = r['data'] as Json;
    await api.setToken(data['token'] as String);
    user = User(data['user'] as Json);
    notice = null;
    tab = 0;
    chatScan = null;
    _set(AuthStatus.signedIn);
  }

  Future<void> logout({bool expired = false}) async {
    if (expired) notice = 'Sesi Anda telah berakhir. Silakan masuk kembali.';
    user = null;
    chatScan = null;
    tab = 0;
    _set(AuthStatus.signedOut);
    await api.setToken(null);
  }

  Future<void> updateProfile(Json changes) async {
    final r = await api.put('/auth/me', changes);
    if (status != AuthStatus.signedIn) return;
    user = User((r['data'] as Json)['user'] as Json);
    notifyListeners();
  }

  void openTab(int i) {
    tab = i;
    notifyListeners();
  }

  void askDeni(Scan scan) {
    chatScan = scan;
    chatRequest++;
    openTab(2);
  }

  void scansChanged() {
    scansVersion++;
    notifyListeners();
  }

  Future<void> _loadTheme() async {
    try {
      final v = (await SharedPreferences.getInstance()).getString('theme');
      themeMode = ThemeMode.values.asNameMap()[v] ?? ThemeMode.system;
    } catch (_) {
      // Ikut sistem.
    }
  }

  Future<void> setTheme(ThemeMode m) async {
    themeMode = m;
    notifyListeners();
    try {
      await (await SharedPreferences.getInstance()).setString('theme', m.name);
    } catch (_) {
      // Hanya berlaku sampai aplikasi ditutup.
    }
  }

  void _set(AuthStatus s) {
    status = s;
    notifyListeners();
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
    : super(notifier: state);

  static AppState of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;

  /// Tanpa berlangganan perubahan (untuk callback dan initState).
  static AppState read(BuildContext context) =>
      context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'fonts.dart';
import 'screens/auth.dart';
import 'screens/shell.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets/common.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  setupFonts();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(DentifyApp(state: AppState(ApiClient())..bootstrap()));
}

class DentifyApp extends StatelessWidget {
  const DentifyApp({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) => AppScope(
    state: state,
    child: Builder(
      builder: (context) => MaterialApp(
        // Kunci berganti saat akun berganti: semua layar di atas Home ikut ditutup.
        key: ValueKey(AppScope.of(context).user?.id),
        title: 'Dentify',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: AppScope.of(context).themeMode,
        locale: const Locale('id', 'ID'),
        supportedLocales: const [Locale('id', 'ID')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        home: const RootGate(),
      ),
    ),
  );
}

class RootGate extends StatelessWidget {
  const RootGate({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return switch (state.status) {
      AuthStatus.signedIn => const HomeShell(),
      AuthStatus.signedOut => const AuthScreen(),
      AuthStatus.unknown => Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset('assets/brand/dentify-logo.png', height: 112),
              const SizedBox(height: 20),
              const CircularProgressIndicator(),
            ],
          ),
        ),
      ),
      AuthStatus.offline => Scaffold(
        body: SafeArea(
          child: Center(
            child: EmptyState(
              icon: Icons.cloud_off,
              title: 'Cannot Connect',
              body:
                  'Server Dentify belum dapat dihubungi. Periksa koneksi internet, lalu coba lagi.',
              action: FilledButton(onPressed: state.restore, child: const Text('Coba lagi')),
            ),
          ),
        ),
      ),
    };
  }
}

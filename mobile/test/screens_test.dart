import 'dart:convert';

import 'package:dentify/main.dart';
import 'package:dentify/models.dart';
import 'package:dentify/screens/result.dart';
import 'package:dentify/state.dart';
import 'package:dentify/theme.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

const _shots = bool.fromEnvironment('SHOTS');

Future<void> settle(WidgetTester t) async {
  for (var i = 0; i < 8; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

Future<void> shot(WidgetTester t, String name) async {
  if (!_shots) return;
  await t.runAsync(() async {
    for (final e in find.byType(Image).evaluate()) {
      await precacheImage((e.widget as Image).image, e);
    }
    await Future<void>.delayed(const Duration(milliseconds: 100));
  });
  await t.pump();
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('shots/$name.png'));
}

final _meta = {'page': 1, 'limit': 10, 'total': 1, 'total_pages': 1};

Future<http.Response> _handler(http.Request r) async {
  final p = r.url.path;
  if (p.endsWith('/scans')) {
    return jsonRes({
      'data': [
        scanJson(),
        scanJson(id: 'b', urgency: 'emergency'),
        scanJson(id: 'c', unsure: true),
      ],
      'meta': _meta,
    });
  }
  if (p.endsWith('/chat')) {
    return jsonRes({
      'data': {
        'session_id': 's1',
        'reply': '**Halo!** Sikat gigi:\n\n- pagi\n- malam',
        'urgency_level': 'emergency',
        'trigger_clinic_finder': true,
        'suggested_questions': ['Kapan ke dokter?'],
      },
    });
  }
  return jsonRes({'code': 'NOT_FOUND'}, 404);
}

void main() {
  setUpAll(loadFonts);
  setUp(() => SharedPreferences.setMockInitialValues({}));

  void phone(WidgetTester t, {double scale = 1}) {
    t.view.physicalSize = const Size(360, 740);
    t.view.devicePixelRatio = 1;
    t.platformDispatcher.textScaleFactorTestValue = scale;
    addTearDown(t.view.reset);
    addTearDown(t.platformDispatcher.clearAllTestValues);
  }

  for (final (mode, scale) in [
    (ThemeMode.light, 1.0),
    (ThemeMode.dark, 1.0),
    (ThemeMode.light, 1.5),
  ]) {
    final tag = '${mode.name}_$scale';
    testWidgets('all tabs fit a small phone ($tag)', (t) async {
      phone(t, scale: scale);
      final state = await signedInState(_handler);
      state.themeMode = mode;
      await t.pumpWidget(DentifyApp(state: state));
      await settle(t);
      expect(find.text('Dental Scan'), findsOneWidget);
      await shot(t, 'scan_$tag');

      state.openTab(1);
      await settle(t);
      expect(find.text('Belum meyakinkan'), findsOneWidget);
      await shot(t, 'history_$tag');

      state.openTab(2);
      await settle(t);
      await shot(t, 'chat_$tag');
      await t.enterText(find.byType(TextField).last, 'Gigi saya sakit');
      await t.tap(find.byTooltip('Kirim'));
      await settle(t);
      expect(find.textContaining('Halo!', findRichText: true), findsOneWidget);
      expect(find.text('Cari Klinik Terdekat'), findsOneWidget);
      await shot(t, 'chat_reply_$tag');

      state.openTab(4);
      await settle(t);
      expect(find.text('Rina Putri'), findsOneWidget);
      await shot(t, 'profile_$tag');
    });

    testWidgets('result and auth fit ($tag)', (t) async {
      phone(t, scale: scale);
      final state = await signedInState(_handler);
      Future<void> show(Widget w, String name) async {
        await t.pumpWidget(
          AppScope(
            state: state,
            child: MaterialApp(
              theme: buildTheme(mode == ThemeMode.dark ? Brightness.dark : Brightness.light),
              home: w,
            ),
          ),
        );
        await settle(t);
        await shot(t, name);
      }

      await show(ResultScreen(scan: Scan(scanJson(urgency: 'emergency'))), 'result_$tag');
      await show(ResultScreen(key: UniqueKey(), scan: Scan(scanJson(unsure: true))), 'unsure_$tag');
      expect(find.textContaining('87%'), findsNothing);
      await state.logout();
      await t.pumpWidget(DentifyApp(state: state..themeMode = mode));
      await settle(t);
      await t.tap(find.text('Belum punya akun? Daftar'));
      await settle(t);
      expect(find.text('Create Account'), findsOneWidget);
      await t.ensureVisible(find.text('Daftar'));
      await t.tap(find.text('Daftar'));
      await settle(t);
      expect(find.text('Nama lengkap minimal 2 karakter.'), findsOneWidget);
      await shot(t, 'auth_$tag');
    });
  }

  testWidgets('a failed Deni message returns to the composer', (t) async {
    phone(t);
    final state = await signedInState(
      (_) async => jsonRes({'code': 'AI_SERVICE_UNAVAILABLE'}, 503),
    );
    state.tab = 2;
    await t.pumpWidget(DentifyApp(state: state));
    await settle(t);
    await t.enterText(find.byType(TextField), 'Halo');
    await t.tap(find.byTooltip('Kirim'));
    await settle(t);
    expect(find.text('Halo'), findsOneWidget);
    expect(find.text('Coba lagi'), findsOneWidget);
  });

  testWidgets('Ask Deni starts a new chat linked to the scan', (t) async {
    phone(t);
    Map<String, dynamic>? body;
    final state = await signedInState((r) {
      if (r.method == 'POST') body = jsonDecode(r.body) as Map<String, dynamic>;
      return _handler(r);
    });
    await t.pumpWidget(DentifyApp(state: state));
    state.askDeni(Scan(scanJson()));
    await settle(t);
    await t.enterText(find.byType(TextField).last, 'Jelaskan');
    await t.tap(find.byTooltip('Kirim'));
    await settle(t);
    expect(body?['scan_id'], 'abc123456');
    expect(body?.containsKey('session_id'), isFalse);
  });
}

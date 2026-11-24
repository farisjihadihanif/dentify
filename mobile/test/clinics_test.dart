import 'dart:convert';

import 'package:dentify/screens/clinics.dart';
import 'package:dentify/state.dart';
import 'package:dentify/theme.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class _BlankTiles extends TileProvider {
  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) => MemoryImage(
    base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    ),
  );
}

void main() {
  setUpAll(loadFonts);
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('search by place lists clinics; empty place shows a notice', (t) async {
    t.view.physicalSize = const Size(360, 740);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    var found = true;
    final state = await signedInState((r) async {
      if (r.url.path.endsWith('/geocode')) {
        return jsonRes({
          'data': [
            if (found) {'display_name': 'Medan', 'latitude': 3.59, 'longitude': 98.67},
          ],
        });
      }
      expect(r.url.queryParameters['radius_km'], '5.0');
      return jsonRes({
        'source': 'directory_fallback',
        'data': [
          {
            'osm_id': 'n1',
            'name': 'Klinik Gigi Sehat',
            'address': 'Jl. Merdeka 1',
            'latitude': 3.591,
            'longitude': 98.671,
            'distance_km': 0.42,
            'phone': '+62 61 123',
            'opening_hours': null,
            'osm_url': 'https://www.openstreetmap.org',
          },
        ],
      });
    });
    await t.pumpWidget(
      AppScope(
        state: state,
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          home: ClinicsScreen(autoLocate: false, tileProvider: _BlankTiles()),
        ),
      ),
    );
    Future<void> search() async {
      await t.enterText(find.byType(TextField), 'Medan');
      await t.tap(find.byTooltip('Cari lokasi'));
      for (var i = 0; i < 10; i++) {
        await t.pump(const Duration(milliseconds: 100));
      }
    }

    await search();
    expect(find.textContaining('direktori Dentify'), findsOneWidget);
    expect(find.text('Klinik Gigi Sehat', skipOffstage: false), findsOneWidget);
    expect(find.textContaining('OpenStreetMap contributors'), findsOneWidget);

    found = false;
    await search();
    expect(find.textContaining('tidak ditemukan'), findsOneWidget);
  });
}

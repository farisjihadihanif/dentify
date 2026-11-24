import 'dart:convert';
import 'dart:io';

import 'package:dentify/api.dart';
import 'package:dentify/state.dart';
import 'package:dentify/theme.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

http.Response jsonRes(Object body, [int status = 200]) => http.Response.bytes(
  utf8.encode(jsonEncode(body)),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

const userJson = {
  'id': 'u1',
  'full_name': 'Rina Putri',
  'email': 'rina@contoh.id',
  'username': 'rina',
  'avatar': '',
  'role': 'user',
};

Json scanJson({String id = 'abc123456', String urgency = 'medium', bool unsure = false}) => {
  'id': id,
  'capture_source': 'camera',
  'user_symptoms': 'Ngilu saat minum dingin 😬',
  'primary_condition': 'caries',
  'condition_label': unsure
      ? 'Hasil Belum Meyakinkan – Silakan Ambil Ulang Foto'
      : 'Indikasi Karies Gigi (Gigi Berlubang)',
  'confidence_score': 0.87,
  'detections': [],
  'urgency_level': urgency,
  'trigger_clinic_finder': urgency == 'emergency',
  'is_low_confidence': unsure,
  'care_recommendations': {
    'summary': 'Ada indikasi gigi berlubang. Periksakan dalam 1–2 minggu.',
    'dos': ['Sikat gigi dua kali sehari.', 'Gunakan pasta gigi berfluoride.'],
    'donts': ['Jangan mengunyah di sisi yang sakit.'],
  },
  'medical_disclaimer': 'Hasil ini bukan diagnosis medis.',
  'model_version': 'm1',
  'created_at': '2026-11-24T11:00:00.000Z',
};

Future<AppState> signedInState(Future<http.Response> Function(http.Request) handler) async {
  final state = AppState(
    ApiClient(
      tokens: MemoryTokenStore('tok'),
      baseUrl: 'https://api.test/api/v1',
      client: MockClient((r) async {
        if (r.url.path.endsWith('/auth/me') && r.method == 'GET') {
          return jsonRes({
            'data': {'user': userJson},
          });
        }
        if (r.url.path.endsWith('/health')) return jsonRes({'success': true});
        return handler(r);
      }),
    ),
  );
  await state.bootstrap();
  return state;
}

/// Muat font asli supaya ukuran teks di tes sama dengan di perangkat.
Future<void> loadFonts() async {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  // google_fonts memuat font secara asinkron; tunggu sebelum tes pertama.
  buildTheme(Brightness.light);
  await GoogleFonts.pendingFonts();
  final icons = File(
    '${Platform.environment['FLUTTER_ROOT']}/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  if (icons.existsSync()) {
    await (FontLoader(
      'MaterialIcons',
    )..addFont(Future.value(ByteData.sublistView(icons.readAsBytesSync())))).load();
  }
  await Future<void>.delayed(const Duration(milliseconds: 300));
}

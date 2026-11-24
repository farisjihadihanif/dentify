import 'package:dentify/api.dart';
import 'package:dentify/models.dart';
import 'package:dentify/photo.dart';
import 'package:dentify/report_pdf.dart';
import 'package:dentify/state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

ApiClient client(MockClientHandler h, {TokenStore? tokens}) =>
    ApiClient(client: MockClient(h), tokens: tokens ?? MemoryTokenStore(), baseUrl: 'https://a/v1');

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('sends the stored token as Bearer', () async {
    String? header;
    final api = client((r) async {
      header = r.headers['Authorization'];
      return jsonRes({'success': true});
    }, tokens: MemoryTokenStore('tok'));
    await api.loadToken();
    await api.get('/scans');
    expect(header, 'Bearer tok');
  });

  test('login stores the token; wrong password does not end a session', () async {
    final tokens = MemoryTokenStore();
    var ok = false;
    final state = AppState(
      client(
        (_) async => ok
            ? jsonRes({
                'data': {'token': 'new', 'user': userJson},
              })
            : jsonRes({'code': 'UNAUTHENTICATED', 'message': 'Email atau password salah.'}, 401),
        tokens: tokens,
      ),
    );
    await expectLater(
      state.login('a@b.id', 'x'),
      throwsA(isA<ApiException>().having((e) => e.message, 'm', 'Email atau password salah.')),
    );
    expect(state.notice, isNull);
    ok = true;
    await state.login('a@b.id', 'x');
    expect(tokens.token, 'new');
    expect(state.status, AuthStatus.signedIn);
  });

  test('401 on a protected call signs out and clears the token', () async {
    final tokens = MemoryTokenStore('old');
    final state = AppState(
      client((_) async => jsonRes({'code': 'UNAUTHENTICATED'}, 401), tokens: tokens),
    );
    await state.bootstrap();
    await Future<void>.delayed(Duration.zero);
    expect(state.status, AuthStatus.signedOut);
    expect(tokens.token, isNull);
    expect(state.notice, isNotNull);
  });

  test('network failure keeps the token', () async {
    final tokens = MemoryTokenStore('old');
    final state = AppState(client((_) async => throw http.ClientException('x'), tokens: tokens));
    await state.bootstrap();
    expect(state.status, AuthStatus.offline);
    expect(tokens.token, 'old');
  });

  test('maps errors', () {
    expect(ApiClient.parseError(504, const {}).isWaking, isTrue);
    expect(ApiClient.parseError(503, const {'code': 'AI_SERVICE_UNAVAILABLE'}).isWaking, isTrue);
    expect(ApiClient.parseError(500, const {}).code, 'INTERNAL_ERROR');
    final e = ApiClient.parseError(422, const {
      'code': 'VALIDATION_ERROR',
      'errors': {
        'email': ['Email sudah terdaftar.'],
      },
    });
    expect(e.fields['email'], 'Email sudah terdaftar.');
  });

  test('scaling bounds the long side and never enlarges', () {
    expect(shortSideFor(4000, 3000, 2048), 1536);
    expect(shortSideFor(3000, 4000, 2048), 1536);
    expect(shortSideFor(800, 600, 2048), 600);
  });

  test('time is shown in WIB', () {
    expect(formatWib(DateTime.utc(2026, 11, 24, 18, 5)), '25 November 2026, 01.05 WIB');
  });

  test('PDF report is built, including emoji symptoms and unsure results', () async {
    for (final unsure in [false, true]) {
      final pdf = await buildScanReport(Scan(scanJson(unsure: unsure)));
      expect(String.fromCharCodes(pdf.take(5)), '%PDF-');
    }
  });
}

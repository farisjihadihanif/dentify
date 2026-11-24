import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'config.dart';

typedef Json = Map<String, dynamic>;

/// Galat API. [status] 0 = tidak ada jawaban dari server.
class ApiException implements Exception {
  ApiException(this.code, {this.status = 0, String? message, this.fields = const {}})
    : message = message ?? _messages[code] ?? _messages['UNKNOWN_ERROR']!;

  final int status;
  final String code;
  final String message;

  /// Galat per isian, mis. `{email: 'Email sudah terdaftar.'}`.
  final Map<String, String> fields;

  /// Server (atau layanan AI) kemungkinan sedang dinyalakan; coba lagi sebentar lagi.
  bool get isWaking => code == 'SERVER_WAKING' || code == 'AI_SERVICE_UNAVAILABLE';

  @override
  String toString() => message;
}

const _messages = {
  'UNAUTHENTICATED': 'Sesi Anda telah berakhir. Silakan masuk kembali.',
  'PAYLOAD_TOO_LARGE': 'Ukuran foto terlalu besar. Silakan pilih foto lain.',
  'INVALID_IMAGE': 'Format foto tidak didukung. Gunakan foto JPG, PNG, atau WEBP.',
  'LOW_QUALITY_IMAGE':
      'Foto kurang jelas atau terlalu gelap. Ambil ulang foto di tempat yang terang dengan gigi yang bersih.',
  'NOT_DENTAL_IMAGE':
      'Foto ini bukan foto gigi atau rongga mulut. Ambil foto close-up gigi dan gusi yang terlihat jelas.',
  'RATE_LIMITED': 'Permintaan terlalu cepat. Mohon tunggu sebentar sebelum mencoba lagi.',
  'AI_SERVICE_UNAVAILABLE':
      'Layanan analisis AI sedang dinyalakan. Tunggu sekitar 1 menit, lalu coba lagi.',
  'AI_AUTH_FAILED': 'Layanan AI menolak kunci akses server. Hubungi pengelola Dentify.',
  'AI_SERVICE_ERROR': 'Layanan AI gagal memproses permintaan. Silakan coba lagi.',
  'SERVER_NOT_READY': 'Server belum siap. Silakan coba lagi sebentar lagi.',
  'BAD_REQUEST': 'Permintaan tidak valid. Periksa kembali data Anda.',
  'FORBIDDEN': 'Anda tidak memiliki hak akses untuk data ini.',
  'NOT_FOUND': 'Data yang Anda cari tidak ditemukan.',
  'VALIDATION_ERROR': 'Beberapa isian belum sesuai. Mohon periksa kembali.',
  'INTERNAL_ERROR': 'Terjadi kendala pada server. Silakan coba beberapa saat lagi.',
  'NETWORK_ERROR': 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
  'SERVER_WAKING': 'Server sedang dinyalakan. Tunggu sekitar 1 menit, lalu coba lagi.',
  'UNKNOWN_ERROR': 'Terjadi kendala pada sistem. Silakan coba kembali.',
};

/// Kode yang pesan backend-nya lebih jelas daripada pesan umum.
const _useBackendMessage = {
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'FORBIDDEN',
  'NOT_FOUND',
  'AI_AUTH_FAILED',
  'AI_SERVICE_ERROR',
  'SERVER_NOT_READY',
};

abstract class TokenStore {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  static const _key = 'auth_token';
  final _storage = const FlutterSecureStorage();

  @override
  Future<String?> read() async {
    try {
      return await _storage.read(key: _key);
    } on PlatformException {
      // Kunci enkripsi perangkat tidak cocok lagi: anggap belum masuk.
      return null;
    }
  }

  @override
  Future<void> write(String token) => _storage.write(key: _key, value: token);

  @override
  Future<void> clear() => _storage.delete(key: _key);
}

class MemoryTokenStore implements TokenStore {
  MemoryTokenStore([this.token]);
  String? token;

  @override
  Future<String?> read() async => token;
  @override
  Future<void> write(String token) async => this.token = token;
  @override
  Future<void> clear() async => token = null;
}

/// Klien API dengan `Authorization: Bearer <token>`.
class ApiClient {
  ApiClient({http.Client? client, TokenStore? tokens, String? baseUrl})
    : _http = client ?? http.Client(),
      _tokens = tokens ?? SecureTokenStore(),
      _base = baseUrl ?? apiBase;

  static const normalTimeout = Duration(seconds: 30);

  /// Scan dan Deni bisa menunggu layanan AI bangun; backend menyerah setelah 90 detik.
  static const aiTimeout = Duration(seconds: 115);

  final http.Client _http;
  final TokenStore _tokens;
  final String _base;
  String? _token;

  bool get hasToken => _token != null;

  /// Dipanggil saat token yang sedang dipakai ditolak (401).
  void Function()? onUnauthorized;

  Future<void> loadToken() async {
    final t = await _tokens.read();
    _token = (t == null || t.isEmpty) ? null : t;
  }

  Future<void> setToken(String? token) async {
    _token = token;
    if (token == null) {
      await _tokens.clear();
    } else {
      await _tokens.write(token);
    }
  }

  Uri _uri(String path, [Map<String, Object>? query]) {
    final u = Uri.parse('$_base$path');
    if (query == null) return u;
    return u.replace(queryParameters: query.map((k, v) => MapEntry(k, '$v')));
  }

  Future<Json> get(String path, {Map<String, Object>? query}) =>
      _send(http.Request('GET', _uri(path, query)));

  Future<Json> delete(String path) => _send(http.Request('DELETE', _uri(path)));

  Future<Json> post(
    String path,
    Object body, {
    Duration timeout = normalTimeout,
    bool auth = true,
  }) => _json('POST', path, body, timeout, auth);

  Future<Json> put(String path, Object body) => _json('PUT', path, body, normalTimeout, true);

  Future<Json> _json(String method, String path, Object body, Duration timeout, bool auth) {
    final req = http.Request(method, _uri(path))
      ..headers['Content-Type'] = 'application/json; charset=utf-8'
      ..body = jsonEncode(body);
    return _send(req, timeout: timeout, auth: auth);
  }

  Future<Json> upload(
    String path, {
    required String field,
    required List<int> bytes,
    required String filename,
    Map<String, String> fields = const {},
    Duration timeout = aiTimeout,
  }) {
    final req = http.MultipartRequest('POST', _uri(path))
      ..fields.addAll(fields)
      ..files.add(http.MultipartFile.fromBytes(field, bytes, filename: filename));
    return _send(req, timeout: timeout);
  }

  Future<Json> _send(
    http.BaseRequest req, {
    Duration timeout = normalTimeout,
    bool auth = true,
  }) async {
    final token = auth ? _token : null;
    req.headers['Accept'] = 'application/json';
    if (token != null) req.headers['Authorization'] = 'Bearer $token';

    final http.Response res;
    try {
      res = await _http.send(req).then(http.Response.fromStream).timeout(timeout);
    } on TimeoutException {
      throw ApiException('SERVER_WAKING');
    } on IOException {
      throw ApiException('NETWORK_ERROR');
    } on http.ClientException {
      throw ApiException('NETWORK_ERROR');
    }

    Object? data;
    try {
      data = jsonDecode(utf8.decode(res.bodyBytes));
    } on FormatException {
      data = null;
    }
    final map = data is Json ? data : const <String, dynamic>{};
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (map.isEmpty) throw ApiException('UNKNOWN_ERROR', status: res.statusCode);
      return map;
    }

    final error = parseError(res.statusCode, map);
    // Abaikan 401 dari permintaan lama yang tokennya sudah diganti.
    if (res.statusCode == 401 && token != null && token == _token) onUnauthorized?.call();
    throw error;
  }

  static ApiException parseError(int status, Json body) {
    final raw = body['code'];
    final String code = raw is String && _messages.containsKey(raw)
        ? raw
        : switch (status) {
            400 => 'BAD_REQUEST',
            401 => 'UNAUTHENTICATED',
            403 => 'FORBIDDEN',
            404 => 'NOT_FOUND',
            413 => 'PAYLOAD_TOO_LARGE',
            429 => 'RATE_LIMITED',
            504 => 'SERVER_WAKING',
            >= 500 => 'INTERNAL_ERROR',
            _ => 'UNKNOWN_ERROR',
          };
    final text = body['message'];
    final useText =
        text is String &&
        (_useBackendMessage.contains(code) || text == 'Email atau password salah.');
    final fields = <String, String>{};
    final errors = body['errors'];
    if (errors is Map) {
      for (final e in errors.entries) {
        final v = e.value;
        if (v is List && v.isNotEmpty) fields['${e.key}'] = '${v.first}';
      }
    }
    return ApiException(code, status: status, message: useText ? text : null, fields: fields);
  }
}

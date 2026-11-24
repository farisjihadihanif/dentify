import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image_picker/image_picker.dart';

import 'api.dart';

/// Vercel menolak body di atas 4,5 MB; foto 3 MB masih muat sebagai base64 di chat.
const maxPhotoBytes = 3 * 1024 * 1024;

class Photo {
  const Photo(this.bytes, {required this.fromCamera});

  /// JPEG.
  final Uint8List bytes;
  final bool fromCamera;
}

/// Panjang sisi pendek keluaran bila sisi terpanjang dibatasi [longSide]. Tidak memperbesar.
int shortSideFor(int width, int height, int longSide) {
  final scale = min(1.0, longSide / max(width, height));
  return max(1, (min(width, height) * scale).round());
}

/// Kompres menjadi JPEG maksimal [maxBytes] (kualitas diturunkan dulu, baru ukuran).
Future<Uint8List> compressJpeg(
  String path, {
  int maxBytes = maxPhotoBytes,
  List<int> longSides = const [2048, 1600, 1280, 1024],
}) async {
  final int width, height;
  try {
    final buffer = await ui.ImmutableBuffer.fromFilePath(path);
    final descriptor = await ui.ImageDescriptor.encoded(buffer);
    width = descriptor.width;
    height = descriptor.height;
    descriptor.dispose();
    buffer.dispose();
  } catch (_) {
    throw ApiException('INVALID_IMAGE');
  }
  try {
    for (final side in longSides) {
      // minWidth/minHeight plugin ini membatasi sisi pendek, jadi aman untuk rotasi EXIF.
      final short = shortSideFor(width, height, side);
      for (final quality in const [92, 85, 78]) {
        final out = await FlutterImageCompress.compressWithFile(
          path,
          minWidth: short,
          minHeight: short,
          quality: quality,
        );
        if (out == null || out.isEmpty) throw ApiException('INVALID_IMAGE');
        if (out.length <= maxBytes) return out;
      }
    }
  } on ApiException {
    rethrow;
  } catch (_) {
    throw ApiException('INVALID_IMAGE');
  }
  throw ApiException('PAYLOAD_TOO_LARGE');
}

final _picker = ImagePicker();

/// Ambil foto lalu kompres. Null bila dibatalkan.
Future<Photo?> pickPhoto({required bool camera}) async {
  final XFile? file;
  try {
    file = await _picker.pickImage(
      source: camera ? ImageSource.camera : ImageSource.gallery,
      requestFullMetadata: false,
    );
  } on PlatformException {
    throw ApiException(
      'PHOTO',
      message: camera
          ? 'Kamera tidak dapat dibuka. Periksa izin kamera atau pilih dari galeri.'
          : 'Galeri tidak dapat dibuka. Silakan coba lagi.',
    );
  }
  if (file == null) return null;
  return _load(file, camera);
}

Future<Photo> _load(XFile file, bool camera) async {
  try {
    return Photo(await compressJpeg(file.path), fromCamera: camera);
  } finally {
    // Salinan sementara di cache; foto gigi tidak perlu ditinggalkan di sana.
    try {
      await File(file.path).delete();
    } catch (_) {}
  }
}

/// Android bisa menutup aplikasi saat kamera terbuka; ambil kembali fotonya.
Future<Photo?> recoverLostPhoto() async {
  if (!Platform.isAndroid) return null;
  try {
    final lost = await _picker.retrieveLostData();
    final file = lost.file;
    return file == null ? null : await _load(file, true);
  } catch (_) {
    return null;
  }
}

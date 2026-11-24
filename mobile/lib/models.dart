import 'api.dart';

enum Urgency {
  low('Perawatan Mandiri', 'Rawat mandiri'),
  medium('Disarankan Periksa ke Dokter Gigi (1–2 minggu)', 'Periksa dalam 1–2 minggu'),
  emergency('Segera ke Dokter Gigi', 'Segera ke dokter gigi');

  const Urgency(this.label, this.shortLabel);
  final String label;
  final String shortLabel;

  static Urgency parse(Object? v) => switch (v) {
    'emergency' => emergency,
    'medium' => medium,
    _ => low,
  };
}

class User {
  User(Json j)
    : id = '${j['id']}',
      fullName = '${j['full_name'] ?? ''}',
      email = '${j['email'] ?? ''}',
      username = j['username'] as String?,
      avatar = '${j['avatar'] ?? ''}';

  final String id, fullName, email, avatar;
  final String? username;
}

List<String> _strings(Object? v) => v is List ? [for (final e in v) '$e'] : const [];
DateTime _date(Object? v) => DateTime.tryParse('$v') ?? DateTime.fromMillisecondsSinceEpoch(0);

class Scan {
  Scan(Json j)
    : id = j['id'] as String?,
      source = '${j['capture_source']}',
      symptoms = '${j['user_symptoms'] ?? ''}',
      label = '${j['condition_label'] ?? ''}',
      confidence = (j['confidence_score'] as num? ?? 0).toDouble(),
      urgency = Urgency.parse(j['urgency_level']),
      needsClinic = j['trigger_clinic_finder'] == true,
      unsure = j['is_low_confidence'] == true,
      summary = '${(j['care_recommendations'] as Map?)?['summary'] ?? ''}',
      dos = _strings((j['care_recommendations'] as Map?)?['dos']),
      donts = _strings((j['care_recommendations'] as Map?)?['donts']),
      disclaimer = '${j['medical_disclaimer'] ?? ''}',
      createdAt = _date(j['created_at']);

  final String? id;
  final String source, symptoms, label, summary, disclaimer;
  final double confidence;
  final Urgency urgency;
  final bool needsClinic;

  /// Di bawah ambang keyakinan: jangan tampilkan tebakan model.
  final bool unsure;
  final List<String> dos, donts;
  final DateTime createdAt;

  int get percent => (confidence * 100).round();
  String get sourceLabel => source == 'camera' ? 'Kamera' : 'Galeri';

  String get confidenceMeaning {
    if (confidence >= 0.85) {
      return 'Indikasi visual cukup kuat pada foto ini, namun tetap memerlukan pemeriksaan dokter gigi.';
    }
    if (confidence >= 0.75) {
      return 'Indikasi visual cukup jelas pada foto ini; gunakan sebagai skrining awal.';
    }
    return 'Indikasi visual masih lemah; gunakan hanya sebagai gambaran awal dan periksakan ke dokter gigi.';
  }
}

class ChatSession {
  ChatSession(Json j)
    : id = '${j['id']}',
      title = '${j['title'] ?? ''}',
      updatedAt = _date(j['updated_at']);
  final String id, title;
  final DateTime updatedAt;
}

class Clinic {
  Clinic(Json j)
    : id = '${j['osm_id']}',
      name = '${j['name'] ?? ''}',
      address = j['address'] as String?,
      lat = (j['latitude'] as num).toDouble(),
      lng = (j['longitude'] as num).toDouble(),
      distanceKm = (j['distance_km'] as num? ?? 0).toDouble(),
      phone = j['phone'] as String?,
      hours = j['opening_hours'] as String?;

  final String id, name;
  final String? address, phone, hours;
  final double lat, lng, distanceKm;

  Uri get directions => Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
}

const _months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', //
  'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/// Waktu Jakarta, sama dengan web.
String formatWib(DateTime t) {
  final d = t.toUtc().add(const Duration(hours: 7));
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.day} ${_months[d.month - 1]} ${d.year}, ${two(d.hour)}.${two(d.minute)} WIB';
}

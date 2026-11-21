export const DISCLAIMER_SCAN =
  'Penting: DentHub adalah alat skrining awal berbasis AI untuk pencegahan dan bukan pengganti diagnosis dokter gigi. Hasil ini bukan diagnosis medis. Segera kunjungi dokter gigi jika Anda merasakan nyeri hebat atau pembengkakan.';

export const DISCLAIMER_CHAT =
  'Saran Deni bersifat edukatif dan tidak menggantikan pemeriksaan langsung oleh dokter gigi.';

export const CONDITIONS = ['caries', 'calculus', 'gingivitis', 'healthy'] as const;
export type DentalCondition = (typeof CONDITIONS)[number];

export const KNOWLEDGE_KEYS = ['caries', 'calculus', 'gingivitis', 'healthy', 'general'] as const;
export type KnowledgeKey = (typeof KNOWLEDGE_KEYS)[number];

export const URGENCY_LEVELS = ['low', 'medium', 'emergency'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const CAPTURE_SOURCES = ['camera', 'upload'] as const;
export type CaptureSource = (typeof CAPTURE_SOURCES)[number];

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CONDITION_LABELS: Record<DentalCondition, string> = {
  caries: 'Indikasi Karies Gigi (Gigi Berlubang)',
  calculus: 'Indikasi Karang Gigi',
  gingivitis: 'Indikasi Radang Gusi (Gingivitis)',
  healthy: 'Gigi dan Gusi Tampak Sehat',
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const MIN_IMAGE_DIMENSION = 64;
export const MAX_CHAT_MESSAGES = 50;
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const SEVERE_SYMPTOM_KEYWORDS = [
  'nyeri hebat',
  'berdenyut',
  'bengkak',
  'nanah',
  'abses',
  'demam',
  'pendarahan',
  'berdarah terus',
  'sulit membuka mulut',
  'sakit tidak tertahankan',
  'tidak bisa tidur',
] as const;

export const STATIC_FALLBACK_CHAT_REPLY =
  'Maaf, Deni sedang mengalami gangguan koneksi sementara sehingga belum dapat memproses pertanyaan Anda secara mendalam. ' +
  'Untuk sementara, jaga kebersihan gigi dengan menyikat gigi secara lembut dua kali sehari menggunakan pasta gigi berfluoride dan berkumur air hangat. ' +
  'Jika Anda mengalami nyeri hebat, gigi berdenyut, pembengkakan, demam, atau perdarahan yang tidak berhenti, segera kunjungi dokter gigi terdekat.';

export const STATIC_FALLBACK_SUGGESTIONS = [
  'Bagaimana cara menyikat gigi yang benar setiap hari?',
  'Kapan sebaiknya saya memeriksakan gigi ke dokter gigi?',
];

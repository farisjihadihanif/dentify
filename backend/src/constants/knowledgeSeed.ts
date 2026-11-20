import type { KnowledgeKey } from './domain';

export interface KnowledgeSeedItem {
  condition_key: KnowledgeKey;
  title: string;
  description: string;
  dos: string[];
  donts: string[];
  emergency_signs: string[];
}

export const DENTAL_KNOWLEDGE_SEED: KnowledgeSeedItem[] = [
  {
    condition_key: 'caries',
    title: 'Panduan Perawatan Awal Indikasi Karies Gigi (Gigi Berlubang)',
    description:
      'Karies gigi adalah kerusakan pada lapisan luar gigi (email) akibat asam dari bakteri yang memecah sisa gula. Deteksi dini membantu mencegah lubang melebar hingga mencapai saraf gigi.',
    dos: [
      'Sikat gigi dengan lembut dua kali sehari menggunakan pasta gigi berfluoride.',
      'Berkumur air hangat setelah makan untuk membantu membersihkan sisa makanan dan gula.',
      'Gunakan benang gigi (dental floss) secara rutin untuk membersihkan sela-sela gigi.',
      'Jadwalkan pemeriksaan ke dokter gigi untuk evaluasi dan penanganan seperti penambalan.',
    ],
    donts: [
      'Jangan mengorek atau menusuk area gigi yang diduga berlubang dengan benda tajam.',
      'Hindari makanan dan minuman yang terlalu manis, asam, panas, atau dingin sementara waktu.',
      'Jangan menunda kunjungan ke dokter gigi jika mulai muncul rasa ngilu atau berdenyut.',
    ],
    emergency_signs: [
      'Nyeri gigi hebat atau berdenyut yang mengganggu tidur.',
      'Pembengkakan pada gusi, pipi, atau wajah.',
      'Muncul nanah atau rasa tidak enak dari area sekitar gigi.',
      'Demam yang menyertai sakit gigi atau kesulitan membuka mulut.',
    ],
  },
  {
    condition_key: 'calculus',
    title: 'Panduan Perawatan Awal Indikasi Karang Gigi',
    description:
      'Karang gigi (kalkulus) adalah plak yang mengeras di permukaan gigi atau di sepanjang garis gusi. Karang gigi yang sudah mengeras tidak dapat dibersihkan hanya dengan sikat gigi dan memerlukan pembersihan profesional (scaling).',
    dos: [
      'Sikat gigi dua kali sehari selama dua menit dengan sikat berbulu lembut, terutama di dekat garis gusi.',
      'Gunakan benang gigi setiap hari untuk mencegah penumpukan plak baru di sela gigi.',
      'Jadwalkan tindakan pembersihan karang gigi (scaling) di klinik dokter gigi dalam 1–2 minggu.',
    ],
    donts: [
      'Jangan mencoba mengikis atau mencungkil karang gigi sendiri dengan alat tajam atau logam.',
      'Hindari menyikat gigi terlalu keras karena dapat melukai gusi dan mengikis email.',
      'Batasi kebiasaan merokok serta konsumsi kopi atau teh manis berlebihan tanpa berkumur air putih.',
    ],
    emergency_signs: [
      'Gusi bengkak hebat, sangat nyeri, atau keluar nanah di sekitar karang gigi.',
      'Gigi mulai terasa goyang disertai nyeri saat mengunyah.',
      'Perdarahan gusi terus-menerus yang tidak berhenti.',
    ],
  },
  {
    condition_key: 'gingivitis',
    title: 'Panduan Perawatan Awal Indikasi Radang Gusi (Gingivitis)',
    description:
      'Gingivitis adalah peradangan awal pada gusi yang ditandai dengan gusi tampak kemerahan, bengkak ringan, atau mudah berdarah saat menyikat gigi. Pada tahap awal, kondisi ini dapat membaik dengan kebersihan mulut yang tepat dan pemeriksaan dokter gigi.',
    dos: [
      'Sikat gigi secara lembut menggunakan sikat gigi berbulu halus dua kali sehari.',
      'Berkumur dengan larutan air garam hangat secara perlahan untuk membantu menenangkan gusi.',
      'Periksakan kondisi gusi ke dokter gigi untuk membersihkan plak penyebab radang.',
    ],
    donts: [
      'Jangan berhenti menyikat gigi hanya karena gusi sedikit berdarah; tetap sikat dengan sangat lembut.',
      'Hindari obat kumur beralkohol tinggi atau pasta gigi yang terlalu abrasif jika terasa perih.',
      'Hindari rokok dan makanan terlalu keras atau pedas yang dapat mengiritasi gusi.',
    ],
    emergency_signs: [
      'Pembengkakan gusi meluas ke pipi atau disertai demam.',
      'Perdarahan gusi banyak dan tidak kunjung berhenti.',
      'Nyeri hebat disertai munculnya nanah di tepi gusi.',
    ],
  },
  {
    condition_key: 'healthy',
    title: 'Panduan Menjaga Kesehatan Gigi dan Gusi',
    description:
      'Gigi dan gusi Anda tampak dalam kondisi sehat pada skrining visual awal ini. Pertahankan kebiasaan kebersihan mulut yang baik serta pemeriksaan berkala ke dokter gigi untuk pencegahan jangka panjang.',
    dos: [
      'Sikat gigi dua kali sehari (pagi setelah sarapan dan malam sebelum tidur) dengan pasta gigi berfluoride.',
      'Bersihkan sela gigi menggunakan benang gigi (dental floss) minimal sekali sehari.',
      'Perbanyak minum air putih dan batasi camilan tinggi gula di luar waktu makan utama.',
      'Lakukan pemeriksaan rutin ke dokter gigi setiap 6 bulan sekali.',
    ],
    donts: [
      'Jangan menggunakan gigi untuk membuka kemasan atau menggigit benda keras seperti es batu.',
      'Hindari kebiasaan tidur tanpa menyikat gigi setelah makan atau minum manis.',
      'Jangan mengabaikan tanda awal seperti ngilu ringan atau gusi berdarah meskipun sebelumnya tampak sehat.',
    ],
    emergency_signs: [
      'Tiba-tiba muncul nyeri gigi berdenyut atau pembengkakan di gusi maupun pipi.',
      'Cedera pada gigi seperti gigi patah atau lepas akibat benturan.',
      'Perdarahan di rongga mulut yang tidak berhenti.',
    ],
  },
  {
    condition_key: 'general',
    title: 'Panduan Umum Kebersihan Mulut dan Kapan Harus ke Dokter Gigi',
    description:
      'Kesehatan gigi dan mulut berperan penting bagi kesehatan tubuh secara keseluruhan. Skrining mandiri membantu mengenali tanda awal masalah gigi, tetapi pemeriksaan langsung oleh dokter gigi tetap diperlukan untuk diagnosis dan perawatan pasti.',
    dos: [
      'Sikat gigi dua kali sehari selama dua menit menggunakan sikat berbulu lembut dan pasta gigi berfluoride.',
      'Ganti sikat gigi setiap 3 bulan sekali atau segera setelah bulu sikat mekar.',
      'Rutin periksa ke dokter gigi setiap 6 bulan sekali meski tidak ada keluhan.',
    ],
    donts: [
      'Jangan mengonsumsi obat pereda nyeri atau antibiotik tanpa anjuran tenaga medis atau dokter gigi.',
      'Jangan menunda pemeriksaan bila gejala tidak membaik dalam beberapa hari.',
      'Hindari penggunaan bahan rumah tangga yang keras atau asam langsung pada gigi.',
    ],
    emergency_signs: [
      'Nyeri gigi hebat atau berdenyut terus-menerus.',
      'Pembengkakan pada gusi, pipi, wajah, atau leher.',
      'Demam yang menyertai keluhan gigi atau kesulitan menelan dan membuka mulut.',
      'Keluarnya nanah (abses) atau perdarahan yang tidak berhenti.',
    ],
  },
];

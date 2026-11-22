import type { ArticleCategory } from '../models/Article';

export interface ArticleSeedItem {
  title: string;
  slug: string;
  category: ArticleCategory;
  summary: string;
  content: string;
  coverImageUrl: string;
  isPublished: boolean;
  authorName: string;
  publishedAt: Date;
}

export const INITIAL_ARTICLES_SEED: readonly ArticleSeedItem[] = [
  // =========================================================================
  // PROMO (3 published items)
  // =========================================================================
  {
    title: 'Promo Skrining Gigi AI Gratis & Voucher Scaling 25% Mitra RSGM',
    slug: 'promo-skrining-gigi-gratis-voucher-scaling-25',
    category: 'Promo',
    summary:
      'Manfaatkan pemeriksaan gigi awal gratis di Dentify dan tunjukkan kartu laporan PNG Anda untuk menikmati potongan biaya scaling rutin di klinik mitra.',
    content:
      'Menjaga kebersihan karang gigi secara berkala adalah investasi terbaik untuk mencegah radang gusi dan gigi berlubang. Melalui program Bulan Kesehatan Gigi Preventif Dentify, Anda dapat melakukan skrining gigi mandiri tanpa biaya langsung dari ponsel.\n\nSetelah mengunduh laporan hasil skrining (format PNG) di halaman /scan, bawa laporan tersebut saat mendaftar pemeriksaan di klinik gigi atau RSGM mitra terdekat. Pasien yang menunjukkan laporan skrining preventif berhak memperoleh potongan hingga 25% untuk tindakan pembersihan karang gigi (scaling ultrasonik) dan konsultasi awal.\n\nProgram ini berlaku hingga akhir bulan bagi pengguna terdaftar Dentify. Jadwalkan kunjungan Anda sekarang melalui fitur Pencari Klinik Terdekat agar gigi dan gusi tetap sehat sepanjang tahun.',
    coverImageUrl: '/images/covers/promo-scaling.svg',
    isPublished: true,
    authorName: 'Tim Kemitraan Dentify',
    publishedAt: new Date('2026-11-20T08:00:00.000Z'),
  },
  {
    title: 'Paket Kontrol Keluarga: Cek Gigi Anak & Dewasa Lebih Hemat',
    slug: 'paket-kontrol-keluarga-cek-gigi-anak-dewasa',
    category: 'Promo',
    summary:
      'Ajak seluruh anggota keluarga memeriksakan kesehatan gigi bersama setiap 6 bulan sekali dengan paket konsultasi preventif dan edukasi sikat gigi anak.',
    content:
      'Kebiasaan merawat gigi sejak dini sangat menentukan kesehatan rongga mulut hingga usia dewasa. Banyak anak merasa cemas saat pertama kali mengunjungi dokter gigi karena datang dalam kondisi gigi sudah nyeri.\n\nMelalui Paket Kontrol Keluarga, klinik mitra menyediakan sesi pemeriksaan menyeluruh yang ramah anak, aplikasi fluoride topikal untuk memperkuat email gigi susu, serta pembersihan plak ringan bagi orang tua dalam satu kunjungan.\n\nGunakan Dentify di rumah untuk membiasakan evaluasi kondisi gigi secara visual sebelum berangkat ke klinik agar pengalaman pemeriksaan terasa tenang dan menyenangkan.',
    coverImageUrl: '/images/covers/promo-keluarga.svg',
    isPublished: true,
    authorName: 'Tim Kemitraan Dentify',
    publishedAt: new Date('2026-11-18T09:00:00.000Z'),
  },
  {
    title: 'Konsultasi Awal Tambal Karies Dini Tanpa Antre Panjang',
    slug: 'konsultasi-awal-tambal-karies-dini-tanpa-antre',
    category: 'Promo',
    summary:
      'Deteksi dini bercak gelap pada gigi membantu penambalan komposit lebih cepat, nyaman, dan jauh lebih hemat dibandingkan perawatan saluran akar.',
    content:
      'Lubang gigi tahap awal sering kali tidak menimbulkan rasa nyeri sehingga baru disadari ketika sudah dalam. Penanganan dini dengan tambalan resin komposit sewarna gigi umumnya selesai dalam satu kunjungan singkat.\n\nUnduh hasil skrining awal Anda di Dentify, lalu manfaatkan jalur pendaftaran terjadwal di klinik gigi terdekat melalui halaman Klinik agar Anda mendapatkan estimasi waktu tunggu yang lebih pasti.',
    coverImageUrl: '/images/covers/promo-karies.svg',
    isPublished: true,
    authorName: 'Tim Kemitraan Dentify',
    publishedAt: new Date('2026-11-15T10:00:00.000Z'),
  },

  // =========================================================================
  // BERITA (3 published items)
  // =========================================================================
  {
    title: 'Dentify Luncurkan Model AI Skrining Gigi Generasi Baru Berbasis OpenCV CLAHE',
    slug: 'dentify-luncurkan-model-ai-skrining-gigi-clahe',
    category: 'Berita',
    summary:
      'Pembaruan model Deep Learning Dentify memanfaatkan peningkatan kontras LAB CLAHE untuk membantu mengenali indikasi karies, karang gigi, dan gingivitis dengan lebih konsisten.',
    content:
      'Dentify resmi menghadirkan pembaruan pipeline Computer Vision yang menggabungkan normalisasi pencahayaan OpenCV LAB CLAHE dengan arsitektur CNN kustom TensorFlow/Keras.\n\nDalam pengujian internal terkontrol pada ratusan foto intraoral bebas kebocoran data, penggunaan preprocessing CLAHE terbukti meningkatkan akurasi pengenalan visual secara signifikan dibandingkan foto tanpa koreksi pencahayaan.\n\nMeski demikian, Dentify menegaskan bahwa seluruh keluaran AI bersifat skrining awal non-diagnostik dan selalu disertai panduan tindak lanjut menuju dokter gigi profesional.',
    coverImageUrl: '/images/covers/berita-ai.svg',
    isPublished: true,
    authorName: 'Redaksi Teknologi Dentify',
    publishedAt: new Date('2026-11-19T07:30:00.000Z'),
  },
  {
    title: 'Kemenkes RI Ingatkan Pentingnya Pemeriksaan Gigi Rutin Tiap 6 Bulan',
    slug: 'kemenkes-ri-ingatkan-pemeriksaan-gigi-rutin-6-bulan',
    category: 'Berita',
    summary:
      'Mayoritas masyarakat Indonesia baru mendatangi dokter gigi ketika nyeri hebat muncul; skrining mandiri dan kontrol rutin menjadi kunci pencegahan.',
    content:
      'Data kesehatan nasional menunjukkan bahwa gangguan gigi berlubang dan radang gusi masih menjadi keluhan rongga mulut tertinggi di Indonesia, namun tingkat kunjungan preventif ke dokter gigi masih rendah.\n\nKementerian Kesehatan RI terus mengampanyekan kebiasaan menyikat gigi dua kali sehari dengan pasta gigi berfluoride (pagi setelah sarapan dan malam sebelum tidur) serta pemeriksaan klinis minimal setiap 6 bulan sekali.\n\nKehadiran alat bantu edukasi digital seperti Dentify dan peta klinik gigi berbasis OpenStreetMap diharapkan membantu masyarakat lebih cepat mengenali tanda awal masalah gigi sebelum berkembang menjadi infeksi darurat.',
    coverImageUrl: '/images/covers/berita-kemenkes.svg',
    isPublished: true,
    authorName: 'Redaksi Kesehatan Dentify',
    publishedAt: new Date('2026-11-16T08:15:00.000Z'),
  },
  {
    title: 'Integrasi Peta OpenStreetMap & Direktori RSGM Kini Cakup Kota Besar Indonesia',
    slug: 'integrasi-peta-osm-direktori-rsgm-indonesia',
    category: 'Berita',
    summary:
      'Fitur Pencari Klinik Dentify kini dilengkapi rotasi server Overpass dan direktori klinik/RSGM terkurasi agar peta tetap informatif di segala kondisi jaringan.',
    content:
      'Untuk mendukung akses cepat menuju fasilitas kesehatan gigi saat kondisi darurat, Dentify memperbarui layanan pencarian lokasi klinik dengan mekanisme rotasi multi-mirror Overpass OpenStreetMap serta direktori cadangan RSGM dan klinik gigi di berbagai kota besar Indonesia.\n\nPengguna di Yogyakarta, Jakarta, Bandung, Surabaya, Semarang, Solo, Malang, Medan, Makassar, hingga Denpasar kini dapat menemukan titik klinik terdekat beserta estimasi jarak Haversine dan tautan rute langsung ke OpenStreetMap.',
    coverImageUrl: '/images/covers/berita-klinik.svg',
    isPublished: true,
    authorName: 'Redaksi Produk Dentify',
    publishedAt: new Date('2026-11-14T11:00:00.000Z'),
  },

  // =========================================================================
  // ARTIKEL (4 published items preserving core dental health articles)
  // =========================================================================
  {
    title: 'Pemeriksaan Rutin & Scaling Karang Gigi (Tiap 6 Bulan)',
    slug: 'pemeriksaan-rutin-scaling-karang-gigi',
    category: 'Artikel',
    summary:
      'Karang gigi (calculus) yang telah mengeras tidak dapat dibersihkan hanya dengan sikat gigi biasa. Pelajari mengapa scaling ultrasonik tiap 6 bulan penting bagi gusi Anda.',
    content:
      'Menurut World Health Organization (WHO), penyakit rongga mulut seperti karies dan penyakit gusi merupakan masalah kesehatan yang paling umum di dunia, namun sebagian besar dapat dicegah melalui kebersihan gigi harian dan pemeriksaan berkala. Plak gigi terbentuk terus-menerus dari lapisan bakteri dan sisa makanan; apabila tidak dibersihkan sempurna dalam 24–72 jam, mineral air liur akan mengeraskannya menjadi karang gigi (calculus).\n\nKementerian Kesehatan RI (Kemenkes RI) menganjurkan pemeriksaan kesehatan gigi dan mulut secara rutin setiap 6 bulan sekali. Begitu plak mengeras menjadi karang gigi di sepanjang garis gusi, menyikat gigi lebih keras tidak dapat menghilangkannya dan justru berisiko menyebabkan abrasi email serta resesi gusi.\n\nDi klinik gigi, dokter gigi melakukan prosedur scaling menggunakan alat ultrasonic scaler yang memancarkan getaran mikro dan semprotan air steril untuk melepaskan karang gigi secara aman. Pembersihan rutin membantu mencegah radang gusi (gingivitis) berkembang menjadi periodontitis yang dapat menggoyangkan gigi.',
    coverImageUrl: '/images/covers/artikel-scaling.svg',
    isPublished: true,
    authorName: 'Tim Edukasi Dentify',
    publishedAt: new Date('2026-11-17T06:00:00.000Z'),
  },
  {
    title: 'Penambalan Karies Dini & Konservasi Struktur Gigi',
    slug: 'penambalan-karies-dini-konservasi-gigi',
    category: 'Artikel',
    summary:
      'Lubang gigi tahap awal sering muncul tanpa nyeri. Kenali proses terbentuknya karies dan manfaat penanganan restoratif sebelum mencapai saraf gigi.',
    content:
      'American Dental Association (ADA) menjelaskan bahwa karies gigi terjadi ketika bakteri plak mengubah gula dari makanan dan minuman menjadi asam yang secara bertahap melarutkan mineral email gigi. Pada tahap paling awal, lesi karies sering muncul sebagai bercak putih kapur atau bayangan gelap ringan tanpa rasa sakit.\n\nJika terdeteksi dini sebelum menembus lapisan dentin dalam, dokter gigi dapat melakukan tindakan konservasi berupa pembersihan jaringan karies lalu menutup kavitas menggunakan resin komposit sewarna gigi. Prosedur ini mempertahankan struktur alami gigi dan biasanya selesai dalam satu kali kunjungan.\n\nMenunda pemeriksaan hingga karies mencapai ruang pulpa (saraf gigi) dapat memicu nyeri spontan hebat, pembengkakan, serta membutuhkan perawatan saluran akar (endodontik) yang lebih kompleks.',
    coverImageUrl: '/images/covers/artikel-karies.svg',
    isPublished: true,
    authorName: 'Tim Edukasi Dentify',
    publishedAt: new Date('2026-11-13T06:00:00.000Z'),
  },
  {
    title: 'Tanda Darurat Gigi yang Memerlukan Penanganan Segera',
    slug: 'tanda-darurat-gigi-penanganan-segera',
    category: 'Artikel',
    summary:
      'Ketahui perbedaan keluhan gigi ringan dengan tanda bahaya medis seperti abses, pembengkakan pipi, demam, atau pendarahan gusi yang tidak berhenti.',
    content:
      'Panduan darurat kedokteran gigi dari American Dental Association (ADA) membedakan keluhan yang dapat dijadwalkan rutin dengan kondisi darurat yang memerlukan penanganan segera. Infeksi bakteri dari gigi berlubang dalam dapat menyebar ke jaringan sekitar akar dan membentuk abses (kantong nanah).\n\nTanda bahaya yang tidak boleh ditunda mencakup pembengkakan pada gusi, pipi, atau rahang; demam yang menyertai sakit gigi; nyeri berdenyut tajam yang mengganggu tidur; pendarahan gusi yang tidak kunjung berhenti; serta gigi patah atau lepas akibat benturan.\n\nSambil menuju fasilitas layanan gigi terdekat, hindari menusuk gusi yang bengkak, hindari kompres hangat di area pipi bengkak, dan gunakan kompres dingin di luar pipi selama 10–15 menit untuk meredakan rasa tidak nyaman sementara.',
    coverImageUrl: '/images/covers/artikel-darurat.svg',
    isPublished: true,
    authorName: 'Tim Edukasi Dentify',
    publishedAt: new Date('2026-11-12T06:00:00.000Z'),
  },
  {
    title: 'Persiapan Praktis Sebelum Berkunjung ke Dokter Gigi',
    slug: 'persiapan-praktis-sebelum-ke-dokter-gigi',
    category: 'Artikel',
    summary:
      'Langkah sederhana sebelum pemeriksaan—mulai dari mencatat pola ngilu hingga menyiapkan laporan skrining Dentify—agar konsultasi berjalan efektif.',
    content:
      'Komunikasi yang jelas antara pasien dan dokter gigi berperan penting dalam menentukan rencana perawatan yang tepat. Sebelum berkunjung ke klinik, catat sejak kapan keluhan muncul, pemicu ngilu (dingin, panas, manis, atau saat mengunyah), serta lokasi gigi yang terasa mengganggu.\n\nBila Anda sudah melakukan skrining mandiri menggunakan Dentify, unduh kartu laporan hasil skrining (PNG) di perangkat Anda. Meskipun hasil AI bersifat skrining awal non-diagnostik, catatan gejala dan dokumentasi visual yang terstruktur membantu dokter gigi menggali riwayat keluhan lebih cepat.\n\nPastikan Anda juga menyampaikan riwayat penyakit sistemik, obat rutin yang sedang dikonsumsi, status kehamilan, serta riwayat alergi obat sebelum prosedur dimulai.',
    coverImageUrl: '/images/covers/artikel-persiapan.svg',
    isPublished: true,
    authorName: 'Tim Edukasi Dentify',
    publishedAt: new Date('2026-11-11T06:00:00.000Z'),
  },
];

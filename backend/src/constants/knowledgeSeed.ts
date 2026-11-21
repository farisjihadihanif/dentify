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
    title: 'Panduan Perawatan Awal Indikasi Karang Gigi & Plak (Kalkulus Dental)',
    description:
      'Karang gigi (kalkulus dental) adalah penumpukan plak yang mengeras di permukaan gigi atau di sepanjang garis gusi. Karang gigi yang sudah mengeras tidak dapat dibersihkan hanya dengan sikat gigi dan memerlukan tindakan pembersihan profesional (scaling) oleh dokter gigi.',
    dos: [
      'Jadwalkan tindakan pembersihan karang gigi profesional (scaling) di klinik dokter gigi dalam 1–2 minggu.',
      'Sikat gigi dua kali sehari selama dua menit dengan pasta gigi berfluoride dan sikat berbulu lembut, diarahkan lembut pada garis gusi.',
      'Lakukan pembersihan sela gigi (interdental cleaning) setiap hari menggunakan benang gigi (dental floss) atau sikat interdental untuk mencegah plak baru mengeras.',
      'Berkumur dengan air putih atau obat kumur anti-plak non-alkohol setelah makan untuk membantu mengendalikan bakteri pembentuk plak.',
    ],
    donts: [
      'Jangan mencoba mengikis, mengerok, atau mencungkil karang gigi sendiri dengan alat tajam, pinset, atau logam.',
      'Hindari menyikat gigi terlalu keras karena dapat melukai gusi yang meradang dan mengikis lapisan email gigi.',
      'Batasi kebiasaan merokok serta konsumsi kopi, teh manis, atau camilan tinggi gula tanpa berkumur air putih setelahnya.',
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
  {
    condition_key: 'periodontitis',
    title: 'Panduan Perawatan Awal Periodontitis (Penyakit Gusi Lanjut)',
    description:
      'Periodontitis adalah infeksi gusi tingkat lanjut yang merusak jaringan penyangga dan tulang di sekitar gigi. Kondisi ini sering diawali dari gingivitis dan karang gigi yang tidak ditangani sehingga memicu gusi surut, kantong gusi dalam, hingga gigi goyang.',
    dos: [
      'Segera jadwalkan pemeriksaan dokter gigi atau spesialis periodonsia untuk pembersihan mendalam (scaling & root planing).',
      'Sikat gigi secara sangat lembut dua kali sehari dengan sikat berbulu ultra-soft serta bersihkan sela gigi dengan benang gigi atau sikat interdental.',
      'Hentikan kebiasaan merokok dan kendalikan kadar gula darah bila memiliki riwayat diabetes untuk mendukung pemulihan jaringan gusi.',
    ],
    donts: [
      'Jangan menggoyangkan atau mencoba mencabut sendiri gigi yang mulai longgar.',
      'Hindari menyikat gusi terlalu keras atau menggunakan tusuk gigi kayu yang dapat melukai kantong gusi.',
      'Jangan menunda pemeriksaan medis meskipun tidak selalu disertai rasa nyeri hebat.',
    ],
    emergency_signs: [
      'Keluarnya nanah di antara gigi dan gusi disertai bau mulut tajam.',
      'Pembengkakan gusi meluas atau gigi goyang mendadak saat mengunyah.',
      'Demam atau nyeri berdenyut di sepanjang rahang.',
    ],
  },
  {
    condition_key: 'dental_abscess',
    title: 'Panduan Tindak Lanjut Abses Gigi (Infeksi Bernanah)',
    description:
      'Abses gigi adalah kantong nanah akibat infeksi bakteri pada akar gigi atau jaringan gusi. Abses tidak dapat sembuh sendiri dan memerlukan drainase serta perawatan langsung oleh dokter gigi agar infeksi tidak menyebar ke jaringan wajah atau leher.',
    dos: [
      'Segera kunjungi dokter gigi atau IGD terdekat pada hari yang sama untuk penanganan infeksi yang tepat.',
      'Berkumur perlahan dengan larutan air garam hangat untuk membantu menjaga kebersihan rongga mulut sementara waktu.',
      'Kompres dingin dari luar pipi selama 10–15 menit untuk membantu meredakan rasa bengkak sebelum tiba di klinik.',
    ],
    donts: [
      'Jangan memencet, menusuk, atau memecahkan benjolan nanah di gusi sendiri.',
      'Jangan mengonsumsi antibiotik tanpa resep dan evaluasi langsung dari dokter gigi.',
      'Hindari kompres panas pada pipi karena dapat memperparah pembengkakan dan penyebaran infeksi.',
    ],
    emergency_signs: [
      'Pembengkakan pipi, rahang, kelopak mata, atau leher yang makin membesar.',
      'Demam tinggi, menggigil, sulit menelan, sulit membuka mulut, atau sesak napas.',
      'Nyeri berdenyut hebat yang tidak mereda.',
    ],
  },
  {
    condition_key: 'dentin_hypersensitivity',
    title: 'Panduan Perawatan Awal Gigi Sensitif (Hipersensitivitas Dentin)',
    description:
      'Gigi sensitif menimbulkan rasa ngilu tajam dan singkat saat terkena minuman dingin, panas, manis, asam, atau embusan udara akibat lapisan dentin terbuka karena menipisnya email atau turunnya garis gusi.',
    dos: [
      'Gunakan pasta gigi khusus gigi sensitif (mengandung potassium nitrate atau stannous fluoride) secara rutin dua kali sehari.',
      'Gunakan sikat gigi berbulu lembut dengan gerakan melingkar ringan tanpa menekan terlalu kuat.',
      'Periksakan ke dokter gigi bila rasa ngilu menetap lebih dari 2 minggu untuk memastikan bukan akibat karies atau retakan gigi.',
    ],
    donts: [
      'Hindari menyikat gigi langsung setelah mengonsumsi makanan atau minuman asam; tunggu minimal 30 menit dan berkumur air putih dahulu.',
      'Batasi minuman bersoda, buah terlalu asam, dan suhu ekstrem saat gigi sedang sensitif.',
      'Hindari pasta gigi pemutih yang terlalu abrasif.',
    ],
    emergency_signs: [
      'Ngilu berubah menjadi nyeri menetap lebih dari 30 detik atau berdenyut spontan di malam hari.',
      'Muncul pembengkakan gusi atau nyeri hebat saat menggigit.',
    ],
  },
  {
    condition_key: 'tooth_wear',
    title: 'Panduan Keausan Gigi (Erosi, Abrasi & Bruksisme)',
    description:
      'Keausan gigi dapat disebabkan oleh paparan asam (erosi), gesekan sikat terlalu keras (abrasi), atau kebiasaan menggertakkan gigi saat tidur/stres (bruksisme) yang membuat permukaan kunyah rata, tipis, atau ngilu.',
    dos: [
      'Konsultasikan ke dokter gigi mengenai pelindung gigi malam (night guard) jika sering bangun dengan rahang pegal atau pasangan mendengar bunyi gertakan gigi.',
      'Gunakan teknik menyikat gigi lembut dengan sikat berbulu halus dan pasta gigi berfluoride untuk membantu remineralisasi email.',
      'Perbanyak minum air putih setelah makan atau minum asam serta kelola stres sebelum tidur.',
    ],
    donts: [
      'Hindari kebiasaan menggigit pulpen, kuku, es batu, atau membuka kemasan dengan gigi.',
      'Jangan mengonsumsi minuman berkarbonasi atau asam dengan cara dikulum terlalu lama di mulut.',
      'Jangan mengabaikan gejala rahang kaku di pagi hari atau gigi tampak makin pendek.',
    ],
    emergency_signs: [
      'Gigi menipis hingga patah atau menimbulkan nyeri tajam saat mengunyah.',
      'Sendi rahang terkunci atau sangat nyeri saat membuka mulut.',
    ],
  },
  {
    condition_key: 'cracked_tooth',
    title: 'Panduan Pertolongan Awal Gigi Retak atau Patah',
    description:
      'Gigi retak atau patah sering menimbulkan nyeri tajam saat menggigit atau melepaskan gigitan. Retakan yang tidak segera diperiksa dapat meluas hingga saraf gigi dan memicu infeksi.',
    dos: [
      'Segera jadwalkan pemeriksaan ke dokter gigi agar retakan dapat dievaluasi dan dilindungi sebelum melebar.',
      'Berkumur perlahan dengan air hangat bersih; jika ada potongan gigi patah yang besar, simpan dalam susu dingin atau larutan salin dan bawa ke dokter gigi.',
      'Kunyah makanan lunak menggunakan sisi rahang yang sehat hingga gigi diperiksa.',
    ],
    donts: [
      'Jangan menggigit makanan keras atau lengket pada sisi gigi yang terasa retak.',
      'Hindari mengoleskan lem, bahan kimia rumah tangga, atau mengikir tepi gigi yang tajam sendiri.',
      'Jangan menunda pemeriksaan bila muncul ngilu saat melepaskan gigitan.',
    ],
    emergency_signs: [
      'Perdarahan dari bagian tengah gigi atau gusi yang tidak berhenti.',
      'Nyeri berdenyut hebat, gigi goyang parah, atau trauma wajah akibat benturan.',
    ],
  },
  {
    condition_key: 'wisdom_tooth_impaction',
    title: 'Panduan Impaksi Gigi Bungsu & Maloklusi (Susunan Gigi Tidak Rapi)',
    description:
      'Gigi bungsu yang tumbuh miring atau terjebak sebagian di bawah gusi (impaksi) rentan memerangkap sisa makanan dan memicu radang gusi (perikoronitis). Susunan gigi berjejal (maloklusi) juga menyulitkan pembersihan plak.',
    dos: [
      'Jaga kebersihan area geraham belakang dengan sikat berkepala kecil dan berkumur air garam hangat bila gusi belakang terasa tidak nyaman.',
      'Konsultasikan ke dokter gigi untuk foto rontgen panoramik guna menilai posisi gigi bungsu atau kebutuhan perawatan ortodonti.',
      'Lakukan kontrol rutin setiap 6 bulan agar penumpukan plak di area gigi berjejal tetap terkendali.',
    ],
    donts: [
      'Jangan menusuk atau mengorek lipatan gusi di sekitar gigi bungsu dengan tusuk gigi atau benda tajam.',
      'Hindari mengonsumsi obat pereda nyeri berlebihan tanpa evaluasi dokter bila nyeri berulang.',
      'Jangan menunda pemeriksaan jika mulut mulai sulit dibuka lebar.',
    ],
    emergency_signs: [
      'Pembengkakan pipi atau sudut rahang belakang disertai kesulitan membuka mulut (trismus).',
      'Demam, nyeri menelan, atau keluar nanah dari gusi belakang.',
    ],
  },
  {
    condition_key: 'edentulism_implants',
    title: 'Panduan Gigi Hilang, Gigi Tiruan & Implan Gigi',
    description:
      'Kehilangan satu atau lebih gigi yang dibiarkan lama dapat membuat gigi di sebelahnya bergeser, mengganggu fungsi kunyah, dan mempercepat penyusutan tulang rahang. Dokter gigi dapat membantu memilih opsi penggantian seperti gigi tiruan lepasan, jembatan (bridge), atau implan.',
    dos: [
      'Konsultasikan opsi penggantian gigi yang sesuai dengan kondisi tulang rahang dan kesehatan umum Anda ke dokter gigi.',
      'Jika memakai gigi tiruan lepasan, lepas dan bersihkan setiap malam menggunakan sikat lembut khusus dan rendam dalam air bersih.',
      'Tetap jaga kebersihan gusi, lidah, dan gigi yang tersisa agar jaringan penyangga tetap sehat.',
    ],
    donts: [
      'Jangan memakai gigi tiruan lepasan yang sudah longgar, retak, atau melukai gusi tanpa penyesuaian dokter gigi.',
      'Jangan membersihkan gigi tiruan dengan air mendidih atau pemutih rumah tangga.',
      'Hindari jasa pasang gigi tiruan non-medis tanpa izin praktik dokter gigi.',
    ],
    emergency_signs: [
      'Luka terbuka atau pembengkakan bernanah di sekitar area implan atau bawah gigi tiruan.',
      'Implan terasa goyang disertai nyeri saat mengunyah.',
    ],
  },
  {
    condition_key: 'oral_lesions_tmd',
    title: 'Panduan Lesi Mulut (Sariawan) & Gangguan Sendi Rahang (TMD)',
    description:
      'Sariawan ringan umumnya pulih dalam 7–14 hari, tetapi lesi putih/merah atau luka yang tidak sembuh lebih dari 2 minggu wajib diperiksa dokter gigi. Gangguan sendi rahang (TMD) ditandai bunyi klik, pegal rahang, atau nyeri saat mengunyah.',
    dos: [
      'Untuk sariawan ringan, berkumur lembut dengan air garam hangat dan perbanyak air putih serta konsumsi buah dan sayur.',
      'Untuk keluhan sendi rahang, pilih makanan lunak sementara, kompres hangat area otot rahang, dan hindari membuka mulut terlalu lebar.',
      'Segera periksakan ke dokter gigi bila luka mulut tidak membaik setelah 14 hari atau rahang sering terasa terkunci.',
    ],
    donts: [
      'Hindari makanan terlalu pedas, asam, renyah/tajam, serta rokok dan alkohol saat terdapat luka di rongga mulut.',
      'Jangan mengunyah permen karet terlalu lama atau menopang dagu terlalu keras saat sendi rahang pegal.',
      'Jangan mengoleskan obat keras atau bahan iritan tanpa anjuran tenaga medis.',
    ],
    emergency_signs: [
      'Luka, bercak putih/merah, atau benjolan di mulut yang menetap lebih dari 2 minggu atau mudah berdarah.',
      'Rahang terkunci tidak bisa dibuka atau ditutup, disertai nyeri hebat di telinga atau wajah.',
    ],
  },
];

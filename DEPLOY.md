# Panduan Deploy Dentify (Gratis)

Panduan ini memasang Dentify di layanan gratis:

| Bagian | Layanan | Paket |
|---|---|---|
| Database | MongoDB Atlas | M0 (gratis) |
| Backend (Express, serverless) | Vercel | Hobby (gratis) |
| ai-service (FastAPI + model TFLite) | Render | Free |
| Frontend (Next.js) | Vercel | Hobby (gratis) |

Urutan deploy: **Atlas → file model → GitHub → Render (ai-service) → Vercel backend → seed database → Vercel frontend → cek CORS → keep-alive → uji**. Ikuti berurutan karena tiap langkah butuh URL atau nilai dari langkah sebelumnya.

> **Aturan rahasia:** isi nilai rahasia (password, URI, API key) **hanya** di dashboard Atlas/Render/Vercel atau di terminal Anda. Jangan tulis ke file yang di-commit. File `.env.example` sengaja hanya berisi nama variabel.

---

## 0. Persiapan

1. Akun: GitHub, [MongoDB Atlas](https://cloud.mongodb.com), [Render](https://render.com) (login dengan GitHub), [Vercel](https://vercel.com) (login dengan GitHub), [Google AI Studio](https://aistudio.google.com) untuk Gemini.
2. **Buat API key Gemini baru.** Versi lama `ai-service/.env.example` pernah memuat nilai `GEMINI_API_KEY`. Di Google AI Studio → *API keys*, **hapus key lama** lalu buat key baru. Key baru hanya diisi di Render (langkah 4).
3. Tentukan nama sejak awal karena menjadi URL:
   - Project Vercel frontend: `dentifyd` → `https://dentifyd.vercel.app`.
   - Project Vercel backend, misalnya `dentify-backend` → `https://dentify-backend.vercel.app`. Kalau nama sudah dipakai, Vercel memberi akhiran; cek URL aslinya di **Settings → Domains**.
   - Service Render: `dentify-ai-service` → `https://dentify-ai-service.onrender.com`.

---

## 1. MongoDB Atlas

### 1.1 Buat cluster
1. Atlas → **Create** → pilih **M0 (Free)**.
2. Provider **AWS**, region **Singapore (ap-southeast-1)**: dekat dengan Indonesia, region Render (`render.yaml`) dan region function Vercel (`sin1`).
3. Nama cluster bebas, misalnya `dentify`.

### 1.2 Buat user database khusus aplikasi
Jangan memakai akun admin Atlas Anda. Buat user baru yang hanya bisa membaca/menulis database Dentify:

1. **Security → Database Access → Add New Database User**.
2. Authentication: **Password**. Username misalnya `dentify_app`. Klik **Autogenerate Secure Password** lalu simpan password di password manager.
3. **Database User Privileges → Specific Privileges → Add Specific Privilege**: role `readWrite`, database `dentify`. User ini tidak bisa menyentuh database lain di cluster.
4. **Add User**.

### 1.3 Network Access: `0.0.0.0/0`
1. **Security → Network Access → Add IP Address → Allow Access from Anywhere** (mengisi `0.0.0.0/0`) → Confirm.

**Kenapa perlu, dan apa risikonya:**
- Atlas menolak koneksi dari IP yang tidak ada di daftar. Function Vercel **tidak punya IP keluar yang tetap**, dan laptop Anda (untuk seed) juga butuh akses. `0.0.0.0/0` berarti "semua alamat IP boleh *mencoba* terhubung".
- Itu **bukan** berarti database terbuka. Setiap koneksi tetap wajib TLS dan username + password yang benar. Karena itu keamanannya bergantung pada:
  - password user yang panjang dan acak (langkah 1.2),
  - user aplikasi yang hanya punya `readWrite` di database `dentify`,
  - URI koneksi yang hanya disimpan di Vercel dan tidak pernah di-commit.

### 1.4 Ambil connection string
1. **Database → Connect → Drivers** → salin URI `mongodb+srv://...`.
2. Ganti `<username>` dan `<password>` dengan user dari 1.2. Tambahkan nama database `dentify` setelah host:
   ```
   mongodb+srv://dentify_app:<PASSWORD>@<cluster-host>/dentify?retryWrites=true&w=majority
   ```
3. Kalau password memuat karakter khusus (`@ : / ? # [ ] %`), ubah ke URL-encoding (misalnya `@` → `%40`). Password hasil *Autogenerate* biasanya hanya huruf dan angka.
4. Simpan URI ini. Ini nilai `MONGODB_URI`.

---

## 2. File model (`.tflite`)

File model tidak ada di git (`*.keras` dan `*.tflite` di-ignore). Saat build, Render mengunduhnya dari `MODEL_URL`.

1. Buat file model (dari folder `ai-service/`, butuh `requirements-train.txt`):
   ```powershell
   cd ai-service
   .venv\Scripts\python -m training.convert_tflite
   ```
   Hasilnya `models/dentify_model.tflite` (±12,4 MB) beserta laporan kecocokan dengan model `.keras` pada data validasi.
2. Hitung SHA-256 (untuk `MODEL_SHA256`):
   ```powershell
   certutil -hashfile models\dentify_model.tflite SHA256
   ```
3. Unggah sebagai **GitHub Release asset**: repo GitHub → **Releases → Draft a new release** → tag misalnya `model-2.1.0` → seret file `dentify_model.tflite` → **Publish release**.
4. Klik kanan nama file di halaman release → *Copy link address*. Bentuknya:
   ```
   https://github.com/<akun>/<repo>/releases/download/model-2.1.0/dentify_model.tflite
   ```
   Ini nilai `MODEL_URL`.

> **Repo private?** Link release di repo private butuh login, jadi build Render gagal mengunduhnya. Pakai repo publik terpisah khusus model, atau layanan lain yang memberi link unduh langsung. Catatan: `ai-service/training/MODEL_CARD.md` §2 menyebut 72% data latih berlisensi tidak jelas. Pertimbangkan ini sebelum membagikan file model secara publik.

Setiap kali model dilatih ulang: konversi lagi, unggah ke release baru, perbarui `MODEL_URL` + `MODEL_SHA256` di Render, lalu commit `model_meta.json` yang baru.

---

## 3. Push kode ke GitHub

Render dan Vercel membaca kode dari GitHub. Push branch yang akan di-deploy (misalnya `main`) ke repo GitHub Anda. Pastikan `render.yaml` ada di root repo.

---

## 4. Render: ai-service (Blueprint)

`render.yaml` hanya mendefinisikan ai-service (paket Free, Singapore, health check `/healthz`).

1. Render Dashboard → **New → Blueprint** → hubungkan repo → **Apply**.
2. Isi variabel `sync: false`:

| Variabel | Isi |
|---|---|
| `GEMINI_API_KEY` | key Gemini **baru** (langkah 0.2) |
| `MODEL_URL` | link release dari langkah 2.4 |
| `MODEL_SHA256` | hasil `certutil` (huruf kecil, tanpa spasi) |

3. `AI_SERVICE_API_KEY` dibuat acak oleh Render. Buka **Environment**, salin nilainya untuk langkah 5.
4. Log build harus memuat `fetch_model: saved dentify_model.tflite`, lalu `Application startup complete`.

**Pindah dari backend lama di Render:** setelah backend Vercel lolos uji (langkah 10), **hapus atau suspend** service `dentify-backend` di Render. Jangan hapus `dentify-ai-service`. Mengubah `render.yaml` tidak menghapus service lama secara otomatis.

---

## 5. Vercel: backend (project baru)

1. Vercel → **Add New → Project** → impor repo yang sama.
2. **Root Directory**: `backend`. **Framework Preset**: Other. Build, install, rewrite dan durasi sudah diatur `backend/vercel.json`; jangan ditimpa di dashboard.
3. **Environment Variables** (Production):

| Variabel | Wajib | Isi |
|---|:---:|---|
| `NODE_ENV` | ✔ | `production` |
| `MONGODB_URI` | ✔ | URI dari langkah 1.4 |
| `JWT_SECRET` | ✔ | salin dari backend Render lama agar sesi login tetap berlaku; atau nilai acak ≥ 32 karakter |
| `CORS_ORIGINS` | ✔ | `https://dentifyd.vercel.app` (tanpa `/` di akhir) |
| `AI_SERVICE_URL` | ✔ | `https://dentify-ai-service.onrender.com` (tanpa `/` di akhir) |
| `AI_SERVICE_API_KEY` | ✔ | **sama persis** dengan nilai di Render (langkah 4.3) |
| `AI_SERVICE_TIMEOUT_MS` | – | default `90000`; jangan di atas `100000` (durasi maksimum function 120 detik) |
| `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS` | – | default `7d`, `10` |
| `OVERPASS_URL`, `NOMINATIM_URL`, `OSM_USER_AGENT` | – | ada default |
| `TRUST_PROXY` | – | otomatis `1` di Vercel |

   `PORT` dan `ADMIN_*` tidak diperlukan.
4. **Settings → Deployment Protection**: pastikan domain production bisa diakses publik.
5. **Deploy**, lalu cek `https://<project-backend>.vercel.app/healthz`.

Catatan:
- `api/index.js` mengekspor app Express tanpa `listen()`. Koneksi MongoDB dibuka sekali per instance lalu dipakai ulang. Kalau env salah atau database tidak bisa dihubungi, API menjawab 503 `SERVER_NOT_READY`; nama variabel yang salah ada di **Logs** Vercel.
- Batas body Vercel 4,5 MB. Frontend mengompres foto ke bawah 3 MB; backend menolak file di atas 4 MB.
- Setiap panggilan ke ai-service dicatat di Logs sebagai `AI service call` (operation, status, duration_ms).
- Rate limit disimpan di memori tiap instance, jadi batasnya berlaku per instance.

---

## 6. Seed database (dari laptop)

Seed dijalankan dari laptop ke Atlas. Seed mengisi pengetahuan gigi untuk Deni, artikel awal, direktori klinik, dan akun admin. Aman dijalankan berulang (data yang sudah ada tidak digandakan).

Di PowerShell, dari folder `backend/`. Nilainya hanya hidup di sesi terminal ini dan tidak ditulis ke file:

```powershell
cd backend
npm install
$env:MONGODB_URI = "<URI dari langkah 1.4>"
$env:ADMIN_EMAIL = "<email admin>"
$env:ADMIN_PASSWORD = "<password admin yang kuat>"
npm run seed
Remove-Item Env:MONGODB_URI, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
```

Hasil yang diharapkan: log `Seed completed` dengan `adminSeeded: true`. Kalau ada file `backend/.env` lokal, variabel dari terminal tetap diutamakan.

---

## 7. Vercel: frontend

1. Vercel → **Add New → Project** → impor repo GitHub Dentify.
2. **Project Name**: nama dari langkah 0.3 (`dentifyd`).
3. **Root Directory**: `frontend`. Framework otomatis terdeteksi Next.js (`frontend/vercel.json`).
4. **Environment Variables**:

| Variabel | Isi | Environment |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<project-backend>.vercel.app/api/v1` | Production (dan Preview bila dipakai) |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | opsional; kosongkan untuk default 30000 | – |

5. **Deploy**. Build **sengaja gagal** bila `NEXT_PUBLIC_API_URL` kosong, mengarah ke localhost, bukan `https://`, atau tidak diakhiri `/api/v1`. Nilai `NEXT_PUBLIC_*` ditanam saat build, jadi setelah mengubahnya Anda harus **Redeploy**.

Jangan pernah menaruh `GEMINI_API_KEY`, `MONGODB_URI`, `JWT_SECRET`, atau `AI_SERVICE_API_KEY` di project **frontend**.

---

## 8. Cocokkan CORS

1. Lihat domain production di Vercel → **Settings → Domains**, misalnya `https://dentifyd.vercel.app`.
2. Vercel project backend → **Environment Variables** → `CORS_ORIGINS` (Redeploy setelah diubah) harus **persis** sama (dengan `https://`, tanpa `/` di akhir). Beberapa origin dipisah koma.
3. Opsional, untuk Preview Deployment Vercel: tambahkan pola dengan `*`, dan sertakan slug tim Vercel Anda supaya project orang lain tidak ikut cocok:
   ```
   https://dentifyd.vercel.app,https://dentifyd-*-<slug-tim>.vercel.app
   ```
   `*` hanya cocok dengan satu bagian nama domain (huruf, angka, `-`).

---

## 9. Ringkasan: variabel mana di mana

| Variabel | ai-service (Render) | backend (Vercel) | frontend (Vercel) | Sumber nilai |
|---|:---:|:---:|:---:|---|
| `AI_SERVICE_API_KEY` | ✔ | ✔ | – | dibuat Render, disalin manual ke Vercel |
| `GEMINI_API_KEY` | ✔ | – | – | Google AI Studio (key baru) |
| `MODEL_URL`, `MODEL_SHA256` | ✔ | – | – | GitHub Release + `certutil` |
| `APP_ENV`, `PYTHON_VERSION`, `MODEL_RUNTIME`, `CONFIDENCE_THRESHOLD`, `EMERGENCY_CONFIDENCE`, `LLM_TIMEOUT_S`, `GEMINI_MODEL`, `LOG_LEVEL` | ✔ | – | – | `render.yaml` |
| `MONGODB_URI` | – | ✔ | – | Atlas (langkah 1.4) |
| `JWT_SECRET` | – | ✔ | – | nilai acak ≥ 32 karakter |
| `AI_SERVICE_URL` | – | ✔ | – | URL ai-service di Render |
| `CORS_ORIGINS` | – | ✔ | – | domain Vercel |
| `NODE_ENV`, `TRUST_PROXY`, `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`, `AI_SERVICE_TIMEOUT_MS`, `OVERPASS_URL`, `NOMINATIM_URL`, `OSM_USER_AGENT` | – | ✔ | – | tabel langkah 5 |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | – | – | – | hanya di terminal saat seed (langkah 6) |
| `NEXT_PUBLIC_API_URL` | – | – | ✔ | URL backend + `/api/v1` |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | – | – | opsional | – |

`PORT` diisi otomatis; jangan diatur.

---

## 9b. Keep-alive ai-service (cron-job.org)

Service Render Free tidur setelah 15 menit tanpa trafik dan butuh ±1 menit untuk bangun. Agar selalu siap:

1. Daftar di [cron-job.org](https://cron-job.org) (gratis) → **Create cronjob**.
2. URL: `https://dentify-ai-service.onrender.com/healthz`, metode **GET**, jadwal **setiap 10 menit**. Tidak perlu header atau key.
3. Aktifkan notifikasi kegagalan, lalu **Create**.

**Kenapa cukup dengan kuota gratis:** Render memberi **750 jam instance per workspace per bulan**. Satu service yang menyala terus memakai 24 × 31 = **744 jam**, jadi pas di bawah batas. Ini **hanya** berlaku karena ai-service adalah **satu-satunya** service Render di workspace. Dengan dua service (2 × 744 = 1.488 jam) kuota habis di tengah bulan dan semuanya disuspend. Karena itu backend lama di Render harus dihapus atau disuspend **sebelum** cron diaktifkan. Deploy ulang dan service percobaan juga memakai jam yang sama.

Jangan arahkan cron ke backend atau `/api/v1/health`; `/healthz` ai-service tidak memanggil model maupun database.

---

## 10. Uji setelah deploy

Kalau keep-alive belum aktif, permintaan pertama ke ai-service yang tidur butuh ±1 menit. Itu normal.

### 10.1 Health check (PowerShell / terminal)
```powershell
curl.exe https://dentify-ai-service.onrender.com/healthz
# {"status":"alive"}

curl.exe https://<project-backend>.vercel.app/healthz
# {"status":"alive"}

curl.exe https://<project-backend>.vercel.app/api/v1/health
# "database":"connected", "ai_service":{"status":"ok","model_version":"dentify-mobilenetv2-2.1.0","model_loaded":true}
```
- `database` bukan `connected` → cek `MONGODB_URI` dan Network Access Atlas.
- `ai_service.status` = `auth_failed` → `AI_SERVICE_API_KEY` di Vercel dan Render berbeda.
- `ai_service.status` = `unavailable` → ai-service masih bangun (tunggu 1 menit lalu ulangi), atau `AI_SERVICE_URL` salah.
- `ai_service.status` = `degraded` → model tidak termuat; cek log build ai-service (langkah 4).

### 10.2 Uji lewat browser
Buka URL Vercel, lalu:
1. **Beranda** terbuka. Buka DevTools → Console: tidak boleh ada error CORS.
2. **Daftar** akun baru → **Masuk**.
3. **/scan**: unggah foto gigi yang jelas → hasil muncul lengkap dengan tingkat urgensi, saran, dan disclaimer.
4. **/chat**: tanya Deni (misalnya "gusi saya berdarah saat sikat gigi") → jawaban berbahasa Indonesia + disclaimer.
5. **/clinics**: izinkan lokasi atau ketik nama kota → daftar dan peta klinik muncul.
6. **/login** dengan akun admin dari langkah 6 → **/admin** terbuka.
7. **Profil → riwayat**: hasil skrining tadi tersimpan; hapus satu untuk memastikan hapus berfungsi.

### 10.3 Uji cold start
1. Matikan cron sementara dan tunggu >15 menit sampai ai-service tidur.
2. Lakukan skrining. Backend menunggu sampai 90 detik, jadi biasanya hasil tetap muncul (dengan pesan "Analisis lebih lama dari biasanya").
3. Kalau ai-service belum siap (jaringan, timeout, atau 502/503/504), muncul kotak biru **"Server sedang dinyalakan"**. Error lain (401/403/4xx/500) tampil sebagai pesan asli dengan kodenya.

### 10.4 Smoke test otomatis (opsional)
`scripts/e2e-smoke.js` mengecek ai-service, health + CORS backend, register/login, skrining, Deni, dan klinik. Script ini **membuat satu akun uji** di database production. Ambil nilai `AI_SERVICE_API_KEY` dari Render (ai-service → Environment).
```powershell
$env:BACKEND_URL = "https://<project-backend>.vercel.app/api/v1"
$env:AI_SERVICE_URL = "https://dentify-ai-service.onrender.com"
$env:AI_SERVICE_API_KEY = "<salin dari Render>"
$env:FRONTEND_ORIGIN = "https://dentifyd.vercel.app"
$env:TEST_IMAGE_PATH = "data-science/data/processed/test/caries/<file>.jpg"
node scripts/e2e-smoke.js
Remove-Item Env:AI_SERVICE_API_KEY
```
Hasil yang diharapkan: `E2E SMOKE TEST PASSED 100%.`

---

## 11. Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| Build ai-service: `fetch_model: ... MODEL_URL is not set` | Isi `MODEL_URL` di Environment ai-service, lalu deploy ulang. |
| Build ai-service: `SHA-256 mismatch` | File di release berubah, atau `MODEL_SHA256` salah salin. Hitung ulang dengan `certutil`. |
| Build ai-service: `No matching distribution found for ai-edge-litert` | `PYTHON_VERSION` bukan 3.13.x. Pastikan nilainya `3.13.5`. |
| API 503 `SERVER_NOT_READY` | Lihat Logs Vercel: `Invalid production environment` menyebut variabelnya; `MongooseServerSelectionError` berarti Network Access Atlas belum `0.0.0.0/0` atau URI salah. |
| `AI_AUTH_FAILED` | `AI_SERVICE_API_KEY` di Vercel tidak sama dengan di Render. Samakan lalu Redeploy. |
| `AI_SERVICE_ERROR` | ai-service menjawab 4xx/500; status aslinya ada di pesan dan di log `AI service call`. |
| Browser: error CORS / `Origin tidak diizinkan` | `CORS_ORIGINS` tidak persis sama dengan domain Vercel (cek `https://` dan `/` di akhir). |
| Frontend memanggil `localhost:5000` | `NEXT_PUBLIC_API_URL` diubah tanpa redeploy Vercel. |
| Skrining selalu "Server sedang dinyalakan" | Cek `/api/v1/health` dan log ai-service (gagal start?). Pesan ini juga muncul bila browser tidak bisa menghubungi backend, termasuk karena CORS salah. |
| Semua service Render "Suspended" | Kuota 750 jam habis (ada service Render lain yang ikut menyala). Hapus service lain; kuota pulih di awal bulan. |
| Deni selalu menjawab pesan cadangan | `GEMINI_API_KEY` kosong/salah, atau kuota Gemini habis. Cek log ai-service. |

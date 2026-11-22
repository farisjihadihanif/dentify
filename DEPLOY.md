# Panduan Deploy Dentify (Gratis)

Panduan ini memasang Dentify di layanan gratis:

| Bagian | Layanan | Paket |
|---|---|---|
| Database | MongoDB Atlas | M0 (gratis) |
| Backend (Express) | Render | Free |
| ai-service (FastAPI + model TFLite) | Render | Free |
| Frontend (Next.js) | Vercel | Hobby (gratis) |

Urutan deploy: **Atlas → file model → GitHub → Render (ai-service + backend) → seed database → Vercel → cek CORS → uji**. Ikuti berurutan karena tiap langkah butuh URL atau nilai dari langkah sebelumnya.

> **Aturan rahasia:** isi nilai rahasia (password, URI, API key) **hanya** di dashboard Atlas/Render/Vercel atau di terminal Anda. Jangan tulis ke file yang di-commit. File `.env.example` sengaja hanya berisi nama variabel.

---

## 0. Persiapan

1. Akun: GitHub, [MongoDB Atlas](https://cloud.mongodb.com), [Render](https://render.com) (login dengan GitHub), [Vercel](https://vercel.com) (login dengan GitHub), [Google AI Studio](https://aistudio.google.com) untuk Gemini.
2. **Buat API key Gemini baru.** Versi lama `ai-service/.env.example` pernah memuat nilai `GEMINI_API_KEY` dan nilai itu masih ada di riwayat git. Di Google AI Studio → *API keys*, **hapus key lama** lalu buat key baru. Key baru hanya diisi di Render (langkah 4).
3. Tentukan dua nama sejak awal karena keduanya menjadi URL:
   - Nama project Vercel, misalnya `dentify-app` → URL `https://dentify-app.vercel.app`.
   - Nama service Render dari `render.yaml`: `dentify-ai-service` dan `dentify-backend` → URL `https://dentify-ai-service.onrender.com` dan `https://dentify-backend.onrender.com`. Kalau nama sudah dipakai orang lain, Render menambah akhiran acak. Cek URL aslinya di dashboard setelah deploy (langkah 4.5).

---

## 1. MongoDB Atlas

### 1.1 Buat cluster
1. Atlas → **Create** → pilih **M0 (Free)**.
2. Provider **AWS**, region **Singapore (ap-southeast-1)**: dekat dengan Indonesia dan dengan region Render di `render.yaml`.
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
- Atlas menolak koneksi dari IP yang tidak ada di daftar. Server Render Free **tidak punya IP keluar yang tetap**, dan laptop Anda (untuk seed) juga butuh akses. `0.0.0.0/0` berarti "semua alamat IP boleh *mencoba* terhubung".
- Itu **bukan** berarti database terbuka. Setiap koneksi tetap wajib TLS dan username + password yang benar. Karena itu keamanannya bergantung pada:
  - password user yang panjang dan acak (langkah 1.2),
  - user aplikasi yang hanya punya `readWrite` di database `dentify`,
  - URI koneksi yang hanya disimpan di Render dan tidak pernah di-commit.
- Mau lebih ketat? Render menampilkan rentang IP keluar per region (dashboard service → **Connect → Outbound**). Anda bisa memasukkan rentang itu ke Atlas sebagai ganti `0.0.0.0/0`. Ingat juga menambahkan IP laptop Anda sementara saat menjalankan seed.

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

## 4. Render: ai-service + backend (Blueprint)

`render.yaml` mendefinisikan kedua service sekaligus (paket Free, region Singapore, health check `/healthz`).

### 4.1 Buat Blueprint
1. Render Dashboard → **New → Blueprint**.
2. Hubungkan repo GitHub Dentify, pilih branch, lalu Render membaca `render.yaml`.
3. Render meminta nilai untuk variabel bertanda `sync: false`. Isi sesuai tabel berikut:

**dentify-ai-service**

| Variabel | Isi |
|---|---|
| `GEMINI_API_KEY` | key Gemini **baru** (langkah 0.2) |
| `MODEL_URL` | link release dari langkah 2.4 |
| `MODEL_SHA256` | hasil `certutil` (huruf kecil, tanpa spasi) |

**dentify-backend**

| Variabel | Isi |
|---|---|
| `MONGODB_URI` | URI dari langkah 1.4 |
| `AI_SERVICE_URL` | `https://dentify-ai-service.onrender.com` (tanpa `/` di akhir) |
| `CORS_ORIGINS` | `https://<nama-project-vercel>.vercel.app` (dari langkah 0.3) |

4. **Apply**. Render membangun kedua service. Build pertama ai-service ±3–5 menit.

Variabel yang **tidak** perlu Anda isi:
- `AI_SERVICE_API_KEY`: dibuat acak oleh Render di ai-service, lalu disalin otomatis ke backend (`fromService`), jadi keduanya pasti sama.
- `JWT_SECRET`: dibuat acak oleh Render. Jangan diubah setelah ada pengguna, karena semua sesi login akan keluar.
- Variabel lain (`NODE_ENV`, `PYTHON_VERSION`, `MODEL_RUNTIME`, ambang keyakinan, dsb.) sudah terisi dari `render.yaml`.

### 4.2 Hal yang sudah diatur di `render.yaml`
- **ai-service** memakai `requirements.txt` tanpa TensorFlow (runtime LiteRT). Puncak memorinya ±185 MB, aman untuk batas 512 MB paket Free. `PYTHON_VERSION=3.13.5` wajib karena LiteRT belum punya paket untuk Python 3.14 (default Render).
- **Build ai-service** menjalankan `scripts/fetch_model.py`. Build **gagal** bila `MODEL_URL` kosong atau checksum tidak cocok, sehingga service tidak pernah jalan tanpa model.
- **Backend** menolak start bila `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS`, `AI_SERVICE_URL`, atau `AI_SERVICE_API_KEY` kosong, atau masih berisi nilai development/localhost. ai-service juga menolak start dengan key development.
- **Health check** `/healthz` di kedua service tidak menyentuh database atau ai-service. Dengan begitu pengecekan rutin Render tidak membuat ai-service terus terjaga.

### 4.3 Batas paket Free yang perlu diingat
- Service **tidur setelah 15 menit tanpa trafik**, dan permintaan pertama sesudahnya butuh ±1 menit. Frontend menampilkan "Server sedang dinyalakan, tunggu sekitar 1 menit" lengkap dengan tombol *Coba Lagi*.
- Kuota **750 jam instance/bulan per workspace** dipakai bersama oleh kedua service. Jangan pasang pinger/uptime monitor untuk membuat keduanya selalu menyala: 2 × 24 jam × 31 hari = 1.488 jam, sehingga semua service akan disuspend sampai bulan berikutnya.
- Disk lokal terhapus setiap restart. Dentify tidak menyimpan apa pun di disk (foto skrining hanya diproses di memori).

### 4.4 Cek log build
- ai-service → **Logs**: saat build cari `fetch_model: saved dentify_model.tflite (12.4 MB, sha256 ...)`, lalu saat start `Application startup complete`. Apakah model benar-benar termuat dicek lewat `/api/v1/health` backend (langkah 9.1, `model_loaded: true`).
- backend → **Logs**: cari `MongoDB connected` dan `Dentify backend listening`.
- Kalau muncul `Invalid production environment: ...`, pesan itu menyebut nama variabel yang salah. Perbaiki di **Environment**, lalu **Manual Deploy → Deploy latest commit**.

### 4.5 Cocokkan URL
Buka tiap service dan lihat URL di bagian atas. Kalau URL ai-service **bukan** `https://dentify-ai-service.onrender.com`, ubah `AI_SERVICE_URL` di backend → **Save Changes** (Render otomatis redeploy).

---

## 5. Seed database (dari laptop)

Paket Free tidak menyediakan Shell di Render, jadi seed dijalankan dari laptop ke Atlas. Seed mengisi pengetahuan gigi untuk Deni, artikel awal, direktori klinik, dan akun admin. Aman dijalankan berulang (data yang sudah ada tidak digandakan).

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

## 6. Vercel: frontend

1. Vercel → **Add New → Project** → impor repo GitHub Dentify.
2. **Project Name**: nama dari langkah 0.3 (misalnya `dentify-app`).
3. **Root Directory**: `frontend`. Framework otomatis terdeteksi Next.js (`frontend/vercel.json`).
4. **Environment Variables**:

| Variabel | Isi | Environment |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://dentify-backend.onrender.com/api/v1` | Production (dan Preview bila dipakai) |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | opsional; kosongkan untuk default 30000 | – |

5. **Deploy**. Build **sengaja gagal** bila `NEXT_PUBLIC_API_URL` kosong, mengarah ke localhost, bukan `https://`, atau tidak diakhiri `/api/v1`. Nilai `NEXT_PUBLIC_*` ditanam saat build, jadi setelah mengubahnya Anda harus **Redeploy**.

Jangan pernah menaruh `GEMINI_API_KEY`, `MONGODB_URI`, `JWT_SECRET`, atau `AI_SERVICE_API_KEY` di Vercel.

---

## 7. Cocokkan CORS

1. Lihat domain production di Vercel → **Settings → Domains**, misalnya `https://dentify-app.vercel.app`.
2. Render → `dentify-backend` → **Environment** → `CORS_ORIGINS` harus **persis** sama (dengan `https://`, tanpa `/` di akhir). Beberapa origin dipisah koma.
3. Opsional, untuk Preview Deployment Vercel: tambahkan pola dengan `*`, dan sertakan slug tim Vercel Anda supaya project orang lain tidak ikut cocok:
   ```
   https://dentify-app.vercel.app,https://dentify-app-*-<slug-tim>.vercel.app
   ```
   `*` hanya cocok dengan satu bagian nama domain (huruf, angka, `-`).

---

## 8. Ringkasan: variabel mana di mana

| Variabel | ai-service (Render) | backend (Render) | frontend (Vercel) | Sumber nilai |
|---|:---:|:---:|:---:|---|
| `AI_SERVICE_API_KEY` | ✔ | ✔ | – | dibuat Render, disalin otomatis |
| `GEMINI_API_KEY` | ✔ | – | – | Google AI Studio (key baru) |
| `MODEL_URL`, `MODEL_SHA256` | ✔ | – | – | GitHub Release + `certutil` |
| `APP_ENV`, `PYTHON_VERSION`, `MODEL_RUNTIME`, `CONFIDENCE_THRESHOLD`, `EMERGENCY_CONFIDENCE`, `LLM_TIMEOUT_S`, `GEMINI_MODEL`, `LOG_LEVEL` | ✔ | – | – | `render.yaml` |
| `MONGODB_URI` | – | ✔ | – | Atlas (langkah 1.4) |
| `JWT_SECRET` | – | ✔ | – | dibuat Render |
| `AI_SERVICE_URL` | – | ✔ | – | URL ai-service di Render |
| `CORS_ORIGINS` | – | ✔ | – | domain Vercel |
| `NODE_ENV`, `TRUST_PROXY`, `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`, `AI_SERVICE_TIMEOUT_MS`, `OVERPASS_URL`, `NOMINATIM_URL`, `OSM_USER_AGENT` | – | ✔ | – | `render.yaml` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | – | – | – | hanya di terminal saat seed (langkah 5) |
| `NEXT_PUBLIC_API_URL` | – | – | ✔ | URL backend + `/api/v1` |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | – | – | opsional | – |

`PORT` diisi otomatis oleh Render; jangan diatur.

---

## 9. Uji setelah deploy

Permintaan pertama ke service yang sedang tidur butuh ±1 menit. Itu normal.

### 9.1 Health check (PowerShell / terminal)
```powershell
curl.exe https://dentify-ai-service.onrender.com/healthz
# {"status":"alive"}

curl.exe https://dentify-backend.onrender.com/healthz
# {"status":"alive"}

curl.exe https://dentify-backend.onrender.com/api/v1/health
# "database":"connected", "ai_service":{"status":"ok","model_version":"dentify-mobilenetv2-2.1.0","model_loaded":true}
```
- `database` bukan `connected` → cek `MONGODB_URI` dan Network Access Atlas.
- `ai_service.status` = `unavailable` → ai-service masih bangun (tunggu 1 menit lalu ulangi), atau `AI_SERVICE_URL` salah.
- `ai_service.status` = `degraded` → model tidak termuat; cek log build ai-service (langkah 4.4).

### 9.2 Uji lewat browser
Buka URL Vercel, lalu:
1. **Beranda** terbuka. Buka DevTools → Console: tidak boleh ada error CORS.
2. **Daftar** akun baru → **Masuk**.
3. **/scan**: unggah foto gigi yang jelas → hasil muncul lengkap dengan tingkat urgensi, saran, dan disclaimer.
4. **/chat**: tanya Deni (misalnya "gusi saya berdarah saat sikat gigi") → jawaban berbahasa Indonesia + disclaimer.
5. **/clinics**: izinkan lokasi atau ketik nama kota → daftar dan peta klinik muncul.
6. **/login** dengan akun admin dari langkah 5 → **/admin** terbuka.
7. **Profil → riwayat**: hasil skrining tadi tersimpan; hapus satu untuk memastikan hapus berfungsi.

### 9.3 Uji cold start
1. Jangan buka situs selama >15 menit (kedua service tertidur).
2. Buka situs lalu langsung coba login atau skrining. Seharusnya muncul kotak biru **"Server sedang dinyalakan, tunggu sekitar 1 menit"** dengan hitung mundur, bukan pesan error merah.
3. Setelah ±1 menit kotak berubah menjadi **"Server sudah siap"**. Klik **Coba Lagi**, dan permintaan berhasil.

### 9.4 Smoke test otomatis (opsional)
`scripts/e2e-smoke.js` mengecek ai-service, health + CORS backend, register/login, skrining, Deni, dan klinik. Script ini **membuat satu akun uji** di database production. Ambil nilai `AI_SERVICE_API_KEY` dari Render (ai-service → Environment).
```powershell
$env:BACKEND_URL = "https://dentify-backend.onrender.com/api/v1"
$env:AI_SERVICE_URL = "https://dentify-ai-service.onrender.com"
$env:AI_SERVICE_API_KEY = "<salin dari Render>"
$env:FRONTEND_ORIGIN = "https://dentify-app.vercel.app"
$env:TEST_IMAGE_PATH = "data-science/data/processed/test/caries/<file>.jpg"
node scripts/e2e-smoke.js
Remove-Item Env:AI_SERVICE_API_KEY
```
Hasil yang diharapkan: `E2E SMOKE TEST PASSED 100%.`

---

## 10. Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| Build ai-service: `fetch_model: ... MODEL_URL is not set` | Isi `MODEL_URL` di Environment ai-service, lalu deploy ulang. |
| Build ai-service: `SHA-256 mismatch` | File di release berubah, atau `MODEL_SHA256` salah salin. Hitung ulang dengan `certutil`. |
| Build ai-service: `No matching distribution found for ai-edge-litert` | `PYTHON_VERSION` bukan 3.13.x. Pastikan nilainya `3.13.5`. |
| Backend log: `Invalid production environment: ...` | Pesan menyebut variabel yang kosong atau salah. Perbaiki di Environment backend. |
| Backend: `MongoServerSelectionError` / timeout | Network Access Atlas belum `0.0.0.0/0`, atau URI/password salah. |
| Browser: error CORS / `Origin tidak diizinkan` | `CORS_ORIGINS` tidak persis sama dengan domain Vercel (cek `https://` dan `/` di akhir). |
| Frontend memanggil `localhost:5000` | `NEXT_PUBLIC_API_URL` diubah tanpa redeploy Vercel. |
| Skrining selalu "Server sedang dinyalakan" walau sudah >2 menit | Cek `/api/v1/health` (langkah 9.1) dan log ai-service. Pesan ini juga muncul bila ai-service gagal start. |
| Semua service Render "Suspended" | Kuota 750 jam habis (biasanya karena pinger). Matikan pinger; kuota pulih di awal bulan. |
| Deni selalu menjawab pesan cadangan | `GEMINI_API_KEY` kosong/salah, atau kuota Gemini habis. Cek log ai-service. |

# ROKU KASIR POS

Aplikasi Point of Sale berbasis web dengan arsitektur **microservices**, dibangun menggunakan Node.js + React, dan di-deploy di **Google Cloud Platform**.

---

## Arsitektur

```
┌─────────────────────────────────────────────────┐
│             Google Cloud Run                     │
│                                                  │
│  ┌──────────────────────┐                        │
│  │  kasir-frontend-     │  React (Vite) +        │
│  │  gateway             │  API Gateway           │
│  └──────────┬───────────┘                        │
│             │ proxy /api                         │
│    ┌────────┴────────┐                           │
│    ▼                 ▼                           │
│  ┌──────────┐  ┌──────────────┐                  │
│  │kasir-auth│  │kasir-transaksi│                 │
│  └────┬─────┘  └──────┬───────┘                  │
│       │               │                          │
└───────┼───────────────┼──────────────────────────┘
        │               │
   ┌────▼───────────────▼────┐
   │   Cloud SQL (MySQL)     │
   │   kasir-roku-db         │
   └─────────────────────────┘
        │
   ┌────▼──────────┐
   │   Firestore   │  (antrean sinkronisasi offline)
   └───────────────┘
```

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js + Express.js |
| Database | MySQL (Cloud SQL) + Firestore |
| Deploy | Docker + Google Cloud Run |
| CI/CD | Google Cloud Build |

---

## Struktur Folder

```
ROKU-KASIR-POS/
├── backend/
│   ├── layanan-auth/         # Service 2: Login, JWT, CRUD Kasir & Cabang
│   │   ├── Dockerfile
│   │   └── layanan_auth.js
│   ├── layanan-transaksi/    # Service 3: Barang, Transaksi, Laporan
│   │   ├── Dockerfile
│   │   └── layanan_transaksi.js
│   ├── shared/               # Koneksi DB, middleware JWT
│   │   ├── basis_data.js
│   │   ├── db_mysql.js
│   │   ├── db_firestore.js
│   │   ├── db_nedb.js
│   │   └── middleware_auth.js
│   ├── data/                 # NeDB lokal (offline cache)
│   ├── .env.example          # Template env lokal
│   ├── jalankan_semua.js     # Runner semua service (dev lokal)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # Halaman: Kasir, Barang, Laporan, SDM, Pengaturan
│   │   ├── components/       # Komponen reusable
│   │   ├── api/klien_api.js  # Axios wrapper
│   │   ├── store/toko_state.js  # State management (Zustand)
│   │   └── App.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── .env.example          # Template env lokal
│   └── package.json
├── gcp/
│   ├── schema.sql            # DDL skema database
│   ├── reset-database.sql    # Script reset DB (development)
│   ├── seed_firestore.js     # Seed data Firestore
│   └── firestore.rules       # Aturan keamanan Firestore
├── Dockerfile                # Build frontend+gateway (Service 1)
├── cloudbuild.yaml           # Pipeline CI/CD Cloud Build
├── .dockerignore
├── .gitignore
├── LinkDeploy.md             # URL service yang sudah di-deploy
└── Overview Project.md       # Pemetaan terhadap spesifikasi tugas
```

---

## Menjalankan Secara Lokal

### Prasyarat
- Node.js >= 18
- MySQL (XAMPP / Laragon)
- Database `kasir_roku` sudah dibuat

### 1. Clone & install dependencies

```bash
git clone https://github.com/alfarizkyhpsr/ROKU-KASIR-POS.git
cd ROKU-KASIR-POS

# Install backend
cd backend && npm install

# Install frontend
cd ../frontend && npm install
```

### 2. Konfigurasi environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env: isi DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET

# Frontend
cd ../frontend
cp .env.example .env
# Edit .env: isi VITE_API_URL (default: http://localhost:3000)
```

### 3. Setup database

```bash
# Import skema ke MySQL
mysql -u root -p kasir_roku < gcp/schema.sql
```

### 4. Jalankan semua service

```bash
cd backend
node jalankan_semua.js
```

Frontend dev server:
```bash
cd frontend
npm run dev
```

---

## API Endpoint

### Layanan Autentikasi (`kasir-auth`)

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/auth/masuk` | Login kasir |
| POST | `/api/auth/keluar` | Logout |
| GET | `/api/kasir` | Daftar kasir |
| POST | `/api/kasir` | Tambah kasir |
| PUT | `/api/kasir/:id` | Update kasir |
| DELETE | `/api/kasir/:id` | Hapus kasir |
| GET | `/api/cabang` | Daftar cabang |
| POST | `/api/cabang` | Tambah cabang |
| PUT | `/api/cabang/:id` | Update cabang |
| DELETE | `/api/cabang/:id` | Hapus cabang |

### Layanan Transaksi (`kasir-transaksi`)

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/barang` | Daftar barang |
| POST | `/api/barang` | Tambah barang |
| PUT | `/api/barang/:id` | Update barang |
| DELETE | `/api/barang/:id` | Hapus barang |
| GET | `/api/barang/:id/target` | Target penjualan |
| PUT | `/api/target/:id` | Update target |
| GET | `/api/transaksi` | Riwayat transaksi |
| POST | `/api/transaksi` | Buat transaksi |
| POST | `/api/transaksi/sinkronisasi` | Sinkronisasi offline |
| GET | `/api/laporan/omzet` | Laporan keuangan |
| GET | `/api/laporan/kasir` | Laporan performa kasir |
| POST | `/api/shift/buka` | Buka shift |
| PUT | `/api/shift/:id/tutup` | Tutup shift |

---

## Deploy ke GCP

Lihat `cloudbuild.yaml` untuk pipeline lengkap. Secara singkat:

```bash
# Trigger Cloud Build dari root project
gcloud builds submit --config cloudbuild.yaml \
  --substitutions="_CLOUD_SQL_CONNECTION=project:region:instance"
```

URL service yang sudah di-deploy tersedia di `LinkDeploy.md`.

---

## Skema Database

9 tabel MySQL utama: `barang`, `cabang`, `kasir`, `stok`, `transaksi`, `item_transaksi`, `pembayaran`, `shift_kasir`, `sesi_aktif`.

3 koleksi Firestore: `antrean_sinkronisasi`, `transaksi_offline`, `log_perangkat`.

Lihat `gcp/schema.sql` untuk DDL lengkap.
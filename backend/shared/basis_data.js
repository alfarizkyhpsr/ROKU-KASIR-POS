const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pathFileDb = path.join(__dirname, 'basis_data_toko.json');

// HELPER VALIDASI INPUT

const Validator = {
  // Pastikan string tidak kosong, tidak melebihi panjang maks, dan tidak mengandung karakter berbahaya
  teks: (nilai, maks = 255) => {
    if (typeof nilai !== 'string') return false;
    const bersih = nilai.trim();
    if (bersih.length === 0 || bersih.length > maks) return false;
    // Tolak karakter HTML/script injection dasar
    if (/<[^>]*>|[<>"'`;]/.test(bersih)) return false;
    return true;
  },

  // Pastikan angka valid, tidak negatif, dan tidak melebihi batas wajar
  angka: (nilai, min = 0, maks = 999999999) => {
    const n = Number(nilai);
    if (isNaN(n)) return false;
    if (n < min || n > maks) return false;
    return true;
  },

  // Pastikan PIN 6 angka
  pin: (nilai) => {
    return /^\d{6}$/.test(String(nilai));
  },

  // Pastikan username: huruf, angka, underscore, panjang 3-30
  namapengguna: (nilai) => {
    return /^[a-z0-9_]{3,30}$/.test(String(nilai));
  },

  // Bersihkan string dari karakter berbahaya
  bersihkan: (nilai) => {
    if (typeof nilai !== 'string') return '';
    return nilai.trim().replace(/[<>"'`;]/g, '');
  }
};

// STRUKTUR AWAL DATABASE

const dataAwal = {
  // --- MOCK DATABASE RELASIONAL / SQL (MySQL) ---
  cabang: [
    {
      id: 1,
      kode_cabang: "CAB01",
      nama_cabang: "Toko Utama",
      alamat: "Jl. Dago No. 102",
      kota: "Bandung",
      telepon: "022-2501234",
      nama_manajer: "Budi Santoso",
      is_aktif: 1,
      dibuat_pada: new Date().toISOString(),
      diperbarui_pada: new Date().toISOString()
    },
    {
      id: 2,
      kode_cabang: "CAB02",
      nama_cabang: "Toko Roti & Kopi Kemang",
      alamat: "Jl. Kemang Raya No. 15",
      kota: "Jakarta Selatan",
      telepon: "021-7194321",
      nama_manajer: "Siti Aminah",
      is_aktif: 1,
      dibuat_pada: new Date().toISOString(),
      diperbarui_pada: new Date().toISOString()
    }
  ],
  barang: [
    {
      id: 1,
      kode_barcode: "8991001",
      nama_barang: "ES KOPI SUSU AREN",
      kategori: "MINUMAN",
      satuan: "gelas",
      harga_jual: 18000,
      harga_pokok: 8000,
      url_gambar: "local_cafe",
      is_aktif: 1,
      dibuat_pada: new Date().toISOString()
    },
    {
      id: 2,
      kode_barcode: "8991002",
      nama_barang: "BUTTER CROISSANT",
      kategori: "MAKANAN",
      satuan: "pcs",
      harga_jual: 22000,
      harga_pokok: 10000,
      url_gambar: "bakery_dining",
      is_aktif: 1,
      dibuat_pada: new Date().toISOString()
    },
    {
      id: 3,
      kode_barcode: "8991003",
      nama_barang: "CLUB SANDWICH",
      kategori: "MAKANAN",
      satuan: "pcs",
      harga_jual: 35000,
      harga_pokok: 15000,
      url_gambar: "bakery_dining",
      is_aktif: 1,
      dibuat_pada: new Date().toISOString()
    },
    {
      id: 4,
      kode_barcode: "8991004",
      nama_barang: "MATCHA LATTE",
      kategori: "MINUMAN",
      satuan: "gelas",
      harga_jual: 24000,
      harga_pokok: 11000,
      url_gambar: "local_cafe",
      is_aktif: 1,
      dibuat_pada: new Date().toISOString()
    }
  ],
  kasir: [], // Di-seed di bawah
  transaksi: [],
  item_transaksi: [],

  // TABEL BARU: pembayaran terpisah dari transaksi
  pembayaran: [],

  stok: [
    {
      id: 1,
      cabang_id: 1,
      barang_id: 1,
      terjual: 0,
      terjual_terakhir_reset: new Date().toISOString().split('T')[0], // tanggal reset terakhir
      target_harian: 150,
      diperbarui_pada: new Date().toISOString()
    },
    {
      id: 2,
      cabang_id: 1,
      barang_id: 2,
      terjual: 0,
      terjual_terakhir_reset: new Date().toISOString().split('T')[0],
      target_harian: 80,
      diperbarui_pada: new Date().toISOString()
    },
    {
      id: 3,
      cabang_id: 1,
      barang_id: 3,
      terjual: 0,
      terjual_terakhir_reset: new Date().toISOString().split('T')[0],
      target_harian: 45,
      diperbarui_pada: new Date().toISOString()
    },
    {
      id: 4,
      cabang_id: 1,
      barang_id: 4,
      terjual: 0,
      terjual_terakhir_reset: new Date().toISOString().split('T')[0],
      target_harian: 120,
      diperbarui_pada: new Date().toISOString()
    },
    {
      id: 5,
      cabang_id: 2,
      barang_id: 1,
      terjual: 0,
      terjual_terakhir_reset: new Date().toISOString().split('T')[0],
      target_harian: 90,
      diperbarui_pada: new Date().toISOString()
    },
    {
      id: 6,
      cabang_id: 2,
      barang_id: 2,
      terjual: 0,
      terjual_terakhir_reset: new Date().toISOString().split('T')[0],
      target_harian: 50,
      diperbarui_pada: new Date().toISOString()
    }
  ],
  shift_kasir: [],

  // --- MOCK DATABASE NOSQL (Firestore) ---
  transaksi_offline: [],
  antrean_sinkronisasi: [],

  // CACHE KATALOG BARANG — kini benar-benar digunakan
  cache_katalog_barang: [],

  log_perangkat: [],
  sesi_aktif: []
};

// SEEDING KASIR — PIN sekarang di-hash bcrypt

const sandiAdmin    = bcrypt.hashSync("admin123", 10);
const sandiManajer  = bcrypt.hashSync("manajer123", 10);
const sandiKasir    = bcrypt.hashSync("kasir123", 10);

// PIN juga di-hash untuk keamanan
const pinAdmin   = bcrypt.hashSync("123456", 10);
const pinManajer = bcrypt.hashSync("222222", 10);
const pinKasir   = bcrypt.hashSync("111111", 10);

dataAwal.kasir = [
  {
    id: 1,
    cabang_id: 1,
    nama_pengguna: "admin",
    kata_sandi_hash: sandiAdmin,
    pin_hash: pinAdmin,         // PIN sekarang di-hash
    nama_lengkap: "Admin Utama",
    peran: "admin",
    is_aktif: 1,
    login_terakhir: null,
    dibuat_pada: new Date().toISOString()
  },
  {
    id: 2,
    cabang_id: 1,
    nama_pengguna: "manajer01",
    kata_sandi_hash: sandiManajer,
    pin_hash: pinManajer,
    nama_lengkap: "Budi Santoso",
    peran: "manajer",
    is_aktif: 1,
    login_terakhir: null,
    dibuat_pada: new Date().toISOString()
  },
  {
    id: 3,
    cabang_id: 1,
    nama_pengguna: "kasir01",
    kata_sandi_hash: sandiKasir,
    pin_hash: pinKasir,
    nama_lengkap: "Andi Nugroho",
    peran: "kasir",
    is_aktif: 1,
    login_terakhir: null,
    dibuat_pada: new Date().toISOString()
  }
];

// KELAS BASIS DATA

class BasisData {
  constructor() {
    this.data = null;
    this.muatData();
    this.jadwalkanResetHarian();
  }

  muatData() {
    try {
      if (fs.existsSync(pathFileDb)) {
        const fileContent = fs.readFileSync(pathFileDb, 'utf-8');
        this.data = JSON.parse(fileContent);

        // Pastikan semua koleksi baru tersedia jika database lama belum punya
        if (!this.data.pembayaran) this.data.pembayaran = [];
        if (!this.data.cache_katalog_barang) this.data.cache_katalog_barang = [];

        // Migrasi: pastikan semua stok punya kolom terjual_terakhir_reset
        const hariIni = new Date().toISOString().split('T')[0];
        this.data.stok = (this.data.stok || []).map(s => ({
          ...s,
          terjual_terakhir_reset: s.terjual_terakhir_reset || hariIni
        }));

        // Migrasi: hash PIN lama yang masih plaintext
        this._migrasiPinPlaintext();

      } else {
        this.data = dataAwal;
        this.simpanKeFile();
      }
    } catch (e) {
      console.error("Gagal memuat basis data, menggunakan data awal default:", e);
      this.data = dataAwal;
    }
  }

  // Migrasi otomatis: PIN lama yang masih plaintext (6 angka) dikonversi ke hash
  _migrasiPinPlaintext() {
    let adaperubahan = false;
    this.data.kasir = (this.data.kasir || []).map(k => {
      // Jika pin_hash tidak ada tapi pin (lama) ada, hash PIN-nya
      if (!k.pin_hash && k.pin) {
        k.pin_hash = bcrypt.hashSync(String(k.pin), 10);
        delete k.pin; // Hapus PIN plaintext
        adaperubahan = true;
      }
      return k;
    });
    if (adaperubahan) {
      this.simpanKeFile();
      console.log("Migrasi PIN plaintext ke bcrypt hash selesai.");
    }
  }

  simpanKeFile() {
    try {
      fs.writeFileSync(pathFileDb, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error("Gagal menyimpan basis data ke file:", e);
    }
  }

    // RESET HARIAN OTOMATIS — terjual di-reset tiap hari baru
    resetTerjualHarian() {
    const hariIni = new Date().toISOString().split('T')[0];
    let adaReset = false;

    this.data.stok = this.data.stok.map(s => {
      if (s.terjual_terakhir_reset !== hariIni && s.terjual > 0) {
        adaReset = true;
        return {
          ...s,
          terjual: 0,
          terjual_terakhir_reset: hariIni,
          diperbarui_pada: new Date().toISOString()
        };
      }
      return s;
    });

    if (adaReset) {
      this.simpanKeFile();
      // Catat log reset harian di NoSQL
      this.tambah('log_perangkat', {
        cabang_id: 0,
        kasir_id: 0,
        tipe_kejadian: "reset_terjual_harian",
        pesan: `Reset harian kolom terjual dieksekusi untuk tanggal ${hariIni}`,
        timestamp: new Date().toISOString()
      });
      console.log(`Reset terjual harian dieksekusi: ${hariIni}`);
    }
  }

  // Jadwalkan pengecekan reset setiap jam — ringan dan tidak perlu cron eksternal
  jadwalkanResetHarian() {
    // Jalankan sekali saat startup
    this.resetTerjualHarian();

    // Lalu cek setiap 1 jam
    setInterval(() => {
      this.resetTerjualHarian();
    }, 60 * 60 * 1000);
  }

    // CACHE KATALOG BARANG — NoSQL
  
  // Perbarui cache katalog (dipanggil setiap kali ada perubahan barang)
  perbaruiCacheKatalog() {
    const barangAktif = this.data.barang.filter(b => b.is_aktif === 1);
    const cache = {
      id: "katalog_global",
      diperbarui_pada: new Date().toISOString(),
      jumlah_barang: barangAktif.length,
      data: barangAktif
    };

    // Upsert: ganti cache yang ada atau tambah baru
    const indeks = this.data.cache_katalog_barang.findIndex(c => c.id === "katalog_global");
    if (indeks !== -1) {
      this.data.cache_katalog_barang[indeks] = cache;
    } else {
      this.data.cache_katalog_barang.push(cache);
    }
    this.simpanKeFile();
    return cache;
  }

  // Ambil dari cache jika masih segar (< 5 menit), atau refresh
  ambilCacheKatalog() {
    const cache = this.data.cache_katalog_barang.find(c => c.id === "katalog_global");
    if (!cache) return null;

    const umurMilidetik = Date.now() - new Date(cache.diperbarui_pada).getTime();
    const maks5Menit = 5 * 60 * 1000;

    if (umurMilidetik > maks5Menit) {
      // Cache kadaluarsa, refresh
      return this.perbaruiCacheKatalog();
    }
    return cache;
  }

    // OPERASI CRUD UMUM
  
  ambilSemua(tabel) {
    return this.data[tabel] || [];
  }

  ambilBerdasarkanId(tabel, id) {
    const daftar = this.ambilSemua(tabel);
    return daftar.find(item => item.id === Number(id) || (typeof item.id === 'string' && item.id === id));
  }

  cariSatu(tabel, filterFungsi) {
    return this.ambilSemua(tabel).find(filterFungsi);
  }

  cariSemua(tabel, filterFungsi) {
    return this.ambilSemua(tabel).filter(filterFungsi);
  }

  tambah(tabel, itemBaru) {
    if (!this.data[tabel]) {
      this.data[tabel] = [];
    }

    // Auto-increment ID untuk basis data relasional
    if (!itemBaru.id) {
      const daftar = this.data[tabel];
      let maxId = 0;
      daftar.forEach(item => {
        if (typeof item.id === 'number' && item.id > maxId) {
          maxId = item.id;
        }
      });
      itemBaru.id = maxId + 1;
    }

    itemBaru.dibuat_pada = new Date().toISOString();
    this.data[tabel].push(itemBaru);
    this.simpanKeFile();
    return itemBaru;
  }

  perbarui(tabel, id, dataPerubahan) {
    const daftar = this.ambilSemua(tabel);
    const indeks = daftar.findIndex(item => item.id === Number(id) || (typeof item.id === 'string' && item.id === id));

    if (indeks !== -1) {
      daftar[indeks] = {
        ...daftar[indeks],
        ...dataPerubahan,
        diperbarui_pada: new Date().toISOString()
      };
      this.simpanKeFile();
      return daftar[indeks];
    }
    return null;
  }

  hapus(tabel, id) {
    const daftar = this.ambilSemua(tabel);
    const indeks = daftar.findIndex(item => item.id === Number(id) || (typeof item.id === 'string' && item.id === id));

    if (indeks !== -1) {
      const itemDihapus = daftar.splice(indeks, 1)[0];
      this.simpanKeFile();
      return itemDihapus;
    }
    return null;
  }
}

const instanceDb = new BasisData();

// Export Validator juga agar bisa dipakai di layanan-layanan
module.exports = instanceDb;
module.exports.Validator = Validator;
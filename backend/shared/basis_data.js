const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pathFileDb = path.join(__dirname, 'basis_data_toko.json');

// Struktur awal database dengan bahasa Indonesia
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
  kasir: [], // Akan di-seed di bawah
  transaksi: [],
  item_transaksi: [],
  stok: [
    { id: 1, cabang_id: 1, barang_id: 1, terjual: 0, target_harian: 150, diperbarui_pada: new Date().toISOString() },
    { id: 2, cabang_id: 1, barang_id: 2, terjual: 0, target_harian: 80, diperbarui_pada: new Date().toISOString() },
    { id: 3, cabang_id: 1, barang_id: 3, terjual: 0, target_harian: 45, diperbarui_pada: new Date().toISOString() },
    { id: 4, cabang_id: 1, barang_id: 4, terjual: 0, target_harian: 120, diperbarui_pada: new Date().toISOString() },
    { id: 5, cabang_id: 2, barang_id: 1, terjual: 0, target_harian: 90, diperbarui_pada: new Date().toISOString() },
    { id: 6, cabang_id: 2, barang_id: 2, terjual: 0, target_harian: 50, diperbarui_pada: new Date().toISOString() }
  ],
  shift_kasir: [],

  // --- MOCK DATABASE NOSQL (Firestore) ---
  transaksi_offline: [],
  antrean_sinkronisasi: [],
  cache_katalog_barang: [],
  log_perangkat: [],
  sesi_aktif: []
};

// Seeding kasir dengan sandi enkripsi
const sandiAdmin = bcrypt.hashSync("admin123", 10);
const sandiManajer = bcrypt.hashSync("manajer123", 10);
const sandiKasir = bcrypt.hashSync("kasir123", 10);

dataAwal.kasir = [
  {
    id: 1,
    cabang_id: 1,
    nama_pengguna: "admin",
    kata_sandi_hash: sandiAdmin,
    nama_lengkap: "Admin Utama",
    peran: "admin",
    pin: "123456",
    is_aktif: 1,
    login_terakhir: null,
    dibuat_pada: new Date().toISOString()
  },
  {
    id: 2,
    cabang_id: 1,
    nama_pengguna: "manajer01",
    kata_sandi_hash: sandiManajer,
    nama_lengkap: "Budi Santoso",
    peran: "manajer",
    pin: "222222",
    is_aktif: 1,
    login_terakhir: null,
    dibuat_pada: new Date().toISOString()
  },
  {
    id: 3,
    cabang_id: 1,
    nama_pengguna: "kasir01",
    kata_sandi_hash: sandiKasir,
    nama_lengkap: "Andi Nugroho",
    peran: "kasir",
    pin: "111111",
    is_aktif: 1,
    login_terakhir: null,
    dibuat_pada: new Date().toISOString()
  }
];

class BasisData {
  constructor() {
    this.data = null;
    this.muatData();
  }

  muatData() {
    try {
      if (fs.existsSync(pathFileDb)) {
        const fileContent = fs.readFileSync(pathFileDb, 'utf-8');
        this.data = JSON.parse(fileContent);
      } else {
        this.data = dataAwal;
        this.simpanKeFile();
      }
    } catch (e) {
      console.error("Gagal memuat basis data, menggunakan data awal default:", e);
      this.data = dataAwal;
    }
  }

  simpanKeFile() {
    try {
      fs.writeFileSync(pathFileDb, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error("Gagal menyimpan basis data ke file:", e);
    }
  }

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
    
    // Cari auto-increment ID untuk basis data relasional
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
module.exports = instanceDb;

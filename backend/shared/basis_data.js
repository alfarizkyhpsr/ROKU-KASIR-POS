require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');

// ─── DETEKSI MODE DATABASE ────────────────────────────────────────────────────
// USE_MYSQL  : DB_HOST (XAMPP lokal) atau CLOUD_SQL_CONNECTION_NAME (GCP)
// USE_FIRESTORE : GOOGLE_CLOUD_PROJECT atau FIRESTORE_PROJECT_ID (GCP)
// USE_NEDB   : default NoSQL lokal jika bukan GCP Firestore

const USE_MYSQL     = !!(process.env.DB_HOST || process.env.CLOUD_SQL_CONNECTION_NAME);
const USE_FIRESTORE = !!(process.env.GOOGLE_CLOUD_PROJECT || process.env.FIRESTORE_PROJECT_ID);
// NeDB selalu aktif untuk tabel NoSQL (sesi_aktif, log_perangkat, dll.)
// kecuali kalau pakai Firestore (GCP). MySQL dan NeDB bisa aktif bersamaan.
const USE_NEDB      = !USE_FIRESTORE;

const SQL_TABLES = new Set([
  'cabang', 'barang', 'kasir', 'transaksi',
  'item_transaksi', 'pembayaran', 'stok', 'shift_kasir', 'sesi_aktif'
]);

if (!USE_MYSQL && !USE_FIRESTORE) {
  console.warn('[DB] Tidak ada MySQL/Firestore — tabel SQL tidak tersedia. Mode NeDB-only (NoSQL saja).');
} else if (USE_MYSQL) {
  console.log('[DB] MySQL aktif untuk tabel SQL.');
}

console.log(`[DB] Mode: MySQL=${USE_MYSQL} | Firestore=${USE_FIRESTORE} | NeDB=${USE_NEDB}`);

// ─── VALIDATOR ────────────────────────────────────────────────────────────────
const Validator = {
  teks: (nilai, maks = 255) => {
    if (typeof nilai !== 'string') return false;
    const bersih = nilai.trim();
    if (bersih.length === 0 || bersih.length > maks) return false;
    if (/<[^>]*>|[<>"'`;]/.test(bersih)) return false;
    return true;
  },
  angka: (nilai, min = 0, maks = 999999999) => {
    const n = Number(nilai);
    return !isNaN(n) && n >= min && n <= maks;
  },
  pin:          (nilai) => /^\d{6}$/.test(String(nilai)),
  namapengguna: (nilai) => /^[a-z0-9_]{3,30}$/.test(String(nilai)),
  bersihkan:    (nilai) => {
    if (typeof nilai !== 'string') return '';
    return nilai.trim().replace(/[<>"'`;]/g, '');
  }
};

// ─── KELAS BASIS DATA ─────────────────────────────────────────────────────────
class BasisData {
  constructor() {
    if (USE_MYSQL) {
      this._pool = require('./db_mysql').ambilPool();
    }
    if (USE_FIRESTORE) {
      this._fs = require('./db_firestore').ambilFirestore();
    }
    // NeDB selalu diload untuk koleksi NoSQL lokal
    if (USE_NEDB) {
      this._nedb = require('./db_nedb');
    }

    if (USE_MYSQL) {
      this.jadwalkanResetHarian();
    }
  }

  // ── Apakah tabel ini SQL atau NoSQL? ─────────────────────────────────────────
  _adalahSQL(tabel) {
    return SQL_TABLES.has(tabel);
  }

  // ─── MySQL HELPERS ────────────────────────────────────────────────────────────

  async _mysqlAmbilSemua(tabel) {
    const [rows] = await this._pool.execute(`SELECT * FROM \`${tabel}\``);
    return rows;
  }

  async _mysqlAmbilById(tabel, id) {
    const [rows] = await this._pool.execute(
      `SELECT * FROM \`${tabel}\` WHERE id = ?`, [id]
    );
    return rows[0] || null;
  }

  async _mysqlTambah(tabel, data) {
    const now     = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ');
    const payload = { ...data };
    delete payload.id;
    if (!payload.dibuat_pada) payload.dibuat_pada = now;

    const cols         = Object.keys(payload).map(k => `\`${k}\``).join(', ');
    const placeholders = Object.keys(payload).map(() => '?').join(', ');
    const vals         = Object.values(payload);

    const [result] = await this._pool.execute(
      `INSERT INTO \`${tabel}\` (${cols}) VALUES (${placeholders})`, vals
    );
    return this._mysqlAmbilById(tabel, result.insertId);
  }

  async _mysqlPerbarui(tabel, id, data) {
    const now     = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ');
    const TANPA_DIPERBARUI = ['shift_kasir', 'transaksi', 'item_transaksi', 'pembayaran'];
    const payload = TANPA_DIPERBARUI.includes(tabel)
      ? { ...data }
      : { ...data, diperbarui_pada: now };
    const sets    = Object.keys(payload).map(k => `\`${k}\` = ?`).join(', ');
    const vals    = [...Object.values(payload), id];
    await this._pool.execute(
      `UPDATE \`${tabel}\` SET ${sets} WHERE id = ?`, vals
    );
    return this._mysqlAmbilById(tabel, id);
  }

  async _mysqlHapus(tabel, id) {
    const item = await this._mysqlAmbilById(tabel, id);
    if (item) {
      await this._pool.execute(`DELETE FROM \`${tabel}\` WHERE id = ?`, [id]);
    }
    return item;
  }

  // ─── FIRESTORE HELPERS ────────────────────────────────────────────────────────

  async _fsAmbilSemua(koleksi) {
    const snap = await this._fs.collection(koleksi).get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => !d._keterangan);
  }

  async _fsTambah(koleksi, data) {
    const payload = {
      ...data,
      dibuat_pada: data.dibuat_pada || new Date().toISOString()
    };
    delete payload.id;
    const docRef = await this._fs.collection(koleksi).add(payload);
    return { id: docRef.id, ...payload };
  }

  async _fsPerbarui(koleksi, id, data) {
    const payload = { ...data, diperbarui_pada: new Date().toISOString() };
    await this._fs.collection(koleksi).doc(String(id)).update(payload);
    const doc = await this._fs.collection(koleksi).doc(String(id)).get();
    return { id: doc.id, ...doc.data() };
  }

  async _fsHapus(koleksi, id) {
    const doc  = await this._fs.collection(koleksi).doc(String(id)).get();
    const data = doc.exists ? { id: doc.id, ...doc.data() } : null;
    if (data) await this._fs.collection(koleksi).doc(String(id)).delete();
    return data;
  }

  // ─── NEDB HELPERS (wrapper tipis, sudah di db_nedb.js) ───────────────────────

  async _nedbAmbilSemua(koleksi)        { return this._nedb.ambilSemua(koleksi); }
  async _nedbAmbilById(koleksi, id)     { return this._nedb.ambilById(koleksi, id); }
  async _nedbTambah(koleksi, data)      { return this._nedb.tambah(koleksi, data); }
  async _nedbPerbarui(koleksi, id, data){ return this._nedb.perbarui(koleksi, id, data); }
  async _nedbHapus(koleksi, id)         { return this._nedb.hapus(koleksi, id); }

  // ─── ROUTER: pilih backend berdasarkan tipe tabel ────────────────────────────

  _isNoSQL(tabel) {
    return !SQL_TABLES.has(tabel);
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────────

  async ambilSemua(tabel) {
    if (this._adalahSQL(tabel)) {
      if (USE_MYSQL)     return this._mysqlAmbilSemua(tabel);
      return [];
    }
    if (USE_FIRESTORE)   return this._fsAmbilSemua(tabel);
    if (USE_NEDB)        return this._nedbAmbilSemua(tabel);
    return [];
  }

  async ambilBerdasarkanId(tabel, id) {
    if (this._adalahSQL(tabel)) {
      if (USE_MYSQL)     return this._mysqlAmbilById(tabel, id);
      return null;
    }
    if (USE_FIRESTORE) {
      const doc = await this._fs.collection(tabel).doc(String(id)).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }
    if (USE_NEDB)        return this._nedbAmbilById(tabel, id);
    return null;
  }

  async cariSatu(tabel, filterFn) {
    const semua = await this.ambilSemua(tabel);
    return semua.find(filterFn) || null;
  }

  async cariSemua(tabel, filterFn) {
    const semua = await this.ambilSemua(tabel);
    return semua.filter(filterFn);
  }

  async tambah(tabel, data) {
    if (this._adalahSQL(tabel)) {
      if (USE_MYSQL)     return this._mysqlTambah(tabel, data);
      throw new Error('MySQL tidak terkonfigurasi. Set DB_HOST di .env');
    }
    if (USE_FIRESTORE)   return this._fsTambah(tabel, data);
    if (USE_NEDB)        return this._nedbTambah(tabel, data);
    throw new Error('Tidak ada backend database yang aktif.');
  }

  async perbarui(tabel, id, data) {
    if (this._adalahSQL(tabel)) {
      if (USE_MYSQL)     return this._mysqlPerbarui(tabel, id, data);
      throw new Error('MySQL tidak terkonfigurasi. Set DB_HOST di .env');
    }
    if (USE_FIRESTORE)   return this._fsPerbarui(tabel, id, data);
    if (USE_NEDB)        return this._nedbPerbarui(tabel, id, data);
    throw new Error('Tidak ada backend database yang aktif.');
  }

  async hapus(tabel, id) {
    if (this._adalahSQL(tabel)) {
      if (USE_MYSQL)     return this._mysqlHapus(tabel, id);
      throw new Error('MySQL tidak terkonfigurasi. Set DB_HOST di .env');
    }
    if (USE_FIRESTORE)   return this._fsHapus(tabel, id);
    if (USE_NEDB)        return this._nedbHapus(tabel, id);
    throw new Error('Tidak ada backend database yang aktif.');
  }

  async hapusBanyakByField(tabel, field, values) {
    if (this._adalahSQL(tabel)) {
      if (!USE_MYSQL) return;
      const placeholders = values.map(() => '?').join(',');
      await this._pool.execute(
        `DELETE FROM \`${tabel}\` WHERE \`${field}\` IN (${placeholders})`, values
      );
      return;
    }
    if (USE_FIRESTORE) {
      const snap  = await this._fs.collection(tabel)
        .where(field, 'in', values.slice(0, 30)).get();
      const batch = this._fs.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return;
    }
    if (USE_NEDB) await this._nedb.hapusBanyak(tabel, field, values);
  }

  // ─── CACHE KATALOG BARANG (NoSQL) ────────────────────────────────────────────

  async perbaruiCacheKatalog() {
    const semuaBarang = await this.ambilSemua('barang');
    const barangAktif = semuaBarang.filter(b => b.is_aktif === 1 || b.is_aktif === true);
    
    // Strip base64 for cache to avoid blooming NeDB/Firestore document limits
    const barangUntukCache = barangAktif.map(b => ({
      ...b,
      url_gambar: (b.url_gambar && b.url_gambar.startsWith('data:')) ? 'inventory_2' : (b.url_gambar || 'inventory_2')
    }));

    const cache = {
      diperbarui_pada: new Date().toISOString(),
      jumlah_barang:   barangUntukCache.length,
      data:            barangUntukCache
    };

    if (USE_FIRESTORE) {
      await this._fs.collection('cache_katalog_barang').doc('katalog_global').set(cache);
      return { id: 'katalog_global', ...cache };
    }
    if (USE_NEDB) {
      return this._nedb.set('cache_katalog_barang', 'katalog_global', cache);
    }
    return { id: 'katalog_global', ...cache };
  }

  async ambilCacheKatalog() {
    let cache = null;
    if (USE_FIRESTORE) {
      const doc = await this._fs.collection('cache_katalog_barang').doc('katalog_global').get();
      if (!doc.exists) return this.perbaruiCacheKatalog();
      cache = { id: doc.id, ...doc.data() };
    } else if (USE_NEDB) {
      cache = await this._nedb.ambilById('cache_katalog_barang', 'katalog_global');
    } else if (!USE_MYSQL) {
      return null;
    }

    if (!cache) return this.perbaruiCacheKatalog();
    const umur = Date.now() - new Date(cache.diperbarui_pada).getTime();
    if (umur > 5 * 60 * 1000) return this.perbaruiCacheKatalog();
    return cache;
  }

  // ─── RESET TERJUAL HARIAN (MySQL) ────────────────────────────────────────────

  async resetTerjualHarian() {
    if (!USE_MYSQL) return;
    const hariIni = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    try {
      const [res] = await this._pool.execute(
        `UPDATE stok SET terjual = 0, terjual_terakhir_reset = ?
         WHERE terjual_terakhir_reset < ? AND terjual > 0`,
        [hariIni, hariIni]
      );
      if (res.affectedRows > 0) {
        console.log(`[DB] Reset terjual harian: ${res.affectedRows} baris — ${hariIni}`);
      }
    } catch (e) {
      console.error('[DB] Reset harian gagal:', e.message);
    }
  }

  // ─── HITUNG TERJUAL HARI INI DARI TRANSAKSI AKTUAL ─────────────────────────
  // Lebih andal dari stok.terjual: tahan terhadap restart server & mati listrik
  // karena selalu dihitung ulang dari tabel item_transaksi
  async hitungTerjualBarangHariIni(barangId, cabangId, tanggal) {
    if (!USE_MYSQL || !this._pool) return null; // null = fallback ke stok.terjual
    try {
      const [rows] = await this._pool.execute(
        `SELECT COALESCE(SUM(it.jumlah), 0) AS total
         FROM item_transaksi it
         JOIN transaksi t ON t.id = it.transaksi_id
         WHERE it.barang_id = ?
           AND t.cabang_id = ?
           AND DATE(t.dibuat_pada) = ?`,
        [barangId, cabangId, tanggal]
      );
      return Number(rows[0].total) || 0;
    } catch (e) {
      console.error('[DB] hitungTerjualBarangHariIni error:', e.message);
      return null; // null = fallback ke stok.terjual
    }
  }

  jadwalkanResetHarian() {
    this.resetTerjualHarian();
    setInterval(() => this.resetTerjualHarian(), 60 * 60 * 1000);
  }
}

const instanceDb = new BasisData();
module.exports        = instanceDb;
module.exports.Validator = Validator;


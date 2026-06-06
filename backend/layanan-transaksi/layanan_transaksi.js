const express = require('express');
const cors    = require('cors');
const { Storage } = require('@google-cloud/storage');
const basisData     = require('../shared/basis_data');
const { Validator } = require('../shared/basis_data');
const { verifikasiToken, hanyaManajerAtauAdmin } = require('../shared/middleware_auth');

// Helper: url_gambar bisa berupa nama icon ATAU data base64 — jangan dilewatkan Validator.bersihkan()
// karena base64 mengandung karakter ; dan " yang akan dihapus Validator
function bersihkanGambar(nilai) {
  if (!nilai || typeof nilai !== 'string') return 'inventory_2';
  const trimmed = nilai.trim();
  if (trimmed.startsWith('data:image/')) return trimmed; // base64 — simpan apa adanya
  return trimmed.replace(/[<>"'`;]/g, '');              // icon name — bersihkan seperti biasa
}



const app  = express();
const PORT = process.env.PORT || 5002;

// Google Cloud Storage (optional) — hanya aktif bila env GCS_BUCKET diset
const GCS_BUCKET = process.env.GCS_BUCKET || null;
let gcsClient = null;
if (GCS_BUCKET) {
  try {
    gcsClient = new Storage();
  } catch (e) {
    console.warn('[GCS] Gagal inisialisasi client GCS:', e.message);
    gcsClient = null;
  }
}

async function uploadGambarKeGCS(base64String, namaPrefiks = 'barang') {
  if (!gcsClient || !GCS_BUCKET) return base64String;
  try {
    const m = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(base64String.trim());
    if (!m) return base64String;
    const mimeType = m[1];
    const dataBase64 = m[2];
    const ext = mimeType.split('/')[1] || 'jpg';
    const fileName = `${namaPrefiks}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(dataBase64, 'base64');
    const file = gcsClient.bucket(GCS_BUCKET).file(fileName);
    await file.save(buffer, { metadata: { contentType: mimeType } });
    // Coba set file public agar mudah diakses dari frontend
    try { await file.makePublic(); } catch (_) { /* ignore permission errors */ }
    return `https://storage.googleapis.com/${GCS_BUCKET}/${fileName}`;
  } catch (e) {
    console.error('[GCS] Upload error:', e.message);
    return base64String;
  }
}

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));


// ─── 1. CRUD BARANG ──────────────────────────────────────────────────────────

// GET /api/barang
// Strategi cache dua lapis:
// - Saat online: selalu ambil fresh dari MySQL (termasuk url_gambar base64)
// - Cache NeDB disimpan TANPA base64 (diganti icon fallback) → aman untuk offline
// - Saat MySQL error (offline): fallback ke cache NeDB
app.get('/api/barang', verifikasiToken, async (req, res) => {
  try {
    // Coba ambil fresh dari MySQL
    const barang = await basisData.ambilSemua('barang');

    // Update cache di background (tidak ditunggu)
    basisData.perbaruiCacheKatalog().catch(() => {});

    return res.json({ sukses: true, data: barang, dari_cache: false });
  } catch (e) {
    // MySQL tidak bisa diakses (offline) — coba fallback ke cache NeDB
    console.warn('[Barang] MySQL tidak tersedia, mencoba cache offline...');
    try {
      const cacheData = await basisData.ambilCacheKatalog();
      if (cacheData && cacheData.data && cacheData.data.length > 0) {
        return res.json({ sukses: true, data: cacheData.data, dari_cache: true, pesan_offline: 'Data dari cache offline. Gambar mungkin tidak tampil.' });
      }
    } catch (cacheErr) {
      console.error('[Barang] Cache offline juga gagal:', cacheErr.message);
    }
    return res.status(503).json({ sukses: false, pesan: 'Server tidak tersedia dan tidak ada cache offline.' });
  }
});

// POST /api/barang
app.post('/api/barang', verifikasiToken, hanyaManajerAtauAdmin, async (req, res) => {
  try {
    const { kode_barcode, nama_barang, kategori, satuan, harga_jual, harga_pokok, url_gambar } = req.body;

    if (!Validator.teks(kode_barcode, 20))          return res.status(400).json({ sukses: false, pesan: 'Kode barcode tidak valid.' });
    if (!Validator.teks(nama_barang, 150))           return res.status(400).json({ sukses: false, pesan: 'Nama barang tidak valid.' });
    if (!Validator.angka(harga_jual, 1, 99999999))   return res.status(400).json({ sukses: false, pesan: 'Harga jual tidak valid.' });
    if (!Validator.angka(harga_pokok, 0, 99999999))  return res.status(400).json({ sukses: false, pesan: 'Harga pokok tidak valid.' });
    if (Number(harga_pokok) >= Number(harga_jual))   return res.status(400).json({ sukses: false, pesan: 'Harga pokok tidak boleh >= harga jual.' });

    const sudahAda = await basisData.cariSatu('barang', b => b.kode_barcode === kode_barcode.trim());
    if (sudahAda) return res.status(400).json({ sukses: false, pesan: 'Barcode sudah terdaftar.' });

    const kategoriBersih = kategori && ['MAKANAN', 'MINUMAN', 'UMUM'].includes(kategori.toUpperCase())
      ? kategori.toUpperCase() : 'UMUM';

    // Tangani upload gambar base64 ke GCS jika ada dan env diset
    let gambarFinal = bersihkanGambar(url_gambar);
    if (gambarFinal && gambarFinal.startsWith('data:')) {
      gambarFinal = await uploadGambarKeGCS(gambarFinal, 'barang');
    }

    // Validasi ukuran: MySQL TEXT maks ~65KB, MEDIUMTEXT maks ~16MB
    // Jika GCS tidak dipakai dan gambar masih base64, batasi ukuran
    if (gambarFinal && gambarFinal.startsWith('data:') && gambarFinal.length > 500000) {
      return res.status(400).json({ sukses: false, pesan: 'Ukuran gambar terlalu besar (maks ~375KB). Kompres gambar terlebih dahulu, atau konfigurasi GCS_BUCKET.' });
    }
    const baru = await basisData.tambah('barang', {
      kode_barcode: Validator.bersihkan(kode_barcode).trim(),
      nama_barang:  Validator.bersihkan(nama_barang).toUpperCase(),
      kategori: kategoriBersih,
      satuan: satuan ? Validator.bersihkan(satuan).toLowerCase() : 'pcs',
      harga_jual:  Number(harga_jual),
      harga_pokok: Number(harga_pokok),
      url_gambar: gambarFinal,
      is_aktif: 1
    });

    const semuaCabang = await basisData.ambilSemua('cabang');
    const hariIni = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    await Promise.all(semuaCabang.map(c => basisData.tambah('stok', {
      cabang_id: c.id, barang_id: baru.id,
      terjual: 0, terjual_terakhir_reset: hariIni,
      target_harian: 100
    })));

    await basisData.perbaruiCacheKatalog();
    return res.status(201).json({ sukses: true, pesan: 'Barang berhasil ditambahkan.', data: baru });
  } catch (e) { console.error('[POST /barang]', e.message || e); return res.status(500).json({ sukses: false, pesan: 'Kesalahan server: ' + (e.message || 'Unknown error') }); }
});

// GET /api/barang/:id
app.get('/api/barang/:id', verifikasiToken, async (req, res) => {
  try {
    if (!Validator.angka(req.params.id, 1)) return res.status(400).json({ sukses: false, pesan: 'ID tidak valid.' });
    const barang = await basisData.ambilBerdasarkanId('barang', req.params.id);
    if (!barang) return res.status(404).json({ sukses: false, pesan: 'Barang tidak ditemukan.' });
    return res.json({ sukses: true, data: barang });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// PUT /api/barang/:id
app.put('/api/barang/:id', verifikasiToken, hanyaManajerAtauAdmin, async (req, res) => {
  try {
    if (!Validator.angka(req.params.id, 1)) return res.status(400).json({ sukses: false, pesan: 'ID tidak valid.' });
    const barang = await basisData.ambilBerdasarkanId('barang', req.params.id);
    if (!barang) return res.status(404).json({ sukses: false, pesan: 'Barang tidak ditemukan.' });

    const payload = {};
    if (req.body.nama_barang !== undefined) {
      if (!Validator.teks(req.body.nama_barang, 150)) return res.status(400).json({ sukses: false, pesan: 'Nama barang tidak valid.' });
      payload.nama_barang = Validator.bersihkan(req.body.nama_barang).toUpperCase();
    }
    if (req.body.harga_jual !== undefined) {
      if (!Validator.angka(req.body.harga_jual, 1, 99999999)) return res.status(400).json({ sukses: false, pesan: 'Harga jual tidak valid.' });
      payload.harga_jual = Number(req.body.harga_jual);
    }
    if (req.body.harga_pokok !== undefined) {
      if (!Validator.angka(req.body.harga_pokok, 0, 99999999)) return res.status(400).json({ sukses: false, pesan: 'Harga pokok tidak valid.' });
      payload.harga_pokok = Number(req.body.harga_pokok);
    }
    if (req.body.kategori !== undefined) {
      if (!['MAKANAN', 'MINUMAN', 'UMUM'].includes(req.body.kategori.toUpperCase())) return res.status(400).json({ sukses: false, pesan: 'Kategori tidak valid.' });
      payload.kategori = req.body.kategori.toUpperCase();
    }
    if (req.body.satuan !== undefined)    payload.satuan    = Validator.bersihkan(req.body.satuan);
    if (req.body.url_gambar !== undefined) {
      let gambarFinal = bersihkanGambar(req.body.url_gambar);
      if (gambarFinal && gambarFinal.startsWith('data:')) {
        gambarFinal = await uploadGambarKeGCS(gambarFinal, `barang-${req.params.id}`);
      }
      // Validasi ukuran setelah GCS upload (jika GCS tidak dipakai, base64 harus cukup kecil)
      if (gambarFinal && gambarFinal.startsWith('data:') && gambarFinal.length > 500000) {
        return res.status(400).json({ sukses: false, pesan: 'Ukuran gambar terlalu besar (maks ~375KB). Kompres gambar terlebih dahulu, atau konfigurasi GCS_BUCKET.' });
      }
      payload.url_gambar = gambarFinal;
    }
    if (req.body.is_aktif !== undefined)  payload.is_aktif  = req.body.is_aktif ? 1 : 0;

    const updated = await basisData.perbarui('barang', req.params.id, payload);
    await basisData.perbaruiCacheKatalog();
    return res.json({ sukses: true, pesan: 'Barang berhasil diperbarui.', data: updated });
  } catch (e) { console.error('[PUT /barang/:id]', e.message || e); return res.status(500).json({ sukses: false, pesan: 'Kesalahan server: ' + (e.message || 'Unknown error') }); }
});

// DELETE /api/barang/:id
app.delete('/api/barang/:id', verifikasiToken, hanyaManajerAtauAdmin, async (req, res) => {
  try {
    if (!Validator.angka(req.params.id, 1)) return res.status(400).json({ sukses: false, pesan: 'ID tidak valid.' });
    const barang = await basisData.ambilBerdasarkanId('barang', req.params.id);
    if (!barang) return res.status(404).json({ sukses: false, pesan: 'Barang tidak ditemukan.' });
    await basisData.perbarui('barang', req.params.id, { is_aktif: 0 });
    await basisData.perbaruiCacheKatalog();
    return res.json({ sukses: true, pesan: 'Barang berhasil dinonaktifkan.' });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// GET /api/barang/:id/target
app.get('/api/barang/:id/target', verifikasiToken, async (req, res) => {
  try {
    if (!Validator.angka(req.params.id, 1)) return res.status(400).json({ sukses: false, pesan: 'ID tidak valid.' });
    const barangId = Number(req.params.id);
    const hariIni = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

    let daftarStok = await basisData.cariSemua('stok', s => s.barang_id === barangId);

    // AUTO-CREATE: jika barang belum punya entri stok untuk cabang tertentu, buat otomatis
    const semuaCabang = await basisData.ambilSemua('cabang');
    const cabangSudahAda = new Set(daftarStok.map(s => s.cabang_id));
    const cabangBaru = semuaCabang.filter(c => !cabangSudahAda.has(c.id));
    if (cabangBaru.length > 0) {
      await Promise.all(cabangBaru.map(c => basisData.tambah('stok', {
        cabang_id: c.id, barang_id: barangId,
        terjual: 0, terjual_terakhir_reset: hariIni,
        target_harian: 100
      })));
      daftarStok = await basisData.cariSemua('stok', s => s.barang_id === barangId);
    }

    const hasil = await Promise.all(daftarStok.map(async s => {
      const cabang = await basisData.ambilBerdasarkanId('cabang', s.cabang_id);

      // HITUNG DARI TRANSAKSI AKTUAL — tahan restart server & mati listrik
      // Jika MySQL tersedia: hitung SUM(jumlah) dari item_transaksi hari ini
      // Jika tidak (offline): fallback ke stok.terjual
      const terjualDariTransaksi = await basisData.hitungTerjualBarangHariIni(
        barangId, s.cabang_id, hariIni
      );
      const terjualAktual = terjualDariTransaksi !== null
        ? terjualDariTransaksi
        : (s.terjual || 0);

      return {
        id: s.id, cabang_id: s.cabang_id,
        nama_cabang: cabang ? cabang.nama_cabang : 'Tidak Diketahui',
        kota: cabang ? cabang.kota : '-',
        terjual: terjualAktual,
        target_harian: s.target_harian || 100,
        terjual_terakhir_reset: hariIni
      };
    }));

    return res.json({ sukses: true, data: hasil });
  } catch (e) { console.error('[target]', e); return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});


// PUT /api/target/:id
app.put('/api/target/:id', verifikasiToken, hanyaManajerAtauAdmin, async (req, res) => {
  try {
    const { target_baru } = req.body;
    if (!Validator.angka(target_baru, 1, 99999)) return res.status(400).json({ sukses: false, pesan: 'Target harian tidak valid.' });
    if (!Validator.angka(req.params.id, 1))       return res.status(400).json({ sukses: false, pesan: 'ID tidak valid.' });

    const stok = await basisData.ambilBerdasarkanId('stok', req.params.id);
    if (!stok) return res.status(404).json({ sukses: false, pesan: 'Data target tidak ditemukan.' });

    // FIX: Manajer hanya boleh mengubah target cabangnya sendiri
    if (req.kasir.peran === 'manajer' && stok.cabang_id !== req.kasir.cabang_id) {
      return res.status(403).json({ sukses: false, pesan: 'Akses ditolak. Manajer hanya dapat mengatur target cabangnya sendiri.' });
    }

    const updated = await basisData.perbarui('stok', req.params.id, { target_harian: Number(target_baru) });
    return res.json({ sukses: true, pesan: 'Target berhasil diatur.', data: updated });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});


// ─── 2. TRANSAKSI POS ────────────────────────────────────────────────────────

// POST /api/transaksi
app.post('/api/transaksi', verifikasiToken, async (req, res) => {
  try {
    const { cabang_id, kasir_id, shift_id, total_belanja, diskon, pajak, metode_pembayaran, jumlah_bayar, jumlah_kembalian, item, offline, id_offline } = req.body;

    if (!item || !Array.isArray(item) || item.length === 0) return res.status(400).json({ sukses: false, pesan: 'Item keranjang tidak boleh kosong.' });
    if (!Validator.angka(total_belanja, 1, 999999999)) return res.status(400).json({ sukses: false, pesan: 'Total belanja tidak valid.' });
    if (!['tunai', 'qris', 'debit', 'credit'].includes(metode_pembayaran)) return res.status(400).json({ sukses: false, pesan: 'Metode pembayaran tidak valid.' });

    for (const itm of item) {
      if (!Validator.angka(itm.barang_id, 1))        return res.status(400).json({ sukses: false, pesan: 'ID barang tidak valid.' });
      if (!Validator.angka(itm.jumlah, 1, 9999))     return res.status(400).json({ sukses: false, pesan: 'Jumlah item tidak valid.' });
      if (!Validator.angka(itm.harga_satuan, 1, 99999999)) return res.status(400).json({ sukses: false, pesan: 'Harga satuan tidak valid.' });
    }

    // MODE OFFLINE → simpan ke Firestore
    if (offline) {
      const txOff = await basisData.tambah('transaksi_offline', {
        id_offline: id_offline || `OFF-${Date.now()}`,
        cabang_id: Number(cabang_id || req.kasir.cabang_id),
        kasir_id:  Number(kasir_id  || req.kasir.id),
        shift_id:  Number(shift_id  || 0),
        total_belanja: Number(total_belanja), diskon: Number(diskon || 0), pajak: Number(pajak || 0),
        metode_pembayaran, jumlah_bayar: Number(jumlah_bayar), jumlah_kembalian: Number(jumlah_kembalian),
        item, synced: 0, dibuat_pada: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19)
      });
      await basisData.tambah('log_perangkat', {
        cabang_id: Number(cabang_id || req.kasir.cabang_id), kasir_id: Number(kasir_id || req.kasir.id),
        tipe_kejadian: 'offline_transaction', pesan: `Transaksi offline: ${txOff.id_offline}`,
        timestamp: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19)
      });
      return res.status(201).json({ sukses: true, pesan: 'Transaksi disimpan offline di Firestore.', offline: true, data: txOff });
    }

    // MODE ONLINE → validasi shift
    if (shift_id && Number(shift_id) > 0) {
      const shift = await basisData.ambilBerdasarkanId('shift_kasir', shift_id);
      if (!shift || shift.status !== 'buka') return res.status(400).json({ sukses: false, pesan: 'Shift kasir tidak aktif.' });
    }

    const kode      = `TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const cabangId  = Number(cabang_id || req.kasir.cabang_id);

    const tx = await basisData.tambah('transaksi', {
      kode_transaksi: kode,
      cabang_id: cabangId, kasir_id: Number(kasir_id || req.kasir.id),
      shift_id: Number(shift_id || 0), total_belanja: Number(total_belanja),
      diskon: Number(diskon || 0), pajak: Number(pajak || 0),
      metode_pembayaran, jumlah_bayar: Number(jumlah_bayar),
      jumlah_kembalian: Number(jumlah_kembalian), status_sinkronisasi: 1,
      dibuat_pada: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19)
    });

    await basisData.tambah('pembayaran', {
      transaksi_id: tx.id, metode: metode_pembayaran, jumlah: Number(total_belanja),
      jumlah_bayar: metode_pembayaran === 'tunai' ? Number(jumlah_bayar) : Number(total_belanja),
      jumlah_kembalian: metode_pembayaran === 'tunai' ? Number(jumlah_kembalian) : 0,
      status: 'sukses', referensi: metode_pembayaran !== 'tunai' ? `REF-${Date.now()}` : null,
      dibuat_pada: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19)
    });

    const hariIniTx = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    await Promise.all(item.map(async itm => {
      await basisData.tambah('item_transaksi', {
        transaksi_id: tx.id, barang_id: itm.barang_id,
        jumlah: Number(itm.jumlah), harga_satuan: Number(itm.harga_satuan),
        subtotal: Number(itm.jumlah) * Number(itm.harga_satuan)
      });
      const stok = await basisData.cariSatu('stok', s => s.cabang_id === cabangId && s.barang_id === itm.barang_id);
      if (stok) {
        // Reset terjual ke 0 jika sudah ganti hari, lalu tambahkan jumlah baru
        const terjualHariIni = stok.terjual_terakhir_reset === hariIniTx ? Number(stok.terjual || 0) : 0;
        await basisData.perbarui('stok', stok.id, {
          terjual: terjualHariIni + Number(itm.jumlah),
          terjual_terakhir_reset: hariIniTx
        });
      }
    }));

    if (shift_id && Number(shift_id) > 0) {
      const shift = await basisData.ambilBerdasarkanId('shift_kasir', shift_id);
      if (shift) {
        await basisData.perbarui('shift_kasir', shift_id, {
          total_penjualan: Number(shift.total_penjualan || 0) + Number(total_belanja),
          penjualan_tunai: Number(shift.penjualan_tunai || 0) + (metode_pembayaran === 'tunai' ? Number(total_belanja) : 0),
          penjualan_non_tunai: Number(shift.penjualan_non_tunai || 0) + (metode_pembayaran !== 'tunai' ? Number(total_belanja) : 0)
        });
      }
    }

    return res.status(201).json({ sukses: true, pesan: 'Transaksi berhasil diproses online (Cloud SQL).', offline: false, data: tx });
  } catch (e) { console.error(e); return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// GET /api/transaksi
app.get('/api/transaksi', verifikasiToken, async (req, res) => {
  try {
    const cabangId = req.kasir.peran !== 'admin' ? req.kasir.cabang_id : null;
    let transaksi  = await basisData.ambilSemua('transaksi');
    if (cabangId) transaksi = transaksi.filter(t => t.cabang_id === cabangId);

    const detail = await Promise.all(transaksi.map(async t => {
      const kas = await basisData.ambilBerdasarkanId('kasir', t.kasir_id);
      const cab = await basisData.ambilBerdasarkanId('cabang', t.cabang_id);
      return { ...t, nama_kasir: kas ? kas.nama_lengkap : 'Kasir', nama_cabang: cab ? cab.nama_cabang : 'Cabang' };
    }));

    detail.sort((a, b) => new Date(b.dibuat_pada) - new Date(a.dibuat_pada));
    return res.json({ sukses: true, data: detail });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// GET /api/transaksi/:id
app.get('/api/transaksi/:id', verifikasiToken, async (req, res) => {
  try {
    if (!Validator.angka(req.params.id, 1)) return res.status(400).json({ sukses: false, pesan: 'ID tidak valid.' });
    const tx = await basisData.ambilBerdasarkanId('transaksi', req.params.id);
    if (!tx) return res.status(404).json({ sukses: false, pesan: 'Transaksi tidak ditemukan.' });

    const items = await basisData.cariSemua('item_transaksi', i => i.transaksi_id === tx.id);
    const itemsDetail = await Promise.all(items.map(async i => {
      const b = await basisData.ambilBerdasarkanId('barang', i.barang_id);
      return { ...i, nama_barang: b ? b.nama_barang : 'Tidak Dikenal', url_gambar: b ? b.url_gambar : 'inventory_2' };
    }));

    const pembayaran = await basisData.cariSatu('pembayaran', p => p.transaksi_id === tx.id);
    const kasir      = await basisData.ambilBerdasarkanId('kasir', tx.kasir_id);
    const cabang     = await basisData.ambilBerdasarkanId('cabang', tx.cabang_id);

    return res.json({ sukses: true, data: { ...tx, nama_kasir: kasir ? kasir.nama_lengkap : 'Kasir', nama_cabang: cabang ? cabang.nama_cabang : 'Cabang', items: itemsDetail, pembayaran: pembayaran || null } });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// POST /api/transaksi/sinkronisasi
app.post('/api/transaksi/sinkronisasi', verifikasiToken, async (req, res) => {
  try {
    const { antrean } = req.body;
    if (!antrean || !Array.isArray(antrean) || antrean.length === 0) {
      return res.status(400).json({ sukses: false, pesan: 'Tidak ada transaksi offline untuk disinkronisasi.' });
    }

    const hasil = [];

    for (const txOff of antrean) {
      const sudahAda = await basisData.cariSatu('transaksi', t =>
        t.kode_transaksi === txOff.id_offline || t.kode_transaksi.includes(txOff.id_offline)
      );
      if (sudahAda) { hasil.push({ id_offline: txOff.id_offline, sukses: true, pesan: 'Sudah pernah disinkronisasi.' }); continue; }

      const tx = await basisData.tambah('transaksi', {
        kode_transaksi: txOff.id_offline, cabang_id: txOff.cabang_id, kasir_id: txOff.kasir_id,
        shift_id: txOff.shift_id, total_belanja: txOff.total_belanja, diskon: txOff.diskon,
        pajak: txOff.pajak, metode_pembayaran: txOff.metode_pembayaran,
        jumlah_bayar: txOff.jumlah_bayar, jumlah_kembalian: txOff.jumlah_kembalian,
        status_sinkronisasi: 1, dibuat_pada: txOff.dibuat_pada
      });

      await basisData.tambah('pembayaran', {
        transaksi_id: tx.id, metode: txOff.metode_pembayaran, jumlah: txOff.total_belanja,
        jumlah_bayar: txOff.metode_pembayaran === 'tunai' ? txOff.jumlah_bayar : txOff.total_belanja,
        jumlah_kembalian: txOff.metode_pembayaran === 'tunai' ? txOff.jumlah_kembalian : 0,
        status: 'sukses', referensi: txOff.metode_pembayaran !== 'tunai' ? `REF-SYNC-${Date.now()}` : null,
        dibuat_pada: txOff.dibuat_pada
      });

      const hariIniSync = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
      await Promise.all((txOff.item || []).map(async itm => {
        await basisData.tambah('item_transaksi', {
          transaksi_id: tx.id, barang_id: itm.barang_id,
          jumlah: itm.jumlah, harga_satuan: itm.harga_satuan,
          subtotal: itm.jumlah * itm.harga_satuan
        });
        const stok = await basisData.cariSatu('stok', s => s.cabang_id === txOff.cabang_id && s.barang_id === itm.barang_id);
        if (stok) {
          // Reset terjual ke 0 jika sudah ganti hari, lalu tambahkan jumlah baru
          const terjualHariIni = stok.terjual_terakhir_reset === hariIniSync ? Number(stok.terjual || 0) : 0;
          await basisData.perbarui('stok', stok.id, {
            terjual: terjualHariIni + Number(itm.jumlah),
            terjual_terakhir_reset: hariIniSync
          });
        }
      }));

      if (txOff.shift_id) {
        const shift = await basisData.ambilBerdasarkanId('shift_kasir', txOff.shift_id);
        if (shift) {
          await basisData.perbarui('shift_kasir', txOff.shift_id, {
            total_penjualan: Number(shift.total_penjualan || 0) + Number(txOff.total_belanja),
            penjualan_tunai: Number(shift.penjualan_tunai || 0) + (txOff.metode_pembayaran === 'tunai' ? Number(txOff.total_belanja) : 0),
            penjualan_non_tunai: Number(shift.penjualan_non_tunai || 0) + (txOff.metode_pembayaran !== 'tunai' ? Number(txOff.total_belanja) : 0)
          });
        }
      }

      const waktuSekarang = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19);
      await basisData.tambah('antrean_sinkronisasi', {
        cabang_id: txOff.cabang_id, tipe: 'transaksi', payload_id: tx.id,
        status: 'done',
        enqueued_at: txOff.dibuat_pada || waktuSekarang, // FIX: fallback jika dibuat_pada undefined
        processed_at: waktuSekarang
      });

      hasil.push({ id_offline: txOff.id_offline, sukses: true, database_id: tx.id });
    }

    // Bersihkan antrean offline yang sudah disinkronisasi
    const idOfflines = antrean.map(a => a.id_offline);
    await basisData.hapusBanyakByField('transaksi_offline', 'id_offline', idOfflines);

    await basisData.tambah('log_perangkat', {
      cabang_id: req.kasir.cabang_id,
      kasir_id: req.kasir.id,
      tipe_kejadian: 'sync',
      pesan: `Sinkronisasi antrean NoSQL FIFO berhasil diselesaikan (${antrean.length} TX)`,
      timestamp: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19)
    });

    return res.json({ sukses: true, pesan: 'Sinkronisasi berhasil.', hasil });
  } catch (e) { console.error(e); return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});


// ─── 3. SHIFT KASIR ──────────────────────────────────────────────────────────

// GET /api/shift/daftar
app.get('/api/shift/daftar', verifikasiToken, async (req, res) => {
  try {
    const cabangId = req.kasir.peran !== 'admin' ? req.kasir.cabang_id : null;
    let shift = await basisData.ambilSemua('shift_kasir');
    if (cabangId) shift = shift.filter(s => s.cabang_id === cabangId);

    const detail = await Promise.all(shift.map(async s => {
      const kas = await basisData.ambilBerdasarkanId('kasir', s.kasir_id);
      return { ...s, nama_kasir: kas ? kas.nama_lengkap : 'Kasir' };
    }));
    detail.sort((a, b) => new Date(b.dibuka_pada) - new Date(a.dibuka_pada));
    return res.json({ sukses: true, data: detail });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// POST /api/shift/buka
app.post('/api/shift/buka', verifikasiToken, async (req, res) => {
  try {
    const { modal_awal } = req.body;
    if (!Validator.angka(modal_awal, 0, 99999999)) return res.status(400).json({ sukses: false, pesan: 'Modal awal tidak valid.' });

    const shiftAktif = await basisData.cariSatu('shift_kasir', s => s.kasir_id === req.kasir.id && s.status === 'buka');
    if (shiftAktif) return res.status(400).json({ sukses: false, pesan: 'Masih ada shift yang belum ditutup.', data: shiftAktif });

    const baru = await basisData.tambah('shift_kasir', {
      cabang_id: req.kasir.cabang_id, kasir_id: req.kasir.id,
      dibuka_pada: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19), ditutup_pada: null,
      modal_awal: Number(modal_awal), kas_akhir: 0, total_penjualan: 0,
      penjualan_tunai: 0, penjualan_non_tunai: 0, status: 'buka', catatan: ''
    });
    return res.status(201).json({ sukses: true, pesan: 'Shift berhasil dibuka.', data: baru });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// PUT /api/shift/:id/tutup
app.put('/api/shift/:id/tutup', verifikasiToken, async (req, res) => {
  try {
    const { kas_akhir, catatan } = req.body;
    if (!Validator.angka(kas_akhir, 0, 99999999)) return res.status(400).json({ sukses: false, pesan: 'Kas akhir tidak valid.' });
    if (!Validator.angka(req.params.id, 1))        return res.status(400).json({ sukses: false, pesan: 'ID shift tidak valid.' });

    const shift = await basisData.ambilBerdasarkanId('shift_kasir', req.params.id);
    if (!shift || shift.status !== 'buka') return res.status(404).json({ sukses: false, pesan: 'Shift aktif tidak ditemukan atau sudah ditutup.' });

    const penjualanTunai = Number(shift.penjualan_tunai || 0);
    const ekspektasiKas  = Number(shift.modal_awal) + penjualanTunai;
    const selisih        = Number(kas_akhir) - ekspektasiKas;

    const catatanFinal = catatan
      ? Validator.bersihkan(catatan)
      : `Tutup shift. Tunai: Rp ${penjualanTunai.toLocaleString('id-ID')}. Ekspektasi: Rp ${ekspektasiKas.toLocaleString('id-ID')}. Selisih: Rp ${selisih.toLocaleString('id-ID')}`;

    const ditutup = await basisData.perbarui('shift_kasir', req.params.id, {
      ditutup_pada: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19), kas_akhir: Number(kas_akhir), status: 'tutup', catatan: catatanFinal
    });

    await basisData.tambah('log_perangkat', {
      cabang_id: shift.cabang_id, kasir_id: shift.kasir_id, tipe_kejadian: 'close_shift_audit',
      pesan: `Shift ID ${shift.id} ditutup. Modal: ${shift.modal_awal} | Tunai: ${penjualanTunai} | Non-tunai: ${shift.penjualan_non_tunai || 0} | Ekspektasi: ${ekspektasiKas} | Aktual: ${kas_akhir} | Selisih: ${selisih}`,
      timestamp: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19)
    });

    return res.json({ sukses: true, pesan: 'Shift berhasil ditutup.', selisih_kas: selisih, penjualan_tunai: penjualanTunai, penjualan_non_tunai: Number(shift.penjualan_non_tunai || 0), ekspektasi_kas: ekspektasiKas, data: ditutup });
  } catch (e) { console.error(e); return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});


// ─── 4. LAPORAN ──────────────────────────────────────────────────────────────

// GET /api/laporan/omzet
app.get('/api/laporan/omzet', verifikasiToken, async (req, res) => {
  try {
    const cabangId = req.kasir.peran !== 'admin' ? req.kasir.cabang_id : null;
    let transaksi  = await basisData.ambilSemua('transaksi');
    if (cabangId) transaksi = transaksi.filter(t => t.cabang_id === cabangId);

    const rekapHarian = {};
    const namaHari    = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const tanggal = d.toISOString().split('T')[0];
      rekapHarian[tanggal] = {
        tanggal, label: `${namaHari[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`,
        omzet: 0, cost: 0, jumlah_transaksi: 0
      };
    }

    transaksi.forEach(t => {
      const tgl = new Date(t.dibuat_pada).toISOString().split('T')[0];
      if (rekapHarian[tgl]) {
        rekapHarian[tgl].omzet += Number(t.total_belanja);
        rekapHarian[tgl].cost  += Number(t.total_belanja) * 0.55;
        rekapHarian[tgl].jumlah_transaksi += 1;
      }
    });

    return res.json({ sukses: true, data: Object.values(rekapHarian) });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// GET /api/laporan/kasir
app.get('/api/laporan/kasir', verifikasiToken, async (req, res) => {
  try {
    const cabangId = req.kasir.peran !== 'admin' ? req.kasir.cabang_id : null;
    const kasir    = await basisData.ambilSemua('kasir');
    const transaksi = await basisData.ambilSemua('transaksi');

    const rekap = kasir
      .filter(k => !cabangId || k.cabang_id === cabangId)
      .map(k => {
        const txKasir    = transaksi.filter(t => t.kasir_id === k.id);
        const totalOmzet = txKasir.reduce((sum, t) => sum + Number(t.total_belanja), 0);
        return { id: k.id, nama_kasir: k.nama_lengkap, nama_pengguna: k.nama_pengguna, peran: k.peran, jumlah_transaksi: txKasir.length, total_penjualan: totalOmzet };
      });

    return res.json({ sukses: true, data: rekap });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});


app.listen(PORT, '0.0.0.0', () => console.log(`Layanan Transaksi & POS berjalan di port ${PORT}`));







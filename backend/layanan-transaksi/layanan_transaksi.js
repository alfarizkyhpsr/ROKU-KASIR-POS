const express = require('express');
const cors = require('cors');
const basisData = require('../shared/basis_data');
const { Validator } = require('../shared/basis_data');
const { verifikasiToken, hanyaManajerAtauAdmin } = require('../shared/middleware_auth');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5002;


// 1. CRUD BARANG (LAYANAN PRODUK)


// GET /api/barang - Daftar semua barang
// Gunakan cache katalog NoSQL jika tersedia dan masih segar
app.get('/api/barang', verifikasiToken, (req, res) => {
  const cache = basisData.ambilCacheKatalog();

  if (cache) {
    return res.json({
      sukses: true,
      data: cache.data,
      dari_cache: true,
      cache_diperbarui: cache.diperbarui_pada
    });
  }

  // Fallback: ambil langsung dari SQL jika cache tidak ada
  const barang = basisData.ambilSemua('barang');
  return res.json({ sukses: true, data: barang, dari_cache: false });
});

// POST /api/barang - Tambah barang baru (Hanya Manajer/Admin)
app.post('/api/barang', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  const { kode_barcode, nama_barang, kategori, satuan, harga_jual, harga_pokok, url_gambar } = req.body;

  // Validasi input ketat
  if (!Validator.teks(kode_barcode, 20)) {
    return res.status(400).json({ sukses: false, pesan: "Kode barcode tidak valid. Maksimal 20 karakter." });
  }
  if (!Validator.teks(nama_barang, 150)) {
    return res.status(400).json({ sukses: false, pesan: "Nama barang tidak valid. Maksimal 150 karakter." });
  }
  if (!Validator.angka(harga_jual, 1, 99999999)) {
    return res.status(400).json({ sukses: false, pesan: "Harga jual tidak valid. Harus angka positif." });
  }
  if (!Validator.angka(harga_pokok, 0, 99999999)) {
    return res.status(400).json({ sukses: false, pesan: "Harga pokok tidak valid. Harus angka non-negatif." });
  }
  if (Number(harga_pokok) >= Number(harga_jual)) {
    return res.status(400).json({ sukses: false, pesan: "Harga pokok tidak boleh lebih besar atau sama dengan harga jual." });
  }

  // Cek barcode unik
  const barangEksis = basisData.cariSatu('barang', b => b.kode_barcode === kode_barcode.trim());
  if (barangEksis) {
    return res.status(400).json({ sukses: false, pesan: "Barcode produk sudah terdaftar." });
  }

  const kategoriBersih = kategori && ['MAKANAN', 'MINUMAN', 'UMUM'].includes(kategori.toUpperCase())
    ? kategori.toUpperCase()
    : 'UMUM';

  const barangBaru = basisData.tambah('barang', {
    kode_barcode: Validator.bersihkan(kode_barcode).trim(),
    nama_barang: Validator.bersihkan(nama_barang).toUpperCase(),
    kategori: kategoriBersih,
    satuan: satuan ? Validator.bersihkan(satuan).toLowerCase() : 'pcs',
    harga_jual: Number(harga_jual),
    harga_pokok: Number(harga_pokok),
    url_gambar: url_gambar ? Validator.bersihkan(url_gambar) : "inventory_2",
    is_aktif: 1
  });

  // Tambahkan baris stok untuk semua cabang yang ada
  const semuaCabang = basisData.ambilSemua('cabang');
  const hariIni = new Date().toISOString().split('T')[0];
  semuaCabang.forEach(cabang => {
    basisData.tambah('stok', {
      cabang_id: cabang.id,
      barang_id: barangBaru.id,
      terjual: 0,
      terjual_terakhir_reset: hariIni,
      target_harian: 100,
      diperbarui_pada: new Date().toISOString()
    });
  });

  // Invalidasi cache katalog agar ter-refresh
  basisData.perbaruiCacheKatalog();

  return res.status(201).json({ sukses: true, pesan: "Barang berhasil ditambahkan.", data: barangBaru });
});

// GET /api/barang/:id - Detail satu barang
app.get('/api/barang/:id', verifikasiToken, (req, res) => {
  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID tidak valid." });
  }
  const barang = basisData.ambilBerdasarkanId('barang', req.params.id);
  if (!barang) {
    return res.status(404).json({ sukses: false, pesan: "Barang tidak ditemukan." });
  }
  return res.json({ sukses: true, data: barang });
});

// PUT /api/barang/:id - Perbarui barang (Hanya Manajer/Admin)
app.put('/api/barang/:id', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID tidak valid." });
  }
  const barang = basisData.ambilBerdasarkanId('barang', req.params.id);
  if (!barang) {
    return res.status(404).json({ sukses: false, pesan: "Barang tidak ditemukan." });
  }

  const payload = {};
  if (req.body.nama_barang !== undefined) {
    if (!Validator.teks(req.body.nama_barang, 150)) {
      return res.status(400).json({ sukses: false, pesan: "Nama barang tidak valid." });
    }
    payload.nama_barang = Validator.bersihkan(req.body.nama_barang).toUpperCase();
  }
  if (req.body.harga_jual !== undefined) {
    if (!Validator.angka(req.body.harga_jual, 1, 99999999)) {
      return res.status(400).json({ sukses: false, pesan: "Harga jual tidak valid." });
    }
    payload.harga_jual = Number(req.body.harga_jual);
  }
  if (req.body.harga_pokok !== undefined) {
    if (!Validator.angka(req.body.harga_pokok, 0, 99999999)) {
      return res.status(400).json({ sukses: false, pesan: "Harga pokok tidak valid." });
    }
    payload.harga_pokok = Number(req.body.harga_pokok);
  }
  if (req.body.kategori !== undefined) {
    if (!['MAKANAN', 'MINUMAN', 'UMUM'].includes(req.body.kategori.toUpperCase())) {
      return res.status(400).json({ sukses: false, pesan: "Kategori tidak valid." });
    }
    payload.kategori = req.body.kategori.toUpperCase();
  }
  if (req.body.satuan !== undefined) payload.satuan = Validator.bersihkan(req.body.satuan);
  if (req.body.url_gambar !== undefined) payload.url_gambar = Validator.bersihkan(req.body.url_gambar);
  if (req.body.is_aktif !== undefined) payload.is_aktif = req.body.is_aktif ? 1 : 0;

  const updated = basisData.perbarui('barang', req.params.id, payload);

  // Invalidasi cache katalog setelah perubahan
  basisData.perbaruiCacheKatalog();

  return res.json({ sukses: true, pesan: "Barang berhasil diperbarui.", data: updated });
});

// DELETE /api/barang/:id - Hapus barang / soft delete (Hanya Manajer/Admin)
app.delete('/api/barang/:id', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID tidak valid." });
  }
  const barang = basisData.ambilBerdasarkanId('barang', req.params.id);
  if (!barang) {
    return res.status(404).json({ sukses: false, pesan: "Barang tidak ditemukan." });
  }

  // Soft delete
  basisData.perbarui('barang', req.params.id, { is_aktif: 0 });

  // Invalidasi cache katalog
  basisData.perbaruiCacheKatalog();

  return res.json({ sukses: true, pesan: "Barang berhasil dinonaktifkan." });
});

// GET /api/barang/:id/target - Cek target & terjual per cabang
app.get('/api/barang/:id/target', verifikasiToken, (req, res) => {
  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID tidak valid." });
  }
  const barangId = Number(req.params.id);
  const daftarStok = basisData.cariSemua('stok', s => s.barang_id === barangId);

  const dataStokCabang = daftarStok.map(s => {
    const cabang = basisData.ambilBerdasarkanId('cabang', s.cabang_id);
    return {
      id: s.id,
      cabang_id: s.cabang_id,
      nama_cabang: cabang ? cabang.nama_cabang : "Cabang Tidak Diketahui",
      kota: cabang ? cabang.kota : "-",
      terjual: s.terjual || 0,
      target_harian: s.target_harian || 100,
      terjual_terakhir_reset: s.terjual_terakhir_reset || null
    };
  });

  return res.json({ sukses: true, data: dataStokCabang });
});

// PUT /api/target/:id - Atur target harian (Hanya Manajer/Admin)
app.put('/api/target/:id', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  const { target_baru } = req.body;

  if (!Validator.angka(target_baru, 1, 99999)) {
    return res.status(400).json({ sukses: false, pesan: "Target harian tidak valid. Harus angka positif maksimal 99.999." });
  }

  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID tidak valid." });
  }

  const stok = basisData.ambilBerdasarkanId('stok', req.params.id);
  if (!stok) {
    return res.status(404).json({ sukses: false, pesan: "Data target tidak ditemukan." });
  }

  const updatedStok = basisData.perbarui('stok', req.params.id, {
    target_harian: Number(target_baru),
    diperbarui_pada: new Date().toISOString()
  });

  return res.json({ sukses: true, pesan: "Target harian berhasil diatur.", data: updatedStok });
});



// 2. TRANSAKSI POS & SINKRONISASI


// POST /api/transaksi - Buat transaksi POS baru
app.post('/api/transaksi', verifikasiToken, (req, res) => {
  const {
    cabang_id,
    kasir_id,
    shift_id,
    total_belanja,
    diskon,
    pajak,
    metode_pembayaran,
    jumlah_bayar,
    jumlah_kembalian,
    item,
    offline,
    id_offline
  } = req.body;

  // Validasi input transaksi
  if (!item || !Array.isArray(item) || item.length === 0) {
    return res.status(400).json({ sukses: false, pesan: "Item keranjang tidak boleh kosong." });
  }
  if (!Validator.angka(total_belanja, 1, 999999999)) {
    return res.status(400).json({ sukses: false, pesan: "Total belanja tidak valid." });
  }
  const metodeBayarDiizinkan = ['tunai', 'qris', 'debit', 'credit'];
  if (!metode_pembayaran || !metodeBayarDiizinkan.includes(metode_pembayaran)) {
    return res.status(400).json({ sukses: false, pesan: "Metode pembayaran tidak valid." });
  }

  // Validasi setiap item
  for (const itm of item) {
    if (!Validator.angka(itm.barang_id, 1)) {
      return res.status(400).json({ sukses: false, pesan: "ID barang pada item tidak valid." });
    }
    if (!Validator.angka(itm.jumlah, 1, 9999)) {
      return res.status(400).json({ sukses: false, pesan: "Jumlah item tidak valid." });
    }
    if (!Validator.angka(itm.harga_satuan, 1, 99999999)) {
      return res.status(400).json({ sukses: false, pesan: "Harga satuan item tidak valid." });
    }
  }

  // MODE OFFLINE: simpan ke koleksi transaksi_offline (NoSQL)
  if (offline) {
    const transaksiOffline = basisData.tambah('transaksi_offline', {
      id_offline: id_offline || `OFF-${Date.now()}`,
      cabang_id: Number(cabang_id || req.kasir.cabang_id),
      kasir_id: Number(kasir_id || req.kasir.id),
      shift_id: Number(shift_id || 0),
      total_belanja: Number(total_belanja),
      diskon: Number(diskon || 0),
      pajak: Number(pajak || 0),
      metode_pembayaran,
      jumlah_bayar: Number(jumlah_bayar),
      jumlah_kembalian: Number(jumlah_kembalian),
      item,
      synced: 0,
      dibuat_pada: new Date().toISOString()
    });

    basisData.tambah('log_perangkat', {
      cabang_id: Number(cabang_id || req.kasir.cabang_id),
      kasir_id: Number(kasir_id || req.kasir.id),
      tipe_kejadian: "offline_transaction",
      pesan: `Transaksi offline dibuat dengan ID: ${transaksiOffline.id_offline}`,
      timestamp: new Date().toISOString()
    });

    return res.status(201).json({
      sukses: true,
      pesan: "Transaksi disimpan secara lokal dalam antrean offline Firestore.",
      offline: true,
      data: transaksiOffline
    });
  }

  // MODE ONLINE: validasi shift aktif
  if (shift_id) {
    const shift = basisData.ambilBerdasarkanId('shift_kasir', shift_id);
    if (!shift || shift.status !== 'buka') {
      return res.status(400).json({ sukses: false, pesan: "Shift kasir tidak aktif. Silakan buka shift baru terlebih dahulu." });
    }
  }

  const kodeTransaksi = `TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const cabangId = Number(cabang_id || req.kasir.cabang_id);

  const transaksiBaru = basisData.tambah('transaksi', {
    kode_transaksi: kodeTransaksi,
    cabang_id: cabangId,
    kasir_id: Number(kasir_id || req.kasir.id),
    shift_id: Number(shift_id || 0),
    total_belanja: Number(total_belanja),
    diskon: Number(diskon || 0),
    pajak: Number(pajak || 0),
    metode_pembayaran,
    jumlah_bayar: Number(jumlah_bayar),
    jumlah_kembalian: Number(jumlah_kembalian),
    status_sinkronisasi: 1,
    dibuat_pada: new Date().toISOString()
  });

  // Simpan pembayaran ke tabel terpisah
  basisData.tambah('pembayaran', {
    transaksi_id: transaksiBaru.id,
    metode: metode_pembayaran,
    jumlah: Number(total_belanja),
    // Tunai: uang diterima dan kembalian relevan
    // Non-tunai: langsung lunas, tidak ada kembalian fisik
    jumlah_bayar: ['tunai'].includes(metode_pembayaran) ? Number(jumlah_bayar) : Number(total_belanja),
    jumlah_kembalian: ['tunai'].includes(metode_pembayaran) ? Number(jumlah_kembalian) : 0,
    status: "sukses",
    referensi: metode_pembayaran !== 'tunai' ? `REF-${Date.now()}` : null,
    dibuat_pada: new Date().toISOString()
  });

  // Simpan item transaksi & update stok barang per cabang
  item.forEach(itm => {
    basisData.tambah('item_transaksi', {
      transaksi_id: transaksiBaru.id,
      barang_id: itm.barang_id,
      jumlah: Number(itm.jumlah),
      harga_satuan: Number(itm.harga_satuan),
      subtotal: Number(itm.jumlah) * Number(itm.harga_satuan)
    });

    // Update terjual di stok cabang
    const recordStok = basisData.cariSatu('stok', s => s.cabang_id === cabangId && s.barang_id === itm.barang_id);
    if (recordStok) {
      const totalTerjual = Number(recordStok.terjual || 0) + Number(itm.jumlah);
      basisData.perbarui('stok', recordStok.id, {
        terjual: totalTerjual,
        diperbarui_pada: new Date().toISOString()
      });
    }
  });

  // Update total_penjualan pada shift kasir
  if (shift_id) {
    const shift = basisData.ambilBerdasarkanId('shift_kasir', shift_id);
    if (shift) {
      const totalBaru = Number(shift.total_penjualan || 0) + Number(total_belanja);
      // Pisahkan antara penjualan tunai dan non-tunai untuk rekonsiliasi kas
      const penjualanTunaiBaru = Number(shift.penjualan_tunai || 0) + (metode_pembayaran === 'tunai' ? Number(total_belanja) : 0);
      const penjualanNonTunaiBaru = Number(shift.penjualan_non_tunai || 0) + (metode_pembayaran !== 'tunai' ? Number(total_belanja) : 0);
      basisData.perbarui('shift_kasir', shift_id, {
        total_penjualan: totalBaru,
        penjualan_tunai: penjualanTunaiBaru,
        penjualan_non_tunai: penjualanNonTunaiBaru
      });
    }
  }

  return res.status(201).json({
    sukses: true,
    pesan: "Transaksi berhasil diproses online (tersimpan di MySQL Cloud SQL).",
    offline: false,
    data: transaksiBaru
  });
});

// GET /api/transaksi - Ambil riwayat transaksi
app.get('/api/transaksi', verifikasiToken, (req, res) => {
  const cabangId = req.kasir.peran !== 'admin' ? req.kasir.cabang_id : null;

  let transaksi = basisData.ambilSemua('transaksi');
  if (cabangId) {
    transaksi = transaksi.filter(t => t.cabang_id === cabangId);
  }

  const detailTransaksi = transaksi.map(t => {
    const kas = basisData.ambilBerdasarkanId('kasir', t.kasir_id);
    const cab = basisData.ambilBerdasarkanId('cabang', t.cabang_id);
    return {
      ...t,
      nama_kasir: kas ? kas.nama_lengkap : "Kasir",
      nama_cabang: cab ? cab.nama_cabang : "Cabang"
    };
  });

  detailTransaksi.sort((a, b) => new Date(b.dibuat_pada) - new Date(a.dibuat_pada));

  return res.json({ sukses: true, data: detailTransaksi });
});

// GET /api/transaksi/:id - Detail 1 transaksi
app.get('/api/transaksi/:id', verifikasiToken, (req, res) => {
  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID tidak valid." });
  }
  const transaksi = basisData.ambilBerdasarkanId('transaksi', req.params.id);
  if (!transaksi) {
    return res.status(404).json({ sukses: false, pesan: "Transaksi tidak ditemukan." });
  }

  const items = basisData.cariSemua('item_transaksi', item => item.transaksi_id === transaksi.id);
  const itemsDenganNama = items.map(i => {
    const barang = basisData.ambilBerdasarkanId('barang', i.barang_id);
    return {
      ...i,
      nama_barang: barang ? barang.nama_barang : "Barang Tidak Dikenal",
      url_gambar: barang ? barang.url_gambar : "inventory_2"
    };
  });

  // Sertakan data pembayaran dari tabel terpisah
  const dataPembayaran = basisData.cariSatu('pembayaran', p => p.transaksi_id === transaksi.id);

  const kasir = basisData.ambilBerdasarkanId('kasir', transaksi.kasir_id);
  const cabang = basisData.ambilBerdasarkanId('cabang', transaksi.cabang_id);

  return res.json({
    sukses: true,
    data: {
      ...transaksi,
      nama_kasir: kasir ? kasir.nama_lengkap : "Kasir",
      nama_cabang: cabang ? cabang.nama_cabang : "Cabang",
      items: itemsDenganNama,
      pembayaran: dataPembayaran || null
    }
  });
});

// POST /api/transaksi/sinkronisasi - Sinkronisasi antrean offline ke online SQL
app.post('/api/transaksi/sinkronisasi', verifikasiToken, (req, res) => {
  const { antrean } = req.body;

  if (!antrean || !Array.isArray(antrean) || antrean.length === 0) {
    return res.status(400).json({ sukses: false, pesan: "Tidak ada transaksi offline untuk disinkronisasi." });
  }

  const hasilSync = [];

  antrean.forEach(txOff => {
    const transaksiSudahAda = basisData.cariSatu('transaksi', t =>
      t.kode_transaksi === txOff.id_offline || t.kode_transaksi.includes(txOff.id_offline)
    );
    if (transaksiSudahAda) {
      hasilSync.push({ id_offline: txOff.id_offline, sukses: true, pesan: "Sudah pernah disinkronisasi sebelumnya." });
      return;
    }

    const transaksiBaru = basisData.tambah('transaksi', {
      kode_transaksi: txOff.id_offline,
      cabang_id: txOff.cabang_id,
      kasir_id: txOff.kasir_id,
      shift_id: txOff.shift_id,
      total_belanja: txOff.total_belanja,
      diskon: txOff.diskon,
      pajak: txOff.pajak,
      metode_pembayaran: txOff.metode_pembayaran,
      jumlah_bayar: txOff.jumlah_bayar,
      jumlah_kembalian: txOff.jumlah_kembalian,
      status_sinkronisasi: 1,
      dibuat_pada: txOff.dibuat_pada
    });

    // Tambah record pembayaran untuk transaksi yang disinkronisasi
    basisData.tambah('pembayaran', {
      transaksi_id: transaksiBaru.id,
      metode: txOff.metode_pembayaran,
      jumlah: txOff.total_belanja,
      jumlah_bayar: ['tunai'].includes(txOff.metode_pembayaran) ? txOff.jumlah_bayar : txOff.total_belanja,
      jumlah_kembalian: ['tunai'].includes(txOff.metode_pembayaran) ? txOff.jumlah_kembalian : 0,
      status: "sukses",
      referensi: txOff.metode_pembayaran !== 'tunai' ? `REF-SYNC-${Date.now()}` : null,
      dibuat_pada: txOff.dibuat_pada
    });

    txOff.item.forEach(itm => {
      basisData.tambah('item_transaksi', {
        transaksi_id: transaksiBaru.id,
        barang_id: itm.barang_id,
        jumlah: itm.jumlah,
        harga_satuan: itm.harga_satuan,
        subtotal: itm.jumlah * itm.harga_satuan
      });

      const recordStok = basisData.cariSatu('stok', s =>
        s.cabang_id === txOff.cabang_id && s.barang_id === itm.barang_id
      );
      if (recordStok) {
        const totalTerjual = Number(recordStok.terjual || 0) + Number(itm.jumlah);
        basisData.perbarui('stok', recordStok.id, {
          terjual: totalTerjual,
          diperbarui_pada: new Date().toISOString()
        });
      }
    });

    if (txOff.shift_id) {
      const shift = basisData.ambilBerdasarkanId('shift_kasir', txOff.shift_id);
      if (shift) {
        const totalBaru = Number(shift.total_penjualan || 0) + Number(txOff.total_belanja);
        const penjualanTunaiBaru = Number(shift.penjualan_tunai || 0) + (txOff.metode_pembayaran === 'tunai' ? Number(txOff.total_belanja) : 0);
        const penjualanNonTunaiBaru = Number(shift.penjualan_non_tunai || 0) + (txOff.metode_pembayaran !== 'tunai' ? Number(txOff.total_belanja) : 0);
        basisData.perbarui('shift_kasir', txOff.shift_id, {
          total_penjualan: totalBaru,
          penjualan_tunai: penjualanTunaiBaru,
          penjualan_non_tunai: penjualanNonTunaiBaru
        });
      }
    }

    basisData.tambah('antrean_sinkronisasi', {
      cabang_id: txOff.cabang_id,
      tipe: "transaksi",
      payload_id: transaksiBaru.id,
      status: "done",
      enqueued_at: txOff.dibuat_pada,
      processed_at: new Date().toISOString()
    });

    hasilSync.push({ id_offline: txOff.id_offline, sukses: true, database_id: transaksiBaru.id });
  });

  // Bersihkan antrean offline NoSQL yang sudah disinkronisasi
  const idOfflines = antrean.map(a => a.id_offline);
  basisData.data.transaksi_offline = basisData.data.transaksi_offline.filter(
    t => !idOfflines.includes(t.id_offline)
  );
  basisData.simpanKeFile();

  return res.json({
    sukses: true,
    pesan: "Sinkronisasi batch offline-to-online berhasil diselesaikan.",
    hasil: hasilSync
  });
});



// 3. MANAJEMEN SHIFT KASIR


// GET /api/shift/daftar - Ambil daftar shift
app.get('/api/shift/daftar', verifikasiToken, (req, res) => {
  const cabangId = req.kasir.peran !== 'admin' ? req.kasir.cabang_id : null;

  let shift = basisData.ambilSemua('shift_kasir');
  if (cabangId) {
    shift = shift.filter(s => s.cabang_id === cabangId);
  }

  const dataShiftLengkap = shift.map(s => {
    const kas = basisData.ambilBerdasarkanId('kasir', s.kasir_id);
    return { ...s, nama_kasir: kas ? kas.nama_lengkap : "Kasir" };
  });

  dataShiftLengkap.sort((a, b) => new Date(b.dibuka_pada) - new Date(a.dibuka_pada));

  return res.json({ sukses: true, data: dataShiftLengkap });
});

// POST /api/shift/buka - Buka shift baru
app.post('/api/shift/buka', verifikasiToken, (req, res) => {
  const { modal_awal } = req.body;

  if (!Validator.angka(modal_awal, 0, 99999999)) {
    return res.status(400).json({ sukses: false, pesan: "Modal awal tidak valid. Harus angka non-negatif." });
  }

  const cabangId = req.kasir.cabang_id;
  const kasirId = req.kasir.id;

  // Cek shift aktif
  const shiftAktif = basisData.cariSatu('shift_kasir', s => s.kasir_id === kasirId && s.status === 'buka');
  if (shiftAktif) {
    return res.status(400).json({
      sukses: false,
      pesan: "Anda masih memiliki shift yang belum ditutup. Tutup shift lama terlebih dahulu.",
      data: shiftAktif
    });
  }

  const shiftBaru = basisData.tambah('shift_kasir', {
    cabang_id: cabangId,
    kasir_id: kasirId,
    dibuka_pada: new Date().toISOString(),
    ditutup_pada: null,
    modal_awal: Number(modal_awal),
    kas_akhir: 0,
    total_penjualan: 0,
    penjualan_tunai: 0,       // BARU: tracking penjualan tunai
    penjualan_non_tunai: 0,   // BARU: tracking penjualan non-tunai
    status: "buka",
    catatan: ""
  });

  return res.status(201).json({
    sukses: true,
    pesan: "Shift kasir berhasil dibuka.",
    data: shiftBaru
  });
});

// PUT /api/shift/:id/tutup - Tutup shift dan rekap kas
app.put('/api/shift/:id/tutup', verifikasiToken, (req, res) => {
  const { kas_akhir, catatan } = req.body;

  if (!Validator.angka(kas_akhir, 0, 99999999)) {
    return res.status(400).json({ sukses: false, pesan: "Jumlah kas akhir tidak valid." });
  }

  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID shift tidak valid." });
  }

  const shift = basisData.ambilBerdasarkanId('shift_kasir', req.params.id);
  if (!shift || shift.status !== 'buka') {
    return res.status(404).json({ sukses: false, pesan: "Shift aktif tidak ditemukan atau sudah ditutup." });
  }

  // Ekspektasi kas hanya dari penjualan tunai, bukan total semua metode
  // Penjualan QRIS/debit/kredit masuk ke payment gateway, bukan laci kas
  const penjualanTunai = Number(shift.penjualan_tunai || 0);
  const ekspektasiKas = Number(shift.modal_awal) + penjualanTunai;
  const selisih = Number(kas_akhir) - ekspektasiKas;

  const catatanFinal = catatan
    ? Validator.bersihkan(catatan)
    : `Tutup shift. Penjualan tunai: Rp ${penjualanTunai.toLocaleString('id-ID')}. Ekspektasi kas: Rp ${ekspektasiKas.toLocaleString('id-ID')}. Selisih: Rp ${selisih.toLocaleString('id-ID')}`;

  const shiftDitutup = basisData.perbarui('shift_kasir', req.params.id, {
    ditutup_pada: new Date().toISOString(),
    kas_akhir: Number(kas_akhir),
    status: "tutup",
    catatan: catatanFinal
  });

  // Audit log rekonsiliasi kas
  basisData.tambah('log_perangkat', {
    cabang_id: shift.cabang_id,
    kasir_id: shift.kasir_id,
    tipe_kejadian: "close_shift_audit",
    pesan: `Shift ID ${shift.id} ditutup. Modal: Rp ${shift.modal_awal} | Tunai: Rp ${penjualanTunai} | Non-tunai: Rp ${shift.penjualan_non_tunai || 0} | Ekspektasi kas: Rp ${ekspektasiKas} | Aktual: Rp ${kas_akhir} | Selisih: Rp ${selisih}`,
    timestamp: new Date().toISOString()
  });

  return res.json({
    sukses: true,
    pesan: "Shift berhasil ditutup dan direkonsiliasi.",
    selisih_kas: selisih,
    penjualan_tunai: penjualanTunai,
    penjualan_non_tunai: Number(shift.penjualan_non_tunai || 0),
    ekspektasi_kas: ekspektasiKas,
    data: shiftDitutup
  });
});



// 4. ANALISIS LAPORAN


// GET /api/laporan/omzet - Grafik total penjualan harian
// Gunakan tanggal aktual YYYY-MM-DD, bukan nama hari
app.get('/api/laporan/omzet', verifikasiToken, (req, res) => {
  const cabangId = req.kasir.peran !== 'admin' ? req.kasir.cabang_id : null;
  let transaksi = basisData.ambilSemua('transaksi');

  if (cabangId) {
    transaksi = transaksi.filter(t => t.cabang_id === cabangId);
  }

  // Buat map 7 hari terakhir berdasarkan TANGGAL AKTUAL, bukan nama hari
  const rekapHarian = {};
  const daftarHari = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const tanggal = d.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const labelHari = daftarHari[d.getDay()];
    const labelTanggal = `${d.getDate()}/${d.getMonth() + 1}`;

    rekapHarian[tanggal] = {
      tanggal,
      label: `${labelHari} ${labelTanggal}`,
      omzet: 0,
      cost: 0,
      jumlah_transaksi: 0
    };
  }

  // Kelompokkan transaksi per tanggal aktual
  transaksi.forEach(t => {
    const tanggalTransaksi = new Date(t.dibuat_pada).toISOString().split('T')[0];
    if (rekapHarian[tanggalTransaksi]) {
      rekapHarian[tanggalTransaksi].omzet += Number(t.total_belanja);
      rekapHarian[tanggalTransaksi].cost += Number(t.total_belanja) * 0.55;
      rekapHarian[tanggalTransaksi].jumlah_transaksi += 1;
    }
  });

  const dataGrafik = Object.values(rekapHarian);
  return res.json({ sukses: true, data: dataGrafik });
});

// GET /api/laporan/kasir - Ringkasan per kasir
app.get('/api/laporan/kasir', verifikasiToken, (req, res) => {
  const cabangId = req.kasir.peran !== 'admin' ? req.kasir.cabang_id : null;
  const kasir = basisData.ambilSemua('kasir');
  const transaksi = basisData.ambilSemua('transaksi');

  const rekapKasir = kasir
    .filter(k => !cabangId || k.cabang_id === cabangId)
    .map(k => {
      const txKasir = transaksi.filter(t => t.kasir_id === k.id);
      const totalOmzet = txKasir.reduce((sum, t) => sum + Number(t.total_belanja), 0);
      return {
        id: k.id,
        nama_kasir: k.nama_lengkap,
        nama_pengguna: k.nama_pengguna,
        peran: k.peran,
        jumlah_transaksi: txKasir.length,
        total_penjualan: totalOmzet
      };
    });

  return res.json({ sukses: true, data: rekapKasir });
});

// Run server
app.listen(PORT, () => {
  console.log(`Layanan Transaksi & POS berjalan di port http://localhost:${PORT}`);
});
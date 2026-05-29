const express = require('express');
const cors = require('cors');
const basisData = require('../shared/basis_data');
const { verifikasiToken, hanyaManajerAtauAdmin } = require('../shared/middleware_auth');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5002;

// ==========================================
// 1. CRUD BARANG (LAYANAN PRODUK)
// ==========================================

// GET /api/barang - Daftar semua barang
app.get('/api/barang', verifikasiToken, (req, res) => {
  const barang = basisData.ambilSemua('barang');
  return res.json({ sukses: true, data: barang });
});

// POST /api/barang - Tambah barang baru (Hanya Manajer/Admin)
app.post('/api/barang', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  const { kode_barcode, nama_barang, kategori, satuan, harga_jual, harga_pokok, url_gambar } = req.body;

  if (!kode_barcode || !nama_barang || !harga_jual || !harga_pokok) {
    return res.status(400).json({ sukses: false, pesan: "Barcode, nama, harga jual, dan harga pokok wajib diisi." });
  }

  // Cek barcode unik
  const barangEksis = basisData.cariSatu('barang', b => b.kode_barcode === kode_barcode);
  if (barangEksis) {
    return res.status(400).json({ sukses: false, pesan: "Barcode produk sudah terdaftar." });
  }

  const barangBaru = basisData.tambah('barang', {
    kode_barcode,
    nama_barang,
    kategori: kategori || "UMUM",
    satuan: satuan || "pcs",
    harga_jual: Number(harga_jual),
    harga_pokok: Number(harga_pokok),
    url_gambar: url_gambar || "📦",
    is_aktif: 1
  });

  // Tambahkan baris stok untuk semua cabang yang ada
  const semuaCabang = basisData.ambilSemua('cabang');
  semuaCabang.forEach(cabang => {
    basisData.tambah('stok', {
      cabang_id: cabang.id,
      barang_id: barangBaru.id,
      terjual: 0, // Awal mula belum ada yang terjual
      target_harian: 100, // Default target 100
      diperbarui_pada: new Date().toISOString()
    });
  });

  return res.status(201).json({ sukses: true, pesan: "Barang berhasil ditambahkan.", data: barangBaru });
});

// GET /api/barang/:id - Detail satu barang
app.get('/api/barang/:id', verifikasiToken, (req, res) => {
  const barang = basisData.ambilBerdasarkanId('barang', req.params.id);
  if (!barang) {
    return res.status(404).json({ sukses: false, pesan: "Barang tidak ditemukan." });
  }
  return res.json({ sukses: true, data: barang });
});

// PUT /api/barang/:id - Perbarui barang (Hanya Manajer/Admin)
app.put('/api/barang/:id', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  const barang = basisData.ambilBerdasarkanId('barang', req.params.id);
  if (!barang) {
    return res.status(404).json({ sukses: false, pesan: "Barang tidak ditemukan." });
  }

  const updated = basisData.perbarui('barang', req.params.id, req.body);
  return res.json({ sukses: true, pesan: "Barang berhasil diperbarui.", data: updated });
});

// DELETE /api/barang/:id - Hapus barang (Hanya Manajer/Admin)
app.delete('/api/barang/:id', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  const barang = basisData.ambilBerdasarkanId('barang', req.params.id);
  if (!barang) {
    return res.status(404).json({ sukses: false, pesan: "Barang tidak ditemukan." });
  }

  // Soft delete
  basisData.perbarui('barang', req.params.id, { is_aktif: 0 });
  return res.json({ sukses: true, pesan: "Barang berhasil dinonaktifkan." });
});

// GET /api/barang/:id/target - Cek target & terjual per cabang
app.get('/api/barang/:id/target', verifikasiToken, (req, res) => {
  const barangId = Number(req.params.id);
  const daftarStok = basisData.cariSemua('stok', s => s.barang_id === barangId);
  
  // Gabungkan dengan info cabang
  const dataStokCabang = daftarStok.map(s => {
    const cabang = basisData.ambilBerdasarkanId('cabang', s.cabang_id);
    return {
      id: s.id,
      cabang_id: s.cabang_id,
      nama_cabang: cabang ? cabang.nama_cabang : "Cabang Tidak Diketahui",
      kota: cabang ? cabang.kota : "-",
      terjual: s.terjual || 0,
      target_harian: s.target_harian || 100
    };
  });
  
  return res.json({ sukses: true, data: dataStokCabang });
});

// PUT /api/target/:id - Atur target harian (Hanya Manajer/Admin)
app.put('/api/target/:id', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  const { target_baru } = req.body;
  if (!target_baru || isNaN(target_baru) || Number(target_baru) < 0) {
    return res.status(400).json({ sukses: false, pesan: "Target harian tidak valid." });
  }

  const stok = basisData.ambilBerdasarkanId('stok', req.params.id);
  if (!stok) {
    return res.status(404).json({ sukses: false, pesan: "Data target tidak ditemukan." });
  }

  const targetHarianBaru = Number(target_baru);
  const updatedStok = basisData.perbarui('stok', req.params.id, {
    target_harian: targetHarianBaru,
    diperbarui_pada: new Date().toISOString()
  });

  return res.json({ sukses: true, pesan: "Target harian berhasil diatur.", data: updatedStok });
});


// ==========================================
// 2. TRANSAKSI POS & SINKRONISASI
// ==========================================

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

  if (!total_belanja || !item || !item.length) {
    return res.status(400).json({ sukses: false, pesan: "Data transaksi atau item keranjang tidak lengkap." });
  }

  // Jika kasir memilih mode offline, simpan transaksi ke NoSQL transaksi_offline
  if (offline) {
    const transaksiOffline = basisData.tambah('transaksi_offline', {
      id_offline: id_offline || `OFF-${Date.now()}`,
      cabang_id: Number(cabang_id || req.kasir.cabang_id),
      kasir_id: Number(kasir_id || req.kasir.id),
      shift_id: Number(shift_id || 0),
      total_belanja: Number(total_belanja),
      diskon: Number(diskon || 0),
      pajak: Number(pajak || 0),
      metode_pembayaran: metode_pembayaran || "tunai",
      jumlah_bayar: Number(jumlah_bayar),
      jumlah_kembalian: Number(jumlah_kembalian),
      item: item,
      synced: 0,
      dibuat_pada: new Date().toISOString()
    });

    // Tambah log aktivitas perangkat
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

  // JIKA ONLINE: Validasi shift kasir terlebih dahulu
  if (shift_id) {
    const shift = basisData.ambilBerdasarkanId('shift_kasir', shift_id);
    if (!shift || shift.status !== 'buka') {
      return res.status(400).json({ sukses: false, pesan: "Shift kasir tidak aktif. Silakan buka shift baru terlebih dahulu." });
    }
  }

  // Kurangi stok barang dan buat baris database relasional SQL
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
    metode_pembayaran: metode_pembayaran || "tunai",
    jumlah_bayar: Number(jumlah_bayar),
    jumlah_kembalian: Number(jumlah_kembalian),
    status_sinkronisasi: 1, // Sudah sinkron karena dibuat online
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

    // Tambahkan angka terjual di cabang tersebut
    const recordStok = basisData.cariSatu('stok', s => s.cabang_id === cabangId && s.barang_id === itm.barang_id);
    if (recordStok) {
      const totalTerjual = Number(recordStok.terjual || 0) + Number(itm.jumlah);
      basisData.perbarui('stok', recordStok.id, {
        terjual: totalTerjual,
        diperbarui_pada: new Date().toISOString()
      });
    }
  });

  // Perbarui total_penjualan pada shift kasir jika ada
  if (shift_id) {
    const shift = basisData.ambilBerdasarkanId('shift_kasir', shift_id);
    if (shift) {
      const totalBaru = Number(shift.total_penjualan || 0) + Number(total_belanja);
      basisData.perbarui('shift_kasir', shift_id, { total_penjualan: totalBaru });
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

  // Tambahkan detail nama kasir dan nama cabang
  const detailTransaksi = transaksi.map(t => {
    const kas = basisData.ambilBerdasarkanId('kasir', t.kasir_id);
    const cab = basisData.ambilBerdasarkanId('cabang', t.cabang_id);
    return {
      ...t,
      nama_kasir: kas ? kas.nama_lengkap : "Kasir",
      nama_cabang: cab ? cab.nama_cabang : "Cabang"
    };
  });

  // Urutkan transaksi terbaru di atas
  detailTransaksi.sort((a, b) => new Date(b.dibuat_pada) - new Date(a.dibuat_pada));

  return res.json({ sukses: true, data: detailTransaksi });
});

// GET /api/transaksi/:id - Detail 1 transaksi
app.get('/api/transaksi/:id', verifikasiToken, (req, res) => {
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
      url_gambar: barang ? barang.url_gambar : "📦"
    };
  });

  const kasir = basisData.ambilBerdasarkanId('kasir', transaksi.kasir_id);
  const cabang = basisData.ambilBerdasarkanId('cabang', transaksi.cabang_id);

  return res.json({
    sukses: true,
    data: {
      ...transaksi,
      nama_kasir: kasir ? kasir.nama_lengkap : "Kasir",
      nama_cabang: cabang ? cabang.nama_cabang : "Cabang",
      items: itemsDenganNama
    }
  });
});

// POST /api/transaksi/sinkronisasi - Sinkronisasi antrean transaksi offline ke online SQL
app.post('/api/transaksi/sinkronisasi', verifikasiToken, (req, res) => {
  const { antrean } = req.body;

  if (!antrean || !antrean.length) {
    return res.status(400).json({ sukses: false, pesan: "Tidak ada transaksi offline untuk disinkronisasi." });
  }

  const hasilSync = [];

  antrean.forEach(txOff => {
    // Cek apakah transaksi ini sudah pernah disinkronisasi berdasarkan id_offline
    const transaksiSudahAda = basisData.cariSatu('transaksi', t => t.kode_transaksi === txOff.id_offline || t.kode_transaksi.includes(txOff.id_offline));
    if (transaksiSudahAda) {
      hasilSync.push({ id_offline: txOff.id_offline, sukses: true, pesan: "Sudah pernah disinkronisasi sebelumnya." });
      return;
    }

    // Pindahkan ke basis data transaksi SQL
    const transaksiBaru = basisData.tambah('transaksi', {
      kode_transaksi: txOff.id_offline, // Simpan id_offline sebagai kode transaksi
      cabang_id: txOff.cabang_id,
      kasir_id: txOff.kasir_id,
      shift_id: txOff.shift_id,
      total_belanja: txOff.total_belanja,
      diskon: txOff.diskon,
      pajak: txOff.pajak,
      metode_pembayaran: txOff.metode_pembayaran,
      jumlah_bayar: txOff.jumlah_bayar,
      jumlah_kembalian: txOff.jumlah_kembalian,
      status_sinkronisasi: 1, // Berhasil online
      dibuat_pada: txOff.dibuat_pada
    });

    // Simpan item-detail
    txOff.item.forEach(itm => {
      basisData.tambah('item_transaksi', {
        transaksi_id: transaksiBaru.id,
        barang_id: itm.barang_id,
        jumlah: itm.jumlah,
        harga_satuan: itm.harga_satuan,
        subtotal: itm.jumlah * itm.harga_satuan
      });

      // Tambahkan angka terjual cabang untuk sinkronisasi offline
      const recordStok = basisData.cariSatu('stok', s => s.cabang_id === txOff.cabang_id && s.barang_id === itm.barang_id);
      if (recordStok) {
        const totalTerjual = Number(recordStok.terjual || 0) + Number(itm.jumlah);
        basisData.perbarui('stok', recordStok.id, {
          terjual: totalTerjual,
          diperbarui_pada: new Date().toISOString()
        });
      }
    });

    // Perbarui total omzet shift jika ada
    if (txOff.shift_id) {
      const shift = basisData.ambilBerdasarkanId('shift_kasir', txOff.shift_id);
      if (shift) {
        const totalBaru = Number(shift.total_penjualan || 0) + Number(txOff.total_belanja);
        basisData.perbarui('shift_kasir', txOff.shift_id, { total_penjualan: totalBaru });
      }
    }

    // Tambahkan antrean sinkronisasi log di NoSQL
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

  // Bersihkan transaksi offline dari NoSQL antrean lokal yang sudah disinkronisasi
  const idOfflines = antrean.map(a => a.id_offline);
  const transaksiLokal = basisData.ambilSemua('transaksi_offline');
  basisData.data.transaksi_offline = transaksiLokal.filter(t => !idOfflines.includes(t.id_offline));
  basisData.simpanKeFile();

  return res.json({
    sukses: true,
    pesan: "Sinkronisasi batch offline-to-online berhasil diselesaikan.",
    hasil: hasilSync
  });
});


// ==========================================
// 3. MANAJEMEN SHIFT KASIR
// ==========================================

// GET /api/shift/daftar - Ambil daftar shift
app.get('/api/shift/daftar', verifikasiToken, (req, res) => {
  const cabangId = req.kasir.peran !== 'admin' ? req.kasir.cabang_id : null;
  
  let shift = basisData.ambilSemua('shift_kasir');
  if (cabangId) {
    shift = shift.filter(s => s.cabang_id === cabangId);
  }

  // Gabungkan data kasir
  const dataShiftLengkap = shift.map(s => {
    const kas = basisData.ambilBerdasarkanId('kasir', s.kasir_id);
    return {
      ...s,
      nama_kasir: kas ? kas.nama_lengkap : "Kasir"
    };
  });

  dataShiftLengkap.sort((a, b) => new Date(b.dibuka_pada) - new Date(a.dibuka_pada));

  return res.json({ sukses: true, data: dataShiftLengkap });
});

// POST /api/shift/buka - Buka shift baru
app.post('/api/shift/buka', verifikasiToken, (req, res) => {
  const { modal_awal } = req.body;

  if (modal_awal === undefined || modal_awal === null) {
    return res.status(400).json({ sukses: false, pesan: "Modal awal wajib ditentukan untuk membuka shift." });
  }

  const cabangId = req.kasir.cabang_id;
  const kasirId = req.kasir.id;

  // Cek apakah kasir ini memiliki shift yang masih 'buka'
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

  if (kas_akhir === undefined || kas_akhir === null) {
    return res.status(400).json({ sukses: false, pesan: "Jumlah kas akhir wajib diisi untuk menutup shift." });
  }

  const shift = basisData.ambilBerdasarkanId('shift_kasir', req.params.id);
  if (!shift || shift.status !== 'buka') {
    return res.status(404).json({ sukses: false, pesan: "Shift aktif tidak ditemukan atau sudah ditutup." });
  }

  // Hitung ekspektasi kas: modal_awal + total_penjualan (asumsi tunai, namun untuk rekapitulasi hitung selisihnya)
  const ekspektasiKas = Number(shift.modal_awal) + Number(shift.total_penjualan);
  const selisih = Number(kas_akhir) - ekspektasiKas;

  const shiftDitutup = basisData.perbarui('shift_kasir', req.params.id, {
    ditutup_pada: new Date().toISOString(),
    kas_akhir: Number(kas_akhir),
    status: "tutup",
    catatan: catatan || `Tutup shift. Selisih kas: Rp ${selisih.toLocaleString('id-ID')}`
  });

  // Tambahkan log audit selisih kas untuk mencegah kebocoran
  basisData.tambah('log_perangkat', {
    cabang_id: shift.cabang_id,
    kasir_id: shift.kasir_id,
    tipe_kejadian: "close_shift_audit",
    pesan: `Shift ID ${shift.id} ditutup. Ekspektasi: Rp ${ekspektasiKas}, Aktual: Rp ${kas_akhir}. Selisih: Rp ${selisih}`,
    timestamp: new Date().toISOString()
  });

  return res.json({
    sukses: true,
    pesan: "Shift berhasil ditutup dan direkonsiliasi.",
    selisih_kas: selisih,
    data: shiftDitutup
  });
});


// ==========================================
// 4. ANALISIS LAPORAN
// ==========================================

// GET /api/laporan/omzet - Grafik total penjualan harian (untuk visual trend)
app.get('/api/laporan/omzet', verifikasiToken, (req, res) => {
  const cabangId = req.kasir.peran !== 'admin' ? req.kasir.cabang_id : null;
  let transaksi = basisData.ambilSemua('transaksi');

  if (cabangId) {
    transaksi = transaksi.filter(t => t.cabang_id === cabangId);
  }

  // Hitung total belanja per hari (7 hari terakhir)
  const rekapHarian = {};
  const daftarHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  // Inisialisasi 7 hari terakhir
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const namaHari = daftarHari[d.getDay()];
    rekapHarian[namaHari] = { omzet: 0, cost: 0, nama_hari: namaHari };
  }

  transaksi.forEach(t => {
    const tgl = new Date(t.dibuat_pada);
    const namaHari = daftarHari[tgl.getDay()];
    
    // Cek apakah hari ini ada dalam 7 hari terakhir
    if (rekapHarian[namaHari]) {
      rekapHarian[namaHari].omzet += Number(t.total_belanja);
      // Simulasikan harga modal/pokok 50% untuk visualisasi HPP
      rekapHarian[namaHari].cost += Number(t.total_belanja) * 0.55;
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

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const basisData = require('../shared/basis_data');
const { Validator } = require('../shared/basis_data');
const { KUNCI_RAHASIA, verifikasiToken, hanyaAdmin, hanyaManajerAtauAdmin } = require('../shared/middleware_auth');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5001;


// 1. AUTENTIKASI


// POST /api/auth/masuk - Login kasir
app.post('/api/auth/masuk', (req, res) => {
  const { nama_pengguna, kata_sandi, pin } = req.body;

  // Validasi input
  if (!nama_pengguna || typeof nama_pengguna !== 'string' || nama_pengguna.trim().length === 0) {
    return res.status(400).json({ sukses: false, pesan: "Nama pengguna wajib diisi." });
  }

  // Cari kasir berdasarkan username
  const akunKasir = basisData.cariSatu('kasir', k => k.nama_pengguna === nama_pengguna.trim());
  if (!akunKasir || !akunKasir.is_aktif) {
    return res.status(401).json({ sukses: false, pesan: "Username tidak ditemukan atau dinonaktifkan." });
  }

  let kataSandiCocok = false;

  if (pin) {
    // PIN sekarang di-hash, pakai bcrypt.compareSync
    if (!Validator.pin(pin)) {
      return res.status(400).json({ sukses: false, pesan: "Format PIN tidak valid. Harus 6 angka." });
    }
    kataSandiCocok = bcrypt.compareSync(String(pin), akunKasir.pin_hash);

  } else if (kata_sandi) {
    // Login standar menggunakan sandi
    if (typeof kata_sandi !== 'string' || kata_sandi.length < 6) {
      return res.status(400).json({ sukses: false, pesan: "Kata sandi minimal 6 karakter." });
    }
    kataSandiCocok = bcrypt.compareSync(kata_sandi, akunKasir.kata_sandi_hash);

  } else {
    return res.status(400).json({ sukses: false, pesan: "Kata sandi atau PIN wajib diisi." });
  }

  if (!kataSandiCocok) {
    return res.status(401).json({ sukses: false, pesan: "Kredensial salah. Kata sandi atau PIN tidak cocok." });
  }

  // Cari informasi cabang
  const infoCabang = basisData.ambilBerdasarkanId('cabang', akunKasir.cabang_id);

  // Buat JWT Token
  const token = jwt.sign(
    { kasirId: akunKasir.id, peran: akunKasir.peran },
    KUNCI_RAHASIA,
    { expiresIn: '8h' }
  );

  // Simpan sesi aktif ke NoSQL
  basisData.tambah('sesi_aktif', {
    token_id: token.substring(token.length - 20),
    kasir_id: akunKasir.id,
    cabang_id: akunKasir.cabang_id,
    waktu_masuk: new Date().toISOString()
  });

  // Perbarui login terakhir kasir
  basisData.perbarui('kasir', akunKasir.id, { login_terakhir: new Date().toISOString() });

  // Catat log aktivitas login
  basisData.tambah('log_perangkat', {
    cabang_id: akunKasir.cabang_id,
    kasir_id: akunKasir.id,
    tipe_kejadian: "login",
    pesan: `Kasir ${akunKasir.nama_lengkap} berhasil masuk ke sistem`,
    timestamp: new Date().toISOString()
  });

  return res.json({
    sukses: true,
    pesan: "Login berhasil.",
    data: {
      token,
      kasir: {
        id: akunKasir.id,
        nama_pengguna: akunKasir.nama_pengguna,
        nama_lengkap: akunKasir.nama_lengkap,
        peran: akunKasir.peran
        // PIN tidak dikembalikan ke frontend sama sekali
      },
      cabang: infoCabang || null
    }
  });
});

// POST /api/auth/keluar - Logout sesi
app.post('/api/auth/keluar', verifikasiToken, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader.split(' ')[1];
  const tokenId = token.substring(token.length - 20);

  // Hapus sesi aktif dari NoSQL
  const sesi = basisData.cariSatu('sesi_aktif', s => s.token_id === tokenId);
  if (sesi) {
    basisData.hapus('sesi_aktif', sesi.id);
  }

  // Catat log logout
  basisData.tambah('log_perangkat', {
    cabang_id: req.kasir.cabang_id,
    kasir_id: req.kasir.id,
    tipe_kejadian: "logout",
    pesan: `Kasir ${req.kasir.nama_lengkap} keluar dari sistem`,
    timestamp: new Date().toISOString()
  });

  return res.json({
    sukses: true,
    pesan: "Logout berhasil."
  });
});


// 2. CRUD CABANG


// GET /api/cabang - Ambil semua cabang
app.get('/api/cabang', verifikasiToken, (req, res) => {
  const cabang = basisData.ambilSemua('cabang');
  return res.json({ sukses: true, data: cabang });
});

// POST /api/cabang - Tambah cabang baru (Hanya Admin)
app.post('/api/cabang', verifikasiToken, hanyaAdmin, (req, res) => {
  const { kode_cabang, nama_cabang, alamat, kota, telepon, nama_manajer } = req.body;

  // Validasi input
  if (!Validator.teks(kode_cabang, 10)) {
    return res.status(400).json({ sukses: false, pesan: "Kode cabang tidak valid. Maksimal 10 karakter." });
  }
  if (!Validator.teks(nama_cabang, 100)) {
    return res.status(400).json({ sukses: false, pesan: "Nama cabang tidak valid. Maksimal 100 karakter." });
  }
  if (!kota || !Validator.teks(kota, 50)) {
    return res.status(400).json({ sukses: false, pesan: "Kota tidak valid." });
  }

  // Cek apakah kode cabang sudah ada
  const cabangEksis = basisData.cariSatu('cabang', c => c.kode_cabang === kode_cabang.toUpperCase());
  if (cabangEksis) {
    return res.status(400).json({ sukses: false, pesan: "Kode cabang sudah terdaftar." });
  }

  const cabangBaru = basisData.tambah('cabang', {
    kode_cabang: Validator.bersihkan(kode_cabang).toUpperCase(),
    nama_cabang: Validator.bersihkan(nama_cabang),
    alamat: alamat ? Validator.bersihkan(alamat) : '',
    kota: Validator.bersihkan(kota),
    telepon: telepon ? Validator.bersihkan(telepon) : '',
    nama_manajer: nama_manajer ? Validator.bersihkan(nama_manajer) : '',
    is_aktif: 1
  });

  return res.status(201).json({ sukses: true, pesan: "Cabang berhasil ditambahkan.", data: cabangBaru });
});

// GET /api/cabang/:id - Detail cabang
app.get('/api/cabang/:id', verifikasiToken, (req, res) => {
  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID tidak valid." });
  }
  const cabang = basisData.ambilBerdasarkanId('cabang', req.params.id);
  if (!cabang) {
    return res.status(404).json({ sukses: false, pesan: "Cabang tidak ditemukan." });
  }
  return res.json({ sukses: true, data: cabang });
});

// PUT /api/cabang/:id - Update data cabang (Hanya Admin)
app.put('/api/cabang/:id', verifikasiToken, hanyaAdmin, (req, res) => {
  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID tidak valid." });
  }
  const cabang = basisData.ambilBerdasarkanId('cabang', req.params.id);
  if (!cabang) {
    return res.status(404).json({ sukses: false, pesan: "Cabang tidak ditemukan." });
  }

  // Bersihkan input sebelum disimpan
  const payload = {};
  if (req.body.nama_cabang !== undefined) {
    if (!Validator.teks(req.body.nama_cabang, 100)) {
      return res.status(400).json({ sukses: false, pesan: "Nama cabang tidak valid." });
    }
    payload.nama_cabang = Validator.bersihkan(req.body.nama_cabang);
  }
  if (req.body.kode_cabang !== undefined) {
    if (!Validator.teks(req.body.kode_cabang, 10)) {
      return res.status(400).json({ sukses: false, pesan: "Kode cabang tidak valid." });
    }
    payload.kode_cabang = Validator.bersihkan(req.body.kode_cabang).toUpperCase();
  }
  if (req.body.kota !== undefined) payload.kota = Validator.bersihkan(req.body.kota);
  if (req.body.alamat !== undefined) payload.alamat = Validator.bersihkan(req.body.alamat);
  if (req.body.telepon !== undefined) payload.telepon = Validator.bersihkan(req.body.telepon);
  if (req.body.nama_manajer !== undefined) payload.nama_manajer = Validator.bersihkan(req.body.nama_manajer);

  const updated = basisData.perbarui('cabang', req.params.id, payload);
  return res.json({ sukses: true, pesan: "Cabang berhasil diperbarui.", data: updated });
});

// DELETE /api/cabang/:id - Nonaktifkan cabang (Hanya Admin)
app.delete('/api/cabang/:id', verifikasiToken, hanyaAdmin, (req, res) => {
  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID tidak valid." });
  }
  const cabang = basisData.ambilBerdasarkanId('cabang', req.params.id);
  if (!cabang) {
    return res.status(404).json({ sukses: false, pesan: "Cabang tidak ditemukan." });
  }

  const permanen = req.query.permanen === 'true';

  if (permanen) {
    basisData.hapus('cabang', req.params.id);
    return res.json({ sukses: true, pesan: "Cabang berhasil dihapus permanen." });
  } else {
    basisData.perbarui('cabang', req.params.id, { is_aktif: 0 });
    return res.json({ sukses: true, pesan: "Cabang berhasil dinonaktifkan." });
  }
});


// 3. CRUD KASIR


// GET /api/kasir - Daftar kasir (Hanya Manajer/Admin)
app.get('/api/kasir', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  let daftarKasir = basisData.ambilSemua('kasir');

  // Manajer hanya lihat kasir cabangnya
  if (req.kasir.peran === 'manajer') {
    daftarKasir = daftarKasir.filter(k => k.cabang_id === req.kasir.cabang_id);
  }

  const kasirLengkap = daftarKasir.map(k => {
    // Jangan kembalikan hash sandi maupun hash PIN ke frontend
    const { kata_sandi_hash, pin_hash, pin, ...info } = k;
    const cabang = basisData.ambilBerdasarkanId('cabang', k.cabang_id);
    return { ...info, nama_cabang: cabang ? cabang.nama_cabang : "Cabang Tidak Diketahui" };
  });

  return res.json({ sukses: true, data: kasirLengkap });
});

// POST /api/kasir - Tambah kasir baru (Hanya Manajer/Admin)
app.post('/api/kasir', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  const { cabang_id, nama_pengguna, kata_sandi, nama_lengkap, peran, pin } = req.body;

  // Validasi ketat semua field
  if (!Validator.namapengguna(nama_pengguna)) {
    return res.status(400).json({ sukses: false, pesan: "Username tidak valid. Gunakan huruf kecil, angka, atau underscore (3-30 karakter)." });
  }
  if (!kata_sandi || typeof kata_sandi !== 'string' || kata_sandi.length < 6) {
    return res.status(400).json({ sukses: false, pesan: "Kata sandi minimal 6 karakter." });
  }
  if (!Validator.teks(nama_lengkap, 100)) {
    return res.status(400).json({ sukses: false, pesan: "Nama lengkap tidak valid." });
  }
  if (!['kasir', 'manajer', 'admin'].includes(peran)) {
    return res.status(400).json({ sukses: false, pesan: "Peran tidak valid." });
  }
  if (!Validator.pin(pin)) {
    return res.status(400).json({ sukses: false, pesan: "PIN harus berupa 6 angka." });
  }

  // Cek username sudah ada
  const userEksis = basisData.cariSatu('kasir', k => k.nama_pengguna === nama_pengguna);
  if (userEksis) {
    return res.status(400).json({ sukses: false, pesan: "Nama pengguna sudah terdaftar." });
  }

  // Validasi kepemilikan cabang untuk manajer
  let finalCabangId = Number(cabang_id);
  if (req.kasir.peran === 'manajer') {
    finalCabangId = req.kasir.cabang_id;
    if (peran === 'admin') {
      return res.status(403).json({ sukses: false, pesan: "Manajer tidak dapat membuat akun Admin." });
    }
  } else if (!finalCabangId || !Validator.angka(finalCabangId, 1)) {
    finalCabangId = req.kasir.cabang_id;
  }

  const kasirBaru = basisData.tambah('kasir', {
    cabang_id: finalCabangId,
    nama_pengguna: nama_pengguna.trim(),
    kata_sandi_hash: bcrypt.hashSync(kata_sandi, 10),
    pin_hash: bcrypt.hashSync(String(pin), 10), // PIN di-hash
    nama_lengkap: Validator.bersihkan(nama_lengkap),
    peran,
    is_aktif: 1,
    login_terakhir: null
  });

  const { kata_sandi_hash, pin_hash: _ph, ...responsInfo } = kasirBaru;
  return res.status(201).json({ sukses: true, pesan: "Kasir berhasil ditambahkan.", data: responsInfo });
});

// PUT /api/kasir/:id - Update data kasir (Hanya Manajer/Admin)
app.put('/api/kasir/:id', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID tidak valid." });
  }
  const kasir = basisData.ambilBerdasarkanId('kasir', req.params.id);
  if (!kasir) {
    return res.status(404).json({ sukses: false, pesan: "Kasir tidak ditemukan." });
  }

  const payload = {};

  // Validasi kepemilikan untuk manajer
  if (req.kasir.peran === 'manajer') {
    if (kasir.cabang_id !== req.kasir.cabang_id) {
      return res.status(403).json({ sukses: false, pesan: "Akses ditolak. Kasir ini bukan dari cabang Anda." });
    }
    if (req.body.peran === 'admin') {
      return res.status(403).json({ sukses: false, pesan: "Manajer tidak dapat mengubah peran menjadi admin." });
    }
  }

  // Validasi dan bersihkan field yang diperbarui
  if (req.body.nama_lengkap !== undefined) {
    if (!Validator.teks(req.body.nama_lengkap, 100)) {
      return res.status(400).json({ sukses: false, pesan: "Nama lengkap tidak valid." });
    }
    payload.nama_lengkap = Validator.bersihkan(req.body.nama_lengkap);
  }
  if (req.body.nama_pengguna !== undefined) {
    if (!Validator.namapengguna(req.body.nama_pengguna)) {
      return res.status(400).json({ sukses: false, pesan: "Username tidak valid." });
    }
    payload.nama_pengguna = req.body.nama_pengguna.trim();
  }
  if (req.body.kata_sandi) {
    if (req.body.kata_sandi.length < 6) {
      return res.status(400).json({ sukses: false, pesan: "Kata sandi minimal 6 karakter." });
    }
    payload.kata_sandi_hash = bcrypt.hashSync(req.body.kata_sandi, 10);
  }
  if (req.body.pin) {
    if (!Validator.pin(req.body.pin)) {
      return res.status(400).json({ sukses: false, pesan: "PIN harus berupa 6 angka." });
    }
    payload.pin_hash = bcrypt.hashSync(String(req.body.pin), 10);
  }
  if (req.body.peran && req.kasir.peran === 'admin') {
    if (!['kasir', 'manajer', 'admin'].includes(req.body.peran)) {
      return res.status(400).json({ sukses: false, pesan: "Peran tidak valid." });
    }
    payload.peran = req.body.peran;
  }
  if (req.body.cabang_id && req.kasir.peran === 'admin') {
    if (!Validator.angka(req.body.cabang_id, 1)) {
      return res.status(400).json({ sukses: false, pesan: "ID cabang tidak valid." });
    }
    payload.cabang_id = Number(req.body.cabang_id);
  }
  if (req.body.is_aktif !== undefined) {
    payload.is_aktif = req.body.is_aktif ? 1 : 0;
  }

  const updated = basisData.perbarui('kasir', req.params.id, payload);
  const { kata_sandi_hash, pin_hash: _ph, pin: _p, ...responsInfo } = updated;
  return res.json({ sukses: true, pesan: "Kasir berhasil diperbarui.", data: responsInfo });
});

// DELETE /api/kasir/:id - Nonaktifkan atau hapus permanen kasir
app.delete('/api/kasir/:id', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  if (!Validator.angka(req.params.id, 1)) {
    return res.status(400).json({ sukses: false, pesan: "ID tidak valid." });
  }
  const kasir = basisData.ambilBerdasarkanId('kasir', req.params.id);
  if (!kasir) {
    return res.status(404).json({ sukses: false, pesan: "Kasir tidak ditemukan." });
  }

  if (req.kasir.peran === 'manajer') {
    if (kasir.cabang_id !== req.kasir.cabang_id) {
      return res.status(403).json({ sukses: false, pesan: "Akses ditolak. Kasir ini bukan dari cabang Anda." });
    }
    if (kasir.peran === 'admin' || kasir.peran === 'manajer') {
      return res.status(403).json({ sukses: false, pesan: "Akses ditolak. Anda tidak bisa menghapus akun dengan peran setara." });
    }
  }

  const permanen = req.query.permanen === 'true';

  if (permanen) {
    basisData.hapus('kasir', req.params.id);
    return res.json({ sukses: true, pesan: "Kasir berhasil dihapus permanen." });
  } else {
    basisData.perbarui('kasir', req.params.id, { is_aktif: 0 });
    return res.json({ sukses: true, pesan: "Kasir berhasil dinonaktifkan." });
  }
});

// Run server
app.listen(PORT, () => {
  console.log(`Layanan Autentikasi berjalan di port http://localhost:${PORT}`);
});
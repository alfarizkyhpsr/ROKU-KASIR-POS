const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const basisData = require('../shared/basis_data');
const { KUNCI_RAHASIA, verifikasiToken, hanyaAdmin, hanyaManajerAtauAdmin } = require('../shared/middleware_auth');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5001;

// 1. POST /api/auth/masuk - Autentikasi Kasir
app.post('/api/auth/masuk', (req, res) => {
  const { nama_pengguna, kata_sandi, pin } = req.body;

  if (!nama_pengguna) {
    return res.status(400).json({ sukses: false, pesan: "Nama pengguna wajib diisi." });
  }

  // Cari kasir berdasarkan username
  const akunKasir = basisData.cariSatu('kasir', k => k.nama_pengguna === nama_pengguna);
  if (!akunKasir || !akunKasir.is_aktif) {
    return res.status(401).json({ sukses: false, pesan: "Username tidak ditemukan atau dinonaktifkan." });
  }

  let kataSandiCocok = false;
  if (pin) {
    // Login cepat menggunakan PIN 6 angka
    kataSandiCocok = (akunKasir.pin === pin);
  } else if (kata_sandi) {
    // Login standar menggunakan sandi
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
    { expiresIn: '8h' } // Berlaku 8 jam (1 shift kasir)
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

  return res.json({
    sukses: true,
    pesan: "Login berhasil.",
    data: {
      token,
      kasir: {
        id: akunKasir.id,
        nama_pengguna: akunKasir.nama_pengguna,
        nama_lengkap: akunKasir.nama_lengkap,
        peran: akunKasir.peran,
        pin: akunKasir.pin
      },
      cabang: infoCabang || null
    }
  });
});

// 2. POST /api/auth/keluar - Logout sesi
app.post('/api/auth/keluar', verifikasiToken, (req, res) => {
  // Ambil token dari header
  const authHeader = req.headers['authorization'];
  const token = authHeader.split(' ')[1];
  const tokenId = token.substring(token.length - 20);

  // Hapus sesi aktif dari NoSQL
  const sesi = basisData.cariSatu('sesi_aktif', s => s.token_id === tokenId);
  if (sesi) {
    basisData.hapus('sesi_aktif', sesi.id);
  }

  return res.json({
    sukses: true,
    pesan: "Logout berhasil."
  });
});

// 3. GET /api/cabang - Ambil semua cabang
app.get('/api/cabang', verifikasiToken, (req, res) => {
  const cabang = basisData.ambilSemua('cabang');
  return res.json({ sukses: true, data: cabang });
});

// 4. POST /api/cabang - Tambah cabang baru (Hanya Admin)
app.post('/api/cabang', verifikasiToken, hanyaAdmin, (req, res) => {
  const { kode_cabang, nama_cabang, alamat, kota, telepon, nama_manajer } = req.body;

  if (!kode_cabang || !nama_cabang) {
    return res.status(400).json({ sukses: false, pesan: "Kode dan nama cabang wajib diisi." });
  }

  // Cek apakah kode cabang sudah ada
  const cabangEksis = basisData.cariSatu('cabang', c => c.kode_cabang === kode_cabang);
  if (cabangEksis) {
    return res.status(400).json({ sukses: false, pesan: "Kode cabang sudah terdaftar." });
  }

  const cabangBaru = basisData.tambah('cabang', {
    kode_cabang,
    nama_cabang,
    alamat,
    kota,
    telepon,
    nama_manajer,
    is_aktif: 1
  });

  return res.status(201).json({ sukses: true, pesan: "Cabang berhasil ditambahkan.", data: cabangBaru });
});

// 5. GET /api/cabang/:id - Detail cabang
app.get('/api/cabang/:id', verifikasiToken, (req, res) => {
  const cabang = basisData.ambilBerdasarkanId('cabang', req.params.id);
  if (!cabang) {
    return res.status(404).json({ sukses: false, pesan: "Cabang tidak ditemukan." });
  }
  return res.json({ sukses: true, data: cabang });
});

// 6. PUT /api/cabang/:id - Update data cabang (Hanya Admin)
app.put('/api/cabang/:id', verifikasiToken, hanyaAdmin, (req, res) => {
  const cabang = basisData.ambilBerdasarkanId('cabang', req.params.id);
  if (!cabang) {
    return res.status(404).json({ sukses: false, pesan: "Cabang tidak ditemukan." });
  }

  const updated = basisData.perbarui('cabang', req.params.id, req.body);
  return res.json({ sukses: true, pesan: "Cabang berhasil diperbarui.", data: updated });
});

// 7. DELETE /api/cabang/:id - Nonaktifkan cabang (Hanya Admin)
app.delete('/api/cabang/:id', verifikasiToken, hanyaAdmin, (req, res) => {
  const cabang = basisData.ambilBerdasarkanId('cabang', req.params.id);
  if (!cabang) {
    return res.status(404).json({ sukses: false, pesan: "Cabang tidak ditemukan." });
  }

  const permanen = req.query.permanen === 'true';

  if (permanen) {
    // Hard delete - hapus dari array
    basisData.hapus('cabang', req.params.id);
    return res.json({ sukses: true, pesan: "Cabang berhasil dihapus permanen." });
  } else {
    // Soft delete - set is_aktif = 0
    basisData.perbarui('cabang', req.params.id, { is_aktif: 0 });
    return res.json({ sukses: true, pesan: "Cabang berhasil dinonaktifkan." });
  }
});

// 8. GET /api/kasir - Daftar kasir (Hanya Manajer/Admin)
app.get('/api/kasir', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  let daftarKasir = basisData.ambilSemua('kasir');
  
  // Jika manajer, hanya kembalikan kasir dari cabangnya
  if (req.kasir.peran === 'manajer') {
    daftarKasir = daftarKasir.filter(k => k.cabang_id === req.kasir.cabang_id);
  }

  const kasirLengkap = daftarKasir.map(k => {
    const { kata_sandi_hash, ...info } = k;
    const cabang = basisData.ambilBerdasarkanId('cabang', k.cabang_id);
    return { ...info, nama_cabang: cabang ? cabang.nama_cabang : "Cabang Tidak Diketahui" };
  });

  return res.json({ sukses: true, data: kasirLengkap });
});

// 9. POST /api/kasir - Tambah kasir baru (Hanya Manajer/Admin)
app.post('/api/kasir', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  const { cabang_id, nama_pengguna, kata_sandi, nama_lengkap, peran, pin } = req.body;

  if (!nama_pengguna || !kata_sandi || !nama_lengkap || !peran || !pin) {
    return res.status(400).json({ sukses: false, pesan: "Semua field kasir wajib diisi." });
  }

  // Cek apakah username sudah ada
  const userEksis = basisData.cariSatu('kasir', k => k.nama_pengguna === nama_pengguna);
  if (userEksis) {
    return res.status(400).json({ sukses: false, pesan: "Nama pengguna sudah terdaftar." });
  }

  // Validasi: Manajer hanya bisa menambahkan kasir di cabangnya sendiri
  let finalCabangId = Number(cabang_id);
  if (req.kasir.peran === 'manajer') {
    finalCabangId = req.kasir.cabang_id;
    // Manajer tidak boleh membuat akun Admin
    if (peran === 'admin') {
      return res.status(403).json({ sukses: false, pesan: "Manajer tidak dapat membuat akun Admin." });
    }
  } else if (!finalCabangId) {
    finalCabangId = req.kasir.cabang_id; // Fallback jika admin tidak mengisi
  }

  const kasirBaru = basisData.tambah('kasir', {
    cabang_id: finalCabangId,
    nama_pengguna,
    kata_sandi_hash: bcrypt.hashSync(kata_sandi, 10),
    nama_lengkap,
    peran,
    pin,
    is_aktif: 1,
    login_terakhir: null
  });

  const { kata_sandi_hash, ...responsInfo } = kasirBaru;
  return res.status(201).json({ sukses: true, pesan: "Kasir berhasil ditambahkan.", data: responsInfo });
});

// 10. PUT /api/kasir/:id - Update data kasir (Hanya Manajer/Admin)
app.put('/api/kasir/:id', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  const kasir = basisData.ambilBerdasarkanId('kasir', req.params.id);
  if (!kasir) {
    return res.status(404).json({ sukses: false, pesan: "Kasir tidak ditemukan." });
  }

  const payload = { ...req.body };
  
  // Validasi kepemilikan jika Manajer
  if (req.kasir.peran === 'manajer') {
    if (kasir.cabang_id !== req.kasir.cabang_id) {
      return res.status(403).json({ sukses: false, pesan: "Akses ditolak. Kasir ini bukan dari cabang Anda." });
    }
    // Manajer tidak boleh mengubah role menjadi admin atau memindahkan cabang
    if (payload.peran === 'admin') delete payload.peran;
    if (payload.cabang_id) delete payload.cabang_id;
  }

  if (payload.kata_sandi) {
    payload.kata_sandi_hash = bcrypt.hashSync(payload.kata_sandi, 10);
    delete payload.kata_sandi;
  }

  const updated = basisData.perbarui('kasir', req.params.id, payload);
  const { kata_sandi_hash, ...responsInfo } = updated;
  return res.json({ sukses: true, pesan: "Kasir berhasil diperbarui.", data: responsInfo });
});

// 11. DELETE /api/kasir/:id - Nonaktifkan atau hapus permanen kasir (Hanya Manajer/Admin)
app.delete('/api/kasir/:id', verifikasiToken, hanyaManajerAtauAdmin, (req, res) => {
  const kasir = basisData.ambilBerdasarkanId('kasir', req.params.id);
  if (!kasir) {
    return res.status(404).json({ sukses: false, pesan: "Kasir tidak ditemukan." });
  }

  // Validasi kepemilikan jika Manajer
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

const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const basisData           = require('../shared/basis_data');
const { Validator }       = require('../shared/basis_data');
const { KUNCI_RAHASIA, verifikasiToken, hanyaAdmin, hanyaManajerAtauAdmin } = require('../shared/middleware_auth');

const app  = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));


// ─── 1. AUTENTIKASI ──────────────────────────────────────────────────────────

// POST /api/auth/masuk
app.post('/api/auth/masuk', async (req, res) => {
  try {
    const { nama_pengguna, pin } = req.body;

    if (!nama_pengguna || typeof nama_pengguna !== 'string' || !nama_pengguna.trim()) {
      return res.status(400).json({ sukses: false, pesan: 'Nama pengguna wajib diisi.' });
    }
    if (!pin) {
      return res.status(400).json({ sukses: false, pesan: 'PIN wajib diisi.' });
    }
    if (!Validator.pin(pin)) {
      return res.status(400).json({ sukses: false, pesan: 'Format PIN tidak valid. Harus 6 angka.' });
    }

    const akunKasir = await basisData.cariSatu('kasir', k => k.nama_pengguna === nama_pengguna.trim());
    if (!akunKasir || !akunKasir.is_aktif) {
      return res.status(401).json({ sukses: false, pesan: 'Username tidak ditemukan atau dinonaktifkan.' });
    }

    const cocok = bcrypt.compareSync(String(pin), akunKasir.pin_hash);
    if (!cocok) return res.status(401).json({ sukses: false, pesan: 'Username atau PIN salah.' });

    const infoCabang = await basisData.ambilBerdasarkanId('cabang', akunKasir.cabang_id);

    const token = jwt.sign(
      { kasirId: akunKasir.id, peran: akunKasir.peran },
      KUNCI_RAHASIA,
      { expiresIn: '8h' }
    );

    await basisData.tambah('sesi_aktif', {
      token_id: token.substring(token.length - 20),
      kasir_id: akunKasir.id,
      cabang_id: akunKasir.cabang_id,
      waktu_masuk: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19)
    });

    await basisData.perbarui('kasir', akunKasir.id, { login_terakhir: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19) });

    await basisData.tambah('log_perangkat', {
      cabang_id: akunKasir.cabang_id,
      kasir_id: akunKasir.id,
      tipe_kejadian: 'login',
      pesan: `${akunKasir.peran === 'admin' ? 'Admin' : akunKasir.peran === 'manajer' ? 'Manajer' : 'Kasir'} ${akunKasir.nama_lengkap} berhasil masuk`,
      timestamp: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19)
    });

    return res.json({
      sukses: true, pesan: 'Login berhasil.',
      data: {
        token,
        kasir: { id: akunKasir.id, nama_pengguna: akunKasir.nama_pengguna, nama_lengkap: akunKasir.nama_lengkap, peran: akunKasir.peran },
        cabang: infoCabang || null
      }
    });
  } catch (e) {
    console.error('Error /api/auth/masuk:', e);
    return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' });
  }
});

// POST /api/auth/keluar
app.post('/api/auth/keluar', verifikasiToken, async (req, res) => {
  try {
    const token   = req.headers['authorization'].split(' ')[1];
    const tokenId = token.substring(token.length - 20);

    const sesi = await basisData.cariSatu('sesi_aktif', s => s.token_id === tokenId);
    if (sesi) await basisData.hapus('sesi_aktif', sesi.id);

    await basisData.tambah('log_perangkat', {
      cabang_id: req.kasir.cabang_id, kasir_id: req.kasir.id,
      tipe_kejadian: 'logout',
      pesan: `${req.kasir.peran === 'admin' ? 'Admin' : req.kasir.peran === 'manajer' ? 'Manajer' : 'Kasir'} ${req.kasir.nama_lengkap} keluar dari sistem`,
      timestamp: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19)
    });

    return res.json({ sukses: true, pesan: 'Logout berhasil.' });
  } catch (e) {
    console.error('Error /api/auth/keluar:', e);
    return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' });
  }
});


// ─── 2. CRUD CABANG ──────────────────────────────────────────────────────────

// GET /api/cabang
app.get('/api/cabang', verifikasiToken, async (req, res) => {
  try {
    const cabang = await basisData.ambilSemua('cabang');
    return res.json({ sukses: true, data: cabang });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// POST /api/cabang
app.post('/api/cabang', verifikasiToken, hanyaAdmin, async (req, res) => {
  try {
    const { kode_cabang, nama_cabang, alamat, kota, telepon, nama_manajer } = req.body;

    if (!Validator.teks(kode_cabang, 10)) return res.status(400).json({ sukses: false, pesan: 'Kode cabang tidak valid. Maksimal 10 karakter.' });
    if (!Validator.teks(nama_cabang, 100)) return res.status(400).json({ sukses: false, pesan: 'Nama cabang tidak valid.' });
    if (!kota || !Validator.teks(kota, 50)) return res.status(400).json({ sukses: false, pesan: 'Kota tidak valid.' });

    const sudahAda = await basisData.cariSatu('cabang', c => c.kode_cabang === kode_cabang.toUpperCase());
    if (sudahAda) return res.status(400).json({ sukses: false, pesan: 'Kode cabang sudah terdaftar.' });

    const baru = await basisData.tambah('cabang', {
      kode_cabang: Validator.bersihkan(kode_cabang).toUpperCase(),
      nama_cabang: Validator.bersihkan(nama_cabang),
      alamat: alamat ? Validator.bersihkan(alamat) : '',
      kota: Validator.bersihkan(kota),
      telepon: telepon ? Validator.bersihkan(telepon) : '',
      nama_manajer: nama_manajer ? Validator.bersihkan(nama_manajer) : '',
      is_aktif: 1
    });

    return res.status(201).json({ sukses: true, pesan: 'Cabang berhasil ditambahkan.', data: baru });
  } catch (e) { console.error(e); return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// GET /api/cabang/:id
app.get('/api/cabang/:id', verifikasiToken, async (req, res) => {
  try {
    if (!Validator.angka(req.params.id, 1)) return res.status(400).json({ sukses: false, pesan: 'ID tidak valid.' });
    const cabang = await basisData.ambilBerdasarkanId('cabang', req.params.id);
    if (!cabang) return res.status(404).json({ sukses: false, pesan: 'Cabang tidak ditemukan.' });
    return res.json({ sukses: true, data: cabang });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// PUT /api/cabang/:id
app.put('/api/cabang/:id', verifikasiToken, hanyaAdmin, async (req, res) => {
  try {
    if (!Validator.angka(req.params.id, 1)) return res.status(400).json({ sukses: false, pesan: 'ID tidak valid.' });
    const cabang = await basisData.ambilBerdasarkanId('cabang', req.params.id);
    if (!cabang) return res.status(404).json({ sukses: false, pesan: 'Cabang tidak ditemukan.' });

    const payload = {};
    if (req.body.nama_cabang !== undefined) {
      if (!Validator.teks(req.body.nama_cabang, 100)) return res.status(400).json({ sukses: false, pesan: 'Nama cabang tidak valid.' });
      payload.nama_cabang = Validator.bersihkan(req.body.nama_cabang);
    }
    if (req.body.kode_cabang !== undefined) {
      if (!Validator.teks(req.body.kode_cabang, 10)) return res.status(400).json({ sukses: false, pesan: 'Kode cabang tidak valid.' });
      payload.kode_cabang = Validator.bersihkan(req.body.kode_cabang).toUpperCase();
    }
    if (req.body.kota !== undefined)        payload.kota        = Validator.bersihkan(req.body.kota);
    if (req.body.alamat !== undefined)      payload.alamat      = Validator.bersihkan(req.body.alamat);
    if (req.body.telepon !== undefined)     payload.telepon     = Validator.bersihkan(req.body.telepon);
    if (req.body.nama_manajer !== undefined) payload.nama_manajer = Validator.bersihkan(req.body.nama_manajer);

    const updated = await basisData.perbarui('cabang', req.params.id, payload);
    return res.json({ sukses: true, pesan: 'Cabang berhasil diperbarui.', data: updated });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// DELETE /api/cabang/:id
app.delete('/api/cabang/:id', verifikasiToken, hanyaAdmin, async (req, res) => {
  try {
    if (!Validator.angka(req.params.id, 1)) return res.status(400).json({ sukses: false, pesan: 'ID tidak valid.' });
    const cabang = await basisData.ambilBerdasarkanId('cabang', req.params.id);
    if (!cabang) return res.status(404).json({ sukses: false, pesan: 'Cabang tidak ditemukan.' });

    if (req.query.permanen === 'true') {
      await basisData.hapus('cabang', req.params.id);
      return res.json({ sukses: true, pesan: 'Cabang berhasil dihapus permanen.' });
    }
    await basisData.perbarui('cabang', req.params.id, { is_aktif: 0 });
    return res.json({ sukses: true, pesan: 'Cabang berhasil dinonaktifkan.' });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});


// ─── 3. CRUD KASIR ───────────────────────────────────────────────────────────

// GET /api/kasir
app.get('/api/kasir', verifikasiToken, hanyaManajerAtauAdmin, async (req, res) => {
  try {
    let daftar = await basisData.ambilSemua('kasir');
    if (req.kasir.peran === 'manajer') daftar = daftar.filter(k => k.cabang_id === req.kasir.cabang_id);

    const hasil = await Promise.all(daftar.map(async k => {
      const { pin_hash, pin, ...info } = k;
      const cabang = await basisData.ambilBerdasarkanId('cabang', k.cabang_id);
      return { ...info, nama_cabang: cabang ? cabang.nama_cabang : 'Cabang Tidak Diketahui' };
    }));

    return res.json({ sukses: true, data: hasil });
  } catch (e) { console.error(e); return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// POST /api/kasir
app.post('/api/kasir', verifikasiToken, hanyaManajerAtauAdmin, async (req, res) => {
  try {
    const { cabang_id, nama_pengguna, nama_lengkap, peran, pin } = req.body;

    if (!Validator.namapengguna(nama_pengguna)) return res.status(400).json({ sukses: false, pesan: 'Username tidak valid (huruf kecil, angka, underscore, 3-30 karakter).' });
    if (!Validator.teks(nama_lengkap, 100))     return res.status(400).json({ sukses: false, pesan: 'Nama lengkap tidak valid.' });
    if (!['kasir', 'manajer', 'admin'].includes(peran)) return res.status(400).json({ sukses: false, pesan: 'Peran tidak valid.' });
    if (!Validator.pin(pin)) return res.status(400).json({ sukses: false, pesan: 'PIN harus 6 angka.' });

    const sudahAda = await basisData.cariSatu('kasir', k => k.nama_pengguna === nama_pengguna);
    if (sudahAda) return res.status(400).json({ sukses: false, pesan: 'Nama pengguna sudah terdaftar.' });

    let finalCabangId = Number(cabang_id);
    if (req.kasir.peran === 'manajer') {
      finalCabangId = req.kasir.cabang_id;
      if (peran === 'admin') return res.status(403).json({ sukses: false, pesan: 'Manajer tidak dapat membuat akun Admin.' });
    } else if (!finalCabangId || !Validator.angka(finalCabangId, 1)) {
      finalCabangId = req.kasir.cabang_id;
    }

    const baru = await basisData.tambah('kasir', {
      cabang_id: finalCabangId,
      nama_pengguna: nama_pengguna.trim(),
      pin_hash: bcrypt.hashSync(String(pin), 10),
      nama_lengkap: Validator.bersihkan(nama_lengkap),
      peran, is_aktif: 1, login_terakhir: null
    });

    // Sinkronisasi: jika peran manajer, perbarui nama_manajer di tabel cabang
    if (peran === 'manajer') {
      await basisData.perbarui('cabang', finalCabangId, {
        nama_manajer: Validator.bersihkan(nama_lengkap)
      });
    }

    const { pin_hash, ...info } = baru;
    return res.status(201).json({ sukses: true, pesan: 'Kasir berhasil ditambahkan.', data: info });
  } catch (e) { console.error(e); return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// PUT /api/kasir/:id
app.put('/api/kasir/:id', verifikasiToken, hanyaManajerAtauAdmin, async (req, res) => {
  try {
    if (!Validator.angka(req.params.id, 1)) return res.status(400).json({ sukses: false, pesan: 'ID tidak valid.' });
    const kasir = await basisData.ambilBerdasarkanId('kasir', req.params.id);
    if (!kasir) return res.status(404).json({ sukses: false, pesan: 'Kasir tidak ditemukan.' });

    if (req.kasir.peran === 'manajer') {
      if (kasir.cabang_id !== req.kasir.cabang_id) return res.status(403).json({ sukses: false, pesan: 'Akses ditolak. Kasir bukan dari cabang Anda.' });
      if (req.body.peran === 'admin') return res.status(403).json({ sukses: false, pesan: 'Tidak dapat mengubah peran ke admin.' });
    }

    const payload = {};
    if (req.body.nama_lengkap !== undefined) {
      if (!Validator.teks(req.body.nama_lengkap, 100)) return res.status(400).json({ sukses: false, pesan: 'Nama lengkap tidak valid.' });
      payload.nama_lengkap = Validator.bersihkan(req.body.nama_lengkap);
    }
    if (req.body.nama_pengguna !== undefined) {
      if (!Validator.namapengguna(req.body.nama_pengguna)) return res.status(400).json({ sukses: false, pesan: 'Username tidak valid.' });
      payload.nama_pengguna = req.body.nama_pengguna.trim();
    }
    if (req.body.pin) {
      if (!Validator.pin(req.body.pin)) return res.status(400).json({ sukses: false, pesan: 'PIN harus 6 angka.' });
      payload.pin_hash = bcrypt.hashSync(String(req.body.pin), 10);
    }
    if (req.body.peran && req.kasir.peran === 'admin') {
      if (!['kasir', 'manajer', 'admin'].includes(req.body.peran)) return res.status(400).json({ sukses: false, pesan: 'Peran tidak valid.' });
      payload.peran = req.body.peran;
    }
    if (req.body.cabang_id && req.kasir.peran === 'admin') {
      if (!Validator.angka(req.body.cabang_id, 1)) return res.status(400).json({ sukses: false, pesan: 'ID cabang tidak valid.' });
      payload.cabang_id = Number(req.body.cabang_id);
    }
    if (req.body.is_aktif !== undefined) payload.is_aktif = req.body.is_aktif ? 1 : 0;

    const updated = await basisData.perbarui('kasir', req.params.id, payload);

    // Sinkronisasi nama_manajer di tabel cabang:
    // Tentukan data final setelah update (gabungkan data lama + payload)
    const peranFinal    = payload.peran      !== undefined ? payload.peran      : kasir.peran;
    const cabangFinal   = payload.cabang_id  !== undefined ? payload.cabang_id  : kasir.cabang_id;
    const namaFinal     = payload.nama_lengkap !== undefined ? payload.nama_lengkap : kasir.nama_lengkap;
    const isAktifFinal  = payload.is_aktif   !== undefined ? payload.is_aktif   : kasir.is_aktif;

    if (peranFinal === 'manajer' && isAktifFinal) {
      // Kasir ini adalah manajer aktif → perbarui nama_manajer di cabangnya
      await basisData.perbarui('cabang', cabangFinal, { nama_manajer: namaFinal });
    } else if (kasir.peran === 'manajer' && (peranFinal !== 'manajer' || !isAktifFinal)) {
      // Sebelumnya manajer, sekarang bukan / dinonaktifkan → kosongkan nama_manajer
      await basisData.perbarui('cabang', kasir.cabang_id, { nama_manajer: '' });
    }

    const { pin_hash, pin: _p, ...info } = updated;
    return res.json({ sukses: true, pesan: 'Kasir berhasil diperbarui.', data: info });
  } catch (e) { console.error(e); return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});

// DELETE /api/kasir/:id
app.delete('/api/kasir/:id', verifikasiToken, hanyaManajerAtauAdmin, async (req, res) => {
  try {
    if (!Validator.angka(req.params.id, 1)) return res.status(400).json({ sukses: false, pesan: 'ID tidak valid.' });
    const kasir = await basisData.ambilBerdasarkanId('kasir', req.params.id);
    if (!kasir) return res.status(404).json({ sukses: false, pesan: 'Kasir tidak ditemukan.' });

    if (req.kasir.peran === 'manajer') {
      if (kasir.cabang_id !== req.kasir.cabang_id) return res.status(403).json({ sukses: false, pesan: 'Akses ditolak.' });
      if (['admin', 'manajer'].includes(kasir.peran)) return res.status(403).json({ sukses: false, pesan: 'Tidak bisa hapus akun setara.' });
    }

    if (req.query.permanen === 'true') {
      await basisData.hapus('kasir', req.params.id);
      return res.json({ sukses: true, pesan: 'Kasir berhasil dihapus permanen.' });
    }
    await basisData.perbarui('kasir', req.params.id, { is_aktif: 0 });
    return res.json({ sukses: true, pesan: 'Kasir berhasil dinonaktifkan.' });
  } catch (e) { return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); }
});


// GET /api/log
app.get('/api/log', verifikasiToken, async (req, res) => {
  try {
    let logs = await basisData.ambilSemua('log_perangkat');
    if (req.kasir.peran !== 'admin') {
      logs = logs.filter(l => l.cabang_id === req.kasir.cabang_id);
    }
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return res.json({ sukses: true, data: logs.slice(0, 50) });
  } catch (e) { 
    return res.status(500).json({ sukses: false, pesan: 'Kesalahan server.' }); 
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Layanan Autentikasi berjalan di port ${PORT}`));


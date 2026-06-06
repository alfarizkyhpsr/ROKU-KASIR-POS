const jwt = require('jsonwebtoken');
const basisData = require('./basis_data');

const KUNCI_RAHASIA = process.env.JWT_SECRET || 'KASIR_ROKU_KUNCI_RAHASIA_SUPER_AMAN_GANTI_DI_PROD';

async function verifikasiToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ sukses: false, pesan: 'Akses ditolak. Token otorisasi tidak ditemukan.' });
  }

  const bagian = authHeader.split(' ');
  if (bagian.length !== 2 || bagian[0] !== 'Bearer') {
    return res.status(400).json({ sukses: false, pesan: "Format token tidak valid. Harus 'Bearer <token>'." });
  }

  const token = bagian[1];

  try {
    const terdekripsi = jwt.verify(token, KUNCI_RAHASIA);

    const akunKasir = await basisData.ambilBerdasarkanId('kasir', terdekripsi.kasirId);
    if (!akunKasir || !akunKasir.is_aktif) {
      return res.status(403).json({ sukses: false, pesan: 'Akun kasir tidak ditemukan atau sudah dinonaktifkan.' });
    }

    const tokenId = token.substring(token.length - 20);
    const sesi    = await basisData.cariSatu('sesi_aktif', s => s.token_id === tokenId && s.kasir_id === akunKasir.id);

    if (!sesi) {
      return res.status(401).json({ sukses: false, pesan: 'Sesi tidak ditemukan atau sudah berakhir. Silakan login kembali.' });
    }

    req.kasir = {
      id: akunKasir.id,
      cabang_id: akunKasir.cabang_id,
      nama_pengguna: akunKasir.nama_pengguna,
      nama_lengkap: akunKasir.nama_lengkap,
      peran: akunKasir.peran
    };

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(403).json({ sukses: false, pesan: 'Token kedaluwarsa atau tidak valid.' });
    }
    console.error('Error verifikasiToken:', err.message);
    return res.status(500).json({ sukses: false, pesan: 'Kesalahan server saat verifikasi token.' });
  }
}

function hanyaAdmin(req, res, next) {
  if (req.kasir && req.kasir.peran === 'admin') return next();
  return res.status(403).json({ sukses: false, pesan: 'Akses ditolak. Fitur ini hanya untuk Admin Utama.' });
}

function hanyaManajerAtauAdmin(req, res, next) {
  if (req.kasir && (req.kasir.peran === 'manajer' || req.kasir.peran === 'admin')) return next();
  return res.status(403).json({ sukses: false, pesan: 'Akses ditolak. Fitur ini memerlukan hak akses Manajer atau Admin.' });
}

module.exports = { verifikasiToken, hanyaAdmin, hanyaManajerAtauAdmin, KUNCI_RAHASIA };

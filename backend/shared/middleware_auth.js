const jwt = require('jsonwebtoken');
const basisData = require('./basis_data');

const KUNCI_RAHASIA = process.env.JWT_SECRET || "KASIR_UI_KUNCI_RAHASIA_SUPER_AMAN";

function verifikasiToken(req, res, next) {
  const authorizationHeader = req.headers['authorization'];

  if (!authorizationHeader) {
    return res.status(401).json({
      sukses: false,
      pesan: "Akses ditolak. Token otorisasi tidak ditemukan."
    });
  }

  const bagianToken = authorizationHeader.split(' ');
  if (bagianToken.length !== 2 || bagianToken[0] !== 'Bearer') {
    return res.status(400).json({
      sukses: false,
      pesan: "Format token tidak valid. Harus 'Bearer <token>'."
    });
  }

  const token = bagianToken[1];

  try {
    const terdekripsi = jwt.verify(token, KUNCI_RAHASIA);

    // Cari kasir di basis data untuk memastikan akun masih ada & aktif
    const akunKasir = basisData.ambilBerdasarkanId('kasir', terdekripsi.kasirId);
    if (!akunKasir || !akunKasir.is_aktif) {
      return res.status(403).json({
        sukses: false,
        pesan: "Akun kasir tidak ditemukan atau sudah dinonaktifkan."
      });
    }

    // Cegah token yang sudah di-logout dipakai kembali
    const tokenId = token.substring(token.length - 20);
    const sesiMasihAktif = basisData.cariSatu(
      'sesi_aktif',
      s => s.token_id === tokenId && s.kasir_id === akunKasir.id
    );

    if (!sesiMasihAktif) {
      return res.status(401).json({
        sukses: false,
        pesan: "Sesi tidak ditemukan atau sudah berakhir. Silakan login kembali."
      });
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
    return res.status(403).json({
      sukses: false,
      pesan: "Token kedaluwarsa atau tidak valid."
    });
  }
}

function hanyaAdmin(req, res, next) {
  if (req.kasir && req.kasir.peran === 'admin') {
    next();
  } else {
    return res.status(403).json({
      sukses: false,
      pesan: "Akses ditolak. Fitur ini hanya untuk Admin Utama."
    });
  }
}

function hanyaManajerAtauAdmin(req, res, next) {
  if (req.kasir && (req.kasir.peran === 'manajer' || req.kasir.peran === 'admin')) {
    next();
  } else {
    return res.status(403).json({
      sukses: false,
      pesan: "Akses ditolak. Fitur ini memerlukan hak akses Manajer atau Admin."
    });
  }
}

module.exports = {
  verifikasiToken,
  hanyaAdmin,
  hanyaManajerAtauAdmin,
  KUNCI_RAHASIA
};
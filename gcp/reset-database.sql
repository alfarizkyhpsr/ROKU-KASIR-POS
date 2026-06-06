-- Script Pembersihan Keseluruhan Database Kasir ROKU
-- PERINGATAN: MENJALANKAN SCRIPT INI AKAN MENGHAPUS SEMUA DATA TRANSAKSI DAN MASTER DATA!

USE `kasir_roku`;

-- Mematikan sementara pemeriksaan Foreign Key agar penghapusan tidak ditolak
SET FOREIGN_KEY_CHECKS = 0;

-- Menghapus semua tabel secara paksa
DROP TABLE IF EXISTS `item_transaksi`;
DROP TABLE IF EXISTS `pembayaran`;
DROP TABLE IF EXISTS `transaksi`;
DROP TABLE IF EXISTS `sesi_aktif`;
DROP TABLE IF EXISTS `shift_kasir`;
DROP TABLE IF EXISTS `stok`;
DROP TABLE IF EXISTS `kasir`;
DROP TABLE IF EXISTS `barang`;
DROP TABLE IF EXISTS `cabang`;

-- Menghidupkan kembali pemeriksaan Foreign Key
SET FOREIGN_KEY_CHECKS = 1;

-- Menampilkan pesan sukses (opsional tergantung klien SQL)
SELECT 'Semua tabel berhasil dihapus. Database kembali kosong.' AS Pesan_Status;

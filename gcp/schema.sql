-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: mysql
-- ------------------------------------------------------
-- Server version	8.0.44-google

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `kasir_roku`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `kasir_roku` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `kasir_roku`;

--
-- Table structure for table `barang`
--

DROP TABLE IF EXISTS `barang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `barang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_barcode` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `nama_barang` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `kategori` enum('MAKANAN','MINUMAN','UMUM') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'UMUM',
  `satuan` varchar(20) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pcs',
  `harga_jual` decimal(12,2) NOT NULL,
  `harga_pokok` decimal(12,2) NOT NULL DEFAULT '0.00',
  `url_gambar` mediumtext COLLATE utf8mb4_general_ci,
  `is_aktif` tinyint(1) NOT NULL DEFAULT '1',
  `dibuat_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kode_barcode` (`kode_barcode`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `barang`
--

LOCK TABLES `barang` WRITE;
/*!40000 ALTER TABLE `barang` DISABLE KEYS */;
INSERT INTO `barang` VALUES (1,'8991001','ES KOPI SUSU AREN','MINUMAN','gelas',18000.00,8000.00,'inventory_2',1,'2026-05-31 14:25:59','2026-06-05 03:00:57'),(2,'8991002','BUTTER CROISSANT','MAKANAN','pcs',22000.00,10000.00,'bakery_dining',1,'2026-05-31 14:25:59','2026-05-31 14:25:59'),(3,'8991003','CLUB SANDWICH','MAKANAN','pcs',35000.00,15000.00,'bakery_dining',1,'2026-05-31 14:25:59','2026-05-31 14:25:59'),(4,'8991004','MATCHA LATTE','MINUMAN','gelas',24000.00,11000.00,'data:image/jpeg;base64,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',1,'2026-05-31 14:25:59','2026-06-06 01:55:33');
/*!40000 ALTER TABLE `barang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cabang`
--

DROP TABLE IF EXISTS `cabang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cabang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_cabang` varchar(10) COLLATE utf8mb4_general_ci NOT NULL,
  `nama_cabang` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `alamat` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '',
  `kota` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `telepon` varchar(20) COLLATE utf8mb4_general_ci DEFAULT '',
  `nama_manajer` varchar(100) COLLATE utf8mb4_general_ci DEFAULT '',
  `is_aktif` tinyint(1) NOT NULL DEFAULT '1',
  `dibuat_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kode_cabang` (`kode_cabang`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cabang`
--

LOCK TABLES `cabang` WRITE;
/*!40000 ALTER TABLE `cabang` DISABLE KEYS */;
INSERT INTO `cabang` VALUES (1,'TOKO UTAMA','Toko Utama','Jl. Dago No. 102','Bandung','022-2501234','Budi Santoso',1,'2026-05-31 14:25:59','2026-05-31 07:41:13'),(2,'CAB01','Toko Roti & Kopi Kemang','Jl. Kemang Raya No. 15','Jakarta Selatan','021-7194321','Siti Aminah',1,'2026-05-31 14:25:59','2026-06-06 01:39:41');
/*!40000 ALTER TABLE `cabang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_transaksi`
--

DROP TABLE IF EXISTS `item_transaksi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_transaksi` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaksi_id` int NOT NULL,
  `barang_id` int NOT NULL,
  `jumlah` int NOT NULL,
  `harga_satuan` decimal(12,2) NOT NULL,
  `subtotal` decimal(14,2) NOT NULL,
  `dibuat_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `transaksi_id` (`transaksi_id`),
  KEY `barang_id` (`barang_id`),
  CONSTRAINT `item_transaksi_ibfk_1` FOREIGN KEY (`transaksi_id`) REFERENCES `transaksi` (`id`),
  CONSTRAINT `item_transaksi_ibfk_2` FOREIGN KEY (`barang_id`) REFERENCES `barang` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_transaksi`
--

LOCK TABLES `item_transaksi` WRITE;
/*!40000 ALTER TABLE `item_transaksi` DISABLE KEYS */;
INSERT INTO `item_transaksi` VALUES (1,1,2,1,22000.00,22000.00,'2026-06-05 03:01:59'),(2,1,3,1,35000.00,35000.00,'2026-06-05 03:01:59'),(3,1,1,1,18000.00,18000.00,'2026-06-05 03:01:59'),(4,2,3,1,35000.00,35000.00,'2026-06-05 03:04:27'),(5,2,1,1,18000.00,18000.00,'2026-06-05 03:04:27'),(6,2,2,1,22000.00,22000.00,'2026-06-05 03:04:27'),(7,3,1,1,18000.00,18000.00,'2026-06-06 00:30:00'),(8,3,4,1,24000.00,24000.00,'2026-06-06 00:30:00'),(9,4,1,1,18000.00,18000.00,'2026-06-06 00:31:09'),(10,4,4,1,24000.00,24000.00,'2026-06-06 00:31:09'),(11,4,2,1,22000.00,22000.00,'2026-06-06 00:31:09'),(12,4,3,1,35000.00,35000.00,'2026-06-06 00:31:09'),(13,5,3,1,35000.00,35000.00,'2026-06-06 00:37:31'),(14,5,1,1,18000.00,18000.00,'2026-06-06 00:37:31'),(15,5,2,1,22000.00,22000.00,'2026-06-06 00:37:31'),(16,5,4,1,24000.00,24000.00,'2026-06-06 00:37:31'),(17,6,1,1,18000.00,18000.00,'2026-06-06 00:37:47'),(18,6,2,1,22000.00,22000.00,'2026-06-06 00:37:47'),(19,6,3,1,35000.00,35000.00,'2026-06-06 00:37:47'),(20,6,4,1,24000.00,24000.00,'2026-06-06 00:37:47'),(21,7,1,1,18000.00,18000.00,'2026-06-06 00:46:56'),(22,7,3,1,35000.00,35000.00,'2026-06-06 00:46:56'),(23,7,4,1,24000.00,24000.00,'2026-06-06 00:46:56'),(24,7,2,1,22000.00,22000.00,'2026-06-06 00:46:56'),(25,8,1,1,18000.00,18000.00,'2026-06-06 00:47:38'),(26,8,3,1,35000.00,35000.00,'2026-06-06 00:47:38'),(27,8,2,1,22000.00,22000.00,'2026-06-06 00:47:38'),(28,8,4,1,24000.00,24000.00,'2026-06-06 00:47:38'),(29,9,1,1,18000.00,18000.00,'2026-06-06 01:01:10'),(30,9,2,1,22000.00,22000.00,'2026-06-06 01:01:10'),(31,9,3,1,35000.00,35000.00,'2026-06-06 01:01:10'),(32,10,3,1,35000.00,35000.00,'2026-06-06 01:19:47'),(33,10,1,1,18000.00,18000.00,'2026-06-06 01:19:47'),(34,10,2,1,22000.00,22000.00,'2026-06-06 01:19:47'),(35,11,1,1,18000.00,18000.00,'2026-06-06 01:19:50'),(36,11,2,1,22000.00,22000.00,'2026-06-06 01:19:50'),(37,11,3,1,35000.00,35000.00,'2026-06-06 01:19:50'),(38,11,4,1,24000.00,24000.00,'2026-06-06 01:19:50'),(39,12,1,1,18000.00,18000.00,'2026-06-06 01:33:33'),(40,12,2,1,22000.00,22000.00,'2026-06-06 01:33:33'),(41,12,3,1,35000.00,35000.00,'2026-06-06 01:33:33'),(42,13,4,1,24000.00,24000.00,'2026-06-06 01:40:49');
/*!40000 ALTER TABLE `item_transaksi` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kasir`
--

DROP TABLE IF EXISTS `kasir`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kasir` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cabang_id` int NOT NULL,
  `nama_pengguna` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `pin_hash` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `nama_lengkap` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `peran` enum('admin','manajer','kasir') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'kasir',
  `is_aktif` tinyint(1) NOT NULL DEFAULT '1',
  `login_terakhir` datetime DEFAULT NULL,
  `dibuat_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nama_pengguna` (`nama_pengguna`),
  KEY `cabang_id` (`cabang_id`),
  CONSTRAINT `kasir_ibfk_1` FOREIGN KEY (`cabang_id`) REFERENCES `cabang` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kasir`
--

LOCK TABLES `kasir` WRITE;
/*!40000 ALTER TABLE `kasir` DISABLE KEYS */;
INSERT INTO `kasir` VALUES (1,1,'admin','$2a$10$Di8nv1.pWz7tamdAs5Ord.yRIxiFzWGKJgvTgAq3gI.5NRsl13BVu','Admin Utama','admin',1,'2026-06-06 01:42:14','2026-05-31 14:25:59','2026-06-06 01:42:14'),(2,1,'manajer01','$2a$10$pNmAYRmG.48TdwvLkUTEA.n8ul0BhGKJgHv2rb.XhMgY8tXoFEeia','Budi Santoso','manajer',1,'2026-05-31 07:39:02','2026-05-31 14:25:59','2026-05-31 07:39:02'),(3,1,'kasir01','$2a$10$yxAbgQ8rLRM9RGLz3Uf98u7l3rrqZWFzWuoxVKUQGU49SeipK5IzK','Andi Nugroho','kasir',1,NULL,'2026-05-31 14:25:59','2026-05-31 14:38:17'),(4,2,'siti','$2a$10$Fal4VRm/b/Z39fpdKe56FeYoEnDlRwFLJ44Ngd6hh3cLhjSN30E8u','Siti Aminah','manajer',1,'2026-06-06 01:39:54','2026-05-31 07:42:07','2026-06-06 01:39:54');
/*!40000 ALTER TABLE `kasir` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pembayaran`
--

DROP TABLE IF EXISTS `pembayaran`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pembayaran` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaksi_id` int NOT NULL,
  `metode` enum('tunai','qris','debit','credit') COLLATE utf8mb4_general_ci NOT NULL,
  `jumlah` decimal(14,2) NOT NULL,
  `jumlah_bayar` decimal(14,2) NOT NULL,
  `jumlah_kembalian` decimal(14,2) NOT NULL DEFAULT '0.00',
  `status` varchar(20) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'sukses',
  `referensi` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `dibuat_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `transaksi_id` (`transaksi_id`),
  CONSTRAINT `pembayaran_ibfk_1` FOREIGN KEY (`transaksi_id`) REFERENCES `transaksi` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pembayaran`
--

LOCK TABLES `pembayaran` WRITE;
/*!40000 ALTER TABLE `pembayaran` DISABLE KEYS */;
INSERT INTO `pembayaran` VALUES (1,1,'tunai',82500.00,82500.00,0.00,'sukses',NULL,'2026-06-05 03:01:59'),(2,2,'tunai',82500.00,82500.00,0.00,'sukses',NULL,'2026-06-05 03:04:27'),(3,3,'tunai',46200.00,46200.00,0.00,'sukses',NULL,'2026-06-06 00:30:00'),(4,4,'tunai',108900.00,108900.00,0.00,'sukses',NULL,'2026-06-06 00:31:09'),(5,5,'tunai',108900.00,108900.00,0.00,'sukses',NULL,'2026-06-06 00:37:31'),(6,6,'tunai',108900.00,108900.00,0.00,'sukses',NULL,'2026-06-06 00:37:46'),(7,7,'tunai',108900.00,120000.00,11100.00,'sukses',NULL,'2026-06-06 00:46:56'),(8,8,'tunai',108900.00,108900.00,0.00,'sukses',NULL,'2026-06-06 00:47:38'),(9,9,'tunai',82500.00,82500.00,0.00,'sukses',NULL,'2026-06-06 01:01:10'),(10,10,'tunai',82500.00,82500.00,0.00,'sukses',NULL,'2026-06-06 01:19:47'),(11,11,'tunai',108900.00,108900.00,0.00,'sukses',NULL,'2026-06-06 01:19:50'),(12,12,'tunai',82500.00,82500.00,0.00,'sukses',NULL,'2026-06-06 01:33:33'),(13,13,'tunai',26400.00,26400.00,0.00,'sukses',NULL,'2026-06-06 01:40:49');
/*!40000 ALTER TABLE `pembayaran` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sesi_aktif`
--

DROP TABLE IF EXISTS `sesi_aktif`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesi_aktif` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kasir_id` int NOT NULL,
  `cabang_id` int DEFAULT NULL,
  `token_id` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `waktu_masuk` datetime DEFAULT CURRENT_TIMESTAMP,
  `dibuat_pada` datetime DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `kasir_id` (`kasir_id`),
  CONSTRAINT `sesi_aktif_ibfk_1` FOREIGN KEY (`kasir_id`) REFERENCES `kasir` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sesi_aktif`
--

LOCK TABLES `sesi_aktif` WRITE;
/*!40000 ALTER TABLE `sesi_aktif` DISABLE KEYS */;
INSERT INTO `sesi_aktif` VALUES (1,1,1,'h5OJU7kp9JrQaLi1Tox4','2026-06-05 01:10:14','2026-06-05 01:10:14','2026-06-05 01:10:14'),(2,1,1,'FqNSwWTZGWR6Zs9ya56c','2026-06-05 01:10:23','2026-06-05 01:10:23','2026-06-05 01:10:23'),(3,1,1,'HtjWk-8FCfyWwTmz_7dM','2026-06-05 01:23:59','2026-06-05 01:23:59','2026-06-05 01:23:59'),(4,1,1,'x9J_2aRt9yVoIwzkctVs','2026-06-05 01:30:31','2026-06-05 01:30:31','2026-06-05 01:30:31'),(5,1,1,'D6j68ABp5BbUE7OlPU44','2026-06-05 03:00:45','2026-06-05 03:00:45','2026-06-05 03:00:45'),(6,1,1,'Crpi0DErUdgPcVRGcQ64','2026-06-05 04:36:37','2026-06-05 04:36:37','2026-06-05 04:36:37'),(7,1,1,'NTYBDg1yhq3NfJ9jmoLc','2026-06-05 23:52:30','2026-06-05 23:52:30','2026-06-05 23:52:30'),(8,1,1,'dq55nZuazhzYrcfVqDcg','2026-06-06 00:18:29','2026-06-06 00:18:29','2026-06-06 00:18:29'),(9,1,1,'4ispGGc1RIUVyEIHHy1Y','2026-06-06 00:37:09','2026-06-06 00:37:09','2026-06-06 00:37:09'),(10,4,2,'cVQKHyVq9yAfhS0aqIEM','2026-06-06 01:39:53','2026-06-06 01:39:53','2026-06-06 01:39:53'),(11,1,1,'9q8T4_znKY72KG2ydDEE','2026-06-06 01:42:14','2026-06-06 01:42:14','2026-06-06 01:42:14');
/*!40000 ALTER TABLE `sesi_aktif` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_kasir`
--

DROP TABLE IF EXISTS `shift_kasir`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_kasir` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cabang_id` int NOT NULL,
  `kasir_id` int NOT NULL,
  `dibuka_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ditutup_pada` datetime DEFAULT NULL,
  `modal_awal` decimal(14,2) NOT NULL DEFAULT '0.00',
  `kas_akhir` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total_penjualan` decimal(14,2) NOT NULL DEFAULT '0.00',
  `penjualan_tunai` decimal(14,2) NOT NULL DEFAULT '0.00',
  `penjualan_non_tunai` decimal(14,2) NOT NULL DEFAULT '0.00',
  `status` enum('buka','tutup') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'buka',
  `catatan` text COLLATE utf8mb4_general_ci,
  `dibuat_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cabang_id` (`cabang_id`),
  KEY `kasir_id` (`kasir_id`),
  CONSTRAINT `shift_kasir_ibfk_1` FOREIGN KEY (`cabang_id`) REFERENCES `cabang` (`id`),
  CONSTRAINT `shift_kasir_ibfk_2` FOREIGN KEY (`kasir_id`) REFERENCES `kasir` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_kasir`
--

LOCK TABLES `shift_kasir` WRITE;
/*!40000 ALTER TABLE `shift_kasir` DISABLE KEYS */;
INSERT INTO `shift_kasir` VALUES (1,1,1,'2026-06-05 03:03:55','2026-06-05 03:04:57',100000.00,182500.00,82500.00,82500.00,0.00,'tutup','Tutup shift. Selisih kas: Rp 0','2026-06-05 03:03:55'),(2,1,1,'2026-06-06 00:22:46','2026-06-06 00:23:01',100000.00,50000.00,0.00,0.00,0.00,'tutup','Tutup shift. Selisih kas: Rp -50.000','2026-06-06 00:22:46'),(3,1,1,'2026-06-06 00:30:51','2026-06-06 01:01:51',100000.00,727000.00,627000.00,627000.00,0.00,'tutup','Tutup shift. Selisih kas: Rp 0','2026-06-06 00:30:51');
/*!40000 ALTER TABLE `shift_kasir` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stok`
--

DROP TABLE IF EXISTS `stok`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stok` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cabang_id` int NOT NULL,
  `barang_id` int NOT NULL,
  `terjual` int NOT NULL DEFAULT '0',
  `terjual_terakhir_reset` date DEFAULT (curdate()),
  `target_harian` int NOT NULL DEFAULT '100',
  `diperbarui_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stok` (`cabang_id`,`barang_id`),
  KEY `barang_id` (`barang_id`),
  CONSTRAINT `stok_ibfk_1` FOREIGN KEY (`cabang_id`) REFERENCES `cabang` (`id`),
  CONSTRAINT `stok_ibfk_2` FOREIGN KEY (`barang_id`) REFERENCES `barang` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stok`
--

LOCK TABLES `stok` WRITE;
/*!40000 ALTER TABLE `stok` DISABLE KEYS */;
INSERT INTO `stok` VALUES (1,1,1,4,'2026-06-06',100,'2026-06-06 01:33:33'),(2,1,2,4,'2026-06-06',80,'2026-06-06 01:33:33'),(3,1,3,4,'2026-06-06',45,'2026-06-06 01:33:33'),(4,1,4,1,'2026-06-06',100,'2026-06-06 01:19:50'),(5,2,1,0,'2026-06-06',90,'2026-06-06 00:46:12'),(6,2,2,0,'2026-06-06',50,'2026-06-06 00:46:12'),(7,2,3,0,'2026-06-06',100,'2026-06-06 00:46:12'),(8,2,4,1,'2026-06-06',100,'2026-06-06 01:40:49');
/*!40000 ALTER TABLE `stok` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transaksi`
--

DROP TABLE IF EXISTS `transaksi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transaksi` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_transaksi` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `cabang_id` int NOT NULL,
  `kasir_id` int NOT NULL,
  `shift_id` int DEFAULT '0',
  `total_belanja` decimal(14,2) NOT NULL,
  `diskon` decimal(14,2) NOT NULL DEFAULT '0.00',
  `pajak` decimal(14,2) NOT NULL DEFAULT '0.00',
  `metode_pembayaran` enum('tunai','qris','debit','credit') COLLATE utf8mb4_general_ci NOT NULL,
  `jumlah_bayar` decimal(14,2) NOT NULL,
  `jumlah_kembalian` decimal(14,2) NOT NULL DEFAULT '0.00',
  `status_sinkronisasi` tinyint(1) NOT NULL DEFAULT '1',
  `dibuat_pada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kode_transaksi` (`kode_transaksi`),
  KEY `cabang_id` (`cabang_id`),
  KEY `kasir_id` (`kasir_id`),
  CONSTRAINT `transaksi_ibfk_1` FOREIGN KEY (`cabang_id`) REFERENCES `cabang` (`id`),
  CONSTRAINT `transaksi_ibfk_2` FOREIGN KEY (`kasir_id`) REFERENCES `kasir` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transaksi`
--

LOCK TABLES `transaksi` WRITE;
/*!40000 ALTER TABLE `transaksi` DISABLE KEYS */;
INSERT INTO `transaksi` VALUES (1,'OFF-1780628511603',1,1,0,82500.00,0.00,7500.00,'tunai',82500.00,0.00,1,'2026-06-05 03:01:59'),(2,'TX-1780628667898-572',1,1,1,82500.00,0.00,7500.00,'tunai',82500.00,0.00,1,'2026-06-05 03:04:27'),(3,'OFF-1780705795537',1,1,0,46200.00,0.00,4200.00,'tunai',46200.00,0.00,1,'2026-06-06 00:30:00'),(4,'TX-1780705869503-394',1,1,3,108900.00,0.00,9900.00,'tunai',108900.00,0.00,1,'2026-06-06 00:31:09'),(5,'TX-1780706251930-173',1,1,3,108900.00,0.00,9900.00,'tunai',108900.00,0.00,1,'2026-06-06 00:37:31'),(6,'TX-1780706266979-862',1,1,3,108900.00,0.00,9900.00,'tunai',108900.00,0.00,1,'2026-06-06 00:37:46'),(7,'TX-1780706816137-973',1,1,3,108900.00,0.00,9900.00,'tunai',120000.00,11100.00,1,'2026-06-06 00:46:56'),(8,'TX-1780706858055-930',1,1,3,108900.00,0.00,9900.00,'tunai',108900.00,0.00,1,'2026-06-06 00:47:38'),(9,'TX-1780707670162-544',1,1,3,82500.00,0.00,7500.00,'tunai',82500.00,0.00,1,'2026-06-06 01:01:10'),(10,'OFF-1780707862552',1,1,0,82500.00,0.00,7500.00,'tunai',82500.00,0.00,1,'2026-06-06 01:19:47'),(11,'OFF-1780708153902',1,1,0,108900.00,0.00,9900.00,'tunai',108900.00,0.00,1,'2026-06-06 01:19:50'),(12,'OFF-1780709607931',1,1,0,82500.00,0.00,7500.00,'tunai',82500.00,0.00,1,'2026-06-06 01:33:33'),(13,'OFF-1780710038800',2,4,0,26400.00,0.00,2400.00,'tunai',26400.00,0.00,1,'2026-06-06 01:40:49');
/*!40000 ALTER TABLE `transaksi` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-06  2:37:08

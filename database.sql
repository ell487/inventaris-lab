CREATE DATABASE IF NOT EXISTS `inventaris_lab`;
USE `inventaris_lab`;


-- 1. TABEL USERS (Aktor & Hak Akses)

CREATE TABLE `users` (
  `id_user` INT NOT NULL AUTO_INCREMENT,
  `nama` VARCHAR(100) NOT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'kepala_lab', 'kaprodi', 'staf_admin', 'staf_lab') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 2. TABEL RUANGAN (Admin)

CREATE TABLE `ruangan` (
  `id_ruangan` INT NOT NULL AUTO_INCREMENT,
  `nama_ruangan` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id_ruangan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 3. TABEL BHP / BARANG HABIS PAKAI (Staf Lab)

CREATE TABLE `bhp` (
  `id_bhp` INT NOT NULL AUTO_INCREMENT,
  `nama_bhp` VARCHAR(100) NOT NULL,
  `stok` INT NOT NULL DEFAULT 0,
  `satuan` VARCHAR(20) NOT NULL, -- Contoh: 'Pcs', 'Rim', 'Botol'
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_bhp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 4. TABEL INVENTARIS / ASET TETAP (Staf Lab & Admin)

CREATE TABLE `inventaris` (
  `id_inventaris` INT NOT NULL AUTO_INCREMENT,
  `kode_label_qr` VARCHAR(100) DEFAULT NULL UNIQUE,
  `nama_barang` VARCHAR(100) NOT NULL,
  `kondisi` ENUM('baik', 'rusak', 'maintenance', 'dihapus') NOT NULL DEFAULT 'baik',
  `id_ruangan` INT NOT NULL,
  `foto_qr` VARCHAR(255) DEFAULT NULL, -- Menyimpan nama/path file foto QR/Barcode yang diupload Staf Admin
  PRIMARY KEY (`id_inventaris`),
  CONSTRAINT `fk_inventaris_ruangan` FOREIGN KEY (`id_ruangan`) REFERENCES `ruangan` (`id_ruangan`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 5. TABEL DRAF PENGADAAN (Kepala Lab & Kaprodi)

CREATE TABLE `draf_pengadaan` (
  `id_draf` INT NOT NULL AUTO_INCREMENT,
  `judul_draf` VARCHAR(150) NOT NULL,
  `tahun` INT NOT NULL,
  `status_draf` ENUM('draft', 'pending_kaprodi', 'locked') NOT NULL DEFAULT 'draft',
  `id_kepala_lab` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_draf`),
  CONSTRAINT `fk_draf_kepala_lab` FOREIGN KEY (`id_kepala_lab`) REFERENCES `users` (`id_user`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 6. TABEL DETAIL ITEM DRAF PENGADAAN (Kalab, Kaprodi, Staf Admin)

CREATE TABLE `detail_draf` (
  `id_detail` INT NOT NULL AUTO_INCREMENT,
  `id_draf` INT NOT NULL,
  `tipe_barang` ENUM('inventaris', 'bhp') NOT NULL,
  `nama_barang` VARCHAR(100) NOT NULL,
  `harga_satuan` INT NOT NULL,
  `jumlah` INT NOT NULL, 
  `link_pembelian` TEXT NOT NULL,
  `id_inventaris_lama` INT DEFAULT NULL, 
  `status_approval` ENUM('pending', 'disetujui', 'ditolak') NOT NULL DEFAULT 'pending', 
  PRIMARY KEY (`id_detail`),
  CONSTRAINT `fk_detail_draf` FOREIGN KEY (`id_draf`) REFERENCES `draf_pengadaan` (`id_draf`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_detail_inventaris_lama` FOREIGN KEY (`id_inventaris_lama`) REFERENCES `inventaris` (`id_inventaris`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 7. TABEL RIWAYAT PENERIMAAN BARANG (Staf Admin - Penerimaan Parsial)

CREATE TABLE `riwayat_penerimaan` (
  `id_penerimaan` INT NOT NULL AUTO_INCREMENT,
  `id_detail` INT NOT NULL,
  `jumlah_diterima` INT NOT NULL, 
  `tanggal_penerimaan` DATE NOT NULL,
  `id_staf_admin` INT NOT NULL, 
  PRIMARY KEY (`id_penerimaan`),
  CONSTRAINT `fk_penerimaan_detail` FOREIGN KEY (`id_detail`) REFERENCES `detail_draf` (`id_detail`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_penerimaan_staf` FOREIGN KEY (`id_staf_admin`) REFERENCES `users` (`id_user`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 8. TABEL LOG MAINTENANCE ASET (Staf Lab)

CREATE TABLE `log_maintenance` (
  `id_log` INT NOT NULL AUTO_INCREMENT,
  `id_inventaris` INT NOT NULL,
  `id_staf_lab` INT NOT NULL,
  `tanggal_maintenance` DATE NOT NULL,
  `deskripsi` TEXT NOT NULL,
  `id_bhp_digunakan` INT DEFAULT NULL,
  `jumlah_bhp_dipakai` INT DEFAULT NULL, 
  PRIMARY KEY (`id_log`),
  CONSTRAINT `fk_log_inventaris` FOREIGN KEY (`id_inventaris`) REFERENCES `inventaris` (`id_inventaris`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_log_staf` FOREIGN KEY (`id_staf_lab`) REFERENCES `users` (`id_user`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_log_bhp` FOREIGN KEY (`id_bhp_digunakan`) REFERENCES `bhp` (`id_bhp`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



-- SEEDING DATA SEBAGAI CONTOH AWAL TESTING

INSERT INTO `users` (`nama`, `username`, `password`, `role`) VALUES
('Admin Utama', 'admin', 'password', 'admin'),
('Dr. Budi Utomo', 'kalab', 'password', 'kepala_lab'),
('Prof. Hadi Subroto', 'kaprodi', 'password', 'kaprodi'),
('Siti Aminah', 'stafadmin', 'password', 'staf_admin'),
('Andi Wijaya', 'staflab', 'password', 'staf_lab');

INSERT INTO `ruangan` (`nama_ruangan`) VALUES 
('Laboratorium Rekayasa Perangkat Lunak (RPL)'),
('Laboratorium Jaringan & Keamanan Komputer');

INSERT INTO `bhp` (`nama_bhp`, `stok`, `satuan`) VALUES
('Kabel LAN RJ45 Cat6 (Roll)', 3, 'Roll'),
('Konektor RJ45 Besi', 100, 'Pcs'),
('Tinta Printer Epson Hitam', 5, 'Botol');

INSERT INTO `inventaris` (`kode_label_qr`, `nama_barang`, `kondisi`, `id_ruangan`) VALUES
('LAB-RPL-PC01', 'PC Workstation ASUS i7 16GB', 'baik', 1),
('LAB-RPL-PC02', 'PC Workstation ASUS i7 16GB', 'rusak', 1),
('LAB-JARKOM-SW01', 'Cisco Switch 24-Port Managed', 'baik', 2);
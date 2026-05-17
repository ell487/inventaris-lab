
-- 1. MEMBUAT TABEL USERS

CREATE TABLE `users` (
  `id_user` INT NOT NULL AUTO_INCREMENT,
  `nama` VARCHAR(100) NOT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'kepala_lab', 'kaprodi', 'staf_admin', 'staf_lab') NOT NULL,
  PRIMARY KEY (`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 2. MEMBUAT TABEL RUANGAN

CREATE TABLE `ruangan` (
  `id_ruangan` INT NOT NULL AUTO_INCREMENT,
  `nama_ruangan` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id_ruangan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 3. MEMBUAT TABEL BHP (BARANG HABIS PAKAI)

CREATE TABLE `bhp` (
  `id_bhp` INT NOT NULL AUTO_INCREMENT,
  `nama_bhp` VARCHAR(100) NOT NULL,
  `stok` INT NOT NULL DEFAULT 0,
  `satuan` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`id_bhp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 4. MEMBUAT TABEL INVENTARIS (ASET TETAP)

CREATE TABLE `inventaris` (
  `id_inventaris` INT NOT NULL AUTO_INCREMENT,
  `kode_label_qr` VARCHAR(100) DEFAULT NULL UNIQUE,
  `nama_barang` VARCHAR(100) NOT NULL,
  `kondisi` ENUM('baik', 'rusak', 'maintenance', 'dihapus') NOT NULL DEFAULT 'baik',
  `id_ruangan` INT NOT NULL,
  PRIMARY KEY (`id_inventaris`),
  KEY `fk_inventaris_ruangan` (`id_ruangan`),
  CONSTRAINT `fk_inventaris_ruangan` FOREIGN KEY (`id_ruangan`) REFERENCES `ruangan` (`id_ruangan`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 5. MEMBUAT TABEL DRAF PENGADAAN 

CREATE TABLE `draf_pengadaan` (
  `id_draf` INT NOT NULL AUTO_INCREMENT,
  `judul_draf` VARCHAR(150) NOT NULL,
  `tahun` INT NOT NULL,
  `status_draf` ENUM('draft', 'pending_kaprodi', 'locked') NOT NULL DEFAULT 'draft',
  `id_kepala_lab` INT NOT NULL,
  PRIMARY KEY (`id_draf`),
  KEY `fk_draf_kepala_lab` (`id_kepala_lab`),
  CONSTRAINT `fk_draf_kepala_lab` FOREIGN KEY (`id_kepala_lab`) REFERENCES `users` (`id_user`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 6. MEMBUAT TABEL DETAIL DRAF PENGADAAN

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
  `tanggal_diterima` DATE DEFAULT NULL,
  PRIMARY KEY (`id_detail`),
  KEY `fk_detail_draf` (`id_draf`),
  KEY `fk_detail_inventaris_lama` (`id_inventaris_lama`),
  CONSTRAINT `fk_detail_draf` FOREIGN KEY (`id_draf`) REFERENCES `draf_pengadaan` (`id_draf`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_detail_inventaris_lama` FOREIGN KEY (`id_inventaris_lama`) REFERENCES `inventaris` (`id_inventaris`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 7. MEMBUAT TABEL LOG MAINTENANCE

CREATE TABLE `log_maintenance` (
  `id_log` INT NOT NULL AUTO_INCREMENT,
  `id_inventaris` INT NOT NULL,
  `tanggal_maintenance` DATE NOT NULL,
  `deskripsi` TEXT NOT NULL,
  `id_bhp_digunakan` INT DEFAULT NULL,
  `jumlah_bhp_dipakai` INT DEFAULT NULL,
  PRIMARY KEY (`id_log`),
  KEY `fk_log_inventaris` (`id_inventaris`),
  KEY `fk_log_bhp` (`id_bhp_digunakan`),
  CONSTRAINT `fk_log_bhp` FOREIGN KEY (`id_bhp_digunakan`) REFERENCES `bhp` (`id_bhp`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_log_inventaris` FOREIGN KEY (`id_inventaris`) REFERENCES `inventaris` (`id_inventaris`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 8. INSERT DATA CONTOH (DENGAN PASSWORD 'password')

INSERT INTO `users` (`nama`, `username`, `password`, `role`) VALUES
('Admin Utama', 'admin', 'password', 'admin'),
('Dr. Budi (Kalab)', 'kalab', 'password', 'kepala_lab'),
('Prof. Hadi (Kaprodi)', 'kaprodi', 'password', 'kaprodi'),
('Siti (Staf Admin)', 'stafadmin', 'password', 'staf_admin'),
('Andi (Staf Lab)', 'staflab', 'password', 'staf_lab');

INSERT INTO `ruangan` (`nama_ruangan`) VALUES 
('Laboratorium Rekayasa Perangkat Lunak'),
('Laboratorium Jaringan & Keamanan Komputer');
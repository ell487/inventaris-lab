DROP DATABASE IF EXISTS inventaris_lab;
CREATE DATABASE inventaris_lab;
USE inventaris_lab;


-- TABEL USERS


CREATE TABLE users (
    id_user INT NOT NULL AUTO_INCREMENT,
    nama VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','kepala_lab','kaprodi','staf_admin','staf_lab') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- TABEL RUANGAN


CREATE TABLE ruangan (
    id_ruangan INT NOT NULL AUTO_INCREMENT,
    nama_ruangan VARCHAR(100) NOT NULL,
    PRIMARY KEY (id_ruangan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- TABEL BHP


CREATE TABLE bhp (
    id_bhp INT NOT NULL AUTO_INCREMENT,
    nama_bhp VARCHAR(100) NOT NULL,
    stok INT NOT NULL DEFAULT 0,
    satuan VARCHAR(20) NOT NULL,
    id_ruangan INT DEFAULT NULL,
    tahun_pengadaan INT DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_bhp),
    CONSTRAINT fk_bhp_ruangan
        FOREIGN KEY (id_ruangan)
        REFERENCES ruangan(id_ruangan)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- TABEL INVENTARIS


CREATE TABLE inventaris (
    id_inventaris INT NOT NULL AUTO_INCREMENT,
    kode_label_qr VARCHAR(100) UNIQUE,
    nama_barang VARCHAR(100) NOT NULL,
    kondisi ENUM('baik','rusak','maintenance','dihapus') NOT NULL DEFAULT 'baik',
    id_ruangan INT NOT NULL,
    tahun_pengadaan INT NOT NULL,
    foto_qr VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (id_inventaris),
    CONSTRAINT fk_inventaris_ruangan
        FOREIGN KEY (id_ruangan)
        REFERENCES ruangan(id_ruangan)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- TABEL DRAF PENGADAAN


CREATE TABLE draf_pengadaan (
    id_draf INT NOT NULL AUTO_INCREMENT,
    judul_draf VARCHAR(150) NOT NULL,
    tahun INT NOT NULL,
    status_draf ENUM('draft','pending_kaprodi','locked') NOT NULL DEFAULT 'draft',
    id_kepala_lab INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_draf),
    CONSTRAINT fk_draf_kepala_lab
        FOREIGN KEY (id_kepala_lab)
        REFERENCES users(id_user)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- TABEL DETAIL DRAF


CREATE TABLE detail_draf (
    id_detail INT NOT NULL AUTO_INCREMENT,
    id_draf INT NOT NULL,
    tipe_barang ENUM('inventaris','bhp') NOT NULL,
    nama_barang VARCHAR(100) NOT NULL,
    harga_satuan INT NOT NULL,
    jumlah INT NOT NULL,
    link_pembelian TEXT NOT NULL,
    id_inventaris_lama INT DEFAULT NULL,
    status_approval ENUM('pending','disetujui','ditolak') NOT NULL DEFAULT 'pending',
    PRIMARY KEY (id_detail),
    CONSTRAINT fk_detail_draf
        FOREIGN KEY (id_draf)
        REFERENCES draf_pengadaan(id_draf)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_detail_inventaris_lama
        FOREIGN KEY (id_inventaris_lama)
        REFERENCES inventaris(id_inventaris)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- TABEL RIWAYAT PENERIMAAN


CREATE TABLE riwayat_penerimaan (
    id_penerimaan INT NOT NULL AUTO_INCREMENT,
    id_detail INT NOT NULL,
    jumlah_diterima INT NOT NULL,
    tanggal_penerimaan DATE NOT NULL,
    id_staf_admin INT NOT NULL,
    PRIMARY KEY (id_penerimaan),
    CONSTRAINT fk_penerimaan_detail
        FOREIGN KEY (id_detail)
        REFERENCES detail_draf(id_detail)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_penerimaan_staf
        FOREIGN KEY (id_staf_admin)
        REFERENCES users(id_user)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- TABEL LOG MAINTENANCE


CREATE TABLE log_maintenance (
    id_log INT NOT NULL AUTO_INCREMENT,
    id_inventaris INT NOT NULL,
    id_staf_lab INT NOT NULL,
    tanggal_maintenance DATE NOT NULL,
    deskripsi TEXT NOT NULL,
    id_bhp_digunakan INT DEFAULT NULL,
    jumlah_bhp_dipakai INT DEFAULT NULL,
    PRIMARY KEY (id_log),
    CONSTRAINT fk_log_inventaris
        FOREIGN KEY (id_inventaris)
        REFERENCES inventaris(id_inventaris)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_log_staf
        FOREIGN KEY (id_staf_lab)
        REFERENCES users(id_user)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_log_bhp
        FOREIGN KEY (id_bhp_digunakan)
        REFERENCES bhp(id_bhp)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- DATA USERS


INSERT INTO users (nama, username, password, role) VALUES
('Wenny', 'admin', 'password', 'admin'),
('Robby', 'kalab', 'password', 'kepala_lab'),
('Rosevine Arta', 'kaprodi', 'password', 'kaprodi'),
('Teddy Marcus', 'satfadmin', 'password', 'staf_admin'),
('Denzel', 'staflab', 'password', 'staf_lab');


-- DATA RUANGAN


INSERT INTO ruangan (nama_ruangan) VALUES
('Lab Multimedia'),
('Lab Adv 1'),
('Lab Adv 2'),


-- DATA BHP


INSERT INTO bhp (nama_bhp, stok, satuan, id_ruangan, tahun_pengadaan) VALUES
('Kabel UTP Cat6', 15, 'Roll', 2, 2025),
('Konektor RJ45', 500, 'Pcs', 2, 2025),
('Tinta Printer Epson Hitam', 8, 'Botol', 1, 2025),
('Tinta Printer Epson Warna', 5, 'Botol', 1, 2025),
('Mouse Wireless Logitech', 20, 'Unit', 1, 2025),
('Keyboard USB', 20, 'Unit', 1, 2025),
('Thermal Paste', 10, 'Tube', 3, 2025),
('Flashdisk 32GB', 15, 'Unit', 2, 2025);


-- DATA INVENTARIS


INSERT INTO inventaris
(kode_label_qr,nama_barang,kondisi,id_ruangan,tahun_pengadaan)
VALUES

('MM-001','PC Multimedia 01','baik',1,2023),
('MM-002','PC Multimedia 02','baik',1,2023),
('MM-003','PC Multimedia 03','baik',1,2023),
('MM-004','PC Multimedia 04','maintenance',1,2023),

('ADV1-001','PC Developer 01','baik',2,2024),
('ADV1-002','PC Developer 02','baik',2,2024),
('ADV1-003','PC Developer 03','rusak',2,2024),

('ADV2-001','PC Developer 01','baik',3,2024),
('ADV2-002','PC Developer 02','baik',3,2024),
('ADV2-003','PC Developer 03','baik',3,2024),

('SW-001','Cisco Switch 24 Port','baik',2,2024),
('SW-002','Cisco Switch 24 Port','baik',3,2024),

('AP-001','Access Point TP-Link','baik',1,2024),
('AP-002','Access Point TP-Link','baik',2,2024),

('PR-001','Printer Epson L3210','baik',1,2025),
('PR-002','Printer Epson L3210','baik',3,2025),

('PROJ-001','Proyektor Epson EB-X06','baik',1,2024),
('PROJ-002','Proyektor Epson EB-X06','baik',2,2024),

('UPS-001','UPS APC 1200VA','baik',1,2024),
('UPS-002','UPS APC 1200VA','maintenance',2,2024);


-- DRAF PENGADAAN


INSERT INTO draf_pengadaan
(judul_draf,tahun,status_draf,id_kepala_lab)
VALUES
(
'Pengadaan Perangkat Laboratorium Semester Ganjil 2025',
2025,
'pending_kaprodi',
2
);


-- DETAIL DRAF


INSERT INTO detail_draf
(id_draf,tipe_barang,nama_barang,harga_satuan,jumlah,link_pembelian,status_approval)
VALUES
(1,'inventaris','PC Developer Intel Core i7',12000000,10,'https://tokopedia.com/contoh-pc-i7','pending'),
(1,'inventaris','Cisco Switch Managed 24 Port',4500000,2,'https://tokopedia.com/contoh-switch','pending'),
(1,'bhp','Konektor RJ45',2500,500,'https://tokopedia.com/contoh-rj45','pending'),
(1,'bhp','Kabel UTP Cat6',1200000,10,'https://tokopedia.com/contoh-cat6','pending');


-- RIWAYAT PENERIMAAN


INSERT INTO riwayat_penerimaan
(id_detail,jumlah_diterima,tanggal_penerimaan,id_staf_admin)
VALUES
(1,5,'2025-01-15',4),
(2,2,'2025-01-15',4),
(3,250,'2025-01-15',4);


-- LOG MAINTENANCE


INSERT INTO log_maintenance
(id_inventaris,id_staf_lab,tanggal_maintenance,deskripsi,id_bhp_digunakan,jumlah_bhp_dipakai)
VALUES
(7,5,'2025-03-10',
'Penggantian konektor LAN dan pengecekan jaringan',
2,8),

(20,5,'2025-04-20',
'Penggantian thermal paste UPS',
7,1),

(4,5,'2025-05-05',
'Instal ulang sistem operasi dan pembersihan perangkat',
NULL,NULL);
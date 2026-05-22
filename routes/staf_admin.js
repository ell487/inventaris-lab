const express = require('express');
const router = express.Router();
const db = require('../config/database'); 
const multer = require('multer');
const path = require('path');

// Konfigurasi Penyimpanan Upload Foto QR
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/qr/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});
const upload = multer({ storage: storage });

// Middleware Proteksi Khusus Role Staf Administrasi
const isStafAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'staf_admin') {
        return res.redirect('/');
    }
    next();
};

// 1. Dashboard Utama Staf Admin - Menampilkan Draf Berstatus Locked
router.get('/', isStafAdmin, (req, res) => {
    const queryDraf = `SELECT * FROM draf_pengadaan WHERE status_draf = 'locked' ORDER BY created_at DESC`;
    db.query(queryDraf, (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.render('staf_admin/dashboard', { user: req.session.user, dataDraf: results });
    });
});

// 2. Detail Item di Dalam Draf Berdasarkan Persetujuan Kaprodi
router.get('/draf/:id_draf', isStafAdmin, (req, res) => {
    const idDraf = req.params.id_draf;
    const queryItems = `
        SELECT dd.*, IFNULL(SUM(rp.jumlah_diterima), 0) AS total_diterima
        FROM detail_draf dd
        LEFT JOIN riwayat_penerimaan rp ON dd.id_detail = rp.id_detail
        WHERE dd.id_draf = ? AND dd.status_approval = 'disetujui'
        GROUP BY dd.id_detail
    `;

    db.query('SELECT * FROM draf_pengadaan WHERE id_draf = ?', [idDraf], (err, draf) => {
        if (err) return res.status(500).send(err.message);
        db.query(queryItems, [idDraf], (err, items) => {
            if (err) return res.status(500).send(err.message);
            res.render('staf_admin/detail_draf', { user: req.session.user, draf: draf[0], dataItems: items });
        });
    });
});

// 3. Render Form Penerimaan Satuan Inventaris (QR)
router.get('/terima-inventaris/:id_detail', isStafAdmin, (req, res) => {
    db.query('SELECT * FROM detail_draf WHERE id_detail = ?', [req.params.id_detail], (err, result) => {
        if (err) return res.status(500).send(err.message);
        db.query('SELECT * FROM ruangan', (err, ruangan) => {
            if (err) return res.status(500).send(err.message);
            res.render('staf_admin/terima_inventaris', { user: req.session.user, item: result[0], dataRuangan: ruangan });
        });
    });
});

// 4. Proses Simpan Aset Inventaris + Catat Riwayat Parsial
router.post('/terima-inventaris/:id_detail', isStafAdmin, upload.single('foto_qr'), (req, res) => {
    const { kode_label_qr, nama_barang, id_ruangan, tanggal_penerimaan, id_draf } = req.body;
    const fotoQr = req.file ? req.file.filename : null;

    const queryAsset = 'INSERT INTO inventaris (kode_label_qr, nama_barang, kondisi, id_ruangan, foto_qr) VALUES (?, ?, "baik", ?, ?)';
    db.query(queryAsset, [kode_label_qr, nama_barang, id_ruangan, fotoQr], (err) => {
        if (err) return res.status(500).send("Gagal simpan! Kode QR mungkin sudah terpakai oleh aset lain.");

        const queryRiwayat = 'INSERT INTO riwayat_penerimaan (id_detail, jumlah_diterima, tanggal_penerimaan, id_staf_admin) VALUES (?, 1, ?, ?)';
        db.query(queryRiwayat, [req.params.id_detail, tanggal_penerimaan, req.session.user.id_user], (err) => {
            if (err) return res.status(500).send(err.message);
            res.redirect('/staf-admin/draf/' + id_draf);
        });
    });
});

// 5. Render Form Penerimaan Masal BHP
router.get('/terima-bhp/:id_detail', isStafAdmin, (req, res) => {
    const queryItems = `
        SELECT dd.*, IFNULL(SUM(rp.jumlah_diterima), 0) AS total_diterima
        FROM detail_draf dd
        LEFT JOIN riwayat_penerimaan rp ON dd.id_detail = rp.id_detail
        WHERE dd.id_detail = ?
        GROUP BY dd.id_detail
    `;
    db.query(queryItems, [req.params.id_detail], (err, result) => {
        if (err) return res.status(500).send(err.message);
        res.render('staf_admin/terima_bhp', { user: req.session.user, item: result[0] });
    });
});

// 6. Proses Simpan Penerimaan BHP ke Riwayat
router.post('/terima-bhp/:id_detail', isStafAdmin, (req, res) => {
    const { jumlah_diterima, tanggal_penerimaan, id_draf } = req.body;

    const queryRiwayat = 'INSERT INTO riwayat_penerimaan (id_detail, jumlah_diterima, tanggal_penerimaan, id_staf_admin) VALUES (?, ?, ?, ?)';
    db.query(queryRiwayat, [req.params.id_detail, jumlah_diterima, tanggal_penerimaan, req.session.user.id_user], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect('/staf-admin/draf/' + id_draf);
    });
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../config/database'); 
const QRCode = require('qrcode'); 
const path = require('path');


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

// 3. Render Form Penerimaan Satuan Inventaris
router.get('/terima-inventaris/:id_detail', isStafAdmin, (req, res) => {
    db.query('SELECT * FROM detail_draf WHERE id_detail = ?', [req.params.id_detail], (err, result) => {
        if (err) return res.status(500).send(err.message);
        db.query('SELECT * FROM ruangan', (err, ruangan) => {
            if (err) return res.status(500).send(err.message);
            res.render('staf_admin/terima_inventaris', { user: req.session.user, item: result[0], dataRuangan: ruangan });
        });
    });
});

// 4. PROSES BARU: Auto-Generate Label, QR Code, dan Looping Input Multi-Aset
router.post('/terima-inventaris/:id_detail', isStafAdmin, async (req, res) => {
    const { nama_barang, id_ruangan, tanggal_penerimaan, id_draf, jumlah_diterima } = req.body;
    const id_detail = req.params.id_detail;
    const qty = parseInt(jumlah_diterima) || 1; 

    // Catat ke tabel riwayat penerimaan (parsial/sekaligus)
    const queryRiwayat = 'INSERT INTO riwayat_penerimaan (id_detail, jumlah_diterima, tanggal_penerimaan, id_staf_admin) VALUES (?, ?, ?, ?)';
    db.query(queryRiwayat, [id_detail, qty, tanggal_penerimaan, req.session.user.id_user], async (err, result) => {
        if (err) return res.status(500).send(err.message);

        try {
            const tahunSekarang = new Date().getFullYear(); 
            for (let i = 0; i < qty; i++) {
                const uniqueTimestamp = Date.now() + i; 
                const kodeLabelOtomatis = `LAB-${tahunSekarang}-${uniqueTimestamp.toString().slice(-5)}`;
                const namaFileQR = `${kodeLabelOtomatis}.png`;
                const pathSimpanFile = path.join(__dirname, '../public/uploads/qr/', namaFileQR);
                const pathUntukDatabase = `/uploads/qr/${namaFileQR}`;

                await QRCode.toFile(pathSimpanFile, kodeLabelOtomatis);

                // Simpan setiap unit barang baru ke tabel inventaris
                await new Promise((resolve, reject) => {
                    const queryAsset = 'INSERT INTO inventaris (kode_label_qr, nama_barang, kondisi, id_ruangan, foto_qr) VALUES (?, ?, "baik", ?, ?)';
                    db.query(queryAsset, [kodeLabelOtomatis, nama_barang, id_ruangan, pathUntukDatabase], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // Selesai looping, lempar kembali ke halaman detail draf pengadaan
            res.redirect('/staf-admin/draf/' + id_draf);

        } catch (error) {
            console.error(error);
            return res.status(500).send("Gagal mengenerate QR Code otomatis: " + error.message);
        }
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

// 7. BARU: Halaman Cetak Kumpulan Label QR yang Berhasil Dibuat
router.get('/cetak-label/:id_detail', isStafAdmin, (req, res) => {
    const id_detail = req.params.id_detail;

  
    db.query('SELECT * FROM detail_draf WHERE id_detail = ?', [id_detail], (err, detailResult) => {
        if (err || detailResult.length === 0) return res.status(404).send("Data draf tidak ditemukan");
        const item = detailResult[0];

        db.query('SELECT SUM(jumlah_diterima) AS total FROM riwayat_penerimaan WHERE id_detail = ?', [id_detail], (err, riwayatResult) => {
            const totalDiterima = riwayatResult[0].total || 0;

            if (totalDiterima === 0) return res.send("Belum ada barang yang diterima untuk dicetak.");

            db.query(
                'SELECT * FROM inventaris WHERE nama_barang = ? ORDER BY id_inventaris DESC LIMIT ?', 
                [item.nama_barang, parseInt(totalDiterima)], 
                (err, assets) => {
                    if (err) return res.status(500).send(err.message);
                    res.render('staf_admin/cetak_label', { 
                        user: req.session.user, 
                        item: item, 
                        dataAssets: assets.reverse() 
                    });
                }
            );
        });
    });
});

module.exports = router;
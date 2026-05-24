const express = require('express');
const router = express.Router();
const db = require('../config/database');

function isKepalaLab(req, res, next) {
    if (req.session.user && req.session.user.role === 'kepala_lab') {
        return next();
    }
    res.redirect('/login');
}

// 1. Halaman Utama
router.get('/', isKepalaLab, (req, res) => {
    const query = 'SELECT * FROM draf_pengadaan WHERE id_kepala_lab = ? ORDER BY id_draf DESC';
    db.query(query, [req.session.user.id_user], (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.render('kepala_lab/index', { user: req.session.user, dataDraf: results });
    });
});

// 2. Tambah Draf Baru
router.post('/tambah', isKepalaLab, (req, res) => {
    const { judul_draf, tahun } = req.body;
    const query = 'INSERT INTO draf_pengadaan (judul_draf, tahun, status_draf, id_kepala_lab) VALUES (?, ?, "draft", ?)';
    db.query(query, [judul_draf, parseInt(tahun), req.session.user.id_user], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect('/pengadaan');
    });
});

// 3. Detail Draf
router.get('/detail/:id', isKepalaLab, (req, res) => {
    const id_draf = req.params.id;
    db.query('SELECT * FROM draf_pengadaan WHERE id_draf = ?', [id_draf], (err, drafInfo) => {
        if (err || drafInfo.length === 0) return res.status(404).send('Draf tidak ditemukan');
        
        const queryItems = `
            SELECT d.*, i.kode_label_qr, i.nama_barang AS nama_barang_lama 
            FROM detail_draf d 
            LEFT JOIN inventaris i ON d.id_inventaris_lama = i.id_inventaris 
            WHERE d.id_draf = ?
        `;
        db.query(queryItems, [id_draf], (err, items) => {
            if (err) return res.status(500).send(err.message);
            db.query('SELECT id_inventaris, nama_barang, kode_label_qr FROM inventaris WHERE kondisi != "dihapus"', (err, inventarisLama) => {
                if (err) return res.status(500).send(err.message);
                res.render('kepala_lab/detail', { 
                    user: req.session.user, 
                    draf: drafInfo[0], 
                    items: items,
                    inventarisLama: inventarisLama
                });
            });
        });
    });
});

// 4. Tambah Item
router.post('/detail/:id/add-item', isKepalaLab, (req, res) => {
    const id_draf = req.params.id;
    const { tipe_barang, nama_barang, harga_satuan, jumlah, link_pembelian, id_inventaris_lama } = req.body;
    
    db.query('SELECT status_draf FROM draf_pengadaan WHERE id_draf = ?', [id_draf], (err, results) => {
        if (results[0].status_draf !== 'draft') return res.status(400).send('Draf sudah dikunci.');
        
        const assetLama = id_inventaris_lama === "" ? null : parseInt(id_inventaris_lama);
        const query = 'INSERT INTO detail_draf (id_draf, tipe_barang, nama_barang, harga_satuan, jumlah, link_pembelian, id_inventaris_lama) VALUES (?, ?, ?, ?, ?, ?, ?)';
        
        db.query(query, [id_draf, tipe_barang, nama_barang, parseInt(harga_satuan), parseInt(jumlah), link_pembelian, assetLama], (err) => {
            if (err) return res.status(500).send(err.message);
            res.redirect(`/pengadaan/detail/${id_draf}`);
        });
    });
});

// 5. Hapus Item
router.get('/detail/:id/delete-item/:id_detail', isKepalaLab, (req, res) => {
    const { id, id_detail } = req.params;
    db.query('DELETE FROM detail_draf WHERE id_detail = ? AND id_draf = ?', [id_detail, id], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect(`/pengadaan/detail/${id}`);
    });
});

// 6. Kunci Draf
router.post('/lock/:id', isKepalaLab, (req, res) => {
    const id_draf = req.params.id;
    db.query("UPDATE draf_pengadaan SET status_draf = 'pending_kaprodi' WHERE id_draf = ?", [id_draf], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect('/pengadaan');
    });
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware 
function isKaprodi(req, res, next) {
    if (req.session.user && req.session.user.role === 'kaprodi') {
        return next();
    }
    res.redirect('/login');
}

// 1. Halaman Utama: Daftar Draf yang Butuh Review
router.get('/', isKaprodi, (req, res) => {
    const query = `
        SELECT d.*, u.nama AS nama_kalab 
        FROM draf_pengadaan d 
        JOIN users u ON d.id_kepala_lab = u.id_user 
        WHERE d.status_draf IN ('pending_kaprodi', 'locked') 
        ORDER BY d.id_draf DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.render('kaprodi/index', { user: req.session.user, dataDraf: results });
    });
});

// 2. Halaman Detail Draf untuk Review
router.get('/detail/:id', isKaprodi, (req, res) => {
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
            res.render('kaprodi/detail', { 
                user: req.session.user, 
                draf: drafInfo[0], 
                items: items 
            });
        });
    });
});

// 3. Simpan Hasil Review 
router.post('/detail/:id/review', isKaprodi, (req, res) => {
    const id_draf = req.params.id;
    const reviewData = req.body; 

    const updatePromises = Object.keys(reviewData).map(key => {
        if (key.startsWith('status_')) {
            const id_detail = key.split('_')[1];
            const status_approval = reviewData[key];
            return new Promise((resolve, reject) => {
                db.query('UPDATE detail_draf SET status_approval = ? WHERE id_detail = ?', [status_approval, id_detail], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        return Promise.resolve();
    });

    Promise.all(updatePromises)
        .then(() => res.redirect(`/kaprodi/detail/${id_draf}`))
        .catch(err => res.status(500).send(err.message));
});

// 4. Finalisasi Draf (Kunci Permanen)
router.post('/lock/:id', isKaprodi, (req, res) => {
    const id_draf = req.params.id;

    // logika nya salah disini
    db.query("SELECT COUNT(*) AS pending_count FROM detail_draf WHERE id_draf = ? AND status_approval = 'pending'", [id_draf], (err, result) => {
        if (err) return res.status(500).send(err.message);
        
        if (result[0].pending_count > 0) {
            return res.send('<script>alert("Masih ada barang yang belum Anda review (Setujui/Tolak). Silakan cek kembali."); window.history.back();</script>');
        }
        
        db.query("UPDATE draf_pengadaan SET status_draf = 'locked' WHERE id_draf = ?", [id_draf], (err) => {
            if (err) return res.status(500).send(err.message);
            res.redirect('/kaprodi');
        });
    });
});

module.exports = router;
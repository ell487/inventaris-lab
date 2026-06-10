const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware Proteksi Akses Kaprodi
function isKaprodi(req, res, next) {
    if (req.session.user && req.session.user.role === 'kaprodi') {
        return next();
    }
    res.redirect('/login');
}

// 1. HALAMAN UTAMA: Daftar Draf yang Butuh Review (Dengan Filter Tahun)
router.get('/', isKaprodi, (req, res) => {
    const filterTahun = req.query.tahun || '';
    
    let query = `
        SELECT d.*, u.nama AS nama_kalab 
        FROM draf_pengadaan d 
        JOIN users u ON d.id_kepala_lab = u.id_user 
        WHERE d.status_draf IN ('pending_kaprodi', 'locked')
    `;
    const queryParams = [];

    if (filterTahun) {
        query += ` AND d.tahun = ?`;
        queryParams.push(parseInt(filterTahun));
    }
    
    query += ` ORDER BY d.id_draf DESC`;

    db.query(query, queryParams, (err, results) => {
        if (err) return res.status(500).send(err.message);
        
        db.query('SELECT DISTINCT tahun FROM draf_pengadaan ORDER BY tahun DESC', (err, dataTahun) => {
            if (err) return res.status(500).send(err.message);
            res.render('kaprodi/index', { 
                user: req.session.user, 
                dataDraf: results,
                dataTahun: dataTahun,
                currentFilterTahun: filterTahun
            });
        });
    });
});

// 2. HALAMAN DETAIL DRAF UNTUK REVIEW
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

// 3. SIMPAN HASIL REVIEW SEMENTARA
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

// 4. FINALISASI DRAF 
router.post('/lock/:id', isKaprodi, (req, res) => {
    const id_draf = req.params.id;

    
    const checkQuery = `
        SELECT COUNT(*) AS unreviewed_count 
        FROM detail_draf 
        WHERE id_draf = ? 
        AND (status_approval IS NULL OR status_approval NOT IN ('disetujui', 'ditolak'))
    `;

    db.query(checkQuery, [id_draf], (err, result) => {
        if (err) return res.status(500).send(err.message);
        
        if (result[0].unreviewed_count > 0) {
            return res.send('<script>alert("Masih ada barang yang belum Anda review (Setuju/Tolak). Silakan cek kembali."); window.history.back();</script>');
        }
        
        db.query("UPDATE draf_pengadaan SET status_draf = 'locked' WHERE id_draf = ?", [id_draf], (err) => {
            if (err) return res.status(500).send(err.message);
            res.redirect('/kaprodi');
        });
    });
});

// 5. MONITORING INVENTARIS & BHP 
router.get('/monitoring', isKaprodi, (req, res) => {
    const filterTahun = req.query.tahun || '';
    const filterRuangan = req.query.ruangan || 'all';

    let sqlMain = `
        SELECT gabung.*, r.nama_ruangan 
        FROM (
            SELECT id_inventaris AS id_asli, kode_label_qr, nama_barang, 'inventaris' AS tipe_barang, kondisi, id_ruangan, tahun_pengadaan 
            FROM inventaris WHERE kondisi != 'dihapus'
            UNION ALL
            SELECT id_bhp AS id_asli, '-' AS kode_label_qr, nama_bhp AS nama_barang, 'bhp' AS tipe_barang, 'baik' AS kondisi, id_ruangan, tahun_pengadaan 
            FROM bhp
        ) AS gabung
        LEFT JOIN ruangan r ON gabung.id_ruangan = r.id_ruangan
        WHERE 1=1
    `;
    let queryParams = [];

    if (filterTahun) {
        sqlMain += ` AND gabung.tahun_pengadaan = ?`;
        queryParams.push(parseInt(filterTahun));
    }
    if (filterRuangan !== 'all') {
        sqlMain += ` AND gabung.id_ruangan = ?`;
        queryParams.push(parseInt(filterRuangan));
    }

    sqlMain += ` ORDER BY gabung.tahun_pengadaan DESC, gabung.nama_barang ASC`;

    db.query(sqlMain, queryParams, (err, dataBarang) => {
        if (err) return res.status(500).send(err.message);

        db.query('SELECT * FROM ruangan', (err, dataRuangan) => {
            if (err) return res.status(500).send(err.message);

            let sqlTahunUnik = `
                SELECT DISTINCT tahun_pengadaan FROM inventaris WHERE tahun_pengadaan IS NOT NULL
                UNION 
                SELECT DISTINCT tahun_pengadaan FROM bhp WHERE tahun_pengadaan IS NOT NULL
                ORDER BY tahun_pengadaan DESC
            `;
            db.query(sqlTahunUnik, (err, dataTahun) => {
                if (err) return res.status(500).send(err.message);
                res.render('kaprodi/monitoring', {
                    user: req.session.user,
                    dataBarang: dataBarang,
                    dataRuangan: dataRuangan,
                    dataTahun: dataTahun,
                    currentFilterTahun: filterTahun,
                    currentFilterRuangan: filterRuangan
                });
            });
        });
    });
});

module.exports = router;
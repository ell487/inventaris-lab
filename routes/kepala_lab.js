const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware Proteksi Akses Kepala Lab
function isKepalaLab(req, res, next) {
    if (req.session.user && req.session.user.role === 'kepala_lab') {
        return next();
    }
    res.redirect('/login');
}

// 1. HALAMAN UTAMA PENGADAAN (Akan diakses via /kalab/pengadaan)
router.get('/pengadaan', isKepalaLab, (req, res) => {
    const query = 'SELECT * FROM draf_pengadaan WHERE id_kepala_lab = ? ORDER BY id_draf DESC';
    db.query(query, [req.session.user.id_user], (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.render('kepala_lab/index', { user: req.session.user, dataDraf: results });
    });
});

// 2. TAMBAH DRAF BARU 
router.post('/pengadaan/tambah', isKepalaLab, (req, res) => {
    const { judul_draf, tahun } = req.body;
    const query = 'INSERT INTO draf_pengadaan (judul_draf, tahun, status_draf, id_kepala_lab) VALUES (?, ?, "draft", ?)';
    db.query(query, [judul_draf, parseInt(tahun), req.session.user.id_user], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect('/kalab/pengadaan');
    });
});

// 3. DETAIL DRAF 
router.get('/pengadaan/detail/:id', isKepalaLab, (req, res) => {
    const id_draf = req.params.id;
    const status = req.query.status || null; 

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
                    inventarisLama: inventarisLama,
                    status: status 
                });
            });
        });
    });
});

// 4. TAMBAH ITEM KE DRAF
router.post('/pengadaan/detail/:id/add-item', isKepalaLab, (req, res) => {
    const id_draf = req.params.id;
    const { tipe_barang, nama_barang, harga_satuan, jumlah, link_pembelian, id_inventaris_lama } = req.body;
    
    db.query('SELECT status_draf FROM draf_pengadaan WHERE id_draf = ?', [id_draf], (err, results) => {
        if (results[0].status_draf !== 'draft') return res.status(400).send('Draf sudah dikunci.');
        
        const assetLama = id_inventaris_lama === "" ? null : parseInt(id_inventaris_lama);
        const query = 'INSERT INTO detail_draf (id_draf, tipe_barang, nama_barang, harga_satuan, jumlah, link_pembelian, id_inventaris_lama) VALUES (?, ?, ?, ?, ?, ?, ?)';
        
        db.query(query, [id_draf, tipe_barang, nama_barang, parseInt(harga_satuan), parseInt(jumlah), link_pembelian, assetLama], (err) => {
            if (err) return res.status(500).send(err.message);
            res.redirect(`/kalab/pengadaan/detail/${id_draf}`);
        });
    });
});

// 5. EDIT ITEM 
router.post('/pengadaan/detail/:id/edit-item/:id_detail', isKepalaLab, (req, res) => {
    const { id, id_detail } = req.params;
    const { tipe_barang, nama_barang, harga_satuan, jumlah, link_pembelian, id_inventaris_lama } = req.body;
    
    db.query('SELECT status_draf FROM draf_pengadaan WHERE id_draf = ?', [id], (err, results) => {
        if (results[0].status_draf !== 'draft') return res.status(400).send('Draf sudah dikunci.');
        
        const assetLama = id_inventaris_lama === "" ? null : parseInt(id_inventaris_lama);
        const queryUpdate = `
            UPDATE detail_draf 
            SET tipe_barang = ?, nama_barang = ?, harga_satuan = ?, jumlah = ?, link_pembelian = ?, id_inventaris_lama = ? 
            WHERE id_detail = ? AND id_draf = ?
        `;
        
        db.query(queryUpdate, [tipe_barang, nama_barang, parseInt(harga_satuan), parseInt(jumlah), link_pembelian, assetLama, id_detail, id], (err) => {
            if (err) return res.status(500).send(err.message);
            res.redirect(`/kalab/pengadaan/detail/${id}?status=updated`);
        });
    });
});

// 6. HAPUS ITEM FROM DRAF
router.get('/pengadaan/detail/:id/delete-item/:id_detail', isKepalaLab, (req, res) => {
    const { id, id_detail } = req.params;
    db.query('DELETE FROM detail_draf WHERE id_detail = ? AND id_draf = ?', [id_detail, id], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect(`/kalab/pengadaan/detail/${id}?status=deleted`);
    });
});

// 7. KUNCI DRAF
router.post('/pengadaan/lock/:id', isKepalaLab, (req, res) => {
    const id_draf = req.params.id;
    db.query("UPDATE draf_pengadaan SET status_draf = 'pending_kaprodi' WHERE id_draf = ?", [id_draf], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect('/kalab/pengadaan');
    });
});

// 8. MONITORING INVENTARIS & BHP 
router.get('/monitoring', isKepalaLab, (req, res) => {
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

                res.render('kepala_lab/monitoring', {
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
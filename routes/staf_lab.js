const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware Proteksi Hak Akses Role Staf Laboratorium
const isStafLab = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'staf_lab') {
        return res.redirect('/');
    }
    next();
};

// 1. Dashboard Utama: Menampilkan Inventaris & Stok BHP
router.get('/', isStafLab, (req, res) => {
    const queryInventaris = 'SELECT i.*, r.nama_ruangan FROM inventaris i LEFT JOIN ruangan r ON i.id_ruangan = r.id_ruangan ORDER BY i.id_inventaris DESC';
    const queryBHP = 'SELECT * FROM bhp';

    db.query(queryInventaris, (err, inventaris) => {
        if (err) return res.status(500).send(err.message);
        db.query(queryBHP, (err, bhp) => {
            if (err) return res.status(500).send(err.message);
            res.render('staf_lab/dashboard', { 
                user: req.session.user, 
                dataInventaris: inventaris, 
                dataBHP: bhp 
            });
        });
    });
});

// 2. Update Kondisi Fisik Inventaris secara Instan
router.post('/update-kondisi/:id_inventaris', isStafLab, (req, res) => {
    const { kondisi } = req.body;
    const { id_inventaris } = req.params;

    db.query('UPDATE inventaris SET kondisi = ? WHERE id_inventaris = ?', [kondisi, id_inventaris], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect('/staf-lab');
    });
});

// 3. Tampilkan Form Input Maintenance
router.get('/maintenance/:id_inventaris', isStafLab, (req, res) => {
    db.query('SELECT * FROM inventaris WHERE id_inventaris = ?', [req.params.id_inventaris], (err, asset) => {
        if (err) return res.status(500).send(err.message);
        db.query('SELECT * FROM bhp WHERE stok > 0', (err, bhp) => {
            if (err) return res.status(500).send(err.message);
            res.render('staf_lab/form_maintenance', { user: req.session.user, asset: asset[0], dataBHP: bhp });
        });
    });
});

// 4. Proses Simpan Log Maintenance + Auto Cut Stok BHP (Aman & Sinkron)
router.post('/maintenance/:id_inventaris', isStafLab, (req, res) => {
    const { id_inventaris } = req.params;
    const { deskripsi_kegiatan, tanggal_maintenance, menggunakan_bhp, id_bhp, jumlah_bhp_digunakan } = req.body;

    db.getConnection((err, connection) => {
        if (err) return res.status(500).send(err.message);

        connection.beginTransaction((err) => {
            if (err) { connection.release(); return res.status(500).send(err.message); }

            const queryLog = 'INSERT INTO log_maintenance (id_inventaris, deskripsi_kegiatan, tanggal_maintenance) VALUES (?, ?, ?)';
            connection.query(queryLog, [id_inventaris, deskripsi_kegiatan, tanggal_maintenance], (err) => {
                if (err) {
                    return connection.rollback(() => { connection.release(); res.status(500).send("Gagal mencatat log perbaikan"); });
                }

                if (menggunakan_bhp === 'ya' && id_bhp) {
                    const qtyDigunakan = parseInt(jumlah_bhp_digunakan);

        
                    connection.query('SELECT stok FROM bhp WHERE id_bhp = ?', [id_bhp], (err, bhpResult) => {
                        if (err || bhpResult.length === 0) {
                            return connection.rollback(() => { connection.release(); res.status(400).send("BHP tidak ditemukan"); });
                        }

                        const stokSekarang = bhpResult[0].stok;
                        if (stokSekarang < qtyDigunakan) {
                            return connection.rollback(() => { 
                                connection.release();
                                res.status(400).send("<script>alert('Gagal! Stok BHP di laboratorium tidak mencukupi.'); window.history.back();</script>");
                            });
                        }

                        connection.query('UPDATE bhp SET stok = stok - ? WHERE id_bhp = ?', [qtyDigunakan, id_bhp], (err) => {
                            if (err) {
                                return connection.rollback(() => { connection.release(); res.status(500).send("Gagal memotong stok BHP"); });
                            }

                            connection.commit((err) => {
                                if (err) return connection.rollback(() => { connection.release(); res.status(500).send(err.message); });
                                connection.release();
                                res.redirect('/staf-lab');
                            });
                        });
                    });
                } else {

                    connection.commit((err) => {
                        if (err) return connection.rollback(() => { connection.release(); res.status(500).send(err.message); });
                        connection.release();
                        res.redirect('/staf-lab');
                    });
                }
            });
        });
    });
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware Proteksi Hak Akses
const isStafLab = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'staf_lab') {
        return res.redirect('/');
    }
    next();
};

// 1. Dashboard Utama 
router.get('/', isStafLab, (req, res) => {
    db.query('SELECT COUNT(*) AS total FROM inventaris', (err, rTotal) => {
        if (err) return res.status(500).send("Error Total Aset: " + err.message);
        
        db.query("SELECT COUNT(*) AS rusak FROM inventaris WHERE kondisi = 'rusak'", (err, rRusak) => {
            if (err) return res.status(500).send("Error Aset Rusak: " + err.message);
            
            db.query("SELECT COUNT(*) AS maint FROM inventaris WHERE kondisi = 'maintenance'", (err, rMaint) => {
                if (err) return res.status(500).send("Error Aset Maint: " + err.message);
                
                db.query("SELECT COUNT(*) AS kritis FROM bhp WHERE stok <= 5", (err, rKritis) => {
                    if (err) return res.status(500).send("Error BHP Kritis: " + err.message);

                    const queryLog = `
                        SELECT lm.*, i.nama_barang, i.kode_label_qr, u.nama AS nama_staf, b.nama_bhp 
                        FROM log_maintenance lm
                        LEFT JOIN inventaris i ON lm.id_inventaris = i.id_inventaris
                        LEFT JOIN users u ON lm.id_staf_lab = u.id_user
                        LEFT JOIN bhp b ON lm.id_bhp_digunakan = b.id_bhp
                        ORDER BY lm.tanggal_maintenance DESC LIMIT 50
                    `;
                    db.query(queryLog, (err, logs) => {
                        if (err) return res.status(500).send("Error Log: " + err.message);
                        res.render('staf_lab/dashboard', { 
                            user: req.session.user, 
                            dataLog: logs,
                            stats: {
                                totalAset: rTotal[0].total,
                                asetRusak: rRusak[0].rusak,
                                asetMaint: rMaint[0].maint,
                                bhpKritis: rKritis[0].kritis
                            }
                        });
                    });
                });
            });
        });
    });
});

// 2. Monitoring Inventaris + Filter Ruangan & Kondisi 
router.get('/monitoring-inventaris', isStafLab, (req, res) => {
    const { kondisi, id_ruangan } = req.query;
    
    db.query('SELECT * FROM ruangan ORDER BY nama_ruangan ASC', (err, ruanganList) => {
        if (err) return res.status(500).send("Error Ruangan: " + err.message);

        let queryInventaris = 'SELECT i.*, r.nama_ruangan FROM inventaris i LEFT JOIN ruangan r ON i.id_ruangan = r.id_ruangan';
        let queryParams = [];
        let conditions = [];

        if (kondisi && kondisi !== '') { conditions.push('i.kondisi = ?'); queryParams.push(kondisi); }
        if (id_ruangan && id_ruangan !== '') { conditions.push('i.id_ruangan = ?'); queryParams.push(parseInt(id_ruangan)); }
        if (conditions.length > 0) { queryInventaris += ' WHERE ' + conditions.join(' AND '); }
        queryInventaris += ' ORDER BY i.id_inventaris DESC';

        db.query(queryInventaris, queryParams, (err, inventaris) => {
            if (err) return res.status(500).send("Error Inventaris: " + err.message);
            res.render('staf_lab/monitoring_inventaris', { 
                user: req.session.user, dataInventaris: inventaris, dataRuangan: ruanganList, filters: { kondisi, id_ruangan } 
            });
        });
    });
});

// 3. Monitoring BHP + Filter Status Stok & Pencarian Keyword
router.get('/monitoring-bhp', isStafLab, (req, res) => {
    const { status_stok, keyword } = req.query;
    let queryBHP = 'SELECT * FROM bhp WHERE 1=1';
    let queryParams = [];

    if (status_stok === 'kritis') { queryBHP += ' AND stok <= 5'; } 
    else if (status_stok === 'aman') { queryBHP += ' AND stok > 5'; }

    if (keyword && keyword.trim() !== '') {
        queryBHP += ' AND (nama_bhp LIKE ? OR lokasi_penyimpanan LIKE ?)';
        queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    queryBHP += ' ORDER BY id_bhp DESC';

    db.query(queryBHP, queryParams, (err, bhp) => {
        if (err) return res.status(500).send("Error BHP: " + err.message);
        res.render('staf_lab/monitoring_bhp', { user: req.session.user, dataBHP: bhp, filters: { status_stok, keyword } });
    });
});

// 4. Form Input Maintenance
router.get('/maintenance/:id_inventaris', isStafLab, (req, res) => {
    db.query('SELECT i.*, r.nama_ruangan FROM inventaris i LEFT JOIN ruangan r ON i.id_ruangan = r.id_ruangan WHERE i.id_inventaris = ?', [req.params.id_inventaris], (err, asset) => {
        if (err) return res.status(500).send(err.message);
        if (asset.length === 0) return res.status(404).send("Aset tidak ditemukan.");
        db.query('SELECT * FROM bhp WHERE stok > 0', (err, bhp) => {
            if (err) return res.status(500).send(err.message);
            res.render('staf_lab/form_maintenance', { user: req.session.user, asset: asset[0], dataBHP: bhp });
        });
    });
});

// 5. Proses Simpan Maintenance 
router.post('/maintenance/:id_inventaris', isStafLab, (req, res) => {
    const { id_inventaris } = req.params;
    const { deskripsi_kegiatan, tanggal_maintenance, kondisi_baru, menggunakan_bhp, id_bhp, jumlah_bhp_digunakan } = req.body;
    const idStaf = req.session.user.id_user;

    const pakaiBHP = menggunakan_bhp === 'ya' && id_bhp;
    const dBhpId = pakaiBHP ? parseInt(id_bhp) : null;
    const dQtyBhp = pakaiBHP ? parseInt(jumlah_bhp_digunakan) : 0;

    db.beginTransaction((err) => {
        if (err) return res.status(500).send("Gagal transaksi: " + err.message);

        if (pakaiBHP && dQtyBhp > 0) {
            db.query('SELECT stok, nama_bhp FROM bhp WHERE id_bhp = ?', [dBhpId], (err, bhpResult) => {
                if (err || bhpResult.length === 0) return db.rollback(() => res.status(400).send("BHP tidak ada."));
                if (bhpResult[0].stok < dQtyBhp) {
                    return db.rollback(() => res.send(`<script>alert('Gagal! Stok ${bhpResult[0].nama_bhp} tidak cukup.'); window.history.back();</script>`));
                }
                proceedWithMaintenance(db, id_inventaris, idStaf, deskripsi_kegiatan, tanggal_maintenance, kondisi_baru, dBhpId, dQtyBhp, res);
            });
        } else {
            proceedWithMaintenance(db, id_inventaris, idStaf, deskripsi_kegiatan, tanggal_maintenance, kondisi_baru, null, 0, res);
        }
    });
});

function proceedWithMaintenance(dbInstance, idInventaris, idStaf, deskripsi, tanggal, kondisiBaru, idBhp, qtyBhp, res) {
    const queryLog = 'INSERT INTO log_maintenance (id_inventaris, id_staf_lab, tanggal_maintenance, deskripsi, id_bhp_digunakan, jumlah_bhp_dipakai) VALUES (?, ?, ?, ?, ?, ?)';
    dbInstance.query(queryLog, [idInventaris, idStaf, tanggal, deskripsi, idBhp, qtyBhp], (err) => {
        if (err) return dbInstance.rollback(() => res.status(500).send("Error Log: " + err.message));
        
        dbInstance.query('UPDATE inventaris SET kondisi = ? WHERE id_inventaris = ?', [kondisiBaru, idInventaris], (err) => {
            if (err) return dbInstance.rollback(() => res.status(500).send("Error Update Kondisi: " + err.message));
            
            if (idBhp && qtyBhp > 0) {
                dbInstance.query('UPDATE bhp SET stok = stok - ? WHERE id_bhp = ?', [qtyBhp, idBhp], (err) => {
                    if (err) return dbInstance.rollback(() => res.status(500).send("Error Potong BHP"));
                    dbInstance.commit(() => res.send("<script>alert('Sukses dicatat & Stok BHP Terpotong!'); window.location.href='/staf-lab/monitoring-inventaris';</script>"));
                });
            } else {
                dbInstance.commit(() => res.send("<script>alert('Sukses dicatat tanpa memotong BHP!'); window.location.href='/staf-lab/monitoring-inventaris';</script>"));
            }
        });
    });
}

module.exports = router;
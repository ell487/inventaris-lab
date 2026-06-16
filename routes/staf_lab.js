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

// 1. Dashboard Utama: Menampilkan Log Riwayat Maintenance Saja
router.get('/', isStafLab, (req, res) => {
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
            dataLog: logs
        });
    });
});

// 2. Halaman Terpisah: Monitoring Inventaris Fisik
router.get('/monitoring-inventaris', isStafLab, (req, res) => {
    const queryInventaris = 'SELECT i.*, r.nama_ruangan FROM inventaris i LEFT JOIN ruangan r ON i.id_ruangan = r.id_ruangan ORDER BY i.id_inventaris DESC';
    
    db.query(queryInventaris, (err, inventaris) => {
        if (err) return res.status(500).send("Error Inventaris: " + err.message);
        
        res.render('staf_lab/monitoring_inventaris', { 
            user: req.session.user, 
            dataInventaris: inventaris
        });
    });
});

// 3. Halaman Terpisah: Monitoring Stok BHP
router.get('/monitoring-bhp', isStafLab, (req, res) => {
    const queryBHP = 'SELECT * FROM bhp ORDER BY id_bhp DESC';
    
    db.query(queryBHP, (err, bhp) => {
        if (err) return res.status(500).send("Error BHP: " + err.message);
        
        res.render('staf_lab/monitoring_bhp', { 
            user: req.session.user, 
            dataBHP: bhp
        });
    });
});

// 4. Update Kondisi Fisik Inventaris secara Instan (Dari Halaman Monitoring)
router.post('/update-kondisi/:id_inventaris', isStafLab, (req, res) => {
    const { kondisi } = req.body;
    const { id_inventaris } = req.params;

    db.query('UPDATE inventaris SET kondisi = ? WHERE id_inventaris = ?', [kondisi, id_inventaris], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect('/staf-lab/monitoring-inventaris'); // Redirect balik ke halaman monitoringnya
    });
});

// 5. Tampilkan Form Input Maintenance Lengkap
router.get('/maintenance/:id_inventaris', isStafLab, (req, res) => {
    db.query('SELECT i.*, r.nama_ruangan FROM inventaris i LEFT JOIN ruangan r ON i.id_ruangan = r.id_ruangan WHERE i.id_inventaris = ?', [req.params.id_inventaris], (err, asset) => {
        if (err) return res.status(500).send(err.message);
        if (asset.length === 0) return res.status(404).send("Aset tidak ditemukan.");
        
        db.query('SELECT * FROM bhp WHERE stok > 0', (err, bhp) => {
            if (err) return res.status(500).send(err.message);
            res.render('staf_lab/form_maintenance', { 
                user: req.session.user, 
                asset: asset[0], 
                dataBHP: bhp 
            });
        });
    });
});

// 6. Proses Simpan Log Maintenance + Auto Cut Stok BHP + Update Kondisi Barang (ACID Transaction)
router.post('/maintenance/:id_inventaris', isStafLab, (req, res) => {
    const { id_inventaris } = req.params;
    const { deskripsi_kegiatan, tanggal_maintenance, kondisi_baru, menggunakan_bhp, id_bhp, jumlah_bhp_digunakan } = req.body;
    const idStaf = req.session.user.id_user;

    const pakaiBHP = menggunakan_bhp === 'ya' && id_bhp;
    const dBhpId = pakaiBHP ? parseInt(id_bhp) : null;
    const dQtyBhp = pakaiBHP ? parseInt(jumlah_bhp_digunakan) : 0;

    db.getConnection((err, connection) => {
        if (err) return res.status(500).send(err.message);

        connection.beginTransaction((err) => {
            if (err) { connection.release(); return res.status(500).send(err.message); }

            if (pakaiBHP && dQtyBhp > 0) {
                connection.query('SELECT stok, nama_bhp FROM bhp WHERE id_bhp = ?', [dBhpId], (err, bhpResult) => {
                    if (err || bhpResult.length === 0) {
                        return connection.rollback(() => { connection.release(); res.status(400).send("BHP tidak valid atau tidak ditemukan."); });
                    }

                    const stokSekarang = bhpResult[0].stok;
                    if (stokSekarang < dQtyBhp) {
                        return connection.rollback(() => { 
                            connection.release();
                            res.send(`<script>alert('Gagal! Stok ${bhpResult[0].nama_bhp} tidak mencukupi (Tersedia: ${stokSekarang}).'); window.history.back();</script>`);
                        });
                    }

                    proceedWithMaintenance(connection, id_inventaris, idStaf, deskripsi_kegiatan, tanggal_maintenance, kondisi_baru, dBhpId, dQtyBhp, res);
                });
            } else {
                proceedWithMaintenance(connection, id_inventaris, idStaf, deskripsi_kegiatan, tanggal_maintenance, kondisi_baru, null, 0, res);
            }
        });
    });
});

// Helper function internal untuk memproses rentetan query transaksi database secara sinkron
function proceedWithMaintenance(connection, idInventaris, idStaf, deskripsi, tanggal, kondisiBaru, idBhp, qtyBhp, res) {
    const queryLog = `
        INSERT INTO log_maintenance (id_inventaris, id_staf_lab, tanggal_maintenance, deskripsi_kegiatan, id_bhp_digunakan, jumlah_bhp_dipakai) 
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    connection.query(queryLog, [idInventaris, idStaf, tanggal, deskripsi, idBhp, qtyBhp], (err) => {
        if (err) {
            return connection.rollback(() => { connection.release(); res.status(500).send("Gagal log maintenance: " + err.message); });
        }

        connection.query('UPDATE inventaris SET kondisi = ? WHERE id_inventaris = ?', [kondisiBaru, idInventaris], (err) => {
            if (err) {
                return connection.rollback(() => { connection.release(); res.status(500).send("Gagal update kondisi barang."); });
            }

            if (idBhp && qtyBhp > 0) {
                connection.query('UPDATE bhp SET stok = stok - ? WHERE id_bhp = ?', [qtyBhp, idBhp], (err) => {
                    if (err) {
                        return connection.rollback(() => { connection.release(); res.status(500).send("Gagal potong stok BHP."); });
                    }

                    connection.commit((err) => {
                        if (err) return connection.rollback(() => { connection.release(); res.status(500).send(err.message); });
                        connection.release();
                        res.send("<script>alert('Sukses! Perbaikan dicatat & stok BHP dipotong.'); window.location.href='/staf-lab';</script>");
                    });
                });
            } else {
                connection.commit((err) => {
                    if (err) return connection.rollback(() => { connection.release(); res.status(500).send(err.message); });
                    connection.release();
                    res.send("<script>alert('Sukses mencatat tindakan perbaikan barang!'); window.location.href='/staf-lab';</script>");
                });
            }
        });
    });
}

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../config/database'); 
const QRCode = require('qrcode'); 
const path = require('path');
const fs = require('fs');

// Middleware proteksi Role Staf Admin
const isStafAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'staf_admin') {
        return res.redirect('/');
    }
    next();
};

// 1. DASHBOARD UTAMA
router.get('/', isStafAdmin, (req, res) => {
    const { search, tahun } = req.query;
    let queryDraf = `SELECT * FROM draf_pengadaan WHERE status_draf = 'locked'`;
    let queryParams = [];

    if (search) {
        queryDraf += ` AND judul_draf LIKE ?`;
        queryParams.push(`%${search}%`);
    }
    if (tahun) {
        queryDraf += ` AND tahun = ?`;
        queryParams.push(tahun);
    }
    queryDraf += ` ORDER BY created_at DESC`;

    db.query(queryDraf, queryParams, (err, results) => {
        if (err) return res.status(500).send("Database Error: " + err.message);
        
        db.query(`SELECT DISTINCT tahun FROM draf_pengadaan WHERE status_draf = 'locked'`, (err, tahunRows) => {
            const listTahun = tahunRows ? tahunRows.map(r => r.tahun) : [];
            res.render('staf_admin/dashboard', { 
                user: req.session.user, 
                dataDraf: results,
                filters: { search, tahun },
                listTahun
            });
        });
    });
});

// 2. DETAIL ITEM DRAF
router.get('/draf/:id_draf', isStafAdmin, (req, res) => {
    const idDraf = req.params.id_draf;
    
    const queryItems = `
        SELECT dd.*, IFNULL(SUM(rp.jumlah_diterima), 0) AS total_diterima
        FROM detail_draf dd
        LEFT JOIN riwayat_penerimaan rp ON dd.id_detail = rp.id_detail
        WHERE dd.id_draf = ?
        GROUP BY dd.id_detail
    `;

    db.query('SELECT * FROM draf_pengadaan WHERE id_draf = ?', [idDraf], (err, draf) => {
        if (err) return res.status(500).send("Database Error: " + err.message);
        if (draf.length === 0) return res.status(404).send("Draf tidak ditemukan.");

        db.query(queryItems, [idDraf], (err, items) => {
            if (err) return res.status(500).send("Database Error: " + err.message);
            res.render('staf_admin/detail_draf', { 
                user: req.session.user, 
                draf: draf[0], 
                dataItems: items 
            });
        });
    });
});

// 3. FORM TERIMA INVENTARIS
router.get('/terima-inventaris/:id_detail', isStafAdmin, (req, res) => {
    const queryItemDetail = `
        SELECT dd.*, IFNULL(SUM(rp.jumlah_diterima), 0) AS total_diterima 
        FROM detail_draf dd 
        LEFT JOIN riwayat_penerimaan rp ON dd.id_detail = rp.id_detail
        WHERE dd.id_detail = ?
        GROUP BY dd.id_detail
    `;
    db.query(queryItemDetail, [req.params.id_detail], (err, result) => {
        if (err || result.length === 0) return res.status(404).send("Data item tidak ditemukan.");
        
        db.query('SELECT * FROM ruangan', (err, ruangan) => {
            if (err) return res.status(500).send("Database Error: " + err.message);
            res.render('staf_admin/terima_inventaris', { 
                user: req.session.user, 
                item: result[0], 
                dataRuangan: ruangan 
            });
        });
    });
});

// 4. PROSES SIMPAN INVENTARIS + GENERATE QR CODE (FIXED LOGIC & COLUMN SINKRON)
router.post('/terima-inventaris/:id_detail', isStafAdmin, async (req, res) => {
    const { nama_barang, id_ruangan, tanggal_penerimaan, id_draf, jumlah_diterima } = req.body;
    const id_detail = req.params.id_detail;
    
    const qtyInput = parseInt(jumlah_diterima) || 0; 

    db.query('SELECT jumlah FROM detail_draf WHERE id_detail = ?', [id_detail], (err, detailResult) => {
        if (err || detailResult.length === 0) return res.status(400).send("Data pengadaan tidak valid.");
        
        const targetMaksimal = parseInt(detailResult[0].jumlah) || 0;

        db.query('SELECT IFNULL(SUM(jumlah_diterima), 0) AS total_sebelumnya FROM riwayat_penerimaan WHERE id_detail = ?', [id_detail], async (err, riwayatResult) => {
            if (err) return res.status(500).send(err.message);

            const totalSebelumnya = parseInt(riwayatResult[0].total_sebelumnya) || 0;
            const sisaKuota = targetMaksimal - totalSebelumnya;
            
            // PERBAIKAN LOGIKA: Hanya cegat jika input melebih sisa kuota asli!
            if (qtyInput > sisaKuota) {
                return res.send(`<script>alert('Gagal! Anda menginput ${qtyInput} unit, sisa kuota draf hanya tinggal ${sisaKuota} unit.'); window.history.back();</script>`);
            }

            // Jalankan simpan ke riwayat_penerimaan
            const queryRiwayat = 'INSERT INTO riwayat_penerimaan (id_detail, jumlah_diterima, tanggal_penerimaan, id_staf_admin) VALUES (?, ?, ?, ?)';
            db.query(queryRiwayat, [id_detail, qtyInput, tanggal_penerimaan, req.session.user.id_user], async (err) => {
                if (err) return res.status(500).send("Gagal simpan riwayat: " + err.message);

                try {
                    const qrDir = path.join(__dirname, '../public/uploads/qr/');
                    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
                    const tahunSekarang = new Date(tanggal_penerimaan).getFullYear() || 2026; 

                    for (let i = 0; i < qtyInput; i++) {
                        const uniqueTimestamp = Date.now() + i + Math.floor(Math.random() * 1000); 
                        const kodeLabelSistem = `QR-${tahunSekarang}-${uniqueTimestamp.toString().slice(-5)}`;

                        const namaFileQR = `${kodeLabelSistem}.png`;
                        const pathSimpanFile = path.join(qrDir, namaFileQR);
                        const pathUntukDatabase = `/uploads/qr/${namaFileQR}`;

                        // Bikin gambar QR fisik
                        await QRCode.toFile(pathSimpanFile, kodeLabelSistem);

                        // Masukkan ke tabel inventaris sesuai susunan database asli kamu
                        await new Promise((resolve, reject) => {
                            const queryAsset = `
                                INSERT INTO inventaris (kode_label_qr, nama_barang, kondisi, id_ruangan, tahun_pengadaan, foto_qr) 
                                VALUES (?, ?, 'baik', ?, ?, ?)
                            `;
                            db.query(queryAsset, [kodeLabelSistem, nama_barang, id_ruangan, tahunSekarang, pathUntukDatabase], (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });
                    }
                    
                    // Trigger alert sukses sebelum dilempar kembali ke detail draf
                    res.send(`<script>alert('Berhasil menerima ${qtyInput} unit barang inventaris dan QR Code sukses digenerate!'); window.location.href="/staf-admin/draf/${id_draf}";</script>`);
                } catch (error) {
                    return res.status(500).send("Gagal generate QR Code / Simpan Aset: " + error.message);
                }
            });
        });
    });
});

// 5. FORM TERIMA BHP
router.get('/terima-bhp/:id_detail', isStafAdmin, (req, res) => {
    const queryItems = `
        SELECT dd.*, IFNULL(SUM(rp.jumlah_diterima), 0) AS total_diterima
        FROM detail_draf dd
        LEFT JOIN riwayat_penerimaan rp ON dd.id_detail = rp.id_detail
        WHERE dd.id_detail = ?
        GROUP BY dd.id_detail
    `;
    db.query(queryItems, [req.params.id_detail], (err, result) => {
        if (err || result.length === 0) return res.status(404).send("Data tidak ditemukan.");
        db.query('SELECT * FROM ruangan', (err, ruangan) => {
            if (err) return res.status(500).send(err.message);
            res.render('staf_admin/terima_bhp', { 
                user: req.session.user, 
                item: result[0], 
                dataRuangan: ruangan 
            });
        });
    });
});

// 6. PROSES SIMPAN DATA RECEIVE BHP 
router.post('/terima-bhp/:id_detail', isStafAdmin, (req, res) => {
    const { jumlah_diterima, tanggal_penerimaan, id_draf, id_ruangan } = req.body;
    const id_detail = req.params.id_detail;
    
    const qtyInput = parseInt(jumlah_diterima) || 0;

    db.query('SELECT jumlah, nama_barang FROM detail_draf WHERE id_detail = ?', [id_detail], (err, detailResult) => {
        if (err || detailResult.length === 0) return res.status(400).send("Data tidak valid.");
        
        const targetMaksimal = parseInt(detailResult[0].jumlah) || 0;
        const namaBhp = detailResult[0].nama_barang;

        db.query('SELECT IFNULL(SUM(jumlah_diterima), 0) AS total_sebelumnya FROM riwayat_penerimaan WHERE id_detail = ?', [id_detail], (err, riwayatResult) => {
            if (err) return res.status(500).send(err.message);

            const totalSebelumnya = parseInt(riwayatResult[0].total_sebelumnya) || 0;
            const sisaKuota = targetMaksimal - totalSebelumnya;

            if (qtyInput > sisaKuota) {
                return res.send(`<script>alert('Gagal! Input melebihi target draf. Sisa kuota: ${sisaKuota} unit.'); window.history.back();</script>`);
            }

            const queryRiwayat = 'INSERT INTO riwayat_penerimaan (id_detail, jumlah_diterima, tanggal_penerimaan, id_staf_admin) VALUES (?, ?, ?, ?)';
            db.query(queryRiwayat, [id_detail, qtyInput, tanggal_penerimaan, req.session.user.id_user], (err) => {
                if (err) return res.status(500).send(err.message);
                
                const tahunSekarang = new Date(tanggal_penerimaan).getFullYear() || 2026;
                
                db.query('SELECT * FROM bhp WHERE nama_bhp = ? AND id_ruangan = ?', [namaBhp, id_ruangan], (err, bhpExist) => {
                    if (bhpExist && bhpExist.length > 0) {
                        db.query('UPDATE bhp SET stok = stok + ? WHERE id_bhp = ?', [qtyInput, bhpExist[0].id_bhp], (err) => {
                            res.send(`<script>alert('Berhasil menambah stok BHP!'); window.location.href="/staf-admin/draf/${id_draf}";</script>`);
                        });
                    } else {
                        db.query('INSERT INTO bhp (nama_bhp, stok, satuan, id_ruangan, tahun_pengadaan) VALUES (?, ?, "Pcs", ?, ?)', 
                        [namaBhp, qtyInput, id_ruangan, tahunSekarang], (err) => {
                            if (err) return res.status(500).send("Gagal input BHP Baru: " + err.message);
                            res.send(`<script>alert('Berhasil menambah data BHP baru!'); window.location.href="/staf-admin/draf/${id_draf}";</script>`);
                        });
                    }
                });
            });
        });
    });
});

// 7. HALAMAN CETAK LABEL QR CODE (SINKRON DENGAN REKREASI VIEW)
router.get('/cetak-label/:id_detail', isStafAdmin, (req, res) => {
    const id_detail = req.params.id_detail;

    db.query('SELECT * FROM detail_draf WHERE id_detail = ?', [id_detail], (err, detailResult) => {
        if (err || detailResult.length === 0) return res.status(404).send("Data draf tidak ditemukan");
        const item = detailResult[0];

        // Ambil data asset inventaris yang namanya sama untuk dicetak QR-nya
        db.query('SELECT * FROM inventaris WHERE nama_barang = ? ORDER BY id_inventaris DESC', [item.nama_barang], (err, assets) => {
            if (err) return res.status(500).send("Database Error: " + err.message);
            
            res.render('staf_admin/cetak_label', { 
                user: req.session.user, 
                item: item, 
                dataAssets: assets 
            });
        });
    });
});

module.exports = router;
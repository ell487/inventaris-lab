const express = require('express');
const router = express.Router();
const db = require('../config/database'); 
const QRCode = require('qrcode'); 
const path = require('path');
const fs = require('fs');

const isStafAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'staf_admin') {
        return res.redirect('/');
    }
    next();
};

// 1. Dashboard Utama Staf Admin + Fitur Pencarian & Filter Tahun
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
        if (err) return res.status(500).send(err.message);
        
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

// 2. Detail Item di Dalam Draf
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
    const queryItemDetail = `
        SELECT dd.*, IFNULL(SUM(rp.jumlah_diterima), 0) AS total_diterima 
        FROM detail_draf dd 
        LEFT JOIN riwayat_penerimaan rp ON dd.id_detail = rp.id_detail
        WHERE dd.id_detail = ?
        GROUP BY dd.id_detail
    `;
    db.query(queryItemDetail, [req.params.id_detail], (err, result) => {
        if (err) return res.status(500).send(err.message);
        db.query('SELECT * FROM ruangan', (err, ruangan) => {
            if (err) return res.status(500).send(err.message);
            res.render('staf_admin/terima_inventaris', { user: req.session.user, item: result[0], dataRuangan: ruangan });
        });
    });
});

// 4. PROSES AMAN: Validasi Batas Kapasitas  & Dual Kode QR 
router.post('/terima-inventaris/:id_detail', isStafAdmin, async (req, res) => {
    const { nama_barang, id_ruangan, tanggal_penerimaan, id_draf, jumlah_diterima, kode_univ_base } = req.body;
    const id_detail = req.params.id_detail;
    const qtyInput = parseInt(jumlah_diterima) || 1; 

   
    db.query('SELECT jumlah FROM detail_draf WHERE id_detail = ?', [id_detail], (err, detailResult) => {
        if (err || detailResult.length === 0) return res.status(400).send("Data pengadaan tidak valid.");
        const targetMaksimal = detailResult[0].jumlah;

        db.query('SELECT IFNULL(SUM(jumlah_diterima), 0) AS total_sebelumnya FROM riwayat_penerimaan WHERE id_detail = ?', [id_detail], async (err, riwayatResult) => {
            const totalSebelumnya = riwayatResult[0].total_sebelumnya;
            
            
            if (totalSebelumnya + qtyInput > targetMaksimal) {
                return res.status(400).send(`<h1>LOGIKA JEBOL TERDETEKSI!</h1><p>Anda mencoba memasukkan ${qtyInput} unit, padahal sisa kuota item yang disetujui hanya tinggal ${targetMaksimal - totalSebelumnya} unit.</p><a href="/staf-admin/terima-inventaris/${id_detail}">Kembali ke Formulir</a>`);
            }

            // Jika lolos validasi kuota, eksekusi penyimpanan data
            const queryRiwayat = 'INSERT INTO riwayat_penerimaan (id_detail, jumlah_diterima, tanggal_penerimaan, id_staf_admin) VALUES (?, ?, ?, ?)';
            db.query(queryRiwayat, [id_detail, qtyInput, tanggal_penerimaan, req.session.user.id_user], async (err) => {
                if (err) return res.status(500).send(err.message);

                try {
                    const qrDir = path.join(__dirname, '../public/uploads/qr/');
                    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
                    const tahunSekarang = new Date().getFullYear(); 

                    for (let i = 0; i < qtyInput; i++) {
                        const randomSalt = Math.floor(Math.random() * 1000);
                        const uniqueTimestamp = Date.now() + i + randomSalt; 
                        const kodeLabelSistem = `LAB-${tahunSekarang}-${uniqueTimestamp.toString().slice(-6)}`;
                        
                        
                        const kodeLabelUniv = kode_univ_base ? `${kode_univ_base}-${totalSebelumnya + i + 1}` : null;

                        const namaFileQR = `${kodeLabelSistem}.png`;
                        const pathSimpanFile = path.join(qrDir, namaFileQR);
                        const pathUntukDatabase = `/uploads/qr/${namaFileQR}`;

                        
                        await QRCode.toFile(pathSimpanFile, kodeLabelSistem);

                        await new Promise((resolve, reject) => {
                            const queryAsset = 'INSERT INTO inventaris (kode_label_qr, kode_universitas, nama_barang, kondisi, id_ruangan, foto_qr) VALUES (?, ?, ?, "baik", ?, ?)';
                            db.query(queryAsset, [kodeLabelSistem, kodeLabelUniv, nama_barang, id_ruangan, pathUntukDatabase], (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });
                    }
                    res.redirect('/staf-admin/draf/' + id_draf);
                } catch (error) {
                    return res.status(500).send("Gagal mengenerate QR Code otomatis: " + error.message);
                }
            });
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

// 6. Proses Simpan Penerimaan BHP + Proteksi Over-Capacity
router.post('/terima-bhp/:id_detail', isStafAdmin, (req, res) => {
    const { jumlah_diterima, tanggal_penerimaan, id_draf } = req.body;
    const id_detail = req.params.id_detail;
    const qtyInput = parseInt(jumlah_diterima) || 0;

    db.query('SELECT jumlah FROM detail_draf WHERE id_detail = ?', [id_detail], (err, detailResult) => {
        if (err || detailResult.length === 0) return res.status(400).send("Data tidak valid.");
        const maxKuota = detailResult[0].jumlah;

        db.query('SELECT IFNULL(SUM(jumlah_diterima), 0) AS total_sebelumnya FROM riwayat_penerimaan WHERE id_detail = ?', [id_detail], (err, riwayatResult) => {
            const totalSebelumnya = riwayatResult[0].total_sebelumnya;

            if (totalSebelumnya + qtyInput > maxKuota) {
                return res.status(400).send(`<h1>KAPASITAS BHP MELEBIHI TARGET!</h1><p>Sisa kuota barang habis pakai ini hanya tinggal ${maxKuota - totalSebelumnya} unit.</p>`);
            }

            const queryRiwayat = 'INSERT INTO riwayat_penerimaan (id_detail, jumlah_diterima, tanggal_penerimaan, id_staf_admin) VALUES (?, ?, ?, ?)';
            db.query(queryRiwayat, [id_detail, qtyInput, tanggal_penerimaan, req.session.user.id_user], (err) => {
                if (err) return res.status(500).send(err.message);
                res.redirect('/staf-admin/draf/' + id_draf);
            });
        });
    });
});

// 7. Halaman Cetak Kumpulan Label QR
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
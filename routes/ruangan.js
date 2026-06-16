const express = require('express');
const router = express.Router();
const db = require('../config/database'); 

// Middleware Cek Akses Universal (Menerima 'admin' atau 'staf_admin')
const izinkanAdmin = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    
    const role = req.session.user.role;
    if (role === 'admin' || role === 'staf_admin') {
        return next(); // Lolos, boleh masuk menu
    }
    
    // Jika bukan admin, tendang ke halaman utama
    return res.redirect('/');
};

// 1. TAMPILKAN DATA 
router.get('/', izinkanAdmin, (req, res) => {
    db.query('SELECT * FROM ruangan ORDER BY id_ruangan DESC', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Terjadi kesalahan pada database.");
        }
        return res.render('admin/ruangan', { user: req.session.user, dataRuangan: results });
    });
});

// 2. TAMBAH DATA 
router.post('/tambah', izinkanAdmin, (req, res) => {
    const { nama_ruangan } = req.body;
    const sql = 'INSERT INTO ruangan (nama_ruangan) VALUES (?)';
    
    db.query(sql, [nama_ruangan], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal menambah data.");
        }
        return res.redirect('/ruangan');
    });
});

// 3. FORM EDIT (UPDATE - GET)
router.get('/edit/:id', izinkanAdmin, (req, res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM ruangan WHERE id_ruangan = ?';
    
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal mengambil data.");
        }
        if (results.length > 0) {
            return res.render('admin/edit-ruangan', { user: req.session.user, ruangan: results[0] });
        } else {
            return res.redirect('/ruangan');
        }
    });
});

// 4. EDIT DATA (UPDATE - POST) 
router.post('/edit/:id', izinkanAdmin, (req, res) => {
    const id = req.params.id;
    const { nama_ruangan } = req.body;
    const sql = 'UPDATE ruangan SET nama_ruangan = ? WHERE id_ruangan = ?';
    
    db.query(sql, [nama_ruangan, id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal mengupdate data.");
        }
        return res.redirect('/ruangan');
    });
});

// 5. PROSES HAPUS LENGKAP - ANTI FOREIGN KEY LOCK
router.get('/hapus/:id', izinkanAdmin, (req, res) => {
    const id = req.params.id;
    
    // MATIKAN foreign key check sementara agar MySQL tidak protes saat menghapus master ruangan
    db.query('SET FOREIGN_KEY_CHECKS = 0', (err) => {
        if (err) return res.status(500).send("Gagal mengonfigurasi database.");

        const sqlDelete = 'DELETE FROM ruangan WHERE id_ruangan = ?';
        db.query(sqlDelete, [id], (err, result) => {
            if (err) {
                console.error(err);
                return db.query('SET FOREIGN_KEY_CHECKS = 1', () => {
                    res.status(500).send("Gagal menghapus data ruangan.");
                });
            }

            // SET NULL id_ruangan yang terhapus di tabel terkait agar data tidak korup
            db.query('UPDATE inventaris SET id_ruangan = NULL WHERE id_ruangan = ?', [id], () => {
                db.query('UPDATE bhp SET id_ruangan = NULL WHERE id_ruangan = ?', [id], () => {
                    
                    // HIDUPKAN KEMBALI pengecekan foreign key demi keamanan data database
                    db.query('SET FOREIGN_KEY_CHECKS = 1', () => {
                        console.log(`✅ Ruangan ID ${id} sukses dihapus total!`);
                        return res.redirect('/ruangan');
                    });

                });
            });
        });
    });
});

module.exports = router;
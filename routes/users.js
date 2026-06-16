const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware Cek Akses (Izinkan role 'admin' atau 'staf_admin')
const izinkanAdmin = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    const role = req.session.user.role;
    if (role === 'admin' || role === 'staf_admin') {
        return next();
    }
    return res.redirect('/');
};

// 1. TAMPILKAN DATA USER + TANGKAP STATUS NOTIFIKASI
router.get('/', izinkanAdmin, (req, res) => {
    const { status, error } = req.query;

    db.query('SELECT * FROM users ORDER BY id_user DESC', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Terjadi kesalahan pada database.");
        }
        
        return res.render('admin/users', { 
            user: req.session.user, 
            dataUsers: results,
            status: status,
            error: error
        });
    });
});

// 2. PROSES TAMBAH USER
router.post('/tambah', izinkanAdmin, (req, res) => {
    const { username, password, confirm_password, nama, role } = req.body;

    if (password !== confirm_password) {
        return res.redirect('/users?error=password_mismatch');
    }

    const sql = 'INSERT INTO users (username, password, nama, role) VALUES (?, ?, ?, ?)';
    db.query(sql, [username, password, nama, role], (err, result) => {
        if (err) {
            console.error(err);
            if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
                return res.redirect('/users?error=duplicate_username');
            }
            return res.status(500).send("Gagal menambah pengguna baru.");
        }
        return res.redirect('/users?status=inserted');
    });
});

// 3. TAMPILKAN FORM EDIT USER + TANGKAP ERROR JIKA PASWORD TIDAK MATCH
router.get('/edit/:id', izinkanAdmin, (req, res) => {
    const id = req.params.id;
    const { error } = req.query; 
    const sql = 'SELECT * FROM users WHERE id_user = ?';

    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal mengambil data pengguna.");
        }
        if (results.length > 0) {
            return res.render('admin/edit-user', { 
                user: req.session.user, 
                dataUser: results[0],
                error: error 
            });
        } else {
            return res.redirect('/users');
        }
    });
});

// 4. PROSES SIMPAN PERUBAHAN USER 
router.post('/edit/:id', izinkanAdmin, (req, res) => {
    const id = req.params.id;
    const { username, password, confirm_password, nama, role } = req.body;

    let sql = 'UPDATE users SET username = ?, nama = ?, role = ? WHERE id_user = ?';
    let params = [username, nama, role, id];

    if (password && password.trim() !== "") {
        if (password !== confirm_password) {
            return res.redirect(`/users/edit/${id}?error=password_mismatch`);
        }
        sql = 'UPDATE users SET username = ?, password = ?, nama = ?, role = ? WHERE id_user = ?';
        params = [username, password, nama, role, id];
    }

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal memperbarui data pengguna.");
        }
        return res.redirect('/users?status=updated');
    });
});

// 5. PROSES HAPUS USER - ANTI FOREIGN KEY LOCK 🚀
router.get('/hapus/:id', izinkanAdmin, (req, res) => {
    const idUser = req.params.id;

    // 1. Matikan pengecekan foreign key sementara agar MySQL membolehkan hapus master user
    db.query('SET FOREIGN_KEY_CHECKS = 0', (err) => {
        if (err) return res.status(500).send("Gagal mengonfigurasi database.");

        // 2. Eksekusi hapus data pengguna dari tabel users
        const sqlDelete = 'DELETE FROM users WHERE id_user = ?';
        db.query(sqlDelete, [idUser], (err, result) => {
            if (err) {
                console.error("❌ Gagal hapus user:", err);
                return db.query('SET FOREIGN_KEY_CHECKS = 1', () => {
                    res.status(500).send("Gagal menghapus pengguna.");
                });
            }

            // 3. SET NULL data terkait agar riwayat draf & transaksi tidak corrupt saat user dihapus
            db.query('UPDATE draf_pengadaan SET id_staf_admin = NULL WHERE id_staf_admin = ?', [idUser], () => {
                db.query('UPDATE riwayat_penerimaan SET id_staf_admin = NULL WHERE id_staf_admin = ?', [idUser], () => {
                    db.query('UPDATE log_maintenance SET id_staf_lab = NULL WHERE id_staf_lab = ?', [idUser], () => {
                        
                        // 4. Hidupkan kembali foreign key check
                        db.query('SET FOREIGN_KEY_CHECKS = 1', () => {
                            console.log(`✅ Pengguna ID ${idUser} berhasil dihapus!`);
                            return res.redirect('/users?status=deleted');
                        });

                    });
                });
            });
        });
    });
});

module.exports = router;
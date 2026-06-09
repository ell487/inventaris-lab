const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 1. TAMPILKAN DATA USER + TANGKAP STATUS NOTIFIKASI
router.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== 'admin') return res.redirect('/');

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
router.post('/tambah', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');

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
router.get('/edit/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');

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
router.post('/edit/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');

    const id = req.params.id;
    // Tangkap confirm_password dari form edit
    const { username, password, confirm_password, nama, role } = req.body;

    let sql = 'UPDATE users SET username = ?, nama = ?, role = ? WHERE id_user = ?';
    let params = [username, nama, role, id];

    if (password && password.trim() !== "") {
        // VALIDASI: Password baru harus sama dengan konfirmasi
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
        // Mengembalikan ke halaman utama dengan alert sukses updated!
        return res.redirect('/users?status=updated');
    });
});

// 5. PROSES HAPUS USER 
router.get('/hapus/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');

    const id = req.params.id;
    const sql = 'DELETE FROM users WHERE id_user = ?';

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal menghapus pengguna.");
        }
        return res.redirect('/users?status=deleted');
    });
});

module.exports = router;
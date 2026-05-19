const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 1. TAMPILKAN DATA USER (READ) 
router.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== 'admin') return res.redirect('/');

    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Terjadi kesalahan pada database.");
        }
        return res.render('admin/users', { user: req.session.user, dataUsers: results });
    });
});

// 2. PROSES TAMBAH USER
router.post('/tambah', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');

    const { username, password, nama, role } = req.body;
    const sql = 'INSERT INTO users (username, password, nama, role) VALUES (?, ?, ?, ?)';

    db.query(sql, [username, password, nama, role], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal menambah pengguna baru.");
        }
        return res.redirect('/users');
    });
});

// 3. TAMPILKAN FORM EDIT USER 
router.get('/edit/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');

    const id = req.params.id;
    const sql = 'SELECT * FROM users WHERE id_user = ?';

    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal mengambil data pengguna.");
        }
        if (results.length > 0) {
            return res.render('admin/edit-user', { user: req.session.user, dataUser: results[0] });
        } else {
            return res.redirect('/users');
        }
    });
});

// 4. PROSES SIMPAN PERUBAHAN USER 
router.post('/edit/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');

    const id = req.params.id;
    const { username, password, nama, role } = req.body;

    let sql = 'UPDATE users SET username = ?, nama = ?, role = ? WHERE id_user = ?';
    let params = [username, nama, role, id];

    if (password && password.trim() !== "") {
        sql = 'UPDATE users SET username = ?, password = ?, nama = ?, role = ? WHERE id_user = ?';
        params = [username, password, nama, role, id];
    }

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal memperbarui data pengguna.");
        }
        return res.redirect('/users');
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
        return res.redirect('/users');
    });
});

module.exports = router;
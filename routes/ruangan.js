const express = require('express');
const router = express.Router();
const db = require('../config/database'); 

// 1. TAMPILKAN DATA 
router.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== 'admin') return res.redirect('/');

    db.query('SELECT * FROM ruangan', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Terjadi kesalahan pada database.");
        }
        return res.render('admin/ruangan', { user: req.session.user, dataRuangan: results });
    });
});

// 2. TAMBAH DATA 
router.post('/tambah', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
    
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
router.get('/edit/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
    
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
router.post('/edit/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
    
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

// 5. PROSES HAPUS (DELETE - GET) 
router.get('/hapus/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
    
    const id = req.params.id;
    const sql = 'DELETE FROM ruangan WHERE id_ruangan = ?';
    
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal menghapus data.");
        }
        return res.redirect('/ruangan');
    });
});

module.exports = router; 
const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Naik 1 folder untuk panggil config

// 1. ROUTE DASHBOARD 
router.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    db.query('SELECT COUNT(*) AS total FROM ruangan', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Terjadi kesalahan pada database.");
        }
        
        const totalRuangan = results[0].total;
        
        return res.render('dashboard', { 
            user: req.session.user, 
            totalRuangan: totalRuangan 
        });
    });
});

// 2. TAMPILKAN HALAMAN LOGIN
router.get('/login', (req, res) => {
    return res.render('login');
});

// 3. PROSES LOGIN
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    
    db.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Terjadi kesalahan pada server.");
        }

        if (results.length > 0) {
            req.session.user = results[0];
            return res.redirect('/'); 
        } else {
            return res.send('<script>alert("Username atau Password salah!"); window.location="/login";</script>');
        }
    });
});

// 4. PROSES LOGOUT
router.get('/logout', (req, res) => {
    req.session.destroy();
    return res.redirect('/login');
});

module.exports = router;
const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./config/database'); // Memanggil file koneksi DB

const app = express();
const port = 3000;

// Set Template Engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); // Agar bisa membaca data dari form login
app.use(session({
    secret: 'rahasia_capstone_2026',
    resave: false,
    saveUninitialized: false
}));

// --- ROUTE LOGIN ---
// 1. Tampilkan halaman login
app.get('/login', (req, res) => {
    res.render('login');
});

// 2. Proses data login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Cek ke database
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.query(sql, [username, password], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            // Jika sukses, simpan data user ke session
            req.session.user = results[0];
            res.redirect('/'); // Arahkan ke dashboard
        } else {
            res.send('<script>alert("Username atau Password salah!"); window.location="/login";</script>');
        }
    });
});

// 3. Route Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- ROUTE DASHBOARD 
app.get('/', (req, res) => {
    
    if (!req.session.user) {
        return res.redirect('/login');
    }

    
    res.render('dashboard', { user: req.session.user });
});


app.listen(port, () => {
    console.log(`Server berjalan mantap di http://localhost:${port}`);
});
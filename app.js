const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./config/database'); 

const app = express();
const port = 3000;

// Set Template Engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); 
app.use(session({
    secret: 'rahasia_capstone_2026',
    resave: false,
    saveUninitialized: false
}));

// PANGGIL ROUTER 
const authRouter = require('./routes/auth');
const ruanganRouter = require('./routes/ruangan');
const usersRouter = require('./routes/users');
const stafAdminRouter = require('./routes/staf_admin'); 

// LOGIKA REDIRECT DASHBOARD SESUAI ROLE USER
app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const role = req.session.user.role;

    if (role === 'admin') {
        db.query('SELECT COUNT(*) AS total FROM ruangan', (err, result) => {
            const count = result && result[0] ? result[0].total : 0;
            res.render('admin/dashboard', { user: req.session.user, totalRuangan: count });
        });
    } else if (role === 'staf_admin') {
        res.redirect('/staf-admin');
    } else {
        res.send(`Selamat datang ${req.session.user.nama}. Dashboard untuk peran ${role} sedang dalam tahap perakitan.`);
    }
});

// INTEGRASI ROUTER KE APLIKASI
app.use('/', authRouter);
app.use('/ruangan', ruanganRouter);
app.use('/users', usersRouter);
app.use('/staf-admin', stafAdminRouter); 

// SERVER START 
app.listen(port, () => {
    console.log(`Server berjalan mantap di http://localhost:${port}`);
});
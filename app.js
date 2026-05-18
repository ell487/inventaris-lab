const express = require('express');
const path = require('path');
const session = require('express-session');

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


//  PANGGIL & GUNAKAN ROUTER 
const authRouter = require('./routes/auth');
const ruanganRouter = require('./routes/ruangan');

app.use('/', authRouter);
app.use('/ruangan', ruanganRouter);


//  SERVER START 

app.listen(port, () => {
    console.log(`Server berjalan mantap di http://localhost:${port}`);
});
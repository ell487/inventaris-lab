const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',     
    password: '',      
    database: 'inventaris_lab'
});

db.connect((err) => {
    if (err) {
        console.error('Gagal koneksi ke database:', err);
        return;
    }
    console.log('Koneksi ke MySQL Berhasil Mantap!');
});

module.exports = db;
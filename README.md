
---

# 🖥️ Sistem Informasi Manajemen Laboratorium (SIM-Lab)

Aplikasi berbasis web terintegrasi untuk mengelola inventaris aset fisik, memonitor ketersediaan Bahan Habis Pakai (BHP), mencatat riwayat pemeliharaan (maintenance), serta mengelola alur draf pengadaan barang di laboratorium.

## ✨ Fitur Utama

* 📦 **Monitoring Inventaris Berbasis Ruangan:** Melacak status kondisi aset (Baik, Maintenance, Rusak) lengkap dengan kode label QR dan lokasi penempatan.
* 🛠️ **Manajemen Maintenance & Logistik:** Pencatatan aktivitas perbaikan (*post-action log*) yang terintegrasi langsung dengan pemotongan otomatis stok BHP jika perbaikan menggunakan komponen pengganti.
* 📊 **Dashboard Analitik:** Menampilkan statistik metrik ringkasan (Total Aset, Aset Rusak, Aset Maintenance, dan Stok BHP Kritis) secara *real-time*.
* 📝 **Alur Pengajuan Pengadaan:** Draf pengajuan inventaris dan BHP baru yang berjenjang dari Kepala Lab hingga disetujui oleh Kaprodi, dilengkapi dengan log riwayat penerimaan barang.
* 🔐 **Multi-Role Authentication:** Sistem login dengan pembatasan hak akses dan fungsionalitas yang spesifik untuk setiap peran operasional.

## 👥 Hak Akses (Roles)

Aplikasi ini mendukung 5 tingkatan peran pengguna:

1. **Staf Lab (Teknisi Lapangan):** Mengeksekusi perbaikan alat, mengisi form *log maintenance*, dan memperbarui kondisi aset fisik secara riil.
2. **Staf Admin:** Mengelola entri data mentah dan mencatat riwayat penerimaan barang baru ke gudang.
3. **Kepala Lab (Kalab):** Memantau rekapitulasi data keseluruhan dan membuat draf pengajuan pengadaan alat/BHP baru.
4. **Kaprodi:** Mereview, menyetujui, atau menolak draf pengadaan yang diajukan oleh Kepala Lab.
5. **Admin (Superuser):** Mengelola master data *users*, ruangan, dan kontrol penuh terhadap konfigurasi sistem.

## 🚀 Teknologi yang Digunakan

* **Backend:** Node.js dengan framework [Express.js](https://expressjs.com/)
* **Database:** MySQL
* **Template Engine:** [Pug](https://pugjs.org/) (sebelumnya Jade)
* **Frontend UI:** HTML5, CSS3, JavaScript, dan Bootstrap
* **Session Management:** `express-session`

## ⚙️ Panduan Instalasi (Local Development)

Ikuti langkah-langkah di bawah ini untuk menjalankan aplikasi di mesin lokal kamu.

### 1. Prasyarat

Pastikan kamu sudah menginstal:

* [Node.js](https://nodejs.org/) (versi 14.x atau lebih baru)
* [XAMPP](https://www.apachefriends.org/) atau MySQL Server lokal

### 2. Kloning Repositori

```bash
git clone https://github.com/username-kamu/nama-repo.git
cd nama-repo

```

### 3. Instalasi Dependensi

Instal semua *package* Node.js yang dibutuhkan:

```bash
npm install

```

### 4. Konfigurasi Database

1. Buka phpMyAdmin (biasanya di `http://localhost/phpmyadmin`).
2. Buat database baru (otomatis terbuat melalui skrip).
3. Import file database yang sudah disediakan di dalam folder proyek:
* Buka menu tab **Import**.
* Pilih file `inventaris_lab.sql` (atau file *dump* SQL kamu).
* Klik **Go**.



### 5. Konfigurasi Environment (Jika Ada)

Jika aplikasi menggunakan file konfigurasi terpisah (seperti `.env` atau `config/database.js`), pastikan kredensial database sesuai dengan mesin lokalmu:

```javascript
// Contoh di config/database.js
host: 'localhost',
user: 'root',
password: '', // Kosongkan jika default XAMPP
database: 'inventaris_lab'

```

### 6. Jalankan Aplikasi

Jalankan server aplikasi menggunakan perintah:

```bash
npm start
# atau
node app.js

```

Aplikasi sekarang dapat diakses melalui browser di alamat: `http://localhost:3000` 

## 🗄️ Struktur Tabel Utama (Database)

* `users`: Menyimpan data kredensial dan hak akses pegawai.
* `ruangan`: Master data lokasi laboratorium.
* `inventaris`: Data induk barang keras (PC, Switch, Proyektor).
* `bhp`: Data logistik / Bahan Habis Pakai (Kabel, RJ45, Tinta).
* `log_maintenance`: Tabel transaksi riwayat perbaikan oleh Staf Lab.
* `draf_pengadaan`, `detail_draf`, `riwayat_penerimaan`: Rangkaian tabel untuk siklus pengajuan barang.


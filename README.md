# Class Hub — Pendaftaran Tim Mahasiswa (PHP + MySQL/phpMyAdmin)

Tema macOS (glass / aero), responsif HP & laptop, tampilan penuh 16:9 di PC.

## Pasang (XAMPP / Laragon / hosting cPanel)
1. Salin folder ini ke `htdocs/class-hub` (XAMPP) atau `www/class-hub` (Laragon).
2. Buka **phpMyAdmin → Import** → pilih `database.sql` → *Import*.
   Database `class_hub` dibuat otomatis, berisi 164 mahasiswa, 4 kelas, dan 10 tim per kelas.
   (Di hosting yang tidak mengizinkan `CREATE DATABASE`: buat database kosong dulu, hapus 2 baris
   `CREATE DATABASE` / `USE` di bagian atas `database.sql`, lalu import ke database tsb.)
3. Sesuaikan `config.php` (DB_NAME / DB_USER / DB_PASS). Jika memakai HTTPS ubah `COOKIE_SECURE` jadi `true`.
4. Buka `http://localhost/class-hub/`.

Kebutuhan: PHP 8.0+ dengan ekstensi PDO MySQL, MySQL 5.7+/MariaDB 10.3+.

## Akun
| Peran | Username | Password awal |
|---|---|---|
| Mahasiswa | NIM (mis. 241110007) | `machinelearning2026` (password kolektif) |
| Dosen/Admin | `dosen` | `Admin#ML2026` |

Semua akun **wajib ganti password** saat pertama masuk. Dosen bisa mereset password mahasiswa
ke password kolektif lewat menu *Data Mahasiswa → Reset*. Password kolektif diatur di `config.php`
(`DEFAULT_PASSWORD`).

## Aturan pendaftaran tim
- Mahasiswa hanya melihat & mengelola tim di **kelasnya sendiri** (Tim 1–10 per kelas).
- Satu tim 5–7 anggota (bisa diubah dosen di *Pengaturan*), wajib ada 1 ketua.
- Satu mahasiswa hanya di satu tim. Pindah tim = keluarkan diri dari tim lama (tim lama tetap ≥ 5).
- Anggota tim boleh menambah/mengeluarkan anggota; non-anggota hanya bisa menambah (termasuk dirinya).
- Pengamanan bentrok: jika dua orang menyimpan bersamaan, yang kedua diminta memuat ulang (kolom `tim.versi`).
- Dosen bisa menutup pendaftaran, memberi tenggat, menonaktifkan per kelas, mengeluarkan anggota,
  mengganti ketua, mengosongkan tim, dan mengekspor daftar tim ke CSV.

## Struktur tabel
| Tabel | Isi |
|---|---|
| `mata_kuliah` | master mata kuliah |
| `kelas` | master kelas (kode, sesi, angkatan, jumlah tim, status pendaftaran tim) |
| `mahasiswa` | master mahasiswa (NIM, nama, HP, email, kelas, hash password, status) |
| `tim` | tim per kelas (nomor, ketua, versi) |
| `tim_anggota` | keanggotaan (satu mahasiswa = satu tim, dijaga UNIQUE) |
| `admin` | akun dosen |
| `pengaturan` | min/maks anggota, buka/tutup, tenggat |
| `login_percobaan` | pembatas percobaan login (6 gagal / 10 menit) |
| `log_aktivitas` | jejak audit |

## Berkas
`index.php` (halaman) · `api.php` (backend JSON) · `config.php` · `assets/style.css` · `assets/app.js` · `database.sql`

## Menambah mahasiswa/kelas baru
- Satu per satu: *Data Mahasiswa → Tambah*. Banyak sekaligus: *Impor CSV* (kolom NIM, Nama, No HP, Email, Kelas = kode kelas).
- Kelas/mata kuliah baru: tambahkan baris di tabel `kelas` (dan `mata_kuliah`), lalu buat tim-nya:
  `INSERT INTO tim (kelas_id,nomor,nama) VALUES (5,1,'Tim 1'), (5,2,'Tim 2'), ...;`

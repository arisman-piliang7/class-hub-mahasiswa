<?php
declare(strict_types=1);

/* ============ Konfigurasi — sesuaikan dengan server Anda ============ */
const DB_HOST    = 'localhost';
const DB_NAME    = 'class_hub';
const DB_USER    = 'root';      // XAMPP/Laragon default
const DB_PASS    = '';          // XAMPP/Laragon default kosong
const DB_CHARSET = 'utf8mb4';

const APP_NAME   = 'Class Hub';
const APP_SUB    = 'Machine Learning 2026';
/* Password kolektif — dipakai saat dosen menekan "Reset password" */
const DEFAULT_PASSWORD = 'machinelearning2026';
/* Aktifkan true jika situs diakses lewat HTTPS */
const COOKIE_SECURE = false;
/* ==================================================================== */

date_default_timezone_set('Asia/Jakarta');

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET,
            DB_USER, DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
        $pdo->exec("SET time_zone = '+07:00'");
    }
    return $pdo;
}

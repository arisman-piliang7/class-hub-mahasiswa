<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

session_name('classhub');
session_set_cookie_params([
    'lifetime' => 0, 'path' => '/', 'httponly' => true,
    'samesite' => 'Lax', 'secure' => COOKIE_SECURE,
]);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));

/* ----------------------------- helper ----------------------------- */
function out($data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $code = 400): never { out(['ok' => false, 'error' => $msg], $code); }
function input(): array {
    static $b = null;
    if ($b === null) { $b = json_decode(file_get_contents('php://input') ?: '[]', true); if (!is_array($b)) $b = []; }
    return $b;
}
function ip(): string { return substr($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', 0, 45); }
function setting(string $k, string $def = ''): string {
    static $cache = null;
    if ($cache === null) $cache = db()->query('SELECT kunci,nilai FROM pengaturan')->fetchAll(PDO::FETCH_KEY_PAIR);
    return $cache[$k] ?? $def;
}
function logit(string $tipe, ?int $id, string $aksi, string $detail = ''): void {
    db()->prepare('INSERT INTO log_aktivitas (waktu,pelaku_tipe,pelaku_id,aksi,detail,ip) VALUES (NOW(),?,?,?,?,?)')
        ->execute([$tipe, $id, $aksi, $detail, ip()]);
}
function placeholders(array $a): string { return implode(',', array_fill(0, count($a), '?')); }

function current_user(): ?array {
    if (empty($_SESSION['u'])) return null;
    $s = $_SESSION['u'];
    if ($s['tipe'] === 'admin') {
        $st = db()->prepare('SELECT id,username,nama,wajib_ganti_password FROM admin WHERE id=?');
        $st->execute([$s['id']]);
        $r = $st->fetch();
        if (!$r) return null;
        return ['tipe' => 'admin', 'id' => (int)$r['id'], 'username' => $r['username'], 'nama' => $r['nama'],
                'wajib_ganti' => (bool)$r['wajib_ganti_password']];
    }
    $st = db()->prepare('SELECT m.id,m.nim,m.nama,m.no_hp,m.email,m.kelas_id,m.wajib_ganti_password,m.aktif,
                                k.nama AS kelas_nama,k.kode AS kelas_kode,k.sesi,k.tim_aktif,k.jumlah_tim,mk.nama AS mata_kuliah
                         FROM mahasiswa m JOIN kelas k ON k.id=m.kelas_id JOIN mata_kuliah mk ON mk.id=k.mata_kuliah_id
                         WHERE m.id=?');
    $st->execute([$s['id']]);
    $r = $st->fetch();
    if (!$r || !$r['aktif']) return null;
    return ['tipe' => 'mahasiswa', 'id' => (int)$r['id'], 'nim' => $r['nim'], 'nama' => $r['nama'],
            'no_hp' => $r['no_hp'], 'email' => $r['email'], 'kelas_id' => (int)$r['kelas_id'],
            'kelas_nama' => $r['kelas_nama'], 'kelas_kode' => $r['kelas_kode'], 'sesi' => $r['sesi'],
            'mata_kuliah' => $r['mata_kuliah'], 'tim_aktif' => (bool)$r['tim_aktif'],
            'wajib_ganti' => (bool)$r['wajib_ganti_password']];
}
function need_user(): array { $u = current_user(); if (!$u) fail('Sesi berakhir. Silakan masuk lagi.', 401); return $u; }
function need_mhs(): array { $u = need_user(); if ($u['tipe'] !== 'mahasiswa') fail('Menu ini khusus mahasiswa.', 403); return $u; }
function need_admin(): array { $u = need_user(); if ($u['tipe'] !== 'admin') fail('Menu ini khusus dosen/admin.', 403); return $u; }
function public_settings(): array {
    $tenggat = setting('tenggat');
    return [
        'tim_min' => (int)setting('tim_min', '5'), 'tim_max' => (int)setting('tim_max', '7'),
        'buka' => setting('pendaftaran_buka', '1') === '1', 'tenggat' => $tenggat ?: null,
        'tenggat_lewat' => $tenggat !== '' && strtotime($tenggat) !== false && strtotime($tenggat) < time(),
    ];
}
function password_ok(string $pw, string $nim = ''): ?string {
    if (strlen($pw) < 8) return 'Password minimal 8 karakter.';
    if (strlen($pw) > 72) return 'Password maksimal 72 karakter.';
    if (strcasecmp($pw, DEFAULT_PASSWORD) === 0) return 'Password baru tidak boleh sama dengan password kolektif.';
    if ($nim !== '' && $pw === $nim) return 'Password tidak boleh sama dengan NIM.';
    if (!preg_match('/[A-Za-z]/', $pw) || !preg_match('/\d/', $pw)) return 'Gunakan kombinasi huruf dan angka.';
    return null;
}

/* ------------------------- data tim (dipakai bersama) ------------------------- */
function tim_data(int $kelas_id): array {
    $pdo = db();
    $st = $pdo->prepare('SELECT id,nomor,nama,ketua_id,versi FROM tim WHERE kelas_id=? ORDER BY nomor');
    $st->execute([$kelas_id]);
    $tims = $st->fetchAll();
    $st = $pdo->prepare('SELECT ta.tim_id,m.id,m.nim,m.nama FROM tim_anggota ta
                         JOIN mahasiswa m ON m.id=ta.mahasiswa_id JOIN tim t ON t.id=ta.tim_id
                         WHERE t.kelas_id=? ORDER BY ta.bergabung_pada, m.nama');
    $st->execute([$kelas_id]);
    $by = [];
    foreach ($st->fetchAll() as $r) $by[$r['tim_id']][] = ['id' => (int)$r['id'], 'nim' => $r['nim'], 'nama' => $r['nama']];
    foreach ($tims as &$t) {
        $t['id'] = (int)$t['id']; $t['nomor'] = (int)$t['nomor']; $t['versi'] = (int)$t['versi'];
        $t['ketua_id'] = $t['ketua_id'] !== null ? (int)$t['ketua_id'] : null;
        $t['anggota'] = $by[$t['id']] ?? [];
    }
    return $tims;
}

/* ------------------------------ routing ------------------------------ */
$a = $_GET['a'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
    $tok = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals($_SESSION['csrf'], $tok)) fail('Token keamanan tidak valid. Muat ulang halaman.', 419);
}

try {
switch ($a) {

case 'boot': {
    out(['ok' => true, 'csrf' => $_SESSION['csrf'], 'user' => current_user(), 'settings' => public_settings(),
         'app' => ['nama' => APP_NAME, 'sub' => APP_SUB]]);
}

case 'login': {
    if ($method !== 'POST') fail('Metode tidak diizinkan.', 405);
    $b = input();
    $id = trim((string)($b['username'] ?? ''));
    $pw = (string)($b['password'] ?? '');
    if ($id === '' || $pw === '') fail('Isi NIM dan password.');
    $pdo = db();
    $pdo->prepare('DELETE FROM login_percobaan WHERE waktu < (NOW() - INTERVAL 1 DAY)')->execute();
    $st = $pdo->prepare('SELECT COUNT(*) FROM login_percobaan WHERE identitas=? AND waktu > (NOW() - INTERVAL 10 MINUTE)');
    $st->execute([strtolower($id)]);
    if ((int)$st->fetchColumn() >= 6) fail('Terlalu banyak percobaan gagal. Coba lagi dalam 10 menit.', 429);

    $user = null; $tipe = null;
    $st = $pdo->prepare('SELECT id,password_hash,aktif FROM mahasiswa WHERE nim=?');
    $st->execute([$id]);
    if ($r = $st->fetch()) { $user = $r; $tipe = 'mahasiswa'; }
    else {
        $st = $pdo->prepare('SELECT id,password_hash,1 AS aktif FROM admin WHERE username=?');
        $st->execute([$id]);
        if ($r = $st->fetch()) { $user = $r; $tipe = 'admin'; }
    }
    $okpw = $user ? password_verify($pw, $user['password_hash']) : password_verify($pw, '$2y$10$abcdefghijklmnopqrstuuK7a3Xn0Qx2x5J9mQK5s9Qy6cW1c0b8e');
    if (!$user || !$okpw) {
        $pdo->prepare('INSERT INTO login_percobaan (identitas,ip,waktu) VALUES (?,?,NOW())')->execute([strtolower($id), ip()]);
        fail('NIM atau password tidak cocok.', 401);
    }
    if (!$user['aktif']) fail('Akun ini dinonaktifkan. Hubungi dosen.', 403);
    $pdo->prepare('DELETE FROM login_percobaan WHERE identitas=?')->execute([strtolower($id)]);
    session_regenerate_id(true);
    $_SESSION['csrf'] = bin2hex(random_bytes(24));
    $_SESSION['u'] = ['tipe' => $tipe, 'id' => (int)$user['id']];
    $tbl = $tipe === 'admin' ? 'admin' : 'mahasiswa';
    $pdo->prepare("UPDATE $tbl SET terakhir_login=NOW() WHERE id=?")->execute([$user['id']]);
    logit($tipe, (int)$user['id'], 'login');
    out(['ok' => true, 'csrf' => $_SESSION['csrf'], 'user' => current_user(), 'settings' => public_settings()]);
}

case 'logout': {
    if ($method !== 'POST') fail('Metode tidak diizinkan.', 405);
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);
}

case 'ganti_password': {
    if ($method !== 'POST') fail('Metode tidak diizinkan.', 405);
    $u = need_user(); $b = input();
    $lama = (string)($b['lama'] ?? ''); $baru = (string)($b['baru'] ?? '');
    $tbl = $u['tipe'] === 'admin' ? 'admin' : 'mahasiswa';
    $st = db()->prepare("SELECT password_hash FROM $tbl WHERE id=?");
    $st->execute([$u['id']]);
    if (!password_verify($lama, (string)$st->fetchColumn())) fail('Password saat ini salah.');
    if ($baru === $lama) fail('Password baru harus berbeda dari yang lama.');
    if ($err = password_ok($baru, $u['nim'] ?? '')) fail($err);
    db()->prepare("UPDATE $tbl SET password_hash=?, wajib_ganti_password=0 WHERE id=?")
        ->execute([password_hash($baru, PASSWORD_DEFAULT), $u['id']]);
    logit($u['tipe'], $u['id'], 'ganti_password');
    out(['ok' => true]);
}

/* ============================ MAHASISWA ============================ */
case 'tim_kelas': {
    $u = need_mhs();
    $tims = tim_data($u['kelas_id']);
    $st = db()->prepare('SELECT m.id,m.nim,m.nama,ta.tim_id FROM mahasiswa m
                         LEFT JOIN tim_anggota ta ON ta.mahasiswa_id=m.id
                         WHERE m.kelas_id=? AND m.aktif=1 ORDER BY m.nama');
    $st->execute([$u['kelas_id']]);
    $mhs = array_map(fn($r) => ['id' => (int)$r['id'], 'nim' => $r['nim'], 'nama' => $r['nama'],
                                'tim_id' => $r['tim_id'] !== null ? (int)$r['tim_id'] : null], $st->fetchAll());
    $mine = null;
    foreach ($mhs as $m) if ($m['id'] === $u['id']) $mine = $m['tim_id'];
    out(['ok' => true, 'tim' => $tims, 'mahasiswa' => $mhs, 'tim_saya' => $mine, 'settings' => public_settings(),
         'tim_aktif' => $u['tim_aktif']]);
}

case 'tim_simpan': {
    if ($method !== 'POST') fail('Metode tidak diizinkan.', 405);
    $u = need_mhs(); $b = input();
    $s = public_settings();
    if (!$u['tim_aktif']) fail('Pendaftaran tim belum dibuka untuk kelas ini.', 403);
    if (!$s['buka']) fail('Pendaftaran tim sedang ditutup oleh dosen.', 403);
    if ($s['tenggat_lewat']) fail('Tenggat pendaftaran tim sudah lewat.', 403);

    $tim_id = (int)($b['tim_id'] ?? 0);
    $ids = array_values(array_unique(array_map('intval', (array)($b['anggota'] ?? []))));
    $ketua = (int)($b['ketua_id'] ?? 0);
    $versi = (int)($b['versi'] ?? -1);
    $n = count($ids);
    if ($n < $s['tim_min']) fail("Anggota tim minimal {$s['tim_min']} orang (sekarang $n).");
    if ($n > $s['tim_max']) fail("Anggota tim maksimal {$s['tim_max']} orang (sekarang $n).");
    if (!in_array($ketua, $ids, true)) fail('Pilih salah satu anggota sebagai ketua tim.');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT * FROM tim WHERE id=? AND kelas_id=? FOR UPDATE');
        $st->execute([$tim_id, $u['kelas_id']]);
        $t = $st->fetch();
        if (!$t) { $pdo->rollBack(); fail('Tim tidak ditemukan di kelas Anda.', 404); }
        if ((int)$t['versi'] !== $versi) { $pdo->rollBack(); fail('Tim ini baru saja diubah oleh anggota lain. Data sudah dimuat ulang, coba lagi.', 409); }

        $st = $pdo->prepare('SELECT id,nama FROM mahasiswa WHERE aktif=1 AND kelas_id=? AND id IN (' . placeholders($ids) . ')');
        $st->execute(array_merge([$u['kelas_id']], $ids));
        if (count($st->fetchAll()) !== $n) { $pdo->rollBack(); fail('Ada mahasiswa yang bukan dari kelas Anda atau tidak aktif.'); }

        $st = $pdo->prepare('SELECT ta.mahasiswa_id, m.nama, t.nama AS tim FROM tim_anggota ta
                             JOIN mahasiswa m ON m.id=ta.mahasiswa_id JOIN tim t ON t.id=ta.tim_id
                             WHERE ta.tim_id<>? AND ta.mahasiswa_id IN (' . placeholders($ids) . ') FOR UPDATE');
        $st->execute(array_merge([$tim_id], $ids));
        if ($x = $st->fetch()) {
            $pdo->rollBack();
            fail("{$x['nama']} sudah terdaftar di {$x['tim']}. Keluarkan dari tim tersebut terlebih dahulu.");
        }

        $st = $pdo->prepare('SELECT mahasiswa_id FROM tim_anggota WHERE tim_id=? FOR UPDATE');
        $st->execute([$tim_id]);
        $lama = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));

        $anggota_lama = in_array($u['id'], $lama, true);
        if (!$anggota_lama) {
            if (!in_array($u['id'], $ids, true)) { $pdo->rollBack(); fail('Untuk bergabung, nama Anda harus ada di daftar anggota.', 403); }
            if (array_diff($lama, $ids)) { $pdo->rollBack(); fail('Anda hanya boleh menambah anggota, bukan mengeluarkan anggota tim lain.', 403); }
        }
        $hapus = array_diff($lama, $ids);
        $tambah = array_diff($ids, $lama);
        if ($hapus) {
            $pdo->prepare('DELETE FROM tim_anggota WHERE tim_id=? AND mahasiswa_id IN (' . placeholders($hapus) . ')')
                ->execute(array_merge([$tim_id], array_values($hapus)));
        }
        $ins = $pdo->prepare('INSERT INTO tim_anggota (tim_id,mahasiswa_id) VALUES (?,?)');
        foreach ($tambah as $mid) $ins->execute([$tim_id, $mid]);
        $pdo->prepare('UPDATE tim SET ketua_id=?, versi=versi+1 WHERE id=?')->execute([$ketua, $tim_id]);
        logit('mahasiswa', $u['id'], 'tim_simpan', json_encode(['tim' => $t['nama'], 'anggota' => $ids, 'ketua' => $ketua, 'tambah' => array_values($tambah), 'hapus' => array_values($hapus)]));
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e->getCode() === '23000') fail('Seorang anggota baru saja masuk ke tim lain. Muat ulang dan coba lagi.', 409);
        throw $e;
    }
    out(['ok' => true]);
}

/* ============================== ADMIN ============================== */
case 'admin_ringkasan': {
    need_admin();
    $pdo = db();
    $min = (int)setting('tim_min', '5');
    $rows = $pdo->query("SELECT k.id,k.kode,k.nama,k.sesi,k.tim_aktif,mk.nama AS mata_kuliah,
        (SELECT COUNT(*) FROM mahasiswa m WHERE m.kelas_id=k.id AND m.aktif=1) AS total,
        (SELECT COUNT(*) FROM tim_anggota ta JOIN tim t ON t.id=ta.tim_id WHERE t.kelas_id=k.id) AS bertim,
        (SELECT COUNT(*) FROM tim t WHERE t.kelas_id=k.id AND (SELECT COUNT(*) FROM tim_anggota ta WHERE ta.tim_id=t.id)>=$min) AS tim_valid,
        (SELECT COUNT(*) FROM mahasiswa m WHERE m.kelas_id=k.id AND m.wajib_ganti_password=0) AS sudah_ganti
        FROM kelas k JOIN mata_kuliah mk ON mk.id=k.mata_kuliah_id ORDER BY mk.nama,k.kode")->fetchAll();
    foreach ($rows as &$r) foreach (['id','total','bertim','tim_valid','sudah_ganti','tim_aktif'] as $f) $r[$f] = (int)$r[$f];
    $log = $pdo->query("SELECT l.waktu,l.pelaku_tipe,l.aksi,COALESCE(m.nama,a.nama,'Sistem') AS pelaku
        FROM log_aktivitas l LEFT JOIN mahasiswa m ON l.pelaku_tipe='mahasiswa' AND m.id=l.pelaku_id
        LEFT JOIN admin a ON l.pelaku_tipe='admin' AND a.id=l.pelaku_id
        WHERE l.aksi<>'login' ORDER BY l.id DESC LIMIT 8")->fetchAll();
    out(['ok' => true, 'kelas' => $rows, 'log' => $log, 'settings' => public_settings()]);
}

case 'admin_kelas': {
    need_admin();
    $r = db()->query('SELECT k.id,k.kode,k.nama,k.tim_aktif FROM kelas k JOIN mata_kuliah mk ON mk.id=k.mata_kuliah_id ORDER BY mk.nama,k.kode')->fetchAll();
    out(['ok' => true, 'kelas' => $r]);
}

case 'admin_mahasiswa': {
    need_admin();
    $q = trim((string)($_GET['q'] ?? '')); $kid = (int)($_GET['kelas'] ?? 0);
    $sql = 'SELECT m.id,m.nim,m.nama,m.no_hp,m.email,m.kelas_id,m.aktif,m.wajib_ganti_password AS wajib,k.kode AS kelas_kode,t.nama AS tim
            FROM mahasiswa m JOIN kelas k ON k.id=m.kelas_id
            LEFT JOIN tim_anggota ta ON ta.mahasiswa_id=m.id LEFT JOIN tim t ON t.id=ta.tim_id WHERE 1=1';
    $p = [];
    if ($kid) { $sql .= ' AND m.kelas_id=?'; $p[] = $kid; }
    if ($q !== '') { $sql .= ' AND (m.nim LIKE ? OR m.nama LIKE ?)'; $p[] = "%$q%"; $p[] = "%$q%"; }
    $sql .= ' ORDER BY k.kode, m.nim LIMIT 400';
    $st = db()->prepare($sql); $st->execute($p);
    $rows = $st->fetchAll();
    foreach ($rows as &$r) { $r['id'] = (int)$r['id']; $r['kelas_id'] = (int)$r['kelas_id']; $r['aktif'] = (int)$r['aktif']; $r['wajib'] = (int)$r['wajib']; }
    out(['ok' => true, 'mahasiswa' => $rows]);
}

case 'admin_mhs_simpan': {
    if ($method !== 'POST') fail('Metode tidak diizinkan.', 405);
    $adm = need_admin(); $b = input();
    $id = (int)($b['id'] ?? 0);
    $nim = trim((string)($b['nim'] ?? '')); $nama = trim((string)($b['nama'] ?? ''));
    $hp = trim((string)($b['no_hp'] ?? '')) ?: null; $email = trim((string)($b['email'] ?? '')) ?: null;
    $kelas = (int)($b['kelas_id'] ?? 0); $aktif = !empty($b['aktif']) ? 1 : 0;
    if (!preg_match('/^\d{6,20}$/', $nim)) fail('NIM harus angka (6–20 digit).');
    if ($nama === '') fail('Nama wajib diisi.');
    if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Format email tidak valid.');
    $pdo = db();
    $st = $pdo->prepare('SELECT id FROM kelas WHERE id=?'); $st->execute([$kelas]);
    if (!$st->fetch()) fail('Pilih kelas.');
    $st = $pdo->prepare('SELECT id FROM mahasiswa WHERE nim=? AND id<>?'); $st->execute([$nim, $id]);
    if ($st->fetch()) fail('NIM sudah terdaftar.');
    if ($id) {
        $st = $pdo->prepare('SELECT kelas_id FROM mahasiswa WHERE id=?'); $st->execute([$id]);
        $old = $st->fetchColumn();
        if ($old === false) fail('Mahasiswa tidak ditemukan.', 404);
        if ((int)$old !== $kelas) {
            $in = $pdo->prepare('SELECT ta.tim_id FROM tim_anggota ta WHERE ta.mahasiswa_id=?'); $in->execute([$id]);
            if ($in->fetch()) fail('Mahasiswa masih tergabung di sebuah tim. Keluarkan dari tim dulu sebelum pindah kelas.');
        }
        $pdo->prepare('UPDATE mahasiswa SET nim=?,nama=?,no_hp=?,email=?,kelas_id=?,aktif=? WHERE id=?')->execute([$nim, $nama, $hp, $email, $kelas, $aktif, $id]);
        logit('admin', $adm['id'], 'mhs_ubah', $nim);
    } else {
        $pdo->prepare('INSERT INTO mahasiswa (nim,nama,no_hp,email,kelas_id,password_hash,aktif) VALUES (?,?,?,?,?,?,?)')
            ->execute([$nim, $nama, $hp, $email, $kelas, password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT), $aktif]);
        logit('admin', $adm['id'], 'mhs_tambah', $nim);
    }
    out(['ok' => true]);
}

case 'admin_mhs_reset': {
    if ($method !== 'POST') fail('Metode tidak diizinkan.', 405);
    $adm = need_admin(); $id = (int)(input()['id'] ?? 0);
    $st = db()->prepare('UPDATE mahasiswa SET password_hash=?, wajib_ganti_password=1 WHERE id=?');
    $st->execute([password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT), $id]);
    logit('admin', $adm['id'], 'mhs_reset_password', (string)$id);
    out(['ok' => true]);
}

case 'admin_import': {
    if ($method !== 'POST') fail('Metode tidak diizinkan.', 405);
    $adm = need_admin(); $rows = input()['rows'] ?? [];
    if (!is_array($rows) || !$rows) fail('Tidak ada baris data.');
    if (count($rows) > 1000) fail('Maksimal 1000 baris per impor.');
    $pdo = db();
    $kmap = $pdo->query('SELECT kode,id FROM kelas')->fetchAll(PDO::FETCH_KEY_PAIR);
    $hash = password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT);
    $ok = 0; $skip = [];
    $chk = $pdo->prepare('SELECT 1 FROM mahasiswa WHERE nim=?');
    $ins = $pdo->prepare('INSERT INTO mahasiswa (nim,nama,no_hp,email,kelas_id,password_hash) VALUES (?,?,?,?,?,?)');
    foreach ($rows as $i => $r) {
        $nim = trim((string)($r['nim'] ?? '')); $nama = trim((string)($r['nama'] ?? ''));
        $kode = trim((string)($r['kelas'] ?? ''));
        $line = $i + 2;
        if (!preg_match('/^\d{6,20}$/', $nim) || $nama === '') { $skip[] = "Baris $line: NIM/nama tidak valid"; continue; }
        if (!isset($kmap[$kode])) { $skip[] = "Baris $line: kode kelas \"$kode\" tidak dikenal"; continue; }
        $chk->execute([$nim]);
        if ($chk->fetch()) { $skip[] = "Baris $line: NIM $nim sudah ada"; continue; }
        $ins->execute([$nim, $nama, trim((string)($r['no_hp'] ?? '')) ?: null, trim((string)($r['email'] ?? '')) ?: null, $kmap[$kode], $hash]);
        $ok++;
    }
    logit('admin', $adm['id'], 'mhs_impor', "$ok berhasil, " . count($skip) . ' dilewati');
    out(['ok' => true, 'berhasil' => $ok, 'dilewati' => array_slice($skip, 0, 20), 'jumlah_dilewati' => count($skip)]);
}

case 'admin_tim': {
    need_admin();
    $kid = (int)($_GET['kelas'] ?? 0);
    $st = db()->prepare('SELECT id FROM kelas WHERE id=?'); $st->execute([$kid]);
    if (!$st->fetch()) fail('Kelas tidak ditemukan.', 404);
    out(['ok' => true, 'tim' => tim_data($kid), 'settings' => public_settings()]);
}

case 'admin_tim_aksi': {
    if ($method !== 'POST') fail('Metode tidak diizinkan.', 405);
    $adm = need_admin(); $b = input();
    $tim_id = (int)($b['tim_id'] ?? 0); $aksi = (string)($b['aksi'] ?? ''); $mid = (int)($b['mahasiswa_id'] ?? 0);
    $pdo = db();
    $pdo->beginTransaction();
    $st = $pdo->prepare('SELECT * FROM tim WHERE id=? FOR UPDATE'); $st->execute([$tim_id]);
    $t = $st->fetch();
    if (!$t) { $pdo->rollBack(); fail('Tim tidak ditemukan.', 404); }
    if ($aksi === 'kosongkan') {
        $pdo->prepare('DELETE FROM tim_anggota WHERE tim_id=?')->execute([$tim_id]);
        $pdo->prepare('UPDATE tim SET ketua_id=NULL, versi=versi+1 WHERE id=?')->execute([$tim_id]);
    } elseif ($aksi === 'hapus_anggota') {
        $pdo->prepare('DELETE FROM tim_anggota WHERE tim_id=? AND mahasiswa_id=?')->execute([$tim_id, $mid]);
        $pdo->prepare('UPDATE tim SET ketua_id=IF(ketua_id=?,NULL,ketua_id), versi=versi+1 WHERE id=?')->execute([$mid, $tim_id]);
    } elseif ($aksi === 'set_ketua') {
        $st = $pdo->prepare('SELECT 1 FROM tim_anggota WHERE tim_id=? AND mahasiswa_id=?'); $st->execute([$tim_id, $mid]);
        if (!$st->fetch()) { $pdo->rollBack(); fail('Mahasiswa bukan anggota tim ini.'); }
        $pdo->prepare('UPDATE tim SET ketua_id=?, versi=versi+1 WHERE id=?')->execute([$mid, $tim_id]);
    } else { $pdo->rollBack(); fail('Aksi tidak dikenal.'); }
    logit('admin', $adm['id'], 'tim_' . $aksi, $t['nama'] . ' / mhs ' . $mid);
    $pdo->commit();
    out(['ok' => true]);
}

case 'admin_export': {
    need_admin();
    $kid = (int)($_GET['kelas'] ?? 0);
    $st = db()->prepare('SELECT k.kode,t.nama AS tim,m.nim,m.nama,m.no_hp,m.email,IF(t.ketua_id=m.id,"Ketua","Anggota") AS peran
        FROM tim_anggota ta JOIN tim t ON t.id=ta.tim_id JOIN kelas k ON k.id=t.kelas_id JOIN mahasiswa m ON m.id=ta.mahasiswa_id
        WHERE (?=0 OR k.id=?) ORDER BY k.kode,t.nomor,peran DESC,m.nama');
    $st->execute([$kid, $kid]);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="daftar-tim-' . date('Ymd-His') . '.csv"');
    $f = fopen('php://output', 'w');
    fwrite($f, "\xEF\xBB\xBF");
    fputcsv($f, ['Kelas', 'Tim', 'NIM', 'Nama', 'No HP', 'Email', 'Peran']);
    foreach ($st->fetchAll() as $r) {
        $r['nim'] = $r['nim']; fputcsv($f, array_values($r));
    }
    exit;
}

case 'admin_setting': {
    if ($method !== 'POST') fail('Metode tidak diizinkan.', 405);
    $adm = need_admin(); $b = input();
    $min = (int)($b['tim_min'] ?? 5); $max = (int)($b['tim_max'] ?? 7);
    if ($min < 1 || $max > 30 || $min > $max) fail('Batas anggota tidak valid (min ≤ maks).');
    $tenggat = trim((string)($b['tenggat'] ?? ''));
    if ($tenggat !== '' && strtotime($tenggat) === false) fail('Format tenggat tidak valid.');
    $up = db()->prepare('INSERT INTO pengaturan (kunci,nilai) VALUES (?,?) ON DUPLICATE KEY UPDATE nilai=VALUES(nilai)');
    $up->execute(['tim_min', (string)$min]); $up->execute(['tim_max', (string)$max]);
    $up->execute(['pendaftaran_buka', !empty($b['buka']) ? '1' : '0']);
    $up->execute(['tenggat', $tenggat !== '' ? date('Y-m-d H:i:s', strtotime($tenggat)) : '']);
    logit('admin', $adm['id'], 'pengaturan', json_encode($b));
    out(['ok' => true]);
}

case 'admin_kelas_toggle': {
    if ($method !== 'POST') fail('Metode tidak diizinkan.', 405);
    $adm = need_admin(); $b = input();
    db()->prepare('UPDATE kelas SET tim_aktif=? WHERE id=?')->execute([!empty($b['tim_aktif']) ? 1 : 0, (int)($b['kelas_id'] ?? 0)]);
    logit('admin', $adm['id'], 'kelas_toggle', json_encode($b));
    out(['ok' => true]);
}

default:
    fail('Perintah tidak dikenal.', 404);
}
} catch (PDOException $e) {
    error_log('[classhub] ' . $e->getMessage());
    fail('Terjadi kesalahan pada database. Pastikan database sudah diimpor dan config.php benar.', 500);
}

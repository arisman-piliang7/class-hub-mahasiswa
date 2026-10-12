-- ============================================================
--  Class Hub — skema database + data awal
--  Import lewat phpMyAdmin: tab "Import" -> pilih file ini -> Kirim
--  (database `class_hub` dibuat otomatis oleh file ini)
-- ============================================================
SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET FOREIGN_KEY_CHECKS = 0;

-- CREATE DATABASE IF NOT EXISTS `class_hub` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE `class_hub`;

DROP TABLE IF EXISTS `log_aktivitas`, `login_percobaan`, `tim_anggota`, `tim`, `mahasiswa`, `kelas`, `mata_kuliah`, `admin`, `pengaturan`;

-- Pengaturan global (aturan tim, buka/tutup pendaftaran, tenggat)
CREATE TABLE `pengaturan` (
  `kunci` VARCHAR(50) NOT NULL PRIMARY KEY,
  `nilai` VARCHAR(255) NOT NULL DEFAULT '',
  `diubah_pada` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Akun dosen / admin
CREATE TABLE `admin` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `nama` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `wajib_ganti_password` TINYINT(1) NOT NULL DEFAULT 1,
  `terakhir_login` DATETIME NULL,
  `dibuat_pada` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Master mata kuliah
CREATE TABLE `mata_kuliah` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `kode` VARCHAR(20) NOT NULL UNIQUE,
  `nama` VARCHAR(120) NOT NULL,
  `dibuat_pada` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Master kelas (satu baris = satu kelas perkuliahan)
CREATE TABLE `kelas` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `mata_kuliah_id` INT UNSIGNED NOT NULL,
  `kode` VARCHAR(30) NOT NULL UNIQUE,
  `nama` VARCHAR(150) NOT NULL,
  `sesi` VARCHAR(20) NULL,
  `angkatan` YEAR NULL,
  `jumlah_tim` TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `tim_aktif` TINYINT(1) NOT NULL DEFAULT 1,
  `dibuat_pada` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_kelas_mk` FOREIGN KEY (`mata_kuliah_id`) REFERENCES `mata_kuliah`(`id`) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Master data mahasiswa
CREATE TABLE `mahasiswa` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `nim` VARCHAR(20) NOT NULL UNIQUE,
  `nama` VARCHAR(150) NOT NULL,
  `no_hp` VARCHAR(25) NULL,
  `email` VARCHAR(150) NULL,
  `kelas_id` INT UNSIGNED NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `wajib_ganti_password` TINYINT(1) NOT NULL DEFAULT 1,
  `aktif` TINYINT(1) NOT NULL DEFAULT 1,
  `terakhir_login` DATETIME NULL,
  `dibuat_pada` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diubah_pada` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_mhs_kelas` (`kelas_id`),
  CONSTRAINT `fk_mhs_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Tim per kelas (Tim 1 .. Tim N)
CREATE TABLE `tim` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `kelas_id` INT UNSIGNED NOT NULL,
  `nomor` TINYINT UNSIGNED NOT NULL,
  `nama` VARCHAR(60) NOT NULL,
  `ketua_id` INT UNSIGNED NULL,
  `versi` INT UNSIGNED NOT NULL DEFAULT 0,
  `diubah_pada` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_tim_kelas_nomor` (`kelas_id`,`nomor`),
  CONSTRAINT `fk_tim_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tim_ketua` FOREIGN KEY (`ketua_id`) REFERENCES `mahasiswa`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Anggota tim (satu mahasiswa hanya boleh di satu tim)
CREATE TABLE `tim_anggota` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `tim_id` INT UNSIGNED NOT NULL,
  `mahasiswa_id` INT UNSIGNED NOT NULL,
  `bergabung_pada` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_anggota_mhs` (`mahasiswa_id`),
  KEY `idx_anggota_tim` (`tim_id`),
  CONSTRAINT `fk_anggota_tim` FOREIGN KEY (`tim_id`) REFERENCES `tim`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_anggota_mhs` FOREIGN KEY (`mahasiswa_id`) REFERENCES `mahasiswa`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Pembatasan percobaan login
CREATE TABLE `login_percobaan` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `identitas` VARCHAR(60) NOT NULL,
  `ip` VARCHAR(45) NOT NULL,
  `waktu` DATETIME NOT NULL,
  KEY `idx_lp` (`identitas`,`waktu`)
) ENGINE=InnoDB;

-- Jejak aktivitas (audit)
CREATE TABLE `log_aktivitas` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `waktu` DATETIME NOT NULL,
  `pelaku_tipe` ENUM('mahasiswa','admin','sistem') NOT NULL,
  `pelaku_id` INT UNSIGNED NULL,
  `aksi` VARCHAR(60) NOT NULL,
  `detail` TEXT NULL,
  `ip` VARCHAR(45) NULL,
  KEY `idx_log_waktu` (`waktu`)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------- DATA AWAL -------------------------
INSERT INTO `pengaturan` (`kunci`,`nilai`) VALUES
 ('tim_min','5'),('tim_max','7'),('pendaftaran_buka','1'),('tenggat','');

INSERT INTO `admin` (`username`,`nama`,`password_hash`) VALUES ('dosen','Dosen Pengampu','$2y$10$ha9gWjvdNZyBRPM/laQJR.g5IpvJ9ggxcGV0KA7sPOx.DX6DRBNzu');

INSERT INTO `mata_kuliah` (`id`,`kode`,`nama`) VALUES
(1,'ML','Pembelajaran Mesin'),
(2,'SO','Sistem Operasi');

INSERT INTO `kelas` (`id`,`mata_kuliah_id`,`kode`,`nama`,`sesi`,`angkatan`,`jumlah_tim`,`tim_aktif`) VALUES
(1,1,'AISD-A','Pembelajaran Mesin AISD-A','Sore',2024,10,1),
(2,1,'AISD-B','Pembelajaran Mesin AISD-B','Sore',2024,10,1),
(3,2,'SSD-A','Sistem Operasi SSD-A','Sore',2024,10,1),
(4,2,'SSD-B','Sistem Operasi SSD-B','Sore',2024,10,1);

INSERT INTO `tim` (`kelas_id`,`nomor`,`nama`) VALUES
(1,1,'Tim 1'),
(1,2,'Tim 2'),
(1,3,'Tim 3'),
(1,4,'Tim 4'),
(1,5,'Tim 5'),
(1,6,'Tim 6'),
(1,7,'Tim 7'),
(1,8,'Tim 8'),
(1,9,'Tim 9'),
(1,10,'Tim 10'),
(2,1,'Tim 1'),
(2,2,'Tim 2'),
(2,3,'Tim 3'),
(2,4,'Tim 4'),
(2,5,'Tim 5'),
(2,6,'Tim 6'),
(2,7,'Tim 7'),
(2,8,'Tim 8'),
(2,9,'Tim 9'),
(2,10,'Tim 10'),
(3,1,'Tim 1'),
(3,2,'Tim 2'),
(3,3,'Tim 3'),
(3,4,'Tim 4'),
(3,5,'Tim 5'),
(3,6,'Tim 6'),
(3,7,'Tim 7'),
(3,8,'Tim 8'),
(3,9,'Tim 9'),
(3,10,'Tim 10'),
(4,1,'Tim 1'),
(4,2,'Tim 2'),
(4,3,'Tim 3'),
(4,4,'Tim 4'),
(4,5,'Tim 5'),
(4,6,'Tim 6'),
(4,7,'Tim 7'),
(4,8,'Tim 8'),
(4,9,'Tim 9'),
(4,10,'Tim 10');

INSERT INTO `mahasiswa` (`nim`,`nama`,`no_hp`,`email`,`kelas_id`,`password_hash`) VALUES
('241111093','Devin Owen Sanusi','085924292951','devin.owen@students.mikroskil.ac.id',4,'$2y$10$deXa40hEhPQ9PjTPaWprjOx3lQGBAKA8tdYbGn/SzKTpQvhK5Wcsy'),
('241111106','Sean Ryo Valens Sahala','085211129076','sean.ryo@students.mikroskil.ac.id',4,'$2y$10$bxYT2q144ZTZ9pqfN3lAGO5iKHOF5vin4by/eDEgcphG7bnJ3kZOy'),
('241111234','Kendrick Lazuardy','08116328289','kendrick.lazuardy@students.mikroskil.ac.id',4,'$2y$10$rAaYR7pwLKHJNwRQhHQgQOxAvGOXLiDtp1wbXPn8RGzQri7QXaRGC'),
('241111252','Raymond Alberto Kang','081328378533','raymond.alberto@students.mikroskil.ac.id',4,'$2y$10$Ns8b/fKxNjTmbKlwTdev0e70CZXA9eIjRb/LIgMZ0/TQDq7IBlX3.'),
('241111268','Jassemine Tanziro','089520925148','jassemine.tanziro@students.mikroskil.ac.id',4,'$2y$10$x3ciJAqE2yosxsjV1F8FZe8TVAJ8EuiDkeCi/esgScyCFho7obzca'),
('241111280','Vincent Arifwan Widjaya','085275072820','vincent.arifwan@students.mikroskil.ac.id',4,'$2y$10$2zA7jq0weKDCwah9eW5SOes7ffJDy/4a58Uykf80rsrOcIy.woP5i'),
('241111300','Wesley','085358667990','wesley@students.mikroskil.ac.id',4,'$2y$10$fg7B2nAwYhxuzYiwvNu97ezD9QHC8HWdj7Ze6.TCKCyXTS5OstoZu'),
('241111340','Vincent Ramon Rijab','082161290707','vincent.ramon@students.mikroskil.ac.id',4,'$2y$10$zbZfd7p/Z/Qvh1uSMaGe/uvVkVNKgDQOCZsvhLG26/paw7gd9vI96'),
('241111422','Deidrich Zhu','081382789376','deidrich.zhu@students.mikroskil.ac.id',4,'$2y$10$.BCShePMRis9pvP.snKuVurTPXMnmRxJCDuXrW0R3V2FkROH05duy'),
('241111437','Nixon Culver','081263126051','nixon.culver@students.mikroskil.ac.id',4,'$2y$10$E94RDrfOUDvFMG8yqUB0m.K3DMIg2BlZ/NClDuoZceyM348xcPV76'),
('241111446','Farrel Bintang Safarringga','082360017019','farrel.bintang@students.mikroskil.ac.id',4,'$2y$10$hFg/EL3H1Q2CF1q.0VuetutPI9ysg115uMX98buGMdTojBvZUkkJ2'),
('241111461','Shawn Michael','0895601023378','shawn.michael@students.mikroskil.ac.id',4,'$2y$10$/pXBXn6H8N7lRGb08fp6reggr62hNhMKOkreLsxh5wftqljCOYVXK'),
('241111664','Nicholas Lungnata','081275367254','nicholas.lungnata@students.mikroskil.ac.id',4,'$2y$10$sEMpTddBwwDdl8qxxyt1WeUiiJmUE2A6sA1MhcnO82q9tKboYmpdu'),
('241111704','Saravanan','081370072864','saravanan@students.mikroskil.ac.id',4,'$2y$10$otHMKeZSXDioY.giEwoxTeYwEJwuHAhD2YFRIbqfSKzerID15A5JK'),
('241111802','Gylbert Mars Antonius','082244115494','gylbert.mars@students.mikroskil.ac.id',4,'$2y$10$L9/2EUwlqPMi6/48u2lIseYROKCEYmyCRs.XtAn3t1HJL80Ir4/2y'),
('241112002','Ryu Kierando','08116057239','ryu.kierando@students.mikroskil.ac.id',4,'$2y$10$iCHHvperVRmp87.nMilkUeN2zAfJdIRZR/Khuv/yGq/iZVkxQ7wMe'),
('241112044','Stephanus Hartanto','082289644702','stephanus.hartanto@students.mikroskil.ac.id',4,'$2y$10$LtDX/zbu7apNjtiq4RFUle/gz4kMKYG4q0ZwBtJIxzBq0OjNwhuHW'),
('241112050','Andreas Jhonatan','085655734367','andreas.jhonatan@students.mikroskil.ac.id',4,'$2y$10$Y4depbfnSYTYS56jrqasa.srLFs5A45wTTRwF3IOYC9eHA2CCgobG'),
('241112087','Carita Angel Samudra Tjoatja','082361845858','carita.angel@students.mikroskil.ac.id',4,'$2y$10$IFWEV9ytaFSYyIt34MevoeqfiRwO0UZQtBwHZFLRtU3/jtS6YtQUq'),
('241112192','Riyanti Teresa','085260571911','riyanti.teresa@students.mikroskil.ac.id',4,'$2y$10$U8Pqg412qFnlrhs5HFDGdemoq5hOZIUpyXXZ59ZNwMsUBcpF/8oPm'),
('241112201','Mhd. Abimanyu Saraan','0895335386435','mhd.abimanyu@students.mikroskil.ac.id',4,'$2y$10$NnIxAu5z2rxHhENcJyEuzup01WeFYThStaLxzRrfaMZVky2F0dvWa'),
('241112232','Kelvin Kurniawan','089512809452','kelvin.kurniawan@students.mikroskil.ac.id',4,'$2y$10$w5PuRJdC4cnps1uAaUJQLOyJShy8fA7ucpxLg4xh7vrb8CVRknuVq'),
('241112271','Anggara Adelee','089653667157','anggara.adelee@students.mikroskil.ac.id',4,'$2y$10$vuPk23.faP2Nmod4Dse6uupIb3k0Vm1S.fNQ/z6c3Me10cmHSgrzS'),
('241112358','Frendy Finalie','08116233186','frendy.finalie@students.mikroskil.ac.id',4,'$2y$10$fnlefyvvxxGY2Q46bbG8nOvWbT/IO1ulZLikrT7ms5S5RYhm3zSfC'),
('241112498','Nachelle Ferari','085261102114','nachelle.ferari@students.mikroskil.ac.id',4,'$2y$10$MepawALp4EiJ49Sf.3RAzejllRQempMXkWsGKDDm8Ot41Qqk0JyMK'),
('241112555','Vincent','081374611021','vincent4@students.mikroskil.ac.id',4,'$2y$10$mZMwKjkXfq8POt1F/9VA..mTTtkYAIj0teZ3P.dWlTjL/HVSg39.m'),
('241112564','Eka Anastsya Situmorang','083867040250','eka.anastsya@students.mikroskil.ac.id',4,'$2y$10$i4MSycsZAJNx2PxglFNX9OT8mCWOLuUhTTZAQFkMw01CsJ/BwPkwe'),
('241112584','Therania','082362027218','therania@students.mikroskil.ac.id',4,'$2y$10$MfGTt9UsFw/Yaxrk1leUWu.pIv3frLMfriVEFq2M/oYLWowy4Phhy'),
('241112659','Steven Lienardi','082274000707','steven.lienardi@students.mikroskil.ac.id',4,'$2y$10$Y3DkaQI2RMU5lwimJWsjdOuIEQVC0LoNQpItRSyc8JJbZw9hpv5UK'),
('241112797','Victoria Lusiana Manullang','082163517489','victoria.lusiana@students.mikroskil.ac.id',4,'$2y$10$fYyYxmSXKE54WUjnO2lrheH3SmgpSu8gNQ.Tf8iZs51O8NUQUXisu'),
('241112834','Michael','089604449407','michael3@students.mikroskil.ac.id',4,'$2y$10$h9dv2cRL9yVx0reyKFRe2uksLX07B.9b3x3iYpOd.Hy0WTcBm3Zti'),
('241112966','Siska Clarissa','08116513328','siska.clarissa@students.mikroskil.ac.id',4,'$2y$10$QsE1mK5/AbNt1UodC6yI4OR.yCf7U.yoagzL307xLDHT.6EyEmOtq'),
('241112979','Rega Rivalga Wijaya','082216980976','rega.rivalga@students.mikroskil.ac.id',4,'$2y$10$vKL0ZF/B90NLWvb/TsMfueZ49nM6TT42OxCzIMcjrQYhtpcZncUUa'),
('241110028','Jeneva Calista Chandra','083893833433','jeneva.calista@students.mikroskil.ac.id',3,'$2y$10$jSclfU0bz1Eio0AUGkRfVun0MfAEnhgLIfCD0P91GCdt6e/kawJBK'),
('241110035','Hans Valerie','082364740138','hans.valerie@students.mikroskil.ac.id',3,'$2y$10$ov8F/DijJHs4VGsXRr2CaeqY0CwmabvOXvMh3G/la9qS/Map6QyGe'),
('241110083','Aelberth Cheong','085156462870','aelberth.cheong@students.mikroskil.ac.id',3,'$2y$10$F7.ASn5ZFPAZCjKWxFuOfeQOSBb3CDvhroMbGKkxYf29JKFyYgxD.'),
('241110102','Vincent Lawi','083169042237','vincent.lawi@students.mikroskil.ac.id',3,'$2y$10$za9QY7qYbSsiES6XMRYA5Okeehj.NRXZ88iXFkHQKR6fqM.a.35yW'),
('241110161','Gilbert Gunawan','085175333328','gilbert.gunawan@students.mikroskil.ac.id',3,'$2y$10$5qFLBNlZDGVN.3xRXbdlquEWAyPWEf9Ll6/ZxmYOEwPV8N21moSum'),
('241110182','Jessica Gunawan','081266448530','jessica.gunawan@students.mikroskil.ac.id',3,'$2y$10$63tDEsEYXjER3QYZcKO39e88GvhIhGz1.wlvY4xtFnNM54Es6KBE6'),
('241110236','Richie Sanjiro','081333655290','richie.sanjiro@students.mikroskil.ac.id',3,'$2y$10$Hj69P4UMpv.OyOrSX5cv6.15c.MuajGJhfG1HeDMqdT61CYQgAWTm'),
('241110272','Julius Einstein Chandra','085156699240','julius.einstein@students.mikroskil.ac.id',3,'$2y$10$A6jALir6GgqmK58NHXGSoOt.VXx3EMnFhQZ5jRnwG/A5bTDVU2rB2'),
('241110332','Jensen','081269937701','jensen@students.mikroskil.ac.id',3,'$2y$10$HF9WjJVNuxlH7FxHfL9l.uA60b3ymonRTHewlrimfIi2l0DRWLpQq'),
('241110371','Zakky Pratama','+6281396596137','zakky.pratama@students.mikroskil.ac.id',3,'$2y$10$.7qQdqImI2ehsQGxjs9Uiu3Q1KcQ1talDFobITsDvmFgKwCgc2sEO'),
('241110411','Frederico Evan Heandi','081214230352','frederico.evan@students.mikroskil.ac.id',3,'$2y$10$5mz9Xz1fgNCoD1CWAUDEW.bJtI/pOLBG1k1wUtrwfsV4L6b5b0KHK'),
('241110460','Filbert Matthew','081274183515','filbert.matthew@students.mikroskil.ac.id',3,'$2y$10$rcIUkvHw4OgYYqNlyctCbu4vhCzKgwJVv5U.u5/ZT4BDWN7aOZfmy'),
('241110476','Stan Kovic','081260837290','stan.kovic@students.mikroskil.ac.id',3,'$2y$10$mvjHr0RMxOWedVCtKqS0zuU2MdHFtcubqAox8aCX/2n4xoia56Z3G'),
('241110485','Ulya Salsabila','085272267980','ulya.salsabila@students.mikroskil.ac.id',3,'$2y$10$Nts9HOfu0pGNEtEau0onM.h63ypWE5j0aBf1T.nubgDd.vsbDkyEy'),
('241110524','Alvred Andrew Anggrawhi','082387272039','alvred.andrew@students.mikroskil.ac.id',3,'$2y$10$VDzXuVPjrENvtsDf9F8BGOzY.MHwzsWTOo7USUNZwu9RzxIs6yK5u'),
('241110567','Jhonson Hartawan Halim','085370578899','jhonson.hartawan@students.mikroskil.ac.id',3,'$2y$10$K0JPAcFWOZlDT6RTMlpSy.7kLhQOm8rQifD1WVyZA9Ou4iuc6qqLq'),
('241110597','Cherish Evangeline','085359431662','cherish.evangeline@students.mikroskil.ac.id',3,'$2y$10$RPE2hnlVRz7RemghHpxste1DsyR/azSkq4.6GGsLkKZ2fToGeFQqq'),
('241110609','Wellson','083197779191','wellson@students.mikroskil.ac.id',3,'$2y$10$ScRNxwVptJL9QgOmOu6yGu5v4xWICn3K28Yyw84WFjdpdoGD90odC'),
('241110679','Michael Christoffer Chu','085372676481','michael.christoffer@students.mikroskil.ac.id',3,'$2y$10$3aErHzCE0cRZuw5i4qLj6OQviYWvYoEvTTuS1oSAEPCQ.11534PRa'),
('241110684','Ricardo Dendrik','081537519727','ricardo.dendrik@students.mikroskil.ac.id',3,'$2y$10$Mfzik8IpsHM9Lcs7icv2..BXqaoj3b3S94GlMQP7Ku70p8q3fxY/2'),
('241110730','Jay Arnold Lingga','085274292446','jay.arnold@students.mikroskil.ac.id',3,'$2y$10$wUw469PWavg1qlA9JzKCeO1gVK7EN7DLD85Bc5woBf9LVOksQYgBC'),
('241110752','Florentina','082172693379','florentina@students.mikroskil.ac.id',3,'$2y$10$FCdA8ccYRFW2N3Uux553fuvirnCMW8FBsq/bpPpnJj/pEQdxOpBTe'),
('241110764','Angelica Anastasia Manurung','088262392155','angelica.anastasia@students.mikroskil.ac.id',3,'$2y$10$kW5nMMcmCIypE/T6VWcTnu3S7OzoRdsDnzl/zFAAWkbkp3X8.f7Vq'),
('241110805','Laurencio Luckson','0895624174455','laurencio.luckson@students.mikroskil.ac.id',3,'$2y$10$.voZFnHXFwTBGpsT8UPXguGhgMFTNURXKu/ZBykySUY/03kyemsxq'),
('241110810','Edbert Chandra','082213999844','edbert.chandra@students.mikroskil.ac.id',3,'$2y$10$7/G8Z7ahRq80T.bPs.mykuFaJbTkx8r07RX0m/EawASfv/Ud3XhuS'),
('241110868','Justin Wisely','085100296599','justin.wisely@students.mikroskil.ac.id',3,'$2y$10$CuQ0x9NMpNxnqp8wUwbVb.27NVeCCc/XpNsEEqmnfDsH78oGBH8V.'),
('241110910','Fendy','081269162405','fendy@students.mikroskil.ac.id',3,'$2y$10$oVab.J1PuxEwpRrIuarPw.JwymiWk2KaF7VpaE8waaSB3ubsyKFXm'),
('241110926','Catherine Tania','081269019227','catherine.tania@students.mikroskil.ac.id',3,'$2y$10$81fmaAt.yr0PAMpQls747ukKL/8Hmdw007cDkt/Mc8w9FiL3jNJou'),
('241110939','Ethan Wilbert','081269751768','ethan.wilbert@students.mikroskil.ac.id',3,'$2y$10$eeEisZwa93qTnUqjygyvLON559t7NRFDJqgcFJK1qlOH9UlMuSTo.'),
('241110962','Evan Adhyaksa Baskara','082262201550','evan.adhyaksa@students.mikroskil.ac.id',3,'$2y$10$JuqLNmMmXHb5bVTQ6d5fQO1n.0asjeefZqUaW9Qe/xOa8iVQlyqXS'),
('241110982','Kindy Lim','085358688859','kindy.lim@students.mikroskil.ac.id',3,'$2y$10$ICdvrgnba13sLrfnOOvPweIN.XIW7hDdMB9QQORWBzMGbi/ud.L4S'),
('241111021','Sastrawan','085270964956','sastrawan@students.mikroskil.ac.id',3,'$2y$10$NqFpNrfOSJB2KmpG9/g8/e/MrLvgW1L5e2fLuyaoK832UDfkIcvC2'),
('241111056','Louis Fortino','088260095176','louis.fortino@students.mikroskil.ac.id',3,'$2y$10$6sSYPX/dCI0Pk.xaJvMITe5YCHKrM2Xx0lEb7o8FgK/s/2jL4Kizq'),
('241111080','Vian William Kurniawan','085837617932','vian.william@students.mikroskil.ac.id',3,'$2y$10$hu0.WDsXNxArxob69BEJ/ub42wjZyckVxBF3XPCnO4XPewikoGDzW'),
('241110007','William Wiryawan','081360003266','william.wiryawan@students.mikroskil.ac.id',1,'$2y$10$5y.NZMXb0n0bmahhdhxae.URkQJzcrueiR8DXPcqSYZFdSSePE2RG'),
('241110011','Nova Sanada','082380000168','nova.sanada@students.mikroskil.ac.id',1,'$2y$10$p7bIaj8FSZH21ZOe8ZUUweEONoWP/UpslLfBkaA.TsltrK.lC9EA2'),
('241110043','Wilhan','087830930988','wilhan@students.mikroskil.ac.id',1,'$2y$10$aNtMH1d7bSVDzxpAQY/TYen6BDa5OTeKASqV9Lc8VMnxKX3fyl7G6'),
('241110058','Nelvin Claudius','085262638988','nelvin.claudius@students.mikroskil.ac.id',1,'$2y$10$Jis3IszG9iqC5Wu9xcx8iOtyTxfT3WIck/1Yb6R2OM4PD7nHWq0R.'),
('241110066','Nicholian Tjuarsa','085212646688','nicholian.tjuarsa@students.mikroskil.ac.id',1,'$2y$10$xKcv9o8Sa9GycVBSCg4yqedXUowXkgaBr5raWrRAhLrVT1d.Hxh4S'),
('241110098','Fernando Putra Wijaya','087738123672','fernando.putra@students.mikroskil.ac.id',1,'$2y$10$ce4RjNGtoBMX1L6e78rztOvqhgERTSgmPzkPm71sdMXsfAOd1XJEm'),
('241110119','Felix Valentino','082276769990','felix.valentino@students.mikroskil.ac.id',1,'$2y$10$7EnlCZNSJNNPp88IYDE1rODs2bk/gbmPa5XzKfAXMvO7iNC4dRJay'),
('241110121','Gybert','082162103327','gybert@students.mikroskil.ac.id',1,'$2y$10$mSIkhfDFLNjkY1k3ObAmL.7aWxo3wHeDjGt8oQXLM/pNH8tAMeWqm'),
('241110135','Felicia Tania','085370501208','felicia.tania@students.mikroskil.ac.id',1,'$2y$10$4Kcz8c6FDkjCmDGt5JMa0eVl1pvJ0.IDHbSMosHRgTiUznWJs2sKS'),
('241110144','Dicky Taruna','085372712025','dicky.taruna@students.mikroskil.ac.id',1,'$2y$10$YC5QtNmLNrC7G7BKHL92WeVS9vdcY8ytmwJ/x7FJqZKL0CrT/MiHS'),
('241110159','Vincent Oswaldo Tio','085179717561','vincent.oswaldo@students.mikroskil.ac.id',1,'$2y$10$uKbx.LlQjRS4l/3R591EN.zeX9/35.z6NF85I/qtBaCW/8nOIZOLa'),
('241110173','Evenly Chelsea Wahid','081360368347','evenly.chelsea@students.mikroskil.ac.id',1,'$2y$10$sQJWYJWcgWHW6uzngClim.GuR6aoi0CJcQcJ1TcWuJ.FhUpanjUay'),
('241110202','Vincent Lim','089620237119','vincent.lim@students.mikroskil.ac.id',1,'$2y$10$xlBzwFyh06VU1/P70y8ypeVRVdkJyB/ckf5NG.8gAQQ/RAGtbVFTu'),
('241110227','Stefani Evelyn Sukamto','085270204622','stefani.evelyn@students.mikroskil.ac.id',1,'$2y$10$WlukbmPfGRvxeP/uNclO9OzXIeSOCZ2doqWDM1fDsgks0zoALpHSK'),
('241110249','Anthony Louis','082272457103','anthony.louis@students.mikroskil.ac.id',1,'$2y$10$TGprif5eVetrdfDizLM8QeuwRXmVAqWhCrv41yLdusHcWNM.XI/5C'),
('241110258','Richie Hujaya','089609430543','richie.hujaya@students.mikroskil.ac.id',1,'$2y$10$dbn.09Bd5gPcRb.EjHviDuUcJyVgRDqEYN4LK8RV5gu5aRzN9HyhW'),
('241110265','Trevan Edgard','082267431262','trevan.edgard@students.mikroskil.ac.id',1,'$2y$10$6veWLtP3Pn1u0WkPTg4wwOeficthuGsbdgIuN.P3Xpgbbp8AJFnj2'),
('241110287','Angie Diora Jeam','082164910415','angie.diora@students.mikroskil.ac.id',1,'$2y$10$KyYYMLBWIEBA676Rofs3oucC/22vERWzS6W0JknP.8daqS4sAalgy'),
('241110325','Berthan Chitara','082163630812','berthan.chitara@students.mikroskil.ac.id',1,'$2y$10$u5Jy4kf/ikaugmu7ED0Ht.tkRgypZDEXel0pjFEHhTgtArHgkK7Ya'),
('241110357','Felixander Ting','082362026958','felixander.ting@students.mikroskil.ac.id',1,'$2y$10$cTAclcG.YUfzGO0U5WuUq.CGkLelOXN3qtM5jmBS5XankMIoS65fu'),
('241110363','Jimmy Wijaya','085262227101','jimmy.wijaya@students.mikroskil.ac.id',1,'$2y$10$DgdeST5nWYZdQ4GWinA7X.R4KaAB/D60rY1XzFV4DP9QD0zh/OgNO'),
('241110385','Gillbert Allison Wijaya','085100303495','gillbert.allison@students.mikroskil.ac.id',1,'$2y$10$6WNYw9I/ZybzS6jWz9Dg7erD6rzzpFTM77nT8TuE14NTtx/Pvn1am'),
('241110393','Gilbert','0895395846446','gilbert2@students.mikroskil.ac.id',1,'$2y$10$43F3e.rrpYVWOKuUpuehzOZl2t.sPweCPWEA5Gxrcm1e/QnDPYMqi'),
('241110402','Hermes Agistrian Laoli','0895611340514','hermes.agistrian@students.mikroskil.ac.id',1,'$2y$10$.aa7lWFEeFtYS71xdvUEl.nIzL1Mu.IgbNM3onWXfxvOsuEgAYiHi'),
('241110423','Winsley Kamarudin','082382057178','winsley.kamarudin@students.mikroskil.ac.id',1,'$2y$10$dRT/AoZRo1C/c44sdzK3ruOkIHyxTcDmkYVFJ/UQfQDezWqUxNy66'),
('241110430','Felix Chowandra','089519200353','felix.chowandra@students.mikroskil.ac.id',1,'$2y$10$FCPInt.PpWZUqQFhPtaBSegH6oAk1cCKsT5rN4YoqcdXbZi0XT7by'),
('241110442','Cheristine Kayla','089522865030','cheristine.kayla@students.mikroskil.ac.id',1,'$2y$10$R./MNDo6fZAQtmW2xhzuVOWrr/60mp18lkAsI8afuDj8AmxY28iGK'),
('241110459','Fredy Johnaphan','085106720338','fredy.johnaphan@students.mikroskil.ac.id',1,'$2y$10$.ly8KNI53g3veUHIfY3R/.r.pVXfuF94GSHc57ZgadoIU0q8YY3Mq'),
('241110494','Vincent Halim','088807882489','vincent.halim@students.mikroskil.ac.id',1,'$2y$10$Pzb6uVz/SjVfWusJVj.S5O9zx7/IuIO4an6JjPyEx8.nN8rVeMa4y'),
('241110506','Owen Wijaya','0895611410162','owen.wijaya@students.mikroskil.ac.id',1,'$2y$10$TNOiT66fAPq6ObsUYrdc6eb9AcEfx4aWi2OQhxmj/5fnoIMUjvESy'),
('241110541','Devin Gunawan','089668613438','devin.gunawan@students.mikroskil.ac.id',1,'$2y$10$BYy49GyhUS0HbbRnHtGSW.uKPZAWpFKp005zq6Lbmqf7t5TOXZT/C'),
('241110553','Felix Wong','085362908522','felix.wong@students.mikroskil.ac.id',1,'$2y$10$5sl9R0F/sg.znFD03U79NenUlXgJ1/1qii3/jhWu.GmwBGDXfezRm'),
('241110584','Jacintha Aurelia','085262013624','jacintha.aurelia@students.mikroskil.ac.id',1,'$2y$10$WyipnPokejIwEsy4j4gcLu16PUhLYIvkIS3btg68/aSAKMAbn88lq'),
('241110625','Fredericko','08116558588','fredericko@students.mikroskil.ac.id',1,'$2y$10$sI8jtn/J4EZL4LB0WkkuBegs.BdL.xadvogYZmbFEbZN5dZRkh9wK'),
('241110637','Bryan Chandra','089627397638','bryan.chandra@students.mikroskil.ac.id',1,'$2y$10$nwnwNHSWNjaS4B8213QEvusS8Rv9sfY95x2uKJqzBiRnzoY/4gGOO'),
('241110643','Nicholas Halim','087894670170','nicholas.halim@students.mikroskil.ac.id',1,'$2y$10$Ra5VhoxslSkt0JvazBizte/hOKjgnSVwq22XNFKN7o5EBZhkXOxk6'),
('241110658','Peter Lin','081265222220','peter.lin@students.mikroskil.ac.id',1,'$2y$10$1UER.4W.iYKcD517w8/btuhv8zJxoOboKdJ0ioYEcmV6bae5hFthC'),
('241110711','Calvin Kenjiro','082174842347','calvin.kenjiro@students.mikroskil.ac.id',1,'$2y$10$6kcfWlXXtFuXaD.Aj0yL.uwWIPKJvkiqcyMR7.Y3aKihn1Wm16XPe'),
('241110728','Jasmine Arily','081315649822','jasmine.arily@students.mikroskil.ac.id',1,'$2y$10$whFmI2BIbfSwWLUIbtYLJuLdxVT62frAmKrgScsFZzMZfgo2hDorS'),
('241110791','Vincent','081376777035','vincent2@students.mikroskil.ac.id',1,'$2y$10$QiXMuARKD9oZ.mAykXDKdu/EOVV8WeaArTe01sTL8zSu4F3pTQnVa'),
('241110826','Elbert','082284565385','elbert@students.mikroskil.ac.id',1,'$2y$10$YBOGMqNABfZaxCbOgZAvouMuaUJp9NXpmJpsFYeXOknLTJYfLk46O'),
('241110842','Everlita Evenlyn','082111111479','everlita.evenlyn@students.mikroskil.ac.id',1,'$2y$10$17dwQohHDfD7kdDgoofY7ehTRkDIYsyn4DutdEM.u0vD/Po4geNke'),
('241110859','Nikita Ho','081263526055','nikita.ho@students.mikroskil.ac.id',1,'$2y$10$4qr1763ElWgenSF8NZ308u2lVa2gyhkougRWHotBa9/d7mUJrLn9q'),
('241110875','Vincent Jordan Yu','081776000906','vincent.jordan@students.mikroskil.ac.id',1,'$2y$10$w2rEudF3W5ABAx/x7gyRdezZjziZ5.ipOkEm1JjxCVpMC9PPFKbaa'),
('241110882','Vennedy Hong','081278891905','vennedy.hong@students.mikroskil.ac.id',1,'$2y$10$CG4Id8l3CnpPtDBh4vjA.O9qfUZyfpPd4tJXYL5dXWXVKL.qBAbTm'),
('241110896','Ervian Mentari','082298912017','ervian.mentari@students.mikroskil.ac.id',1,'$2y$10$n0uDvnSszrQx7aDC0zeJgeNFa/npBSEH4l9MzsiHk1bUxpmUIRrbe'),
('241110908','David Tandersen','081266919101','david.tandersen@students.mikroskil.ac.id',1,'$2y$10$E0g062akuT/xd6QE7YPWveaO1L5doVLrs6eQXRBFrU0emNaD.iahe'),
('241110957','Semina','082274078600','semina@students.mikroskil.ac.id',1,'$2y$10$IGoq0qd1zigg6bKa3lZJ/.Lov1DApq9QtLzLOuZ2IdKh.XkKNaeR6'),
('241112411','Hendy','081361163184','hendy@students.mikroskil.ac.id',1,'$2y$10$Xe2q3vGwgmXJaryb8QbUI.8siWOLpOc2HtrkfNNfUrGbFi.Upbjra'),
('241110977','Louis Susanto',NULL,'louis.susanto@students.mikroskil.ac.id',1,'$2y$10$AiXHZA8/gAMjiUg2K34QGOfiy.mpAXkaJmfWzEpAEDkqSE8mSnIXi'),
('241110782','Jason Kho','083157632150','jason.kho@students.mikroskil.ac.id',2,'$2y$10$05DmfZYvlrTLTCOyzSo1sOoqv6ls8YlLNkyIwCVBJqYd8uapqjfOi'),
('241110995','Romario Satyo','085207012345','romario.satyo@students.mikroskil.ac.id',2,'$2y$10$B2CmUd5C1m/Eqfry8WZMzeVsiN58sap2aQ7d9anHM1jzR3rMnLnSW'),
('241111003','Devita Andriany Fendy','085178514563','devita.andriany@students.mikroskil.ac.id',2,'$2y$10$/vFdZaxeLHPhMelTwuK9QelOqdoLLYLMmfcfQJhAr2GtW1lvoqNHK'),
('241111038','Marlon Lie','082122380469','marlon.lie@students.mikroskil.ac.id',2,'$2y$10$L1XtKlAQ6FwKWHg91YaV9eEBoWAbMv.OqPm.wr4u026zxGk5CXwL2'),
('241111041','Arvin Jacklim','081262878678','arvin.jacklim@students.mikroskil.ac.id',2,'$2y$10$GDrWBeT6NLcJDPkewhrEkezi3jLgbwR7XXDKn4NkKHBjZtwqK3UP.'),
('241111078','Dicky Sasqia','085276112680','dicky.sasqia@students.mikroskil.ac.id',2,'$2y$10$2HgFZf0G8x.IM5kbPLl62OteB8YMoAixcWtWIERSz1hyjDfTGKqV6'),
('241111115','Calvin Kirawan','085767856387','calvin.kirawan@students.mikroskil.ac.id',2,'$2y$10$w45BzFCO.nKuIiaHUIqQH.3MjJBu6OE1PDI2exmfrppXnpTvir/i.'),
('241111123','Kevin Halim','082360968996','kevin.halim@students.mikroskil.ac.id',2,'$2y$10$UVamdtZtw0PK..62FFQNweaZOHC3Y5gn4j/qJQT24u.yJ03MVSy3W'),
('241111131','William Tonata','085176740520','william.tonata@students.mikroskil.ac.id',2,'$2y$10$k3vGABtpykfvWtqKIen8QeiLY7M1T1ssiH1soYb3VFDB7Gab4H.mC'),
('241111143','Suryanata Yaptanto','082176741300','suryanata.yaptanto@students.mikroskil.ac.id',2,'$2y$10$XwhyMntxhMemsFCx0MjERugc2RP/a3EHZYr3eIY/tbuBnfv85T512'),
('241111178','Louise Emilio Jonathan','082399339886','louise.emilio@students.mikroskil.ac.id',2,'$2y$10$S2U99.Qcd5RoHDQCDLLjlenqOxBWCth.HekwyIIFU9znmywI2MD2u'),
('241111204','Melvin Tan','081397743129','melvin.tan@students.mikroskil.ac.id',2,'$2y$10$kane1kNdvaOgm/sJmoJdQOsx7CqVd56JZ25IBuWlsOiZrZPp9Tyj2'),
('241111218','Stevania','085260394617','stevania@students.mikroskil.ac.id',2,'$2y$10$qUWCOK5hZpTfpve4mwncSumm1K8Vw62VLl3ffQaTPKJIZYj3CiQw6'),
('241111315','Luciano Hendriko Sihura','08216754789','luciano.hendriko@students.mikroskil.ac.id',2,'$2y$10$h/i8AAlCwt1MTvZPccn3SuAzkjWCkR4UCpRMpqBi0DgHgBKC3uW3G'),
('241111355','Jevincho','082180255995','jevincho@students.mikroskil.ac.id',2,'$2y$10$5eEpqGKsKp83lYE9QZIgsund4UNOaRIvjcjjsqfOvacdMJ8T0Spj.'),
('241111387','Jensen Wijaya','087713472649','jensen.wijaya@students.mikroskil.ac.id',2,'$2y$10$bsMW3UH7ONGYhPm/2SODT.NRiWH14/cP0qxpv2ARkpW7Enu0mUyYS'),
('241111489','Jonathan Wijaya','085370359510','jonathan.wijaya2@students.mikroskil.ac.id',2,'$2y$10$ZgFXqNfDqy.CNRcFQIQRUebHgT0PxCWFgscS2DYl5vdj5WXo5aH.2'),
('241111527','Felix Arlen Tivano','089687563779','felix.arlen@students.mikroskil.ac.id',2,'$2y$10$kN4fQua/psoUYVXY20B.LeZEMJBn3HV5jguZRJtbon6qyHWlq.Tp6'),
('241111564','Reagan','081271691239','reagan@students.mikroskil.ac.id',2,'$2y$10$JCvufsJSA18HHz9pRGdZaOkyvWu8XCC5Wa7RJ6cpCA.ptTxQzxU.2'),
('241111583','Wilson Rusli','083838912327','wilson.rusli@students.mikroskil.ac.id',2,'$2y$10$dUnRn/9Z.LRigQgA0vYNGOUPMmv6uyiHFiOzsiqCQotxMvKjlc7mC'),
('241111590','Vincent','082184269417','vincent3@students.mikroskil.ac.id',2,'$2y$10$s29YnHePUaEhsyMX2xI4SewMsIVu8oz5ZRiSqsVQPQIt9BNYrJuKS'),
('241111605','Chiquita Jesslyn Giantito','081376072085','chiquita.jesslyn@students.mikroskil.ac.id',2,'$2y$10$QBJafRmcQ0QbbLRn23oWUOXu6QYTs63K1mvjpyLhJl3lp/hn87P0G'),
('241111649','Victor Valentino','08116316681','victor.valentino@students.mikroskil.ac.id',2,'$2y$10$YILz3m5VszEPEmn/xlT8RutMzJ2D8Yxe4opxn0moAFdTq5Xk5PwTu'),
('241111684','Vincent Roderick','081376888936','vincent.roderick@students.mikroskil.ac.id',2,'$2y$10$hdr4CcNloWwyr3R2GBNY3eVvdLH8NVQQkEMWk1XeYxJKPrZGHkApu'),
('241111738','Riddick','087831265297','riddick@students.mikroskil.ac.id',2,'$2y$10$WpSc43KmXL0WNz4jVKx5KeYpHJWKogaNx4cEiScXjlDT40smgn7zW'),
('241111772','Breonna Castell','0819622222','breonna.castell@students.mikroskil.ac.id',2,'$2y$10$Y1fZuZgteqMdNxX0q9RRSO4fCd4NS8jRD9reani9fi8/2o/tcFhXq'),
('241111817','Jerisco Geraldine','082274197020','jerisco.geraldine@students.mikroskil.ac.id',2,'$2y$10$XcJt83YmvagWOgUJBcKG/Oot84KRwL34qQBPlsVZqXyjo.jiLPqd2'),
('241111821','Rolan Wijaya','0895601385159','rolan.wijaya@students.mikroskil.ac.id',2,'$2y$10$XfoR4UXWUgUUCMqxpdyL7uXiwqeobDHxfIY1aI/Dh/qa.N5AZOghO'),
('241111842','Selly Safira Putri','082170854388','selly.safira@students.mikroskil.ac.id',2,'$2y$10$jRfJyI66KgqLz0kDuiibQO7HaEjZLknL.1JBH0Hh0.0QK2vsUD9Vy'),
('241111967','Grace Christiani','087878171014','grace.christiani@students.mikroskil.ac.id',2,'$2y$10$0J7tj1sG97c12pltGi1aYuu3rrCGPJNC./MF60o20724y0tABtkYy'),
('241111987','Wilson Jacklim. S','081370666856','wilson.jacklim@students.mikroskil.ac.id',2,'$2y$10$MF7lnxL9Mw5HW16wOph6nuG0au1Oqs30yun0rAVHE1m5cAXAPM4tu'),
('241111993','Figo Kosasih','081262699907','figo.kosasih@students.mikroskil.ac.id',2,'$2y$10$ZNH2UPkOxi1K1OlBL2734uFD9IFZmz4eA469KnrJDspTVOssRFQja'),
('241112170','John Herbert','08116335773','john.herbert@students.mikroskil.ac.id',2,'$2y$10$neN3yJhFw/yQkkCQzZx6N.tmTGkynEs9nPjtDSjTcZmxn9Y7F42DG'),
('241112250','Ryan Aurelio Angsari','082160556522','ryan.aurelio@students.mikroskil.ac.id',2,'$2y$10$GBCHilakM2Be5B.lWHFNNu6ibAKhx9o6m6dLPntYDu8PgBGwr3Dle'),
('241112326','Arza Fawazi','082281663245','arza.fawazi@students.mikroskil.ac.id',2,'$2y$10$aXmU2me72OSjdNEhGvUM2edh5V9Avrr9XNNothLLAinAOGiC2hn0m'),
('241112436','Joseph Billy Tandy','081284775789','joseph.billy@students.mikroskil.ac.id',2,'$2y$10$Mj7ZMmFZIkvDMfJ9vfPCye7sAtwFdlVyUgzCdpXnRVRVFjGkO/efW'),
('241112440','Irma Tiara','085262759982','irma.tiara@students.mikroskil.ac.id',2,'$2y$10$ejvbhCIR3gZZBf.VyxsHxuHsrdHW4Z94Q0FkI6BddExGl/qs2WAPe'),
('241112519','Vanessa','0895628640605','vanessa3@students.mikroskil.ac.id',2,'$2y$10$7YbYeTNubKiHcXH.cNr2beMvg9.J2SoWqvGxQ33Tqnq54JB7DrHdy'),
('241112546','Alvin Armando','089652151907','alvin.armando@students.mikroskil.ac.id',2,'$2y$10$1aFxr8AWVWXUXaJ25oNF4OX.Qf.pthtpSF1/k5wKuSlFQu8eTdGn6'),
('241112603','Winnata Mulianto Halim','085922989291','winnata.mulianto@students.mikroskil.ac.id',2,'$2y$10$mRfmezvtI7LXbefnCWlVqetO3E7Cqm1dM7xa7Db31hfqTfbp1vEV.'),
('241112662','Natasya Kristine','085668287633','natasya.kristine@students.mikroskil.ac.id',2,'$2y$10$0p/jcysWaJ/Zlp2elpYz6OPXzeFULcS7niKALcxR/TfRQ4vR98jBC'),
('241112699','Meyggy','089621760668','meyggy@students.mikroskil.ac.id',2,'$2y$10$6ycNC4btwLeZ2nr9sN8of.XHVkmcQ4E06NCmrcJ7ItqO1txIPdeR6'),
('241112730','Calvin Prayogo','081397204069','calvin.prayogo@students.mikroskil.ac.id',2,'$2y$10$V/LoJB5jcWjUdY.vxMpN1eTvO6YcyJTyq3o1fYs.MzBv6mwiFK2QW'),
('241112820','Jenisa Lauren','082273266215','jenisa.lauren@students.mikroskil.ac.id',2,'$2y$10$oVKl5LUA5JAvdv8FFniGrO/7hDAfM/G5.eneeSTEk2V3/Be6yKjdS'),
('241112931','Pauline Angelicca Grechen','081314081407','pauline.angelicca@students.mikroskil.ac.id',2,'$2y$10$e9mfjfxvLxj4CXI29GZdMeQ47XlD/8XdLcGO5KyUIGVn4RwxKsipq'),
('241112984','Jonathan Felix Fubrianto','088807824924','jonathan.felix@students.mikroskil.ac.id',2,'$2y$10$AlFaDQ0vmm9nBq.gJlP6heG9hmmWQSt/A5mE.pRsgWR0umavBzgW.'),
('241112991','Richardo Raymon','0812-1822-1020','richardo.raymon@students.mikroskil.ac.id',2,'$2y$10$uDDVTNdvO9G7WKiy9q9BsOQnNx/ku/hixCmyKU91kwdUQzKBtFhbG');

'use strict';
/* =========================================================
   Class Hub — front-end (vanilla JS)
   ========================================================= */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ic  = n => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const wide = () => matchMedia('(min-width:1001px)').matches;

let CSRF = '', ME = null, SET = {}, APP = {nama: 'Class Hub', sub: ''};
const S = {page: '', timer: null, clock: null};

/* ---------------- util ---------------- */
async function api(a, {method = 'GET', body, params = {}} = {}) {
  const qs = new URLSearchParams({a, ...params});
  let res;
  try {
    res = await fetch('api.php?' + qs, {
      method, credentials: 'same-origin',
      headers: {'Content-Type': 'application/json', 'X-CSRF-Token': CSRF},
      body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
    });
  } catch (e) { throw Object.assign(new Error('Tidak dapat terhubung ke server. Periksa koneksi Anda.'), {status: 0}); }
  let d = null;
  try { d = await res.json(); } catch (e) {}
  if (!res.ok || !d || d.ok === false) {
    const err = Object.assign(new Error((d && d.error) || 'Terjadi kesalahan pada server.'), {status: res.status});
    if (res.status === 401 && ME) { ME = null; toast('Sesi berakhir', 'Silakan masuk kembali.', 'info'); showLogin(); }
    throw err;
  }
  return d;
}
function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function initials(n) { const p = String(n).trim().split(/\s+/); return ((p[0] || '')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function bigAvatar(n) { return avatar(n).replace('class="avatar" style="','class="avatar" style="width:54px;height:54px;font-size:18px;'); }
function avatar(n) { const h = hue(n); return `<div class="avatar" style="background:linear-gradient(145deg,hsl(${h} 78% 64%),hsl(${(h + 40) % 360} 70% 48%))">${esc(initials(n))}</div>`; }
function fmtDT(s) { if (!s) return '—'; const d = new Date(String(s).replace(' ', 'T')); return d.toLocaleString('id-ID', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}); }
function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const loading = `<div class="loading"><div class="spin"></div></div>`;

function toast(title, msg = '', type = 'ok') {
  const col = {ok: 'c-green', err: 'c-pink', info: 'c-blue'}[type] || 'c-blue';
  const icn = {ok: 'check', err: 'alert', info: 'info'}[type] || 'info';
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="ti ${col}">${ic(icn)}</div><div><b>${esc(title)}</b>${msg ? `<span>${esc(msg)}</span>` : ''}</div>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, type === 'err' ? 6500 : 3800);
}

function openSheet(html, {dismiss = true} = {}) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="sheet glass" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(ov);
  const close = () => { document.removeEventListener('keydown', onKey); ov.remove(); };
  const onKey = e => { if (e.key === 'Escape' && dismiss) close(); };
  document.addEventListener('keydown', onKey);
  if (dismiss) ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  $$('[data-close]', ov).forEach(b => b.addEventListener('click', close));
  const f = $('input,select,button.primary', ov); if (f) setTimeout(() => f.focus(), 60);
  return {el: ov, close};
}
function confirmBox(title, msg, ok = 'Lanjutkan', danger = false) {
  return new Promise(res => {
    const s = openSheet(`<h2>${esc(title)}</h2><p class="muted">${esc(msg)}</p>
      <div class="acts"><button class="btn" data-close>Batal</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cf-ok">${esc(ok)}</button></div>`);
    let done = false;
    $('#cf-ok', s.el).addEventListener('click', () => { done = true; s.close(); res(true); });
    new MutationObserver((_, o) => { if (!document.body.contains(s.el)) { o.disconnect(); if (!done) res(false); } }).observe(document.body, {childList: true});
  });
}
async function withBusy(btn, fn) {
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>`;
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
}

/* ---------------- tema & jam ---------------- */
function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('ch-theme', t); } catch (e) {} const b = $('#theme-btn'); if (b) b.innerHTML = ic(t === 'dark' ? 'sun' : 'moon'); }
function toggleTheme() { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); }
const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function tickClock() {
  const d = new Date(), hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  const c = $('#lock-clock'); if (c) c.textContent = `${hh}:${mm}`;
  const dt = $('#lock-date'); if (dt) dt.textContent = `${hari[d.getDay()]}, ${d.getDate()} ${bulan[d.getMonth()]}`;
  const m = $('#mb-clock'); if (m) m.textContent = `${hari[d.getDay()].slice(0, 3)} ${d.getDate()} ${bulan[d.getMonth()].slice(0, 3)}  ${hh}:${mm}`;
}
function startClock() { clearInterval(S.clock); tickClock(); S.clock = setInterval(tickClock, 5000); }

/* ---------------- login ---------------- */
function showLogin() {
  clearInterval(S.timer);
  $('#root').innerHTML = `
  <div class="lock-tools"><button class="mb-btn" id="theme-btn" aria-label="Ganti tema"></button></div>
  <main class="lock">
    <div class="time"><div class="date" id="lock-date"></div><div class="clock" id="lock-clock"></div></div>
    <form class="login glass" id="lf" autocomplete="on">
      <div class="logo">${ic('logo')}</div>
      <h1>${esc(APP.nama)}</h1>
      <p class="hint">${esc(APP.sub)}</p>
      <label class="field"><span>NIM</span><input class="inp" id="lu" name="username" inputmode="text" autocomplete="username" autocapitalize="none" placeholder="Contoh: 241110007" required></label>
      <label class="field"><span>Password</span>
        <div class="inp-wrap"><input class="inp" id="lp" name="password" type="password" autocomplete="current-password" placeholder="Password" required>
        <button type="button" class="eye" id="lpe" aria-label="Tampilkan password">${ic('eye')}</button></div></label>
      <div class="err" id="le" role="alert"></div>
      <button class="btn primary" type="submit">Masuk</button>
    </form>
    <p class="foot-note">Pertama kali masuk? Gunakan password kolektif dari dosen, lalu segera ganti.</p>
  </main>`;
  setTheme(document.documentElement.dataset.theme);
  $('#theme-btn').onclick = toggleTheme;
  startClock();
  $('#lpe').onclick = () => { const p = $('#lp'), show = p.type === 'password'; p.type = show ? 'text' : 'password'; $('#lpe').innerHTML = ic(show ? 'eyeoff' : 'eye'); };
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#lf button[type=submit]'); $('#le').textContent = '';
    try {
      const d = await withBusy(btn, () => api('login', {method: 'POST', body: {username: $('#lu').value, password: $('#lp').value}}));
      CSRF = d.csrf; ME = d.user; SET = d.settings; startApp();
    } catch (err) { $('#le').textContent = err.message; $('#lp').select(); }
  };
}

/* ---------------- shell ---------------- */
const NAV = {
  mahasiswa: [['beranda', 'home', 'Beranda', 'c-blue'], ['tim', 'users', 'Pendaftaran Tim', 'c-green'], ['profil', 'user', 'Profil', 'c-purple']],
  admin: [['ringkasan', 'chart', 'Ringkasan', 'c-blue'], ['mahasiswa', 'user', 'Mahasiswa', 'c-orange'], ['tim', 'users', 'Tim', 'c-green'], ['pengaturan', 'settings', 'Pengaturan', 'c-gray']],
};
function startApp() {
  const nav = NAV[ME.tipe];
  $('#root').innerHTML = `
  <div id="app">
    <header class="menubar">
      <div class="brand"><i class="logo"></i>${esc(APP.nama)}</div>
      <nav id="mb-nav">${nav.map(n => `<button data-go="${n[0]}">${esc(n[2])}</button>`).join('')}</nav>
      <div class="sp"></div>
      <div class="who">${esc(ME.nama)}</div>
      <button class="mb-btn" id="theme-btn" aria-label="Ganti tema"></button>
      <div class="mb-clock" id="mb-clock"></div>
    </header>
    <div class="stage"><section class="window glass" aria-live="polite">
      <div class="titlebar"><div class="lights" aria-hidden="true"><i></i><i></i><i></i></div>
        <h1 id="tb-title"></h1><span class="sub" id="tb-sub"></span><div class="sp"></div><div id="tb-actions" style="display:flex;gap:8px"></div></div>
      <div class="content" id="content"></div>
    </section></div>
    <nav class="dock glass" id="dock" aria-label="Navigasi utama">
      ${nav.map(n => `<button class="d-item" data-go="${n[0]}" aria-label="${esc(n[2])}"><span class="tip">${esc(n[2])}</span><span class="d-ico ${n[3]}">${ic(n[1])}</span><span class="lbl">${esc(n[2].replace('Pendaftaran ', ''))}</span><span class="dot"></span></button>`).join('')}
      <span class="sep"></span>
      <button class="d-item" id="d-out" aria-label="Keluar"><span class="tip">Keluar</span><span class="d-ico c-pink">${ic('logout')}</span><span class="lbl">Keluar</span><span class="dot"></span></button>
    </nav>
  </div>`;
  setTheme(document.documentElement.dataset.theme);
  $('#theme-btn').onclick = toggleTheme;
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  $('#d-out').onclick = logout;
  startClock();
  dockMagnify();
  if (ME.wajib_ganti) go(nav[0][0]);
  else go(location.hash.slice(1) && nav.some(n => n[0] === location.hash.slice(1)) ? location.hash.slice(1) : nav[0][0]);
}
function dockMagnify() {
  const dock = $('#dock');
  if (!matchMedia('(hover:hover) and (pointer:fine) and (min-width:721px)').matches) return;
  const items = $$('.d-item', dock);
  dock.addEventListener('mousemove', e => items.forEach(it => {
    const r = it.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2));
    it.style.transform = `scale(${1 + .42 * Math.max(0, 1 - d / 120)})`;
  }));
  dock.addEventListener('mouseleave', () => items.forEach(it => it.style.transform = ''));
}
async function logout() {
  try { await api('logout', {method: 'POST'}); } catch (e) {}
  ME = null; CSRF = ''; S.page = ''; history.replaceState(null, '', location.pathname);
  const d = await api('boot'); CSRF = d.csrf; showLogin();
}
const TITLES = {
  beranda: ['Beranda', ''], tim: ['Pendaftaran Tim', ''], profil: ['Profil & Keamanan', ''],
  ringkasan: ['Ringkasan', 'Dosen'], mahasiswa: ['Data Mahasiswa', 'Master data'], pengaturan: ['Pengaturan', 'Dosen'],
};
function go(page) {
  if (ME.wajib_ganti && !$('.overlay')) openPwSheet(true);
  clearInterval(S.timer); S.page = page; location.hash = page;
  $$('[data-go]').forEach(b => { const on = b.dataset.go === page; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  let t = TITLES[page] || ['', '']; if (ME.tipe === 'admin' && page === 'tim') t = ['Tim per Kelas', 'Dosen'];
  const nm = ME.tipe === 'mahasiswa' && page === 'tim' ? ME.kelas_kode : t[1];
  $('#tb-title').textContent = t[0]; $('#tb-sub').textContent = nm; $('#tb-actions').innerHTML = '';
  const c = $('#content'); c.className = 'content'; c.scrollTop = 0; c.innerHTML = loading;
  const fn = (ME.tipe === 'admin' ? ADMIN_PAGES : MHS_PAGES)[page];
  fn().catch(err => { c.innerHTML = `<div class="empty">${ic('alert')}<b>Gagal memuat</b><span>${esc(err.message)}</span><button class="btn" id="retry">Coba lagi</button></div>`; $('#retry').onclick = () => go(page); });
}

/* ---------------- ganti password ---------------- */
function pwScore(p) { let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++; return s; }
function pwFields(prefix) {
  return `
  <label class="field"><span>Password saat ini</span><input class="inp" type="password" id="${prefix}-old" autocomplete="current-password" required></label>
  <label class="field"><span>Password baru</span><input class="inp" type="password" id="${prefix}-new" autocomplete="new-password" placeholder="Minimal 8 karakter, huruf dan angka" required></label>
  <div class="meter-pw" id="${prefix}-m"><i></i><i></i><i></i><i></i></div>
  <label class="field"><span>Ulangi password baru</span><input class="inp" type="password" id="${prefix}-rep" autocomplete="new-password" required></label>
  <div class="small" id="${prefix}-e" role="alert" style="color:#d92d22;font-weight:600;min-height:18px"></div>`;
}
function pwWire(prefix, onDone) {
  const cols = ['var(--red)', 'var(--amber)', '#c8c03a', 'var(--green)'];
  $(`#${prefix}-new`).addEventListener('input', e => { const s = pwScore(e.target.value); $$(`#${prefix}-m i`).forEach((b, i) => b.style.background = i < s ? cols[Math.max(0, s - 1)] : ''); });
  return async btn => {
    const e = $(`#${prefix}-e`); e.textContent = '';
    const lama = $(`#${prefix}-old`).value, baru = $(`#${prefix}-new`).value, rep = $(`#${prefix}-rep`).value;
    if (baru !== rep) { e.textContent = 'Ulangi password baru dengan sama persis.'; return; }
    try {
      await withBusy(btn, () => api('ganti_password', {method: 'POST', body: {lama, baru}}));
      ME.wajib_ganti = false; toast('Password diperbarui', 'Gunakan password baru saat masuk berikutnya.'); onDone && onDone();
    } catch (err) { e.textContent = err.message; }
  };
}
function openPwSheet(forced) {
  const s = openSheet(`<h2>${forced ? 'Ganti password dulu' : 'Ganti password'}</h2>
    ${forced ? '<p class="muted">Kamu masuk dengan password kolektif. Buat password pribadi agar akunmu aman.</p>' : ''}
    <form id="pw-f" style="display:flex;flex-direction:column;gap:12px">${pwFields('pf')}
    <div class="acts">${forced ? '' : '<button type="button" class="btn" data-close>Batal</button>'}<button class="btn primary" type="submit">Simpan password</button></div></form>`, {dismiss: !forced});
  const submit = pwWire('pf', () => { s.close(); if (S.page === 'beranda' || S.page === 'profil') go(S.page); });
  $('#pw-f', s.el).onsubmit = e => { e.preventDefault(); submit($('button[type=submit]', s.el)); };
}

/* =========================================================
   HALAMAN MAHASISWA
   ========================================================= */
const MHS_PAGES = {};
MHS_PAGES.beranda = async () => {
  const d = await api('tim_kelas'); SET = d.settings;
  const total = d.mahasiswa.length, bertim = d.mahasiswa.filter(m => m.tim_id).length;
  const mine = d.tim.find(t => t.id === d.tim_saya);
  const pct = total ? Math.round(bertim / total * 100) : 0;
  const closed = !SET.buka || SET.tenggat_lewat || !d.tim_aktif;
  const first = ME.nama.split(' ')[0];
  const jam = new Date().getHours(), sapa = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam';
  const ketua = mine && mine.anggota.find(a => a.id === mine.ketua_id);
  $('#content').innerHTML = `<div class="page">
    <div class="hello"><h2>${sapa}, ${esc(first)}</h2><p>${esc(ME.mata_kuliah)} · Kelas ${esc(ME.kelas_kode)}</p></div>
    <div class="widgets">
      <div class="card w wide">
        <div class="k">${ic('users')} Tim saya</div>
        ${mine ? `<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
            <div class="ring" style="--p:${mine.anggota.length / SET.tim_max * 100}"><span>${mine.anggota.length}/${SET.tim_max}</span></div>
            <div style="flex:1;min-width:160px"><div class="big">${esc(mine.nama)}</div>
            <div class="muted">${ketua ? `Ketua: <b style="color:var(--tx)">${esc(ketua.nama)}</b>` : 'Ketua belum dipilih'}</div>
            <div style="margin-top:8px"><span class="badge ${mine.anggota.length >= SET.tim_min ? 'green' : 'amber'}">${mine.anggota.length >= SET.tim_min ? 'Anggota memenuhi syarat' : 'Belum memenuhi syarat'}</span></div></div>
          </div>`
        : `<div class="big">Belum bergabung</div><p class="muted">Pilih salah satu dari ${d.tim.length} tim, lalu tambahkan namamu. Satu tim berisi ${SET.tim_min}–${SET.tim_max} anggota.</p>`}
        <div style="margin-top:auto"><button class="btn primary" data-go2="tim">${ic('users')} ${mine ? 'Lihat atau ubah tim' : 'Daftar tim'}</button></div>
      </div>
      <div class="card w">
        <div class="k">${ic('chart')} Teman sekelas yang sudah bertim</div>
        <div style="display:flex;align-items:center;gap:16px"><div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
          <div class="muted">${bertim} dari ${total} mahasiswa<br>kelas ${esc(ME.kelas_kode)}</div></div>
      </div>
      <div class="card w">
        <div class="k">${ic('cal')} Pendaftaran</div>
        <div class="big" style="font-size:24px">${closed ? 'Ditutup' : 'Dibuka'}</div>
        <span class="badge ${closed ? 'red' : 'green'}" style="align-self:flex-start">${closed ? 'Tidak bisa mengubah tim' : 'Bisa mendaftar dan mengubah tim'}</span>
        <p class="muted small" style="margin-top:auto">${SET.tenggat ? 'Tenggat: ' + esc(fmtDT(SET.tenggat)) : 'Belum ada tenggat yang ditetapkan.'}</p>
      </div>
      <div class="card w">
        <div class="k">${ic('user')} Data saya</div>
        <dl class="kv"><dt>NIM</dt><dd>${esc(ME.nim)}</dd><dt>Kelas</dt><dd>${esc(ME.kelas_kode)}${ME.sesi ? ' · ' + esc(ME.sesi) : ''}</dd><dt>Mata kuliah</dt><dd>${esc(ME.mata_kuliah)}</dd></dl>
      </div>
    </div></div>`;
  $$('[data-go2]').forEach(b => b.onclick = () => go(b.dataset.go2));
};

MHS_PAGES.profil = async () => {
  $('#content').innerHTML = `<div class="page"><div class="grid2">
    <div class="card"><h2 style="margin-bottom:12px">Data mahasiswa</h2>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">${bigAvatar(ME.nama)}
      <div><b style="font-size:16px">${esc(ME.nama)}</b><div class="muted">${esc(ME.nim)}</div></div></div>
      <dl class="kv"><dt>Mata kuliah</dt><dd>${esc(ME.mata_kuliah)}</dd><dt>Kelas</dt><dd>${esc(ME.kelas_nama)}</dd><dt>No. HP</dt><dd>${esc(ME.no_hp || '—')}</dd><dt>Email</dt><dd>${esc(ME.email || '—')}</dd></dl>
      <p class="muted small" style="margin-top:12px">Ada data yang keliru? Sampaikan ke dosen pengampu.</p></div>
    <form class="card" id="pw-page" style="display:flex;flex-direction:column;gap:12px"><h2>${ic('lock')} Ganti password</h2>${pwFields('pp')}
      <button class="btn primary" type="submit" style="align-self:flex-start">Simpan password</button></form>
  </div></div>`;
  const submit = pwWire('pp', () => $$('#pw-page input').forEach(i => i.value = ''));
  $('#pw-page').onsubmit = e => { e.preventDefault(); submit($('#pw-page button[type=submit]')); };
};

/* ---------- Pendaftaran Tim ---------- */
const T = {tim: [], mhs: [], timSaya: null, timAktif: true, sel: null, draft: null, q: '', filter: 'all', view: 'tim', saving: false};
const curTim = () => T.tim.find(t => t.id === T.sel);
const mById = id => T.mhs.find(m => m.id === id);
const timNo = id => (T.tim.find(t => t.id === id) || {}).nomor;
const isClosed = () => !SET.buka || SET.tenggat_lewat || !T.timAktif;
function resetDraft() { const t = curTim(); T.draft = {ids: t.anggota.map(a => a.id), ketua: t.ketua_id, versi: t.versi}; }
function isDirty() {
  const t = curTim(); if (!t || !T.draft) return false;
  const a = [...T.draft.ids].sort().join(','), b = t.anggota.map(x => x.id).sort().join(',');
  return a !== b || (T.draft.ketua || null) !== (t.ketua_id || null);
}
async function loadTim() {
  const d = await api('tim_kelas'); SET = d.settings;
  T.tim = d.tim; T.mhs = d.mahasiswa; T.timSaya = d.tim_saya; T.timAktif = d.tim_aktif;
  if (!curTim()) T.sel = T.timSaya || (T.tim[0] && T.tim[0].id);
}
MHS_PAGES.tim = async () => {
  T.q = ''; T.filter = 'all'; T.view = 'tim'; T.sel = null;
  await loadTim(); resetDraft();
  const c = $('#content'); c.className = 'content fill';
  $('#tb-actions').innerHTML = `<button class="btn sm ghost" id="t-ref" aria-label="Muat ulang">${ic('refresh')}<span class="small">Muat ulang</span></button>`;
  c.innerHTML = `
    <div class="timseg"><div class="seg" role="tablist"><button data-v="mhs">Mahasiswa</button><button data-v="tim">Tim</button></div></div>
    <div class="timwrap" id="timwrap" data-view="tim">
      <section class="pane pane-mhs">
        <div class="pane-h">
          <div class="row1"><h2>1 · Daftar mahasiswa</h2><span class="badge" id="m-count"></span></div>
          <label class="search">${ic('search')}<input class="inp" id="m-q" type="search" placeholder="Cari NIM atau nama" aria-label="Cari NIM atau nama" autocomplete="off"></label>
          <div class="seg" style="align-self:flex-start"><button data-f="all" class="on">Semua</button><button data-f="free">Belum bertim</button></div>
        </div>
        <div class="plist" id="m-list"></div>
        <div class="mhs-foot"><span class="small muted" id="m-foot"></span><button class="btn sm primary" data-v="tim">Lihat tim</button></div>
      </section>
      <section class="pane pane-tim">
        <div class="pane-h" style="padding-bottom:0;border:0"><div class="row1"><h2>2 · Pilih tim</h2><span class="small muted">${T.tim.length} tim · ${SET.tim_min}–${SET.tim_max} anggota</span></div></div>
        <div class="chips" id="chips" role="tablist" aria-label="Pilih tim"></div>
        <div class="roster" id="roster"></div>
        <div class="rost-f" id="rfoot"></div>
      </section>
    </div>`;
  $('#t-ref').onclick = async () => { if (isDirty() && !await confirmBox('Buang perubahan?', 'Perubahan yang belum disimpan akan hilang.', 'Muat ulang', true)) return; await loadTim(); resetDraft(); renderTimAll(); toast('Data dimuat ulang'); };
  $('#m-q').oninput = e => { T.q = e.target.value; renderMhsList(); };
  $$('.seg [data-f]').forEach(b => b.onclick = () => { T.filter = b.dataset.f; $$('.seg [data-f]').forEach(x => x.classList.toggle('on', x === b)); renderMhsList(); });
  $$('[data-v]', c).forEach(b => b.onclick = () => setView(b.dataset.v));
  $('#m-list').onclick = e => {
    const add = e.target.closest('[data-add]'), rm = e.target.closest('[data-rm]');
    if (add) addMember(+add.dataset.add); if (rm) removeMember(+rm.dataset.rm);
  };
  $('#chips').onclick = async e => {
    const b = e.target.closest('[data-tim]'); if (!b || +b.dataset.tim === T.sel) return;
    if (isDirty() && !await confirmBox('Pindah tim?', 'Perubahan pada tim ini belum disimpan dan akan hilang.', 'Pindah', true)) return;
    T.sel = +b.dataset.tim; resetDraft(); renderTimAll();
  };
  $('#roster').onclick = e => {
    const rm = e.target.closest('[data-rm]'), k = e.target.closest('[data-ketua]'), emp = e.target.closest('[data-empty]');
    if (rm) removeMember(+rm.dataset.rm);
    if (k) { T.draft.ketua = +k.dataset.ketua; renderRoster(); }
    if (emp && !wide()) setView('mhs');
  };
  $('#rfoot').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'r-self') addMember(ME.id);
    if (b.id === 'r-reset') { resetDraft(); renderTimAll(); }
    if (b.id === 'r-open') { T.sel = +b.dataset.tim; resetDraft(); renderTimAll(); }
    if (b.id === 'r-save') await saveTim(b);
  };
  $('#roster').addEventListener('click', e => { const b = e.target.closest('#r-open2'); if (b) { T.sel = T.timSaya; resetDraft(); renderTimAll(); } });
  renderTimAll();
  S.timer = setInterval(async () => {
    if (document.hidden || S.page !== 'tim' || T.saving || $('.overlay')) return;
    try { const dirty = isDirty(); const keep = T.draft; await loadTim(); if (dirty && curTim() && curTim().versi === keep.versi) T.draft = keep; else resetDraft(); renderTimAll(); } catch (e) {}
  }, 20000);
};
function setView(v) { T.view = v; $('#timwrap').dataset.view = v; $$('.timseg [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v)); }
function renderTimAll() { setView(T.view); renderChips(); renderMhsList(); renderRoster(); }

function renderChips() {
  const max = SET.tim_max, min = SET.tim_min;
  $('#chips').innerHTML = T.tim.map(t => {
    const n = t.anggota.length, st = n === 0 ? '' : n >= max ? 'full' : n >= min ? 'ok' : 'part';
    return `<button class="chip ${t.id === T.sel ? 'on' : ''} ${t.id === T.timSaya ? 'mine' : ''}" role="tab" aria-selected="${t.id === T.sel}" data-tim="${t.id}" title="${t.id === T.timSaya ? 'Tim saya' : ''}">
      <i class="st ${st}"></i>${esc(t.nama)}<small>${n}/${max}</small></button>`;
  }).join('');
}
function canRemove(id) {
  const t = curTim(); const iMember = t.anggota.some(a => a.id === ME.id);
  return !isClosed() && (iMember || !t.anggota.some(a => a.id === id));
}
function renderMhsList() {
  const q = T.q.trim().toLowerCase(), inDraft = new Set(T.draft.ids), full = T.draft.ids.length >= SET.tim_max, closed = isClosed();
  let list = T.mhs.filter(m => (!q || m.nim.includes(q) || m.nama.toLowerCase().includes(q)) && (T.filter === 'all' || (m.tim_id == null && !inDraft.has(m.id))));
  $('#m-count').textContent = list.length === T.mhs.length ? `${T.mhs.length} orang` : `${list.length} dari ${T.mhs.length}`;
  const t = curTim(); $('#m-foot').textContent = t ? `${t.nama} · ${T.draft.ids.length}/${SET.tim_max}` : '';
  if (!list.length) { $('#m-list').innerHTML = `<div class="empty">${ic('search')}<b>Tidak ada hasil</b><span>Coba NIM atau nama yang lain.</span></div>`; return; }
  $('#m-list').innerHTML = list.map(m => {
    const mine = m.id === ME.id, d = inDraft.has(m.id);
    let act;
    if (d) act = `<span class="badge blue">${ic('check')} Di ${esc(t.nama)}</span>${canRemove(m.id) ? `<button class="btn sm icon ghost" data-rm="${m.id}" aria-label="Keluarkan ${esc(m.nama)}">${ic('x')}</button>` : ''}`;
    else if (m.tim_id && m.tim_id !== T.sel) act = `<span class="badge">Tim ${timNo(m.tim_id)}</span>`;
    else act = `<button class="btn sm" data-add="${m.id}" ${full || closed ? 'disabled' : ''} aria-label="Tambahkan ${esc(m.nama)}">${ic('plus')} Tambah</button>`;
    return `<div class="prow ${mine ? 'me' : ''} ${m.tim_id && m.tim_id !== T.sel && !d ? 'dim' : ''}">${avatar(m.nama)}<div class="info"><div class="nm">${esc(m.nama)}</div><div class="nim">${esc(m.nim)}</div></div><div style="display:flex;align-items:center;gap:4px">${act}</div></div>`;
  }).join('');
}
function addMember(id) {
  const d = T.draft; if (isClosed() || d.ids.includes(id)) return;
  if (d.ids.length >= SET.tim_max) return toast('Tim sudah penuh', `Maksimal ${SET.tim_max} anggota.`, 'err');
  d.ids.push(id); if (!d.ketua) d.ketua = id; renderTimAll();
}
function removeMember(id) {
  const d = T.draft; if (!canRemove(id)) return;
  d.ids = d.ids.filter(x => x !== id); if (d.ketua === id) d.ketua = null; renderTimAll();
}
function renderRoster() {
  const t = curTim(), d = T.draft, n = d.ids.length, min = SET.tim_min, max = SET.tim_max, closed = isClosed();
  const iMember = t.anggota.some(a => a.id === ME.id), iInDraft = d.ids.includes(ME.id);
  const other = T.timSaya && T.timSaya !== t.id ? T.tim.find(x => x.id === T.timSaya) : null;
  const dirty = isDirty(), valid = n >= min && n <= max && d.ketua && d.ids.includes(d.ketua);
  let note = '';
  if (closed) note = `<div class="notice warn">${ic('lock')}<span>${!T.timAktif ? 'Pendaftaran tim belum dibuka untuk kelasmu.' : SET.tenggat_lewat ? 'Tenggat pendaftaran sudah lewat.' : 'Pendaftaran sedang ditutup oleh dosen.'} Kamu hanya bisa melihat data tim.</span></div>`;
  else if (other && !iMember) note = `<div class="notice warn">${ic('info')}<span>Kamu sudah terdaftar di <b>${esc(other.nama)}</b>. Untuk pindah ke ${esc(t.nama)}, keluarkan dirimu dari ${esc(other.nama)} dulu (tim itu harus tetap berisi minimal ${min} anggota). <button class="btn sm" id="r-open2" style="margin-left:6px">Buka ${esc(other.nama)}</button></span></div>`;
  else if (!iMember && !iInDraft) note = `<div class="notice">${ic('info')}<span>Tambahkan namamu agar bisa bergabung ke ${esc(t.nama)}.</span></div>`;
  const slots = [];
  for (let i = 0; i < max; i++) {
    const m = d.ids[i] != null ? mById(d.ids[i]) : null;
    if (m) {
      const k = d.ketua === m.id;
      slots.push(`<div class="slot">${avatar(m.nama)}<div class="info"><div class="nm">${esc(m.nama)}${m.id === ME.id ? ' <span class="badge blue" style="height:18px;font-size:11px">Saya</span>' : ''}</div><div class="nim">${esc(m.nim)}</div></div>
        <button class="star ${k ? 'on' : ''}" data-ketua="${m.id}" ${closed ? 'disabled' : ''} aria-pressed="${k}" aria-label="${k ? 'Ketua tim' : 'Jadikan ketua'}: ${esc(m.nama)}" title="${k ? 'Ketua tim' : 'Jadikan ketua'}">${ic('star')}</button>
        ${canRemove(m.id) ? `<button class="btn sm icon ghost" data-rm="${m.id}" aria-label="Keluarkan ${esc(m.nama)}">${ic('x')}</button>` : ''}</div>`);
    } else {
      const req = i < min;
      slots.push(`<div class="slot empty-s ${req ? 'req' : ''}" ${closed ? '' : 'data-empty="1"'}>${ic('plus')}<span>${req ? `Anggota ${i + 1} · wajib` : `Anggota ${i + 1} · opsional`}</span></div>`);
    }
  }
  $('#roster').innerHTML = `
    <div class="rost-h"><h2>${esc(t.nama)}</h2>
      <span class="badge ${n >= min ? 'green' : n ? 'amber' : ''}">${n} dari ${max} anggota${n >= max ? ' · penuh' : ''}</span></div>
    <div class="meter" aria-hidden="true">${Array.from({length: max}, (_, i) => `<i class="${i < n ? 'on' : ''} ${n >= min ? 'ok' : ''} ${i < min ? 'req' : ''}"></i>`).join('')}</div>
    ${note}
    <div style="display:flex;flex-direction:column;gap:8px">${slots.join('')}</div>`;
  const msg = closed ? '' : !n ? `Mulai dengan menambahkan anggota (minimal ${min}).`
    : n < min ? `Tambahkan ${min - n} anggota lagi.` : !d.ketua ? 'Pilih satu ketua tim (ikon bintang).'
    : dirty ? 'Siap disimpan.' : 'Tidak ada perubahan.';
  $('#rfoot').innerHTML = `<span class="small ${valid && dirty ? '' : 'muted'}" style="font-weight:600">${esc(msg)}</span>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${!closed && !iInDraft && !other && n < max ? `<button class="btn" id="r-self">${ic('plus')} Tambahkan saya</button>` : ''}
      ${dirty ? `<button class="btn ghost" id="r-reset">Batalkan</button>` : ''}
      <button class="btn primary" id="r-save" ${closed || !dirty || !valid ? 'disabled' : ''}>${ic('check')} Simpan tim</button></div>`;
}
async function saveTim(btn) {
  const t = curTim(), d = T.draft; T.saving = true;
  try {
    await withBusy(btn, () => api('tim_simpan', {method: 'POST', body: {tim_id: t.id, anggota: d.ids, ketua_id: d.ketua, versi: d.versi}}));
    await loadTim(); resetDraft(); renderTimAll();
    toast(`${t.nama} tersimpan`, `${d.ids.length} anggota terdaftar.`);
  } catch (err) {
    toast('Belum bisa disimpan', err.message, 'err');
    if (err.status === 409) { await loadTim(); resetDraft(); renderTimAll(); }
  } finally { T.saving = false; }
}

/* =========================================================
   HALAMAN ADMIN (DOSEN)
   ========================================================= */
const ADMIN_PAGES = {};
const A = {kelas: [], kid: 0, q: '', filter: 0};
async function loadKelas() { A.kelas = (await api('admin_kelas')).kelas; return A.kelas; }
function kelasOptions(sel, all) { return (all ? `<option value="0">Semua kelas</option>` : '') + A.kelas.map(k => `<option value="${k.id}" ${+sel === +k.id ? 'selected' : ''}>${esc(k.kode)} — ${esc(k.nama)}</option>`).join(''); }

ADMIN_PAGES.ringkasan = async () => {
  const d = await api('admin_ringkasan'); SET = d.settings;
  const sum = k => d.kelas.reduce((a, x) => a + x[k], 0);
  const total = sum('total'), bertim = sum('bertim');
  const logs = {tim_simpan: 'menyimpan tim', mhs_ubah: 'mengubah data mahasiswa', mhs_tambah: 'menambah mahasiswa', mhs_reset_password: 'mereset password', mhs_impor: 'impor mahasiswa', pengaturan: 'mengubah pengaturan', ganti_password: 'mengganti password', kelas_toggle: 'mengubah status kelas', tim_kosongkan: 'mengosongkan tim', tim_hapus_anggota: 'mengeluarkan anggota', tim_set_ketua: 'mengubah ketua'};
  $('#content').innerHTML = `<div class="page">
    <div class="hello"><h2>Ringkasan kelas</h2><p>Pendaftaran tim ${SET.buka ? 'sedang <b>dibuka</b>' : 'sedang <b>ditutup</b>'}${SET.tenggat ? ' · tenggat ' + esc(fmtDT(SET.tenggat)) : ''}</p></div>
    <div class="widgets">
      <div class="card w" style="min-height:130px"><div class="k">${ic('users')} Mahasiswa aktif</div><div class="big">${total}</div><span class="muted small">${d.kelas.length} kelas</span></div>
      <div class="card w" style="min-height:130px"><div class="k">${ic('check')} Sudah bertim</div><div class="big">${bertim}<span class="muted" style="font-size:18px"> / ${total}</span></div><div class="bar"><i style="width:${total ? bertim / total * 100 : 0}%"></i></div></div>
      <div class="card w" style="min-height:130px"><div class="k">${ic('shield')} Sudah ganti password</div><div class="big">${sum('sudah_ganti')}<span class="muted" style="font-size:18px"> / ${total}</span></div><div class="bar green"><i style="width:${total ? sum('sudah_ganti') / total * 100 : 0}%"></i></div></div>
    </div>
    <div class="grid2">${d.kelas.map(k => `<div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><h3>${esc(k.kode)}</h3><div class="muted small">${esc(k.mata_kuliah)}${k.sesi ? ' · ' + esc(k.sesi) : ''}</div></div>
      <span class="badge ${k.tim_aktif ? 'green' : ''}">${k.tim_aktif ? 'Pendaftaran aktif' : 'Nonaktif'}</span></div>
      <div class="bar"><i style="width:${k.total ? k.bertim / k.total * 100 : 0}%"></i></div>
      <div class="small muted">${k.bertim} dari ${k.total} mahasiswa sudah bertim · ${k.tim_valid} tim memenuhi syarat</div></div>`).join('')}</div>
    <div class="card"><h3 style="margin-bottom:6px">Aktivitas terbaru</h3>
      ${d.log.length ? d.log.map(l => `<div class="mini"><span class="nm"><b>${esc(l.pelaku)}</b> ${esc(logs[l.aksi] || l.aksi)}</span><span class="muted small">${esc(fmtDT(l.waktu))}</span></div>`).join('') : '<p class="muted">Belum ada aktivitas.</p>'}</div>
  </div>`;
};

ADMIN_PAGES.mahasiswa = async () => {
  await loadKelas(); A.q = ''; A.filter = 0;
  const c = $('#content'); c.className = 'content fill';
  $('#tb-actions').innerHTML = `<button class="btn sm" id="a-imp">${ic('upload')} Impor CSV</button><button class="btn sm primary" id="a-add">${ic('plus')} Tambah</button>`;
  c.innerHTML = `<div class="toolbar" style="margin-bottom:12px">
      <label class="search">${ic('search')}<input class="inp" id="a-q" type="search" placeholder="Cari NIM atau nama" aria-label="Cari"></label>
      <select class="inp" id="a-k" style="width:auto;min-width:200px" aria-label="Filter kelas">${kelasOptions(0, true)}</select><span class="badge" id="a-n"></span></div>
    <div class="tablewrap" id="a-wrap"></div>`;
  $('#a-q').oninput = debounce(e => { A.q = e.target.value; loadMhs(); });
  $('#a-k').onchange = e => { A.filter = +e.target.value; loadMhs(); };
  $('#a-add').onclick = () => mhsSheet(null); $('#a-imp').onclick = importSheet;
  $('#a-wrap').onclick = e => {
    const ed = e.target.closest('[data-ed]'), rs = e.target.closest('[data-rs]');
    if (ed) mhsSheet(S.rows.find(r => r.id === +ed.dataset.ed));
    if (rs) resetPw(S.rows.find(r => r.id === +rs.dataset.rs));
  };
  await loadMhs();
};
async function loadMhs() {
  const d = await api('admin_mahasiswa', {params: {q: A.q, kelas: A.filter}}); S.rows = d.mahasiswa;
  $('#a-n').textContent = `${d.mahasiswa.length} data`;
  $('#a-wrap').innerHTML = d.mahasiswa.length ? `<table class="tbl"><thead><tr><th>NIM</th><th>Nama</th><th>Kelas</th><th>Tim</th><th>Status</th><th></th></tr></thead><tbody>
    ${d.mahasiswa.map(r => `<tr><td data-l="NIM">${esc(r.nim)}</td><td data-l="Nama" class="nm">${esc(r.nama)}</td><td data-l="Kelas">${esc(r.kelas_kode)}</td><td data-l="Tim">${r.tim ? esc(r.tim) : '<span class="muted">—</span>'}</td>
      <td data-l="Status">${r.aktif ? (r.wajib ? '<span class="badge amber">Password awal</span>' : '<span class="badge green">Aktif</span>') : '<span class="badge red">Nonaktif</span>'}</td>
      <td class="acts-td"><div class="acts"><button class="btn sm" data-ed="${r.id}">${ic('edit')} Ubah</button><button class="btn sm" data-rs="${r.id}" title="Kembalikan ke password kolektif">${ic('key')} Reset</button></div></td></tr>`).join('')}</tbody></table>`
    : `<div class="empty">${ic('search')}<b>Tidak ada data</b><span>Ubah kata kunci atau filter kelas.</span></div>`;
}
function mhsSheet(r) {
  const s = openSheet(`<h2>${r ? 'Ubah mahasiswa' : 'Tambah mahasiswa'}</h2>
    <form id="mf" style="display:flex;flex-direction:column;gap:12px">
      <label class="field"><span>NIM</span><input class="inp" id="mf-nim" value="${esc(r ? r.nim : '')}" inputmode="numeric" required></label>
      <label class="field"><span>Nama lengkap</span><input class="inp" id="mf-nama" value="${esc(r ? r.nama : '')}" required></label>
      <div class="grid2" style="grid-template-columns:1fr 1fr;gap:12px"><label class="field"><span>No. HP</span><input class="inp" id="mf-hp" value="${esc(r ? r.no_hp || '' : '')}" inputmode="tel"></label>
      <label class="field"><span>Kelas</span><select class="inp" id="mf-k">${kelasOptions(r ? r.kelas_id : A.filter || A.kelas[0].id)}</select></label></div>
      <label class="field"><span>Email</span><input class="inp" id="mf-em" type="email" value="${esc(r ? r.email || '' : '')}"></label>
      <div class="setrow" style="padding:6px 0"><span><b>Akun aktif</b><div class="muted small">Akun nonaktif tidak bisa masuk.</div></span><button type="button" class="switch ${!r || r.aktif ? 'on' : ''}" id="mf-a" role="switch" aria-checked="${!r || !!r.aktif}" aria-label="Akun aktif"></button></div>
      ${r ? '' : `<p class="muted small">Password awal: password kolektif. Mahasiswa diminta menggantinya saat pertama masuk.</p>`}
      <div class="small" id="mf-e" role="alert" style="color:#d92d22;font-weight:600;min-height:18px"></div>
      <div class="acts"><button type="button" class="btn" data-close>Batal</button><button class="btn primary" type="submit">Simpan</button></div></form>`);
  $('#mf-a', s.el).onclick = e => { const b = e.currentTarget, on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); };
  $('#mf', s.el).onsubmit = async e => {
    e.preventDefault();
    try {
      await withBusy($('button[type=submit]', s.el), () => api('admin_mhs_simpan', {method: 'POST', body: {id: r ? r.id : 0, nim: $('#mf-nim').value, nama: $('#mf-nama').value, no_hp: $('#mf-hp').value, email: $('#mf-em').value, kelas_id: +$('#mf-k').value, aktif: $('#mf-a').classList.contains('on')}}));
      s.close(); toast('Data tersimpan'); loadMhs();
    } catch (err) { $('#mf-e').textContent = err.message; }
  };
}
async function resetPw(r) {
  if (!await confirmBox('Reset password?', `Password ${r.nama} dikembalikan ke password kolektif dan ia diminta menggantinya lagi saat masuk.`, 'Reset')) return;
  try { await api('admin_mhs_reset', {method: 'POST', body: {id: r.id}}); toast('Password direset', r.nama); loadMhs(); } catch (e) { toast('Gagal', e.message, 'err'); }
}
function parseCSV(text) {
  const first = text.split(/\r?\n/)[0] || '', delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}
function importSheet() {
  let rows = [];
  const s = openSheet(`<h2>Impor mahasiswa dari CSV</h2>
    <p class="muted small">Baris pertama adalah judul kolom: <b>NIM, Nama, No HP, Email, Kelas</b>. Kolom Kelas diisi kode kelas (mis. ${esc(A.kelas.map(k => k.kode).join(', '))}). Di Excel: Simpan sebagai → CSV. NIM yang sudah ada dilewati.</p>
    <input class="inp" type="file" id="im-f" accept=".csv,text/csv" style="padding-top:8px">
    <div class="small" id="im-s" role="status" style="font-weight:600;min-height:18px"></div>
    <div class="acts"><button class="btn" data-close>Tutup</button><button class="btn primary" id="im-go" disabled>Impor</button></div>`);
  $('#im-f', s.el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const data = parseCSV((await f.text()).replace(/^\uFEFF/, '')); const head = (data.shift() || []).map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
    const col = (...n) => head.findIndex(h => n.includes(h));
    const ix = {nim: col('nim'), nama: col('nama'), no_hp: col('nohp', 'hp', 'nomorhandphone', 'telepon'), email: col('email'), kelas: col('kelas', 'kodekelas')};
    if (ix.nim < 0 || ix.nama < 0 || ix.kelas < 0) { $('#im-s').textContent = 'Kolom NIM, Nama, dan Kelas wajib ada.'; $('#im-go').disabled = true; return; }
    rows = data.map(r => ({nim: (r[ix.nim] || '').trim(), nama: (r[ix.nama] || '').trim(), no_hp: ix.no_hp >= 0 ? (r[ix.no_hp] || '').trim() : '', email: ix.email >= 0 ? (r[ix.email] || '').trim() : '', kelas: (r[ix.kelas] || '').trim()}));
    $('#im-s').textContent = `${rows.length} baris siap diimpor.`; $('#im-go').disabled = !rows.length;
  };
  $('#im-go', s.el).onclick = async e => {
    try {
      const d = await withBusy(e.currentTarget, () => api('admin_import', {method: 'POST', body: {rows}}));
      $('#im-s').innerHTML = `${d.berhasil} ditambahkan, ${d.jumlah_dilewati} dilewati.${d.dilewati.length ? '<br><span class="muted" style="font-weight:500">' + d.dilewati.map(esc).join('<br>') + '</span>' : ''}`;
      e.currentTarget.disabled = true; loadMhs();
    } catch (err) { $('#im-s').textContent = err.message; }
  };
}

ADMIN_PAGES.tim = async () => {
  await loadKelas(); if (!A.kid) A.kid = A.kelas[0].id;
  const c = $('#content'); c.className = 'content';
  c.innerHTML = `<div class="page"><div class="toolbar"><select class="inp" id="at-k" style="width:auto;min-width:240px" aria-label="Pilih kelas">${kelasOptions(A.kid)}</select><span class="sp" style="flex:1"></span>
    <a class="btn" id="at-ex" href="#">${ic('download')} Ekspor CSV kelas ini</a><a class="btn ghost" href="api.php?a=admin_export&kelas=0">Semua kelas</a></div><div id="at-g">${loading}</div></div>`;
  $('#at-k').onchange = e => { A.kid = +e.target.value; loadAdminTim(); };
  $('#at-g').onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, tid = +b.dataset.t, mid = +(b.dataset.m || 0);
    if (act === 'kosongkan' && !await confirmBox('Kosongkan tim?', 'Semua anggota dikeluarkan dari tim ini. Mahasiswa bisa mendaftar ulang.', 'Kosongkan', true)) return;
    if (act === 'hapus_anggota' && !await confirmBox('Keluarkan anggota?', 'Anggota ini akan dikeluarkan dari tim.', 'Keluarkan', true)) return;
    try { await api('admin_tim_aksi', {method: 'POST', body: {tim_id: tid, aksi: act, mahasiswa_id: mid}}); toast('Tim diperbarui'); loadAdminTim(); } catch (err) { toast('Gagal', err.message, 'err'); }
  };
  await loadAdminTim();
};
async function loadAdminTim() {
  $('#at-ex').href = 'api.php?a=admin_export&kelas=' + A.kid;
  const d = await api('admin_tim', {params: {kelas: A.kid}}); SET = d.settings;
  $('#at-g').innerHTML = `<div class="tgrid">${d.tim.map(t => {
    const n = t.anggota.length;
    return `<div class="card tcard"><div class="h"><h3>${esc(t.nama)}</h3><span class="badge ${n >= SET.tim_min ? 'green' : n ? 'amber' : ''}">${n}/${SET.tim_max}${n && n < SET.tim_min ? ' · kurang' : ''}</span></div>
      ${n ? t.anggota.map(a => `<div class="mini"><button class="star ${a.id === t.ketua_id ? 'on' : ''}" style="width:26px;height:26px" data-act="set_ketua" data-t="${t.id}" data-m="${a.id}" aria-label="Jadikan ${esc(a.nama)} ketua" title="Jadikan ketua">${ic('star')}</button>
        <span class="nm" title="${esc(a.nama)}">${esc(a.nama)}<span class="muted small"> · ${esc(a.nim)}</span></span>
        <button class="btn sm icon ghost" data-act="hapus_anggota" data-t="${t.id}" data-m="${a.id}" aria-label="Keluarkan ${esc(a.nama)}">${ic('x')}</button></div>`).join('') : '<p class="muted small">Belum ada anggota.</p>'}
      ${n ? `<button class="btn sm ghost" style="align-self:flex-start;margin-top:4px" data-act="kosongkan" data-t="${t.id}">${ic('trash')} Kosongkan</button>` : ''}</div>`;
  }).join('')}</div>`;
}

ADMIN_PAGES.pengaturan = async () => {
  await loadKelas();
  const d = await api('admin_ringkasan'); SET = d.settings;
  const tg = SET.tenggat ? SET.tenggat.replace(' ', 'T').slice(0, 16) : '';
  $('#content').innerHTML = `<div class="page"><div class="grid2">
    <div class="card"><h2 style="margin-bottom:6px">Aturan pendaftaran tim</h2>
      <div class="setrow"><span><b>Pendaftaran dibuka</b><div class="muted small">Jika ditutup, mahasiswa hanya bisa melihat.</div></span><button class="switch ${SET.buka ? 'on' : ''}" id="s-buka" role="switch" aria-checked="${SET.buka}" aria-label="Pendaftaran dibuka"></button></div>
      <div class="setrow" style="gap:10px"><label class="field" style="flex:1"><span>Minimal anggota</span><input class="inp" id="s-min" type="number" min="1" max="30" value="${SET.tim_min}"></label>
        <label class="field" style="flex:1"><span>Maksimal anggota</span><input class="inp" id="s-max" type="number" min="1" max="30" value="${SET.tim_max}"></label></div>
      <div class="setrow"><label class="field" style="flex:1"><span>Tenggat (opsional)</span><input class="inp" id="s-tg" type="datetime-local" value="${esc(tg)}"></label></div>
      <div class="small" id="s-e" role="alert" style="color:#d92d22;font-weight:600;min-height:18px"></div>
      <button class="btn primary" id="s-save">Simpan pengaturan</button></div>
    <div class="card"><h2 style="margin-bottom:6px">Pendaftaran tim per kelas</h2>
      ${d.kelas.map(k => `<div class="setrow"><span><b>${esc(k.kode)}</b><div class="muted small">${esc(k.mata_kuliah)} · ${k.total} mahasiswa</div></span>
        <button class="switch ${k.tim_aktif ? 'on' : ''}" data-kt="${k.id}" role="switch" aria-checked="${!!k.tim_aktif}" aria-label="Pendaftaran tim kelas ${esc(k.kode)}"></button></div>`).join('')}</div>
    <form class="card" id="pw-adm" style="display:flex;flex-direction:column;gap:12px"><h2>${ic('lock')} Ganti password akun dosen</h2>${pwFields('pa')}<button class="btn primary" type="submit" style="align-self:flex-start">Simpan password</button></form>
  </div></div>`;
  const sw = b => { const on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); return on; };
  $('#s-buka').onclick = e => sw(e.currentTarget);
  $$('[data-kt]').forEach(b => b.onclick = async () => {
    const on = sw(b);
    try { await api('admin_kelas_toggle', {method: 'POST', body: {kelas_id: +b.dataset.kt, tim_aktif: on}}); toast('Tersimpan'); } catch (e) { sw(b); toast('Gagal', e.message, 'err'); }
  });
  $('#s-save').onclick = async e => {
    $('#s-e').textContent = '';
    try {
      await withBusy(e.currentTarget, () => api('admin_setting', {method: 'POST', body: {tim_min: +$('#s-min').value, tim_max: +$('#s-max').value, buka: $('#s-buka').classList.contains('on'), tenggat: $('#s-tg').value}}));
      toast('Pengaturan tersimpan');
    } catch (err) { $('#s-e').textContent = err.message; }
  };
  const submit = pwWire('pa', () => $$('#pw-adm input').forEach(i => i.value = ''));
  $('#pw-adm').onsubmit = e => { e.preventDefault(); submit($('#pw-adm button[type=submit]')); };
};

/* ---------------- start ---------------- */
(async function init() {
  try {
    const d = await api('boot'); CSRF = d.csrf; SET = d.settings; APP = d.app;
    if (d.user) { ME = d.user; startApp(); } else showLogin();
  } catch (e) {
    $('#root').innerHTML = `<main class="lock"><div class="login glass"><div class="logo">${ic('alert')}</div><h1>Tidak dapat memuat</h1><p class="hint">${esc(e.message)}</p><button class="btn primary" onclick="location.reload()">Muat ulang</button></div></main>`;
  }
})();

// config.js
const SUPABASE_URL = 'https://txvgclavcmhyxamxgvsi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4dmdjbGF2Y21oeXhhbXhndnNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzEyMDgsImV4cCI6MjA5MzEwNzIwOH0.oq3lH7_mRR-TIUV0sW8EtbYqS2SjmKOzneSrV3n45mY';

// Buat client Supabase
const sb = supabase.createClient('https://txvgclavcmhyxamxgvsi.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4dmdjbGF2Y21oeXhhbXhndnNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzEyMDgsImV4cCI6MjA5MzEwNzIwOH0.oq3lH7_mRR-TIUV0sW8EtbYqS2SjmKOzneSrV3n45mY', {
  auth: {
    storage: window.sessionStorage,   // login hilang saat tab/browser ditutup
    persistSession: true,
    autoRefreshToken: true
  }
});

// Hapus sisa login lama yang masih tersimpan permanen di browser ini
Object.keys(localStorage)
  .filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  .forEach(k => localStorage.removeItem(k));
// ==================== FUNGSI ROLE & LOG ====================

// Ambil role user
async function getUserRole(email) {
    const { data } = await sb.from('user_profiles').select('role').eq('email', email).single();
    if (data) return data.role;
    
    // Jika belum ada profile, buat otomatis
    const { count } = await sb.from('user_profiles').select('*', { count: 'exact', head: true });
    const defaultRole = count === 0 ? 'admin' : 'operator';
    
    const { data: { user } } = await sb.auth.getUser();
    await sb.from('user_profiles').insert([{ 
        id: user.id, 
        email: email, 
        role: defaultRole 
    }]);
    return defaultRole;
}

// Cek role user saat ini
async function getCurrentUserRole() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    return await getUserRole(user.email);
}

// Cek apakah user punya akses
async function checkRole(allowedRoles) {
    const role = await getCurrentUserRole();
    return allowedRoles.includes(role);
}

// Tambah log aktivitas
async function addLog(aksi, detail) {
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        
        const role = await getUserRole(user.email);
        await sb.from('log_aktivitas').insert([{
            user_email: user.email,
            user_role: role,
            aksi: aksi,
            detail: detail
        }]);
    } catch(e) {
        console.log('Log error:', e);
    }
}

// Redirect jika tidak punya akses
async function requireRole(allowedRoles, redirectUrl = 'dashboard.html') {
    const { data: { user } } = await sb.auth.getSession();
    if (!user) {
        window.location.href = 'login.html';
        return false;
    }
    
    const role = await getUserRole(user.email);
    if (!allowedRoles.includes(role)) {
        alert('⛔ Akses ditolak! Anda tidak memiliki izin untuk mengakses halaman ini.');
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

// Tampilkan menu berdasarkan role
async function filterMenuByRole() {
    const role = await getCurrentUserRole();
    const isAdmin = role === 'admin';
    
    const adminMenus = document.querySelectorAll('.menu-admin-only');
    if (adminMenus.length) {
        adminMenus.forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
    }
}
// =====================================================================
// MENU "PERMINTAAN PRODUKSI" DI SEMUA HALAMAN + ANGKA NOTIFIKASI ADMIN
// Tempel di BARIS PALING BAWAH config.js (jangan hapus isi config.js yang lama)
// =====================================================================
;(function () {
    var URL_HALAMAN = 'permintaan-produksi.html';
    var SELEKTOR_MENU = '[data-menu="permintaan-produksi"], [data-perm-menu]';

    // Pasang menu di sidebar kalau halaman ini belum punya
    function sisipkanMenu() {
        if (document.querySelector(SELEKTOR_MENU)) return;

        // Gaya 1: <div class="menu-item" data-menu="...">
        var ref = document.querySelector('.menu-item[data-menu="stok-pendukung"]')
               || document.querySelector('.menu-item[data-menu="stock-report"]')
               || document.querySelector('.menu-item[data-menu="stock-out"]');
        if (ref) {
            var item = document.createElement('div');
            item.className = 'menu-item';
            item.setAttribute('data-perm-menu', '1');
            item.innerHTML = '<span class="icon">🙋</span><span class="text">Permintaan Produksi</span>';
            item.addEventListener('click', function () { window.location.href = URL_HALAMAN; });
            ref.parentNode.insertBefore(item, ref.nextSibling);
            return;
        }

        // Gaya 2: <ul class="sidebar-menu"><li><a data-menu="...">
        var refA = document.querySelector('.sidebar-menu li a[data-menu="stok-pendukung"]')
                || document.querySelector('.sidebar-menu li a[data-menu="stock-report"]')
                || document.querySelector('.sidebar-menu li a[data-menu="stock-out"]');
        if (refA) {
            var li = refA.closest('li');
            var baru = document.createElement('li');
            baru.innerHTML = '<a href="' + URL_HALAMAN + '" data-perm-menu="1"><span class="icon">🙋</span> Permintaan Produksi</a>';
            li.parentNode.insertBefore(baru, li.nextSibling);
        }
    }

    // Angka merah di menu (khusus admin): permintaan yang perlu tindakan
    function pasangBadge(pending, siap) {
        var el = document.querySelector(SELEKTOR_MENU);
        if (!el) return;
        var lama = el.querySelector('.perm-badge');
        if (lama) lama.remove();
        var total = pending + siap;
        if (total <= 0) return;
        var b = document.createElement('span');
        b.className = 'perm-badge';
        b.textContent = total;
        b.title = pending + ' menunggu persetujuan, ' + siap + ' siap diproses';
        b.style.cssText = 'margin-left:auto;background:#ef4444;color:#fff;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:700;';
        el.appendChild(b);
    }

    async function refreshPermBadge() {
        try {
            if (typeof sb === 'undefined' || !document.querySelector(SELEKTOR_MENU)) return;
            var s = await sb.auth.getSession();
            var session = s && s.data && s.data.session;
            if (!session) return;

            var email = session.user.email;
            var key = 'perm_role_' + email;
            var role = null;
            try { role = sessionStorage.getItem(key); } catch (e) {}
            if (role === null) {
                var p = await sb.from('user_profiles').select('role').eq('email', email).maybeSingle();
                role = (p && p.data && p.data.role) ? p.data.role : 'none';
                try { sessionStorage.setItem(key, role); } catch (e) {}
            }
            if (role !== 'admin') { pasangBadge(0, 0); return; }

            var r = await sb.from('permintaan_produksi').select('status').in('status', ['PENDING', 'DISETUJUI']).limit(500);
            if (r.error) return;
            var pending = 0, siap = 0;
            (r.data || []).forEach(function (x) { if (x.status === 'PENDING') pending++; else siap++; });
            pasangBadge(pending, siap);
        } catch (e) { /* diam: badge hanya pemanis, jangan ganggu halaman */ }
    }
    window.refreshPermBadge = refreshPermBadge;

    function mulai() { sisipkanMenu(); refreshPermBadge(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
    else mulai();
})();

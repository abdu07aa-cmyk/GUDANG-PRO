// config.js
const SUPABASE_URL = 'https://txvgclavcmhyxamxgvsi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4dmdjbGF2Y21oeXhhbXhndnNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzEyMDgsImV4cCI6MjA5MzEwNzIwOH0.oq3lH7_mRR-TIUV0sW8EtbYqS2SjmKOzneSrV3n45mY';

// Hindari deklarasi ganda
if (typeof window.supabaseClient === 'undefined') {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const sb = window.supabaseClient;
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
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    
    const role = await getUserRole(user.email);
    await sb.from('log_aktivitas').insert([{
        user_email: user.email,
        user_role: role,
        aksi: aksi,
        detail: detail
    }]);
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
    
    // Sembunyikan menu yang tidak sesuai role
    const adminMenus = document.querySelectorAll('.menu-admin-only');
    const operatorMenus = document.querySelectorAll('.menu-operator-only');
    
    if (adminMenus.length) {
        adminMenus.forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
    }
}

/* ============================================================
   auth.js — shared auth utilities (loaded on every page)
   ============================================================ */

function getToken() { return localStorage.getItem('token'); }
function getUser()  { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; }

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

function requireAuth(role) {
  const token = getToken();
  const user  = getUser();
  if (!token || !user) { window.location.href = '/'; return false; }
  if (role && user.role !== role) {
    window.location.href = user.role === 'admin' ? '/admin.html' : '/dashboard.html';
    return false;
  }
  return true;
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

/* ── Toast notifications ──────────────────────────────────── */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(() => toast.remove(), 400); }, 3200);
}

/* ── Shared sidebar init ──────────────────────────────────── */
function initSidebar() {
  const user = getUser();
  if (!user) return;

  const avatarEl = document.getElementById('sidebarAvatar');
  const nameEl   = document.getElementById('sidebarName');
  const roleEl   = document.getElementById('sidebarRole');
  if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
  if (nameEl)   nameEl.textContent   = user.name;
  if (roleEl)   roleEl.textContent   = user.role;
}

/* ── Update balance chip ──────────────────────────────────── */
async function refreshBalance() {
  const chip = document.getElementById('balanceChip');
  if (!chip) return;
  try {
    const res  = await fetch('/api/auth/me', { headers: authHeaders() });
    const data = await res.json();
    chip.textContent = `💰 $${parseFloat(data.balance).toFixed(2)}`;
    // Also update localStorage
    const user = getUser();
    if (user) { user.balance = data.balance; localStorage.setItem('user', JSON.stringify(user)); }
  } catch (_) {}
}

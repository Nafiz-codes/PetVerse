/* ============================================================
   admin.js — Admin dashboard: stats, posts, moderation
   ============================================================ */

requireAuth('admin');
initSidebar();

const animalEmojiA = { Cat:'🐱', Dog:'🐶', Rabbit:'🐰', Bird:'🐦', Fish:'🐟', Hamster:'🐹', Snake:'🐍', Horse:'🐴' };
function emoA(name) { return animalEmojiA[name] || '🐾'; }

// ── Page navigation ───────────────────────────────────────────
const adminPages    = document.querySelectorAll('.page');
const adminNavLinks = document.querySelectorAll('.nav-link[data-page]');

function showAdminPage(pageId) {
  adminPages.forEach(p => p.classList.remove('active'));
  adminNavLinks.forEach(n => n.classList.remove('active'));

  const pg  = document.getElementById(`page-${pageId}`);
  const nav = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (pg)  pg.classList.add('active');
  if (nav) nav.classList.add('active');

  const titles = {
    overview: 'Admin Overview', allposts: 'All Posts',
    adoptionAdmin: 'Adoptions', buysellAdmin: 'Buy/Sell',
    donationsAdmin: 'Donation Campaigns', createCampaign: 'New Campaign'
  };
  const tb = document.getElementById('topbarTitle');
  if (tb) tb.textContent = titles[pageId] || pageId;

  if (pageId === 'overview')       { loadStats(); loadRecentPosts(); }
  if (pageId === 'allposts')       loadAllPostsTable('');
  if (pageId === 'adoptionAdmin')  { populateAdminAnimalFilter(); loadAdminAdoptions(); }
  if (pageId === 'buysellAdmin')   loadAdminBuySell();
  if (pageId === 'donationsAdmin') { populateAdminDonFilter(); loadAdminDonations(''); }
  if (pageId === 'createCampaign') loadAnimalTypesForCampaign();
}

adminNavLinks.forEach(link => {
  link.addEventListener('click', () => showAdminPage(link.dataset.page));
});

// ── Stats ─────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res  = await fetch('/api/admin/stats', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    document.getElementById('statPosts').textContent     = data.totalPosts;
    document.getElementById('statAdoptions').textContent = data.totalAdoptions;
    document.getElementById('statUsers').textContent     = data.totalUsers;
    document.getElementById('statModerated').textContent = data.totalModerated;
    document.getElementById('statDeleted').textContent   = data.totalDeleted;
    document.getElementById('statCollected').textContent = `$${parseFloat(data.totalCollected).toFixed(0)}`;
  } catch (err) {
    showToast('Failed to load stats', 'error');
  }
}

// ── Recent Posts (overview) ───────────────────────────────────
async function loadRecentPosts() {
  const grid = document.getElementById('recentPostsGrid');
  grid.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const res  = await fetch('/api/admin/posts?limit=6', { headers: authHeaders() });
    const data = await res.json();
    grid.innerHTML = '';
    if (!data.posts?.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No posts yet</div></div>`;
      return;
    }
    data.posts.forEach(p => grid.appendChild(renderAdminCard(p)));
  } catch (_) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load</div></div>`;
  }
}

// ── Render admin post card ────────────────────────────────────
function renderAdminCard(p) {
  const card = document.createElement('div');
  card.className = 'post-card';

  const isAdoption = p.post_type === 'Adoption';
  const typeBadge  = isAdoption
    ? `<span class="post-card-type type-adoption">Adoption</span>`
    : `<span class="post-card-type type-buysell">Buy/Sell</span>`;
  const modBadge = p.moderated > 0
    ? `<span class="badge badge-green" style="position:absolute;top:44px;right:14px;">✅ Moderated</span>` : '';

  let meta = '';
  if (isAdoption) {
    if (p.animal_type_name) meta += `<span class="meta-item">${emoA(p.animal_type_name)} ${p.animal_type_name}</span>`;
    if (p.animal_name)      meta += `<span class="meta-item">🏷️ ${p.animal_name}</span>`;
    if (p.location)         meta += `<span class="meta-item">📍 ${p.location}</span>`;
  } else {
    if (p.category)         meta += `<span class="meta-item">${p.category === 'Medicine' ? '💊' : '🧸'} ${p.category}</span>`;
    if (p.expire_date)      meta += `<span class="meta-item">📅 Exp: ${p.expire_date?.slice(0,10)}</span>`;
  }

  card.innerHTML = `
    ${typeBadge}${modBadge}
    <div class="post-card-body" style="margin-top:10px;">
      <p class="post-title">${p.description || 'No description'}</p>
      ${meta ? `<div class="post-meta">${meta}</div>` : ''}
      <div class="post-author">
        <span>👤 ${p.author_name} &lt;${p.author_email}&gt;</span>
        <span>#${p.post_id}</span>
      </div>
      <div class="post-actions">
        <button class="btn btn-sm btn-secondary" onclick="openModerate(${p.post_id})">✅ Moderate</button>
        <button class="btn btn-sm btn-danger" onclick="openDelete(${p.post_id})">🗑️ Delete</button>
      </div>
    </div>`;
  return card;
}

// ── All Posts Table ───────────────────────────────────────────
async function loadAllPostsTable(type) {
  const tbody = document.getElementById('allPostsBody');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;"><div class="spinner" style="margin:auto;"></div></td></tr>`;
  try {
    let url = `/api/admin/posts?limit=100`;
    if (type) url += `&type=${type}`;
    const res  = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    if (!data.posts?.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No posts found</td></tr>`;
      return;
    }
    tbody.innerHTML = data.posts.map(p => {
      const isAdoption = p.post_type === 'Adoption';
      const typeHtml   = isAdoption
        ? `<span class="badge badge-purple">Adoption</span>`
        : `<span class="badge badge-cyan">Buy/Sell</span>`;
      let details = '';
      if (isAdoption) details = [p.animal_type_name, p.animal_name, p.location].filter(Boolean).join(' · ');
      else            details = [p.category, p.expire_date ? `Exp: ${p.expire_date?.slice(0,10)}` : ''].filter(Boolean).join(' · ');
      const statusHtml = p.moderated > 0
        ? `<span class="badge badge-green">✅ Moderated</span>`
        : `<span class="badge badge-yellow">Pending</span>`;

      return `<tr>
        <td><span class="badge badge-purple">#${p.post_id}</span></td>
        <td>${p.author_name}<br/><small style="color:var(--text-muted);">${p.author_email}</small></td>
        <td>${typeHtml}</td>
        <td style="font-size:0.82rem;">${details || '—'}</td>
        <td>${p.post_date?.slice(0,10)}</td>
        <td>${statusHtml}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-secondary" onclick="openModerate(${p.post_id})">✅</button>
            <button class="btn btn-sm btn-danger" onclick="openDelete(${p.post_id})">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger);">${err.message}</td></tr>`;
  }
}

// Filter pills for all-posts table
document.querySelectorAll('#page-allposts .filter-pill').forEach(pill => {
  pill.addEventListener('click', function() {
    document.querySelectorAll('#page-allposts .filter-pill').forEach(p => p.classList.remove('active'));
    this.classList.add('active');
    loadAllPostsTable(this.dataset.type || '');
  });
});

// ── Admin Adoptions ───────────────────────────────────────────
async function populateAdminAnimalFilter() {
  try {
    const res   = await fetch('/api/animal-types');
    const types = await res.json();
    const sel   = document.getElementById('adminAnimalFilter');
    while (sel.options.length > 1) sel.remove(1);
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.animal_type_id;
      opt.textContent = `${emoA(t.name)} ${t.name}`;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

document.getElementById('adminAnimalFilter').addEventListener('change', function() {
  loadAdminAdoptions(this.value);
});

async function loadAdminAdoptions(animalTypeId = '') {
  const grid = document.getElementById('adminAdoptionsGrid');
  grid.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    let url = `/api/admin/posts?type=Adoption&limit=100`;
    if (animalTypeId) url += `&animal_type_id=${animalTypeId}`;
    // Note: admin endpoint doesn't support this filter directly, use regular posts endpoint
    url = `/api/posts?type=Adoption&limit=100${animalTypeId ? `&animal_type_id=${animalTypeId}` : ''}`;
    const res  = await fetch(url);
    const data = await res.json();
    grid.innerHTML = '';
    if (!data.posts?.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🐾</div><div class="empty-title">No adoption posts</div></div>`;
      return;
    }
    data.posts.forEach(p => grid.appendChild(renderAdminCard({ ...p, author_email: '' })));
  } catch (_) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load</div></div>`;
  }
}

async function loadAdminBuySell() {
  const grid = document.getElementById('adminBuySellGrid');
  grid.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const res  = await fetch('/api/posts?type=BuySell&limit=100');
    const data = await res.json();
    grid.innerHTML = '';
    if (!data.posts?.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-title">No buy/sell posts</div></div>`;
      return;
    }
    data.posts.forEach(p => grid.appendChild(renderAdminCard({ ...p, author_email: '' })));
  } catch (_) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load</div></div>`;
  }
}

// ── Donations Admin ───────────────────────────────────────────
async function populateAdminDonFilter() {
  try {
    const res   = await fetch('/api/animal-types');
    const types = await res.json();
    const sel   = document.getElementById('adminDonAnimalFilter');
    while (sel.options.length > 1) sel.remove(1);
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.animal_type_id;
      opt.textContent = `${emoA(t.name)} ${t.name}`;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

document.getElementById('adminDonAnimalFilter').addEventListener('change', function() {
  loadAdminDonations(this.value);
});

async function loadAdminDonations(animalTypeId = '') {
  const grid = document.getElementById('adminDonationsGrid');
  grid.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    let url = '/api/donations';
    if (animalTypeId) url += `?animal_type_id=${animalTypeId}`;
    const res  = await fetch(url);
    const data = await res.json();
    grid.innerHTML = '';
    if (!data.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">💝</div><div class="empty-title">No campaigns</div></div>`;
      return;
    }
    data.forEach(d => grid.appendChild(renderAdminDonCard(d)));
  } catch (_) {}
}

function renderAdminDonCard(d) {
  const card = document.createElement('div');
  card.className = 'donation-card';
  const pct     = Math.min(parseFloat(d.progress_pct || 0), 100).toFixed(1);
  const current = parseFloat(d.current_amount || 0).toFixed(2);
  const target  = parseFloat(d.target_amount).toFixed(2);
  const isEnded = new Date(d.end_date) < new Date();
  const animalBadge = d.animal_type_name
    ? `<span class="badge badge-purple">${emoA(d.animal_type_name)} ${d.animal_type_name}</span>`
    : `<span class="badge badge-cyan">🌍 General</span>`;

  card.innerHTML = `
    <div class="donation-header">
      <div><div class="donation-title">${d.title}</div>${animalBadge}</div>
      ${isEnded ? '<span class="badge badge-red">Ended</span>' : '<span class="badge badge-green">Active</span>'}
    </div>
    ${d.description ? `<p class="donation-desc">${d.description}</p>` : ''}
    <div class="progress-wrap">
      <div class="progress-labels">
        <span>Raised: <strong style="color:var(--primary-light);">$${current}</strong></span>
        <span>Goal: $${target}</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="progress-pct">${pct}% funded</div>
    </div>
    <div class="donation-dates">📅 ${d.start_date?.slice(0,10)} → ${d.end_date?.slice(0,10)}</div>
  `;
  return card;
}

// ── Animal types for campaign form ───────────────────────────
async function loadAnimalTypesForCampaign() {
  try {
    const res   = await fetch('/api/animal-types');
    const types = await res.json();
    const sel   = document.getElementById('campAnimalType');
    while (sel.options.length > 1) sel.remove(1);
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.animal_type_id;
      opt.textContent = `${emoA(t.name)} ${t.name}`;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

// ── Create Campaign ───────────────────────────────────────────
document.getElementById('createCampaignForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn       = document.getElementById('createCampBtn');
  const alertEl   = document.getElementById('campAlert');
  const successEl = document.getElementById('campSuccess');
  alertEl.classList.remove('show');
  successEl.classList.remove('show');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating…';

  try {
    const res  = await fetch('/api/admin/donations', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title:          document.getElementById('campTitle').value.trim(),
        description:    document.getElementById('campDesc').value.trim() || undefined,
        start_date:     document.getElementById('campStart').value,
        end_date:       document.getElementById('campEnd').value,
        target_amount:  parseFloat(document.getElementById('campTarget').value),
        animal_type_id: document.getElementById('campAnimalType').value || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create campaign');

    successEl.textContent = `✅ Campaign created! (ID: #${data.donation_id})`;
    successEl.classList.add('show');
    showToast('Campaign launched!', 'success');
    document.getElementById('createCampaignForm').reset();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.classList.add('show');
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Launch Campaign';
  }
});

// ── Moderate modal ────────────────────────────────────────────
function openModerate(postId) {
  document.getElementById('modPostId').value = postId;
  document.getElementById('modNotes').value  = '';
  document.getElementById('moderateModal').classList.add('open');
}

document.getElementById('confirmModBtn').addEventListener('click', async () => {
  const postId = document.getElementById('modPostId').value;
  const notes  = document.getElementById('modNotes').value;
  const btn    = document.getElementById('confirmModBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  try {
    const res  = await fetch(`/api/admin/moderate/${postId}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast('Post moderated successfully!', 'success');
    closeModal('moderateModal');
    // Refresh current visible page
    const activePage = document.querySelector('.page.active');
    if (activePage?.id === 'page-overview')  { loadStats(); loadRecentPosts(); }
    if (activePage?.id === 'page-allposts')   loadAllPostsTable('');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✅ Confirm Moderate';
  }
});

// ── Delete modal ──────────────────────────────────────────────
function openDelete(postId) {
  document.getElementById('delPostId').value = postId;
  document.getElementById('deleteModal').classList.add('open');
}

document.getElementById('confirmDelBtn').addEventListener('click', async () => {
  const postId = document.getElementById('delPostId').value;
  const btn    = document.getElementById('confirmDelBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Deleting…';
  try {
    const res  = await fetch(`/api/admin/posts/${postId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast('Post deleted and orphan types cleaned up.', 'success');
    closeModal('deleteModal');
    // Refresh
    const activePage = document.querySelector('.page.active');
    if (activePage?.id === 'page-overview')  { loadStats(); loadRecentPosts(); }
    if (activePage?.id === 'page-allposts')   loadAllPostsTable('');
    if (activePage?.id === 'page-adoptionAdmin') loadAdminAdoptions();
    if (activePage?.id === 'page-buysellAdmin')  loadAdminBuySell();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🗑️ Delete Post';
  }
});

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modals on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.classList.remove('open');
  });
});

// ── Initial Load ──────────────────────────────────────────────
showAdminPage('overview');

/* ============================================================
   posts.js — Dashboard: Feed, Adoptions, Buy/Sell, navigation
   ============================================================ */

// ── Guard ─────────────────────────────────────────────────────
requireAuth('user');
initSidebar();
refreshBalance();

// ── Page navigation ───────────────────────────────────────────
const pages   = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link[data-page]');

function showPage(pageId) {
  pages.forEach(p => p.classList.remove('active'));
  navLinks.forEach(n => n.classList.remove('active'));

  const pg  = document.getElementById(`page-${pageId}`);
  const nav = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (pg)  pg.classList.add('active');
  if (nav) nav.classList.add('active');

  const titles = {
    feed: 'Feed', adoptions: 'Adoptions', buysell: 'Buy / Sell',
    create: 'Create Post', donations: 'Donations', transactions: 'My Transactions'
  };
  const tb = document.getElementById('topbarTitle');
  if (tb) tb.textContent = titles[pageId] || pageId;

  // Lazy-load page data
  if (pageId === 'feed')         loadFeed();
  if (pageId === 'adoptions')    loadAdoptionPage();
  if (pageId === 'buysell')      loadBuySellPage();
  if (pageId === 'donations')    loadDonationsPage();
  if (pageId === 'transactions') loadTransactions();
}

navLinks.forEach(link => {
  link.addEventListener('click', () => showPage(link.dataset.page));
});

// ── Animal type emoji map ─────────────────────────────────────
const animalEmoji = { Cat:'🐱', Dog:'🐶', Rabbit:'🐰', Bird:'🐦', Fish:'🐟', Hamster:'🐹', Snake:'🐍', Horse:'🐴' };
function emojiForAnimal(name) { return animalEmoji[name] || '🐾'; }

// ── Render a single Post card ─────────────────────────────────
function renderPostCard(p, isAdmin = false) {
  const isAdoption = p.post_type === 'Adoption';
  const card = document.createElement('div');
  card.className = 'post-card';

  const typeBadge   = isAdoption
    ? `<span class="post-card-type type-adoption">Adoption</span>`
    : `<span class="post-card-type type-buysell">Buy/Sell</span>`;
  const modBadge = p.moderated > 0
    ? `<span class="post-card-type type-moderated" style="top:14px;right:${isAdoption ? 95 : 86}px;">✅ Moderated</span>`
    : '';

  let topSection = '';
  if (isAdoption && p.animal_type_name) {
    topSection = `<div class="post-card-header">
      <div class="post-animal-badge">${emojiForAnimal(p.animal_type_name)} ${p.animal_type_name}</div>
    </div>`;
  }

  let metaItems = '';
  if (isAdoption) {
    if (p.animal_name) metaItems += `<span class="meta-item">🏷️ ${p.animal_name}</span>`;
    if (p.gender)      metaItems += `<span class="meta-item">${p.gender === 'Male' ? '♂️' : '♀️'} ${p.gender}</span>`;
    if (p.age)         metaItems += `<span class="meta-item">🎂 ${p.age}yr</span>`;
    if (p.location)    metaItems += `<span class="meta-item">📍 ${p.location}</span>`;
  } else {
    if (p.category)    metaItems += `<span class="meta-item">${p.category === 'Medicine' ? '💊' : '🧸'} ${p.category}</span>`;
    if (p.expire_date) metaItems += `<span class="meta-item">📅 Exp: ${p.expire_date?.slice(0,10)}</span>`;
  }

  const adminBtns = isAdmin
    ? `<div class="post-actions">
        <button class="btn btn-sm btn-secondary" onclick="openModerate(${p.post_id})">✅ Moderate</button>
        <button class="btn btn-sm btn-danger"    onclick="openDelete(${p.post_id})">🗑️ Delete</button>
       </div>`
    : '';

  card.innerHTML = `
    ${typeBadge}${modBadge}
    ${topSection}
    <div class="post-card-body">
      <p class="post-title">${p.description || 'No description'}</p>
      ${metaItems ? `<div class="post-meta">${metaItems}</div>` : ''}
      <div class="post-author">
        <span>👤 ${p.author_name || 'Unknown'}</span>
        <span>${p.post_date?.slice(0,10) || ''}</span>
      </div>
      ${adminBtns}
    </div>`;

  return card;
}

// ── FEED ──────────────────────────────────────────────────────
let feedType       = '';
let feedAnimalType = '';

async function loadFeed() {
  const grid = document.getElementById('feedGrid');
  grid.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    let url = `/api/posts?limit=40`;
    if (feedType)       url += `&type=${feedType}`;
    if (feedAnimalType) url += `&animal_type_id=${feedAnimalType}`;

    const res  = await fetch(url);
    const data = await res.json();

    grid.innerHTML = '';
    if (!data.posts?.length) {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No posts found</div>
        <div class="empty-sub">Try a different filter or create the first post!</div>
      </div>`;
      return;
    }
    data.posts.forEach(p => grid.appendChild(renderPostCard(p)));
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load posts</div></div>`;
  }
}

// Feed filter pills
document.querySelectorAll('#feedFilterBar .filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#feedFilterBar .filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    feedType = pill.dataset.type || '';

    const animalSel = document.getElementById('animalTypeFilter');
    if (feedType === 'Adoption') {
      animalSel.style.display = 'block';
      populateAnimalSelect('animalTypeFilter');
    } else {
      animalSel.style.display = 'none';
      feedAnimalType = '';
    }
    loadFeed();
  });
});

document.getElementById('animalTypeFilter').addEventListener('change', function() {
  feedAnimalType = this.value;
  loadFeed();
});

// ── ADOPTIONS PAGE ────────────────────────────────────────────
async function loadAdoptionPage() {
  await populateAnimalSelect('adoptionAnimalFilter');
  await fetchAndRenderPosts('/api/posts?type=Adoption&limit=40', 'adoptionsGrid');
}

document.getElementById('adoptionAnimalFilter').addEventListener('change', async function() {
  let url = '/api/posts?type=Adoption&limit=40';
  if (this.value) url += `&animal_type_id=${this.value}`;
  await fetchAndRenderPosts(url, 'adoptionsGrid');
});

// ── BUY/SELL PAGE ─────────────────────────────────────────────
async function loadBuySellPage() {
  await fetchAndRenderPosts('/api/posts?type=BuySell&limit=40', 'buysellGrid');
}

document.querySelectorAll('#page-buysell .filter-pill').forEach(pill => {
  pill.addEventListener('click', async () => {
    document.querySelectorAll('#page-buysell .filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    let url = `/api/posts?type=BuySell&limit=40`;
    if (pill.dataset.cat) url += `&category=${pill.dataset.cat}`;
    await fetchAndRenderPosts(url, 'buysellGrid');
  });
});

// ── Shared fetch + render helper ──────────────────────────────
async function fetchAndRenderPosts(url, gridId) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const res  = await fetch(url);
    const data = await res.json();
    grid.innerHTML = '';
    if (!data.posts?.length) {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No posts found</div>
      </div>`;
      return;
    }
    data.posts.forEach(p => grid.appendChild(renderPostCard(p)));
  } catch (_) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load</div></div>`;
  }
}

// ── Populate animal type dropdowns ────────────────────────────
async function populateAnimalSelect(selectId) {
  try {
    const res  = await fetch('/api/animal-types');
    const types = await res.json();
    const sel  = document.getElementById(selectId);
    if (!sel) return;
    // Keep first "All" option
    while (sel.options.length > 1) sel.remove(1);
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value       = t.animal_type_id;
      opt.textContent = `${emojiForAnimal(t.name)} ${t.name}`;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

// ── Transactions ──────────────────────────────────────────────
async function loadTransactions() {
  const tbody = document.getElementById('transactionsBody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;">
    <div class="spinner" style="margin:auto;"></div></td></tr>`;
  try {
    const res  = await fetch('/api/donations/my/transactions', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted);">No transactions yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(t => `
      <tr>
        <td><span class="badge badge-purple">#${t.transaction_id}</span></td>
        <td>${t.campaign_title}</td>
        <td>${t.animal_type_name ? `${emojiForAnimal(t.animal_type_name)} ${t.animal_type_name}` : '<span style="color:var(--text-muted);">General</span>'}</td>
        <td><span style="color:var(--success);font-weight:700;">$${parseFloat(t.amount).toFixed(2)}</span></td>
        <td>${t.date?.slice(0,10)}</td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:20px;">${err.message}</td></tr>`;
  }
}

// ── Initial Load ──────────────────────────────────────────────
loadFeed();

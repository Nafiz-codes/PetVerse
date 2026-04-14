/* ============================================================
   donations.js — Donation campaigns page for user dashboard
   ============================================================ */

const animalEmoji2 = { Cat:'🐱', Dog:'🐶', Rabbit:'🐰', Bird:'🐦', Fish:'🐟', Hamster:'🐹', Snake:'🐍', Horse:'🐴' };
function emo(name) { return animalEmoji2[name] || '🐾'; }

// Populate donation animal filter
async function loadDonationsPage() {
  await populateDonAnimalFilter();
  await fetchDonations('');
}

async function populateDonAnimalFilter() {
  try {
    const res   = await fetch('/api/animal-types');
    const types = await res.json();
    const sel   = document.getElementById('donAnimalFilter');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.animal_type_id;
      opt.textContent = `${emo(t.name)} ${t.name}`;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

document.getElementById('donAnimalFilter').addEventListener('change', function() {
  fetchDonations(this.value);
});

async function fetchDonations(animalTypeId) {
  const grid = document.getElementById('donationsGrid');
  grid.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    let url = '/api/donations';
    if (animalTypeId) url += `?animal_type_id=${animalTypeId}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error('Failed to load campaigns');

    grid.innerHTML = '';
    if (!data.length) {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-icon">💝</div>
        <div class="empty-title">No campaigns found</div>
        <div class="empty-sub">Check back soon for new campaigns!</div>
      </div>`;
      return;
    }
    data.forEach(d => grid.appendChild(renderDonationCard(d)));
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load campaigns</div></div>`;
  }
}

function renderDonationCard(d) {
  const card = document.createElement('div');
  card.className = 'donation-card';

  const pct     = Math.min(parseFloat(d.progress_pct || 0), 100).toFixed(1);
  const current = parseFloat(d.current_amount || 0).toFixed(2);
  const target  = parseFloat(d.target_amount).toFixed(2);
  const isEnded = new Date(d.end_date) < new Date();

  const animalBadge = d.animal_type_name
    ? `<span class="badge badge-purple">${emo(d.animal_type_name)} ${d.animal_type_name}</span>`
    : `<span class="badge badge-cyan">🌍 General</span>`;

  card.innerHTML = `
    <div class="donation-header">
      <div>
        <div class="donation-title">${d.title}</div>
        ${animalBadge}
      </div>
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

    ${!isEnded ? `
      <div class="donate-input-row">
        <input type="number" class="form-control" id="amt-${d.donation_id}" placeholder="Amount ($)" min="1" step="0.01" />
        <button class="btn btn-primary btn-sm" onclick="donate(${d.donation_id})">💝 Donate</button>
      </div>` : `<p style="color:var(--text-muted);font-size:0.83rem;margin-top:10px;">This campaign has ended.</p>`}
  `;
  return card;
}

async function donate(donationId) {
  const input  = document.getElementById(`amt-${donationId}`);
  const amount = parseFloat(input?.value);

  if (!amount || amount <= 0) {
    showToast('Please enter a valid donation amount.', 'error');
    return;
  }

  const btn = input.nextElementSibling;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const res  = await fetch(`/api/donations/${donationId}/contribute`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Donation failed');

    showToast(`💝 Donation of $${amount.toFixed(2)} successful!`, 'success');

    // Update local balance display
    const chip = document.getElementById('balanceChip');
    if (chip) chip.textContent = `💰 $${parseFloat(data.new_balance).toFixed(2)}`;

    // Reload campaigns to update progress bars
    const filterVal = document.getElementById('donAnimalFilter').value;
    fetchDonations(filterVal);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '💝 Donate'; }
  }
}

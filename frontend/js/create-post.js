/* ============================================================
   create-post.js — Dynamic post creation form logic
   ============================================================ */

const postTypeSelect  = document.getElementById('postType');
const adoptionSection = document.getElementById('adoptionSection');
const buysellSection  = document.getElementById('buysellSection');
const bsCategorySelect= document.getElementById('bsCategory');
const medicineSection = document.getElementById('medicineSection');
const animalTypeSelect= document.getElementById('animalTypeSelect');
const newAnimalInput  = document.getElementById('newAnimalType');

// ── Load animal types into the select ────────────────────────
async function loadAnimalTypesForCreate() {
  try {
    const res   = await fetch('/api/animal-types');
    const types = await res.json();
    // Reset, keep placeholder
    while (animalTypeSelect.options.length > 1) animalTypeSelect.remove(1);
    const emoji = { Cat:'🐱', Dog:'🐶', Rabbit:'🐰', Bird:'🐦', Fish:'🐟', Hamster:'🐹', Snake:'🐍', Horse:'🐴' };
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value       = t.name;
      opt.textContent = `${emoji[t.name] || '🐾'} ${t.name}`;
      animalTypeSelect.appendChild(opt);
    });
    // Add "Other / New" option at bottom
    const other = document.createElement('option');
    other.value       = '__new__';
    other.textContent = '✏️ Enter new type below…';
    animalTypeSelect.appendChild(other);
  } catch (_) {}
}

// ── Show/hide sections based on post type ────────────────────
postTypeSelect.addEventListener('change', function() {
  const val = this.value;
  adoptionSection.style.display = val === 'Adoption' ? 'block' : 'none';
  buysellSection.style.display  = val === 'BuySell'  ? 'block' : 'none';

  if (val === 'Adoption') {
    loadAnimalTypesForCreate();
  }
  // Reset sub-sections
  medicineSection.style.display = 'none';
  bsCategorySelect.value = '';
});

// ── Show/hide medicine extra fields ──────────────────────────
bsCategorySelect.addEventListener('change', function() {
  medicineSection.style.display = this.value === 'Medicine' ? 'block' : 'none';
});

// ── Show/hide new animal type input ──────────────────────────
animalTypeSelect.addEventListener('change', function() {
  newAnimalInput.style.display = this.value === '__new__' ? 'block' : 'none';
  if (this.value !== '__new__') newAnimalInput.value = '';
});

// ── Form Submit ───────────────────────────────────────────────
document.getElementById('createPostForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const alertEl   = document.getElementById('createAlert');
  const successEl = document.getElementById('createSuccess');
  const btn       = document.getElementById('createPostBtn');
  alertEl.classList.remove('show');
  successEl.classList.remove('show');

  const post_type   = postTypeSelect.value;
  const description = document.getElementById('postDescription').value.trim();

  if (!post_type) {
    alertEl.textContent = 'Please select a post type.';
    alertEl.classList.add('show');
    return;
  }

  // Build payload
  const payload = { post_type, description };

  if (post_type === 'Adoption') {
    // Determine animal type name
    let animal_type_name = '';
    if (animalTypeSelect.value === '__new__' || !animalTypeSelect.value) {
      animal_type_name = newAnimalInput.value.trim();
    } else {
      animal_type_name = animalTypeSelect.value;
    }
    if (!animal_type_name) {
      alertEl.textContent = 'Please select or enter an animal type.';
      alertEl.classList.add('show');
      return;
    }
    payload.animal_type_name = animal_type_name;
    payload.animal_name      = document.getElementById('animalName').value.trim()    || undefined;
    payload.gender           = document.getElementById('animalGender').value         || undefined;
    payload.age              = document.getElementById('animalAge').value            || undefined;
    payload.location         = document.getElementById('animalLocation').value.trim()|| undefined;
  }

  if (post_type === 'BuySell') {
    const category = bsCategorySelect.value;
    if (!category) {
      alertEl.textContent = 'Please select a category (Medicine or Toys).';
      alertEl.classList.add('show');
      return;
    }
    payload.category    = category;
    payload.expire_date = document.getElementById('expireDate').value || undefined;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Publishing…';

  try {
    const res  = await fetch('/api/posts', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create post');

    successEl.textContent = `✅ Post published! (ID: #${data.post_id})`;
    successEl.classList.add('show');
    showToast('Post published successfully!', 'success');

    // Reset form
    document.getElementById('createPostForm').reset();
    adoptionSection.style.display = 'none';
    buysellSection.style.display  = 'none';
    medicineSection.style.display = 'none';
    newAnimalInput.style.display  = 'none';

    // Refresh balance
    refreshBalance();

    // Navigate to feed after short delay
    setTimeout(() => {
      showPage('feed');
      successEl.classList.remove('show');
    }, 2000);

  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.classList.add('show');
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Publish Post';
  }
});

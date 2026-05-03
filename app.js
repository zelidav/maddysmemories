const $ = id => document.getElementById(id);
const VIEWS = ['home', 'capture', 'edit', 'detail'];

const state = {
  photo: null,
  ocrText: '',
  editingId: null,
};

function show(view) {
  VIEWS.forEach(v => $(v).classList.toggle('active', v === view));
  window.scrollTo(0, 0);
}

function loadRecipes() {
  try { return JSON.parse(localStorage.getItem('recipes') || '[]'); }
  catch { return []; }
}
function saveRecipes(list) {
  localStorage.setItem('recipes', JSON.stringify(list));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderHome() {
  const all = loadRecipes().sort((a, b) => b.updatedAt - a.updatedAt);
  const q = ($('search')?.value || '').trim().toLowerCase();
  const recipes = q
    ? all.filter((r) =>
        [r.title, r.source, r.text].some((s) => (s || '').toLowerCase().includes(q))
      )
    : all;
  const list = $('recipe-list');
  list.innerHTML = '';
  if (!recipes.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = q
      ? `No recipes match "${q}".`
      : 'No recipes yet. Tap "New Recipe" to start.';
    list.appendChild(li);
    return;
  }
  for (const r of recipes) {
    const li = document.createElement('li');
    li.dataset.id = r.id;
    li.innerHTML = `
      <img src="${r.photo}" alt="">
      <div class="meta">
        <strong>${escapeHtml(r.title || 'Untitled')}</strong>
        <span>${escapeHtml(r.source || '')}</span>
      </div>
    `;
    li.addEventListener('click', () => openDetail(r.id));
    list.appendChild(li);
  }
}

$('search').addEventListener('input', renderHome);

const toolsMenu = $('tools-menu');
$('tools-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  toolsMenu.hidden = !toolsMenu.hidden;
});
document.addEventListener('click', (e) => {
  if (!toolsMenu.hidden && !toolsMenu.contains(e.target) && e.target.id !== 'tools-btn') {
    toolsMenu.hidden = true;
  }
});

$('export-all').addEventListener('click', () => {
  toolsMenu.hidden = true;
  const data = {
    exportedAt: new Date().toISOString(),
    version: 1,
    recipes: loadRecipes(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maddys-memories-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('import-json').addEventListener('click', () => {
  toolsMenu.hidden = true;
  $('import-file').click();
});

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const incoming = Array.isArray(data) ? data : data.recipes;
    if (!Array.isArray(incoming)) throw new Error('Not a recipes export.');
    const existing = loadRecipes();
    const byId = new Map(existing.map((r) => [r.id, r]));
    let added = 0, updated = 0;
    for (const r of incoming) {
      if (!r || !r.id || !r.title) continue;
      if (byId.has(r.id)) updated++;
      else added++;
      byId.set(r.id, r);
    }
    saveRecipes([...byId.values()]);
    renderHome();
    alert(`Imported. Added ${added}, updated ${updated}.`);
  } catch (err) {
    alert('Import failed: ' + (err.message || err));
  } finally {
    e.target.value = '';
  }
});

function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function compressImage(dataUrl, maxDim, quality) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

async function runOcr(dataUrl) {
  const endpoint = window.GRANDMA_OCR_ENDPOINT;
  if (!endpoint) {
    return { text: '', note: "Type the recipe below, or tap Dictate to speak it." };
  }
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUrl }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`OCR ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  return { text: data.text || '', note: '' };
}

$('add-recipe').addEventListener('click', () => {
  state.photo = null;
  state.ocrText = '';
  state.editingId = null;
  $('photo-input').value = '';
  $('preview-wrap').hidden = true;
  $('ocr-status').textContent = '';
  show('capture');
});

$('photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const rawDataUrl = await fileToDataUrl(file);
  const ocrSized = await compressImage(rawDataUrl, 1600, 0.85);
  const storedSized = await compressImage(rawDataUrl, 1200, 0.8);

  state.photo = storedSized;
  $('preview').src = storedSized;
  $('preview-wrap').hidden = false;

  const status = $('ocr-status');
  status.textContent = 'Reading the recipe…';
  $('continue').disabled = true;

  try {
    const result = await runOcr(ocrSized);
    state.ocrText = result.text || '';
    status.textContent = result.note
      || (state.ocrText
        ? 'Read it. You can fix anything wrong on the next step.'
        : "Couldn't read it clearly — that's OK, you can type or dictate next.");
  } catch (err) {
    state.ocrText = '';
    status.textContent = "Couldn't read the photo automatically — type or dictate it next.";
    console.error('OCR failed:', err);
  } finally {
    $('continue').disabled = false;
  }
});

$('retake').addEventListener('click', () => {
  $('photo-input').value = '';
  $('photo-input').click();
});

$('continue').addEventListener('click', () => {
  if (!state.editingId) {
    $('recipe-title').value = '';
    $('recipe-source').value = '';
  }
  $('recipe-text').value = state.ocrText;
  if (state.photo) $('e-photo').src = state.photo;
  show('edit');
});

function attachVoice(btn, target) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    btn.hidden = true;
    return;
  }
  let rec = null;
  let active = false;
  let baseline = '';

  const stop = () => {
    if (!active) return;
    active = false;
    try { rec && rec.stop(); } catch {}
    btn.classList.remove('recording');
    btn.textContent = 'Dictate';
  };

  const start = () => {
    if (active) return;
    rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    baseline = target.value ? target.value.replace(/\s+$/, '') + ' ' : '';
    rec.onresult = (e) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      target.value = baseline + txt;
    };
    rec.onerror = () => stop();
    rec.onend = () => stop();
    try { rec.start(); } catch { return; }
    active = true;
    btn.classList.add('recording');
    btn.textContent = 'Stop';
  };

  btn.addEventListener('click', () => active ? stop() : start());
}
attachVoice($('voice-source'), $('recipe-source'));
attachVoice($('voice-text'), $('recipe-text'));

$('save-recipe').addEventListener('click', () => {
  const title = $('recipe-title').value.trim();
  if (!title) {
    alert('Please give the recipe a name.');
    $('recipe-title').focus();
    return;
  }
  const recipes = loadRecipes();
  const id = state.editingId || ('r_' + Date.now());
  const existing = recipes.find(r => r.id === id);
  const recipe = {
    id,
    title,
    source: $('recipe-source').value.trim(),
    text: $('recipe-text').value.trim(),
    photo: state.photo || (existing && existing.photo) || '',
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
  const next = recipes.filter(r => r.id !== id);
  next.push(recipe);
  try {
    saveRecipes(next);
  } catch (err) {
    alert("This phone's storage is full. Delete a recipe or share one out, then try again.");
    return;
  }
  state.editingId = null;
  state.photo = null;
  state.ocrText = '';
  renderHome();
  show('home');
});

function openDetail(id) {
  const r = loadRecipes().find(r => r.id === id);
  if (!r) return;
  state.editingId = id;
  $('d-title').textContent = r.title;
  $('d-source').textContent = r.source;
  $('d-photo').src = r.photo;
  $('d-text').textContent = r.text;
  show('detail');
}

$('share-recipe').addEventListener('click', async () => {
  const r = loadRecipes().find(x => x.id === state.editingId);
  if (!r) return;
  const text = [
    r.title,
    r.source ? `— ${r.source}` : '',
    '',
    r.text,
  ].filter(Boolean).join('\n');

  try {
    if (navigator.canShare && r.photo) {
      const blob = await (await fetch(r.photo)).blob();
      const file = new File([blob], `${r.title || 'recipe'}.jpg`, { type: blob.type || 'image/jpeg' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: r.title, text, files: [file] });
        return;
      }
    }
    if (navigator.share) {
      await navigator.share({ title: r.title, text });
      return;
    }
    await navigator.clipboard.writeText(text);
    alert('Recipe text copied. Paste it anywhere.');
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    alert('Could not share: ' + (err && err.message || err));
  }
});

$('edit-recipe').addEventListener('click', () => {
  const r = loadRecipes().find(x => x.id === state.editingId);
  if (!r) return;
  state.photo = r.photo;
  state.ocrText = r.text;
  $('recipe-title').value = r.title;
  $('recipe-source').value = r.source;
  $('recipe-text').value = r.text;
  $('e-photo').src = r.photo || '';
  show('edit');
});

$('delete-recipe').addEventListener('click', () => {
  if (!confirm('Delete this recipe? This cannot be undone.')) return;
  const next = loadRecipes().filter(r => r.id !== state.editingId);
  saveRecipes(next);
  state.editingId = null;
  renderHome();
  show('home');
});

document.querySelectorAll('.back-btn').forEach(b => {
  b.addEventListener('click', () => {
    renderHome();
    show('home');
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

renderHome();

import { Recipe, JournalEntry, Comment } from './types';
import { authHeader } from './auth';

const API = import.meta.env.VITE_API_URL || '';
const LOCAL_ONLY = !API;

const REC_KEY = 'mm.recipes';
const JNL_KEY = 'mm.journal';
const CMT_KEY = 'mm.comments';

function load<T>(k: string): T[] {
  try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; }
}
function save<T>(k: string, v: T[]) { localStorage.setItem(k, JSON.stringify(v)); }
const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => Date.now();

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  return res.json();
}

/* ============ Recipes ============ */

export async function listRecipes(): Promise<Recipe[]> {
  if (LOCAL_ONLY) return load<Recipe>(REC_KEY).sort((a, b) => b.updatedAt - a.updatedAt);
  const { recipes } = await req<{ recipes: Recipe[] }>('/recipes');
  return recipes;
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  if (LOCAL_ONLY) return load<Recipe>(REC_KEY).find((r) => r.id === id) || null;
  return req<Recipe>(`/recipes/${id}`);
}

export async function saveRecipe(input: Partial<Recipe> & { id?: string }): Promise<Recipe> {
  if (LOCAL_ONLY) {
    const all = load<Recipe>(REC_KEY);
    const id = input.id || newId('rec');
    const existing = all.find((r) => r.id === id);
    const recipe: Recipe = {
      id,
      title: input.title || 'Untitled',
      source: input.source || '',
      forWhom: input.forWhom || '',
      category: input.category || 'other',
      prepTime: input.prepTime || '',
      ingredients: input.ingredients || '',
      instructions: input.instructions || '',
      text: input.text || '',
      photoUrl: input.photoUrl || existing?.photoUrl || '',
      photoThumbUrl: input.photoThumbUrl || existing?.photoThumbUrl,
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
    };
    const next = all.filter((r) => r.id !== id).concat(recipe);
    save(REC_KEY, next);
    return recipe;
  }
  const method = input.id ? 'PUT' : 'POST';
  const path = input.id ? `/recipes/${input.id}` : '/recipes';
  return req<Recipe>(path, { method, body: JSON.stringify(input) });
}

export async function deleteRecipe(id: string): Promise<void> {
  if (LOCAL_ONLY) {
    save(REC_KEY, load<Recipe>(REC_KEY).filter((r) => r.id !== id));
    return;
  }
  await req(`/recipes/${id}`, { method: 'DELETE' });
}

/* ============ Journal ============ */

export async function listJournal(): Promise<JournalEntry[]> {
  if (LOCAL_ONLY) {
    return load<JournalEntry>(JNL_KEY).sort((a, b) => (b.date.localeCompare(a.date)));
  }
  const { entries } = await req<{ entries: JournalEntry[] }>('/journal');
  return entries;
}

export async function getJournal(id: string): Promise<JournalEntry | null> {
  if (LOCAL_ONLY) return load<JournalEntry>(JNL_KEY).find((e) => e.id === id) || null;
  return req<JournalEntry>(`/journal/${id}`);
}

export async function saveJournal(input: Partial<JournalEntry> & { id?: string }): Promise<JournalEntry> {
  if (LOCAL_ONLY) {
    const all = load<JournalEntry>(JNL_KEY);
    const id = input.id || newId('jnl');
    const existing = all.find((e) => e.id === id);
    const entry: JournalEntry = {
      id,
      title: input.title || 'Untitled',
      body: input.body || '',
      date: input.date || new Date().toISOString().slice(0, 10),
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
    };
    save(JNL_KEY, all.filter((e) => e.id !== id).concat(entry));
    return entry;
  }
  const method = input.id ? 'PUT' : 'POST';
  const path = input.id ? `/journal/${input.id}` : '/journal';
  return req<JournalEntry>(path, { method, body: JSON.stringify(input) });
}

export async function deleteJournal(id: string): Promise<void> {
  if (LOCAL_ONLY) {
    save(JNL_KEY, load<JournalEntry>(JNL_KEY).filter((e) => e.id !== id));
    return;
  }
  await req(`/journal/${id}`, { method: 'DELETE' });
}

/* ============ Comments ============ */

export async function listComments(targetType: 'recipe' | 'journal', targetId: string): Promise<Comment[]> {
  if (LOCAL_ONLY) {
    return load<Comment>(CMT_KEY)
      .filter((c) => c.targetType === targetType && c.targetId === targetId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  const { comments } = await req<{ comments: Comment[] }>(`/comments?targetType=${targetType}&targetId=${targetId}`);
  return comments;
}

export async function addComment(c: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
  if (LOCAL_ONLY) {
    const all = load<Comment>(CMT_KEY);
    const comment: Comment = { ...c, id: newId('cmt'), createdAt: now() };
    save(CMT_KEY, all.concat(comment));
    return comment;
  }
  return req<Comment>('/comments', { method: 'POST', body: JSON.stringify(c) });
}

/* ============ Photo upload ============ */

export async function uploadPhoto(dataUrl: string): Promise<{ photoUrl: string; photoThumbUrl: string }> {
  if (LOCAL_ONLY) {
    return { photoUrl: dataUrl, photoThumbUrl: dataUrl };
  }
  return req<{ photoUrl: string; photoThumbUrl: string }>('/upload', {
    method: 'POST',
    body: JSON.stringify({ image: dataUrl }),
  });
}

/* ============ OCR ============ */

export interface OcrResult {
  text: string;
  notARecipe: boolean;
  title?: string;
  source?: string;
  category?: string;
  prepTime?: string;
  ingredientsList?: string[];
  instructionsList?: string[];
}

export async function ocr(dataUrl: string): Promise<OcrResult> {
  if (!API) {
    return { text: '', notARecipe: false };
  }
  const r = await req<{
    text: string;
    not_a_recipe?: boolean;
    title?: string;
    source?: string;
    category?: string;
    prep_time?: string;
    ingredients?: string[];
    instructions?: string[];
  }>('/ocr', {
    method: 'POST',
    body: JSON.stringify({ image: dataUrl }),
  });
  return {
    text: r.text || '',
    notARecipe: !!r.not_a_recipe,
    title: r.title,
    source: r.source,
    category: r.category,
    prepTime: r.prep_time,
    ingredientsList: r.ingredients,
    instructionsList: r.instructions,
  };
}

/* ============ Auth ping ============ */

export async function pingAuth(): Promise<{ role: 'admin' | 'family' | 'guest' }> {
  if (LOCAL_ONLY) return { role: 'guest' };
  return req<{ role: 'admin' | 'family' | 'guest' }>('/whoami');
}

export async function login(password: string, kind: 'admin' | 'family'): Promise<{ token: string }> {
  if (LOCAL_ONLY) {
    // local mode: any non-empty password is accepted, token is the password itself
    if (!password) throw new Error('Enter the password.');
    return { token: password };
  }
  return req<{ token: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ password, kind }),
  });
}

/* ============ Family Photos (rotating gallery) ============ */

export interface FamilyPhoto {
  id: string;
  src: string;
  thumb: string;
  width: number;
  height: number;
  aspect: number;
  portrait: boolean;
  caption?: string;
  uploaderName?: string;
  uploaderRole?: 'admin' | 'family';
  uploaderId?: string;
  createdAt: number;
}

export async function listFamilyPhotos(): Promise<FamilyPhoto[]> {
  if (LOCAL_ONLY) {
    try { return JSON.parse(localStorage.getItem('mm.family_photos') || '[]'); } catch { return []; }
  }
  const { photos } = await req<{ photos: FamilyPhoto[] }>('/photos');
  return photos;
}

export async function addFamilyPhoto(input: {
  image: string;
  caption?: string;
  uploaderName?: string;
  uploaderId?: string;
}): Promise<FamilyPhoto> {
  if (LOCAL_ONLY) {
    const id = newId('fam');
    const photo: FamilyPhoto = {
      id, src: input.image, thumb: input.image,
      width: 0, height: 0, aspect: 1, portrait: false,
      caption: input.caption, uploaderName: input.uploaderName,
      uploaderRole: 'admin', createdAt: now(),
    };
    const all = JSON.parse(localStorage.getItem('mm.family_photos') || '[]');
    all.unshift(photo);
    localStorage.setItem('mm.family_photos', JSON.stringify(all));
    return photo;
  }
  return req<FamilyPhoto>('/photos', { method: 'POST', body: JSON.stringify(input) });
}

export async function deleteFamilyPhoto(id: string, uploaderId?: string): Promise<void> {
  if (LOCAL_ONLY) {
    const all = JSON.parse(localStorage.getItem('mm.family_photos') || '[]');
    localStorage.setItem('mm.family_photos', JSON.stringify(all.filter((p: FamilyPhoto) => p.id !== id)));
    return;
  }
  await req(`/photos/${id}`, { method: 'DELETE', body: JSON.stringify({ uploaderId: uploaderId || '' }) });
}

export const isLocalOnly = LOCAL_ONLY;

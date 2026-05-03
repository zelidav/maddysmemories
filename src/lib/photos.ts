// Photos for backgrounds, hero carousel, and the memories strip.
// Two sources, merged:
//   - static: public/photos/manifest.json (curated by David)
//   - dynamic: GET /photos (uploaded by family)

import { listFamilyPhotos, FamilyPhoto } from './api';

export interface Photo {
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
  createdAt?: number;
  source: 'static' | 'family';
}

let cached: Photo[] | null = null;
let pending: Promise<Photo[]> | null = null;

async function fetchStatic(): Promise<Photo[]> {
  try {
    const r = await fetch('/photos/manifest.json');
    if (!r.ok) return [];
    const list = await r.json();
    return (list as Omit<Photo, 'source'>[]).map((p) => ({ ...p, source: 'static' }));
  } catch { return []; }
}

async function fetchFamily(): Promise<Photo[]> {
  try {
    const list = await listFamilyPhotos();
    return list.map((p: FamilyPhoto) => ({ ...p, source: 'family' as const }));
  } catch { return []; }
}

export async function loadPhotos(): Promise<Photo[]> {
  if (cached) return cached;
  if (!pending) {
    pending = Promise.all([fetchStatic(), fetchFamily()])
      .then(([s, f]) => {
        const merged = [...f, ...s];
        cached = merged;
        return merged;
      });
  }
  return pending;
}

export function invalidatePhotos() {
  cached = null;
  pending = null;
}

export function pickRandom<T>(list: T[]): T | undefined {
  if (!list.length) return undefined;
  return list[Math.floor(Math.random() * list.length)];
}

export function shuffle<T>(list: T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const UPLOADER_KEY = 'mm.uploader_id';
export function getUploaderId(): string {
  let id = localStorage.getItem(UPLOADER_KEY);
  if (!id) {
    id = 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(UPLOADER_KEY, id);
  }
  return id;
}

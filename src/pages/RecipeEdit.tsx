import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getRecipe, ocr, saveRecipe, uploadPhoto, isLocalOnly } from '../lib/api';
import { Recipe, RECIPE_CATEGORIES, RecipeCategory } from '../lib/types';
import { compressImage, fileToDataUrl } from '../lib/photo';
import { makeVoice } from '../lib/voice';

const DRAFT_KEY = 'mm.recipe.draft';

export default function RecipeEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = !id;

  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [forWhom, setForWhom] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('other');
  const [prepTime, setPrepTime] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [text, setText] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoThumbUrl, setPhotoThumbUrl] = useState<string | undefined>();
  const [ocrStatus, setOcrStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) {
      // restore draft for new
      try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (d) {
          setTitle(d.title || ''); setSource(d.source || ''); setForWhom(d.forWhom || '');
          setCategory(d.category || 'other'); setPrepTime(d.prepTime || '');
          setIngredients(d.ingredients || ''); setInstructions(d.instructions || '');
          setText(d.text || ''); setPhotoUrl(d.photoUrl || ''); setPhotoThumbUrl(d.photoThumbUrl);
        }
      } catch {}
      return;
    }
    getRecipe(id).then((r) => {
      if (!r) { setErr('Not found.'); return; }
      setTitle(r.title); setSource(r.source); setForWhom(r.forWhom);
      setCategory(r.category); setPrepTime(r.prepTime);
      setIngredients(r.ingredients); setInstructions(r.instructions);
      setText(r.text); setPhotoUrl(r.photoUrl); setPhotoThumbUrl(r.photoThumbUrl);
    });
  }, [id]);

  // autosave draft for new only
  useEffect(() => {
    if (id) return;
    const d = { title, source, forWhom, category, prepTime, ingredients, instructions, text, photoUrl, photoThumbUrl };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  }, [id, title, source, forWhom, category, prepTime, ingredients, instructions, text, photoUrl, photoThumbUrl]);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrStatus('Reading the recipe card…');
    try {
      const raw = await fileToDataUrl(file);
      const ocrSized = await compressImage(raw, 1600, 0.85);
      const stored = await compressImage(raw, 1400, 0.82);

      // Upload (or fall back to data URL in local mode)
      const { photoUrl: pu, photoThumbUrl: tu } = await uploadPhoto(stored);
      setPhotoUrl(pu);
      setPhotoThumbUrl(tu);

      try {
        const r = await ocr(ocrSized);
        if (r.notARecipe) {
          setOcrStatus('That doesn\'t look like a recipe — but the photo is saved.');
        } else if (r.text) {
          setText(r.text);
          setOcrStatus('Read it. Edit anything that came through wrong.');
        } else if (isLocalOnly) {
          setOcrStatus('Photo saved. Type or dictate the recipe below.');
        } else {
          setOcrStatus('We couldn\'t read this one — type or dictate the recipe below.');
        }
      } catch (oe: any) {
        setOcrStatus('We saved the photo. Type or dictate the recipe below.');
        console.warn('OCR failed:', oe);
      }
    } catch (e: any) {
      setErr(e.message || 'Could not load that photo.');
      setOcrStatus('');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErr('Please give the recipe a name.'); return; }
    setBusy(true);
    setErr('');
    try {
      const saved = await saveRecipe({
        id, title: title.trim(), source: source.trim(), forWhom: forWhom.trim(),
        category, prepTime: prepTime.trim(),
        ingredients, instructions, text,
        photoUrl, photoThumbUrl,
      } as Partial<Recipe>);
      if (isNew) localStorage.removeItem(DRAFT_KEY);
      nav(`/recipes/${saved.id}`, { replace: true });
    } catch (e: any) {
      setErr(e.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="section-head">
        <h1>{isNew ? 'New recipe' : 'Edit recipe'}</h1>
      </div>

      <form className="edit-form" onSubmit={submit}>
        <div className="edit-photo">
          {photoUrl ? (
            <img src={photoUrl} alt="Recipe card" />
          ) : (
            <div className="placeholder">Take a photo of the card</div>
          )}
          <div className="photo-actions">
            <label className="btn btn-primary">
              {photoUrl ? 'Retake photo' : 'Take photo'}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={onPhoto}
              />
            </label>
          </div>
          {ocrStatus && <div className="ocr-status">{ocrStatus}</div>}
        </div>

        <div className="edit-fields">
          <label htmlFor="title">Recipe name</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Grandma's Apple Pie" />

          <div className="field-row">
            <div>
              <label htmlFor="cat">Category</label>
              <select id="cat" value={category} onChange={(e) => setCategory(e.target.value as RecipeCategory)}>
                {RECIPE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="time">Prep / cook time</label>
              <input id="time" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="e.g. 30 min" />
            </div>
          </div>

          <label htmlFor="src">Where is this recipe from?</label>
          <DictatableTextarea
            id="src"
            value={source}
            onChange={setSource}
            rows={2}
            placeholder="From Aunt Rose, summer 1962"
          />

          <label htmlFor="for">Who would love this? <span className="optional">(optional)</span></label>
          <input id="for" value={forWhom} onChange={(e) => setForWhom(e.target.value)} placeholder="e.g. for the grandkids" />

          <label htmlFor="ing">Ingredients</label>
          <DictatableTextarea
            id="ing"
            value={ingredients}
            onChange={setIngredients}
            rows={6}
            placeholder="One per line"
          />

          <label htmlFor="ins">Instructions</label>
          <DictatableTextarea
            id="ins"
            value={instructions}
            onChange={setInstructions}
            rows={8}
            placeholder="Steps in order"
          />

          {text && (
            <details style={{ marginTop: '1.25rem' }}>
              <summary className="muted" style={{ cursor: 'pointer', fontStyle: 'italic' }}>
                Original transcription from the photo
              </summary>
              <DictatableTextarea
                value={text}
                onChange={setText}
                rows={6}
                placeholder=""
              />
            </details>
          )}

          {err && <div className="error-banner">{err}</div>}

          <div className="btn-row">
            <button className="btn btn-primary btn-large" disabled={busy}>
              {busy ? 'Saving…' : 'Save recipe'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => history.back()}>Cancel</button>
          </div>
        </div>
      </form>
    </>
  );
}

function DictatableTextarea({
  id, value, onChange, rows, placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  placeholder: string;
}) {
  const [recording, setRecording] = useState(false);
  const voiceRef = useRef(makeVoice());
  const v = voiceRef.current;

  const toggle = () => {
    if (recording) { v.stop(); setRecording(false); }
    else { v.start((t) => onChange(t), value); setRecording(true); }
  };

  return (
    <>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
      {v.supported && (
        <button type="button" className={'dictate-btn' + (recording ? ' active' : '')} onClick={toggle}>
          {recording ? 'Stop dictating' : 'Dictate'}
        </button>
      )}
    </>
  );
}

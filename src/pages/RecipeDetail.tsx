import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteRecipe, getRecipe } from '../lib/api';
import { Recipe } from '../lib/types';
import { fbShareUrl, previewUrl, shareRecipe } from '../lib/share';
import { scaleBlock } from '../lib/scale';
import Comments from '../components/Comments';

export default function RecipeDetail({ readOnly = false }: { readOnly?: boolean }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [r, setR] = useState<Recipe | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!id) return;
    getRecipe(id).then((x) => { setR(x); setLoaded(true); });
  }, [id]);

  if (!loaded) return <div className="empty-state"><p>Opening the card…</p></div>;
  if (!r) return <div className="empty-state"><h3>Not here</h3><p>That recipe couldn't be found.</p></div>;

  const familyUrl = `${location.origin}/family/recipes/${r.id}`;
  const fbPreviewUrl = previewUrl('recipes', r.id);

  const onShare = async () => {
    try {
      await shareRecipe({
        title: r.title,
        text: [r.title, r.source && `— ${r.source}`, '', r.ingredients, '', r.instructions]
          .filter(Boolean)
          .join('\n'),
        url: familyUrl,
        photoUrl: r.photoUrl,
      });
    } catch (e: any) {
      setErr(e.message || 'Could not share.');
    }
  };

  const onDelete = async () => {
    if (!confirm('Delete this recipe? This cannot be undone.')) return;
    await deleteRecipe(r.id);
    nav('/recipes', { replace: true });
  };

  return (
    <article className="recipe-card-page">
      <div className="photo-stack">
        {r.photoUrl ? (
          <>
            <img src={r.photoUrl} alt={`Recipe card for ${r.title}`} />
            <div className="photo-caption">Grandma's handwriting, preserved.</div>
          </>
        ) : (
          <div className="placeholder" style={{ aspectRatio: '4/3', display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--cream-deep)', color: 'var(--ink-soft)' }}>
            No photo
          </div>
        )}
      </div>

      <div className="recipe-card-paper">
        <h1>{r.title}</h1>
        {r.source && <div className="source">— {r.source}</div>}
        <div className="meta-row">
          {r.category && r.category !== 'other' && <span className="tag tag-sage">{r.category}</span>}
          {r.prepTime && <span className="tag tag-sun">{r.prepTime}</span>}
          {r.forWhom && <span className="tag">for {r.forWhom}</span>}
        </div>

        {r.ingredients && (
          <>
            <h3>Ingredients</h3>
            <div className="scale-row" role="group" aria-label="Scale recipe">
              <span className="muted" style={{ fontSize: '0.85rem', marginRight: '0.5rem' }}>Make:</span>
              {[0.5, 1, 2, 3].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={'chip' + (scale === s ? ' active' : '')}
                  onClick={() => setScale(s)}
                >
                  {s === 1 ? 'as written' : `${s}×`}
                </button>
              ))}
            </div>
            <div className="ingredients">{scaleBlock(r.ingredients, scale)}</div>
            {scale !== 1 && (
              <details className="muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <summary style={{ cursor: 'pointer', fontStyle: 'italic' }}>See original quantities</summary>
                <div className="ingredients" style={{ marginTop: '0.5rem' }}>{r.ingredients}</div>
              </details>
            )}
          </>
        )}
        {r.instructions && (
          <>
            <h3>Instructions</h3>
            <div className="instructions">{r.instructions}</div>
          </>
        )}
        {!r.ingredients && !r.instructions && r.text && (
          <>
            <h3>Recipe</h3>
            <div className="raw-text">{r.text}</div>
          </>
        )}
        {r.text && (r.ingredients || r.instructions) && (
          <details style={{ marginTop: '1.5rem' }}>
            <summary className="muted italic" style={{ cursor: 'pointer' }}>
              See the original transcription
            </summary>
            <div className="raw-text" style={{ marginTop: '0.5rem' }}>{r.text}</div>
          </details>
        )}

        {err && <div className="error-banner">{err}</div>}

        <div className="btn-row">
          <button className="btn btn-primary" onClick={onShare}>Share</button>
          <a className="btn btn-fb" href={fbShareUrl(fbPreviewUrl)} target="_blank" rel="noreferrer">
            <svg className="fb-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M22 12.07C22 6.51 17.52 2 12 2S2 6.51 2 12.07c0 5 3.66 9.15 8.44 9.93v-7.02H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33v7.02C18.34 21.22 22 17.07 22 12.07Z"/>
            </svg>
            Share to Facebook
          </a>
          {!readOnly && (
            <>
              <Link className="btn" to={`/recipes/${r.id}/edit`}>Edit</Link>
              <button type="button" className="btn btn-ghost" style={{ color: 'var(--tulip-deep)' }} onClick={onDelete}>
                Delete
              </button>
            </>
          )}
        </div>

        <Comments targetType="recipe" targetId={r.id} />
      </div>
    </article>
  );
}

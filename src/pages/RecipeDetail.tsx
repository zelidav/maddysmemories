import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteRecipe, getRecipe } from '../lib/api';
import { Recipe } from '../lib/types';
import { fbShareUrl, shareRecipe } from '../lib/share';
import Comments from '../components/Comments';

export default function RecipeDetail({ readOnly = false }: { readOnly?: boolean }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [r, setR] = useState<Recipe | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    getRecipe(id).then((x) => { setR(x); setLoaded(true); });
  }, [id]);

  if (!loaded) return <div className="empty-state"><p>Opening the card…</p></div>;
  if (!r) return <div className="empty-state"><h3>Not here</h3><p>That recipe couldn't be found.</p></div>;

  const pageUrl = `${location.origin}/family/recipes/${r.id}`;

  const onShare = async () => {
    try {
      await shareRecipe({
        title: r.title,
        text: [r.title, r.source && `— ${r.source}`, '', r.ingredients, '', r.instructions]
          .filter(Boolean)
          .join('\n'),
        url: pageUrl,
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
            <div className="ingredients">{r.ingredients}</div>
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
          <a className="btn" href={fbShareUrl(pageUrl)} target="_blank" rel="noreferrer">
            Post to Facebook
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

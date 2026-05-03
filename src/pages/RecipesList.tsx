import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listRecipes } from '../lib/api';
import { Recipe, RECIPE_CATEGORIES, RecipeCategory } from '../lib/types';

export default function RecipesList() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<RecipeCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listRecipes().then((r) => { if (mounted) { setRecipes(r); setLoading(false); } });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return recipes.filter((r) => {
      if (cat !== 'all' && r.category !== cat) return false;
      if (!ql) return true;
      return [r.title, r.source, r.forWhom, r.text, r.ingredients, r.instructions]
        .some((s) => (s || '').toLowerCase().includes(ql));
    });
  }, [recipes, q, cat]);

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Recipes</h1>
          <div className="section-sub">From the recipe box.</div>
        </div>
        <Link to="/recipes/new" className="btn btn-primary">New recipe</Link>
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search recipes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="chip-row" style={{ marginBottom: '1.25rem' }}>
        <button className={`chip ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>All</button>
        {RECIPE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`chip ${cat === c.id ? 'active' : ''}`}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><p>Opening the recipe box…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>{recipes.length === 0 ? 'The box is empty' : 'Nothing matches'}</h3>
          <p>
            {recipes.length === 0
              ? 'Tap "New recipe" to photograph your first card.'
              : 'Try a different search or category.'}
          </p>
        </div>
      ) : (
        <div className="recipe-grid">
          {filtered.map((r) => (
            <Link key={r.id} to={`/recipes/${r.id}`} className="recipe-card-tile">
              {r.photoThumbUrl || r.photoUrl ? (
                <img className="photo" src={r.photoThumbUrl || r.photoUrl} alt="" />
              ) : (
                <div className="photo" />
              )}
              <div className="body">
                <h3>{r.title || 'Untitled'}</h3>
                {r.source && <div className="source">{r.source}</div>}
                <div className="meta-row">
                  {r.category && r.category !== 'other' && (
                    <span className="tag tag-sage">{r.category}</span>
                  )}
                  {r.prepTime && <span className="tag tag-sun">{r.prepTime}</span>}
                  {r.forWhom && <span className="tag">for {r.forWhom}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

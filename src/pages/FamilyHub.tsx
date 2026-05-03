import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listJournal, listRecipes } from '../lib/api';
import { JournalEntry, Recipe } from '../lib/types';
import FloralAccent from '../components/FloralAccent';
import MemoriesStrip from '../components/MemoriesStrip';

function formatDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function FamilyHub() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listRecipes(), listJournal()]).then(([r, j]) => {
      setRecipes(r);
      setEntries(j);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <section className="home-hero">
        <img src="/maddy-avatar.jpg" alt="Maddy" className="hero-avatar" />
        <h1 className="serif">From Grandma's kitchen</h1>
        <p className="muted">Recipes she's preserved, stories she's told.</p>
      </section>

      <MemoriesStrip count={8} title="A few memories" />

      {loading ? (
        <div className="empty-state"><p>Opening Grandma's box…</p></div>
      ) : (
        <>
          <div className="section-head" style={{ marginTop: '2rem' }}>
            <div>
              <h2>Recent recipes</h2>
              <div className="section-sub">Tap to read the card.</div>
            </div>
          </div>

          {recipes.length === 0 ? (
            <div className="empty-state"><p>No recipes yet — check back soon.</p></div>
          ) : (
            <div className="recipe-grid">
              {recipes.slice(0, 9).map((r) => (
                <Link key={r.id} to={`/family/recipes/${r.id}`} className="recipe-card-tile">
                  {r.photoThumbUrl || r.photoUrl ? (
                    <img className="photo" src={r.photoThumbUrl || r.photoUrl} alt="" />
                  ) : <div className="photo" />}
                  <div className="body">
                    <h3>{r.title}</h3>
                    {r.source && <div className="source">{r.source}</div>}
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="section-head" style={{ marginTop: '2.5rem' }}>
            <div>
              <h2>Recent stories</h2>
              <div className="section-sub">From her journal.</div>
            </div>
            <FloralAccent variant="leaf" className="" />
          </div>

          {entries.length === 0 ? (
            <div className="empty-state"><p>No stories written yet.</p></div>
          ) : (
            <div className="journal-timeline">
              {entries.slice(0, 6).map((e) => (
                <Link key={e.id} to={`/family/journal/${e.id}`} className="journal-entry">
                  <div className="date">{formatDate(e.date)}</div>
                  <h3>{e.title}</h3>
                  <div className="preview">{e.body}</div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

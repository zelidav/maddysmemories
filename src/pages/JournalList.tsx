import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listJournal } from '../lib/api';
import { JournalEntry } from '../lib/types';

function formatDate(iso: string) {
  // YYYY-MM-DD → "May 3, 2026"
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function JournalList() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listJournal().then((e) => { setEntries(e); setLoading(false); });
  }, []);

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Journal</h1>
          <div className="section-sub">Stories, memories, the small things.</div>
        </div>
        <Link to="/journal/new" className="btn btn-primary">New entry</Link>
      </div>

      {loading ? (
        <div className="empty-state"><p>Opening the journal…</p></div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <h3>The journal is fresh</h3>
          <p>Start with whatever's on your mind today.</p>
          <Link to="/journal/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>Write the first entry</Link>
        </div>
      ) : (
        <div className="journal-timeline">
          {entries.map((e) => (
            <Link key={e.id} to={`/journal/${e.id}`} className="journal-entry">
              <div className="date">{formatDate(e.date)}</div>
              <h3>{e.title}</h3>
              <div className="preview">{e.body}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

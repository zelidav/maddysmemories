import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteJournal, getJournal } from '../lib/api';
import { JournalEntry } from '../lib/types';
import { fbShareUrl, shareRecipe } from '../lib/share';
import Comments from '../components/Comments';

function formatDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function JournalDetail({ readOnly = false }: { readOnly?: boolean }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [e, setE] = useState<JournalEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    getJournal(id).then((x) => { setE(x); setLoaded(true); });
  }, [id]);

  if (!loaded) return <div className="empty-state"><p>Opening the page…</p></div>;
  if (!e) return <div className="empty-state"><h3>Not here</h3><p>That entry couldn't be found.</p></div>;

  const pageUrl = `${location.origin}/family/journal/${e.id}`;

  const onShare = async () => {
    try {
      await shareRecipe({
        title: e.title,
        text: `${e.title}\n${formatDate(e.date)}\n\n${e.body}`,
        url: pageUrl,
      });
    } catch (er: any) {
      setErr(er.message || 'Could not share.');
    }
  };

  const onDelete = async () => {
    if (!confirm('Delete this entry?')) return;
    await deleteJournal(e.id);
    nav('/journal', { replace: true });
  };

  return (
    <article className="journal-page">
      <div className="date">{formatDate(e.date)}</div>
      <h1>{e.title}</h1>
      <div className="body">{e.body}</div>

      {err && <div className="error-banner" style={{ marginTop: '1rem' }}>{err}</div>}

      <div className="btn-row">
        <button className="btn btn-primary" onClick={onShare}>Share</button>
        <a className="btn" href={fbShareUrl(pageUrl)} target="_blank" rel="noreferrer">Post to Facebook</a>
        {!readOnly && (
          <>
            <Link className="btn" to={`/journal/${e.id}/edit`}>Edit</Link>
            <button type="button" className="btn btn-ghost" style={{ color: 'var(--tulip-deep)' }} onClick={onDelete}>
              Delete
            </button>
          </>
        )}
      </div>

      <Comments targetType="journal" targetId={e.id} />
    </article>
  );
}

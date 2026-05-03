import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteJournal, getJournal } from '../lib/api';
import { JournalEntry } from '../lib/types';
import { fbShareUrl, previewUrl, shareRecipe } from '../lib/share';
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

  const familyUrl = `${location.origin}/family/journal/${e.id}`;
  const fbPreviewUrl = previewUrl('journal', e.id);

  const onShare = async () => {
    try {
      await shareRecipe({
        title: e.title,
        text: `${e.title}\n${formatDate(e.date)}\n\n${e.body}`,
        url: familyUrl,
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
        <a className="btn btn-fb" href={fbShareUrl(fbPreviewUrl)} target="_blank" rel="noreferrer">
          <svg className="fb-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M22 12.07C22 6.51 17.52 2 12 2S2 6.51 2 12.07c0 5 3.66 9.15 8.44 9.93v-7.02H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33v7.02C18.34 21.22 22 17.07 22 12.07Z"/>
          </svg>
          Share to Facebook
        </a>
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

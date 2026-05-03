import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getJournal, saveJournal } from '../lib/api';
import { makeVoice } from '../lib/voice';

const todayISO = () => new Date().toISOString().slice(0, 10);
const DRAFT_KEY = 'mm.journal.draft';

export default function JournalEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = !id;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayISO());
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [recording, setRecording] = useState(false);
  const voiceRef = useRef(makeVoice());

  useEffect(() => {
    if (!id) {
      try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (d) { setTitle(d.title || ''); setBody(d.body || ''); setDate(d.date || todayISO()); }
      } catch {}
      return;
    }
    getJournal(id).then((e) => {
      if (!e) { setErr('Not found.'); return; }
      setTitle(e.title); setDate(e.date); setBody(e.body);
    });
  }, [id]);

  useEffect(() => {
    if (id) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, date, body }));
  }, [id, title, date, body]);

  const toggleVoice = () => {
    const v = voiceRef.current;
    if (recording) { v.stop(); setRecording(false); }
    else { v.start((t) => setBody(t), body); setRecording(true); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErr('Give it a title — even just a few words.'); return; }
    setBusy(true);
    setErr('');
    try {
      const saved = await saveJournal({ id, title: title.trim(), date, body });
      if (isNew) localStorage.removeItem(DRAFT_KEY);
      nav(`/journal/${saved.id}`, { replace: true });
    } catch (e: any) {
      setErr(e.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const v = voiceRef.current;

  return (
    <>
      <div className="section-head">
        <h1>{isNew ? 'New journal entry' : 'Edit entry'}</h1>
      </div>

      <form className="journal-page" onSubmit={submit}>
        <div className="field-row">
          <div>
            <label htmlFor="d">Date</label>
            <input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="t">Title</label>
            <input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A line about what this is" />
          </div>
        </div>

        <label htmlFor="b">Story</label>
        <textarea id="b" rows={14} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write what's on your mind…" />
        {v.supported && (
          <button type="button" className={'dictate-btn' + (recording ? ' active' : '')} onClick={toggleVoice}>
            {recording ? 'Stop dictating' : 'Dictate'}
          </button>
        )}

        {err && <div className="error-banner" style={{ marginTop: '1rem' }}>{err}</div>}

        <div className="btn-row">
          <button className="btn btn-primary btn-large" disabled={busy}>
            {busy ? 'Saving…' : 'Save entry'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => history.back()}>Cancel</button>
        </div>
      </form>
    </>
  );
}

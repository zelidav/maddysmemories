import { useEffect, useState } from 'react';
import { addComment, listComments } from '../lib/api';
import { Comment } from '../lib/types';
import { getCommenterName, role, setCommenterName } from '../lib/auth';

interface Props {
  targetType: 'recipe' | 'journal';
  targetId: string;
}

export default function Comments({ targetType, targetId }: Props) {
  const [items, setItems] = useState<Comment[]>([]);
  const [name, setName] = useState(getCommenterName());
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const r = role();

  useEffect(() => {
    listComments(targetType, targetId).then(setItems).catch(() => {});
  }, [targetType, targetId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const c = await addComment({ targetType, targetId, name: name.trim(), body: body.trim() });
      setItems((prev) => [...prev, c]);
      setBody('');
      setCommenterName(name.trim());
    } finally { setBusy(false); }
  };

  return (
    <div className="comments">
      <h3>Notes from the family</h3>
      {items.length === 0 && <p className="muted">No notes yet — be the first.</p>}
      {items.map((c) => (
        <div key={c.id} className="comment">
          <div>
            <span className="who">{c.name}</span>
            <span className="when">{new Date(c.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="body">{c.body}</div>
        </div>
      ))}
      {r !== 'guest' && (
        <form className="comment-form" onSubmit={submit}>
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            placeholder="Leave a note for Grandma…"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button className="btn btn-primary" disabled={busy || !name.trim() || !body.trim()}>
            {busy ? 'Posting…' : 'Post note'}
          </button>
        </form>
      )}
    </div>
  );
}

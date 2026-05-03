import { useEffect, useState } from 'react';
import { loadPhotos, shuffle, Photo, invalidatePhotos, getUploaderId } from '../lib/photos';
import { deleteFamilyPhoto } from '../lib/api';
import { role } from '../lib/auth';
import AddPhotoButton from './AddPhotoButton';

interface Props {
  count?: number;
  title?: string;
}

export default function MemoriesStrip({ count = 12, title = 'A few memories' }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [open, setOpen] = useState<Photo | null>(null);
  const [reload, setReload] = useState(0);
  const r = role();

  useEffect(() => {
    let alive = true;
    loadPhotos().then((all) => {
      if (alive) setPhotos(shuffle(all).slice(0, count));
    });
    return () => { alive = false; };
  }, [count, reload]);

  const refresh = () => {
    invalidatePhotos();
    setReload((n) => n + 1);
  };

  const onDelete = async () => {
    if (!open || open.source !== 'family') return;
    if (!confirm('Remove this photo from the album?')) return;
    try {
      await deleteFamilyPhoto(open.id, getUploaderId());
      setOpen(null);
      refresh();
    } catch (e: any) {
      alert(e.message || 'Could not remove this photo.');
    }
  };

  const canDelete = open && open.source === 'family' &&
    (r === 'admin' || open.uploaderId === getUploaderId());

  return (
    <section className="memories-strip">
      <div className="section-head" style={{ marginBottom: '0.75rem' }}>
        <div>
          <h2>{title}</h2>
          <div className="section-sub">Tap to look closer.</div>
        </div>
        {r !== 'guest' && <AddPhotoButton onAdded={refresh} />}
      </div>
      {photos.length === 0 ? (
        <div className="empty-state"><p>No photos yet — be the first.</p></div>
      ) : (
        <div className="memories-tiles">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              className={'memory-tile' + (p.portrait ? ' portrait' : '')}
              onClick={() => setOpen(p)}
              aria-label={p.caption || 'Open photo'}
            >
              <img src={p.thumb} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="memory-lightbox" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="lightbox-stage">
            <img src={open.src} alt={open.caption || ''} />
            {(open.caption || open.uploaderName) && (
              <div className="lightbox-caption">
                {open.caption && <div className="text">{open.caption}</div>}
                {open.uploaderName && (
                  <div className="who">— shared by {open.uploaderName}</div>
                )}
              </div>
            )}
            {canDelete && (
              <button type="button" className="btn btn-ghost lightbox-delete" onClick={onDelete}>
                Remove
              </button>
            )}
          </div>
          <button className="memory-close" type="button" aria-label="Close" onClick={() => setOpen(null)}>×</button>
        </div>
      )}
    </section>
  );
}

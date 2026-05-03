import { useEffect, useState } from 'react';
import { loadPhotos, shuffle, Photo } from '../lib/photos';

interface Props {
  count?: number;
  title?: string;
}

export default function MemoriesStrip({ count = 8, title = 'A few memories' }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [open, setOpen] = useState<Photo | null>(null);

  useEffect(() => {
    loadPhotos().then((all) => setPhotos(shuffle(all).slice(0, count)));
  }, [count]);

  if (!photos.length) return null;

  return (
    <section className="memories-strip">
      <div className="section-head" style={{ marginBottom: '0.75rem' }}>
        <div>
          <h2>{title}</h2>
          <div className="section-sub">Tap to look closer.</div>
        </div>
      </div>
      <div className="memories-tiles">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            className={'memory-tile' + (p.portrait ? ' portrait' : '')}
            onClick={() => setOpen(p)}
            aria-label="Open photo"
          >
            <img src={p.thumb} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {open && (
        <div className="memory-lightbox" onClick={() => setOpen(null)}>
          <img src={open.src} alt="" />
          <button className="memory-close" type="button" aria-label="Close">×</button>
        </div>
      )}
    </section>
  );
}

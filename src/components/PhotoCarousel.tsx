import { useEffect, useRef, useState } from 'react';
import { loadPhotos, shuffle, Photo } from '../lib/photos';

export default function PhotoCarousel({ intervalMs = 5000 }: { intervalMs?: number }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    loadPhotos().then((all) => {
      if (!alive) return;
      setPhotos(shuffle(all));
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (photos.length <= 1) return;
    timerRef.current = setInterval(() => setIdx((i) => (i + 1) % photos.length), intervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [photos, intervalMs]);

  if (!photos.length) return null;
  return (
    <div className="photo-carousel">
      {photos.map((p, i) => (
        <img
          key={p.id}
          src={p.src}
          alt=""
          className={i === idx ? 'on' : ''}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}
      <div className="photo-carousel-dots">
        {photos.map((p, i) => (
          <button
            key={p.id}
            className={'dot' + (i === idx ? ' on' : '')}
            aria-label={`Photo ${i + 1}`}
            onClick={() => setIdx(i)}
          />
        ))}
      </div>
    </div>
  );
}

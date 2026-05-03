import { useEffect, useState } from 'react';
import { loadPhotos, pickRandom, Photo } from '../lib/photos';

interface Props {
  /** ms between rotations; 0 = static */
  rotateMs?: number;
  className?: string;
}

export default function PhotoBackdrop({ rotateMs = 0, className = '' }: Props) {
  const [photo, setPhoto] = useState<Photo | undefined>();

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    loadPhotos().then((all) => {
      if (!alive) return;
      setPhoto(pickRandom(all));
      if (rotateMs > 0 && all.length > 1) {
        timer = setInterval(() => {
          setPhoto((prev) => {
            const others = prev ? all.filter((p) => p.id !== prev.id) : all;
            return pickRandom(others);
          });
        }, rotateMs);
      }
    });
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [rotateMs]);

  if (!photo) return null;
  return (
    <div className={`photo-backdrop ${className}`}>
      <img src={photo.src} alt="" />
      <div className="photo-backdrop-overlay" />
    </div>
  );
}

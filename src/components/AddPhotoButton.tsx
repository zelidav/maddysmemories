import { useRef, useState } from 'react';
import { addFamilyPhoto } from '../lib/api';
import { compressImage, fileToDataUrl } from '../lib/photo';
import { getUploaderId, invalidatePhotos } from '../lib/photos';
import { getCommenterName, role, setCommenterName } from '../lib/auth';

export default function AddPhotoButton({ onAdded }: { onAdded?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [name, setName] = useState(getCommenterName());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const r = role();
  const askName = r === 'family';

  if (r === 'guest') return null;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    try {
      const raw = await fileToDataUrl(file);
      const small = await compressImage(raw, 1800, 0.85);
      setPreview(small);
      setOpen(true);
    } catch (er: any) {
      setErr(er.message || 'Could not load photo.');
    }
  };

  const submit = async () => {
    if (!preview) return;
    if (askName && !name.trim()) { setErr('Add your name so we know who shared it.'); return; }
    setBusy(true);
    setErr('');
    try {
      await addFamilyPhoto({
        image: preview,
        caption: caption.trim(),
        uploaderName: name.trim(),
        uploaderId: getUploaderId(),
      });
      if (askName && name.trim()) setCommenterName(name.trim());
      invalidatePhotos();
      setOpen(false);
      setPreview('');
      setCaption('');
      onAdded?.();
    } catch (e: any) {
      setErr(e.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setOpen(false);
    setPreview('');
    setCaption('');
    setErr('');
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-sun"
        onClick={() => fileRef.current?.click()}
      >
        + Add a photo
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFile}
      />

      {open && (
        <div className="memory-lightbox" onClick={(e) => { if (e.target === e.currentTarget) cancel(); }}>
          <div className="add-photo-card" onClick={(e) => e.stopPropagation()}>
            <h3>Share a photo</h3>
            {preview && <img src={preview} alt="" className="add-photo-preview" />}
            {askName && (
              <>
                <label htmlFor="up-name">Your name</label>
                <input
                  id="up-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Hannah"
                />
              </>
            )}
            <label htmlFor="up-caption">A line about the photo <span className="optional">(optional)</span></label>
            <input
              id="up-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Thanksgiving 1985"
            />
            {err && <div className="error-banner">{err}</div>}
            <div className="btn-row">
              <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
                {busy ? 'Sending…' : 'Add to the album'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancel} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

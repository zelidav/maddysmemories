export async function shareRecipe(opts: {
  title: string;
  text: string;
  url?: string;
  photoUrl?: string;
}): Promise<'shared' | 'copied' | 'cancelled'> {
  const { title, text, url, photoUrl } = opts;
  const fullText = url ? `${text}\n\n${url}` : text;

  try {
    if (photoUrl && (navigator as any).canShare) {
      try {
        const blob = await (await fetch(photoUrl)).blob();
        const file = new File([blob], `${title.replace(/[^a-z0-9]+/gi, '-') || 'recipe'}.jpg`, {
          type: blob.type || 'image/jpeg',
        });
        if ((navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({ title, text: fullText, files: [file] });
          return 'shared';
        }
      } catch (err: any) {
        if (err && err.name === 'AbortError') return 'cancelled';
      }
    }
    if (navigator.share) {
      await navigator.share({ title, text: fullText, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(fullText);
    return 'copied';
  } catch (err: any) {
    if (err && err.name === 'AbortError') return 'cancelled';
    throw err;
  }
}

export function fbShareUrl(pageUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
}

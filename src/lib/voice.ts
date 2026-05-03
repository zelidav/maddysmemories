interface VoiceController {
  supported: boolean;
  start(onText: (text: string) => void, baseline?: string): void;
  stop(): void;
  active: boolean;
}

export function makeVoice(): VoiceController {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  let rec: any = null;
  let active = false;
  let baseline = '';
  let cb: (t: string) => void = () => {};

  if (!SR) {
    return {
      supported: false,
      start: () => {},
      stop: () => {},
      get active() { return false; },
    };
  }

  const stop = () => {
    if (!active) return;
    active = false;
    try { rec && rec.stop(); } catch {}
  };

  const start = (onText: (text: string) => void, base = '') => {
    if (active) return;
    cb = onText;
    baseline = base ? base.replace(/\s+$/, '') + ' ' : '';
    rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      cb(baseline + txt);
    };
    rec.onerror = stop;
    rec.onend = stop;
    try { rec.start(); active = true; } catch {}
  };

  return {
    supported: true,
    start,
    stop,
    get active() { return active; },
  };
}

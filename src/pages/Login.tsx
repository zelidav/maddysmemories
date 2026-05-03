import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../lib/api';
import { setAdminToken, setFamilyToken } from '../lib/auth';

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const wantFamily = params.get('family') === '1';
  const next = params.get('next') || (wantFamily ? '/family' : '/');

  const [kind, setKind] = useState<'admin' | 'family'>(wantFamily ? 'family' : 'admin');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const { token } = await login(pw, kind);
      if (kind === 'admin') setAdminToken(token);
      else setFamilyToken(token);
      nav(next, { replace: true });
    } catch (e: any) {
      setErr(e.message || 'Wrong password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-card">
      <h1>Welcome back</h1>
      <p className="muted">Two doors. Same kitchen.</p>

      <div className="role-tabs">
        <button
          type="button"
          className={kind === 'admin' ? 'active' : ''}
          onClick={() => setKind('admin')}
        >
          For Maddy
        </button>
        <button
          type="button"
          className={kind === 'family' ? 'active' : ''}
          onClick={() => setKind('family')}
        >
          For Family
        </button>
      </div>

      <form onSubmit={submit}>
        <label htmlFor="pw">{kind === 'admin' ? "Maddy's password" : 'Family password'}</label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="••••••••"
          autoFocus
        />
        {err && <div className="error-banner">{err}</div>}
        <button className="btn btn-primary btn-large" disabled={busy || !pw}>
          {busy ? 'Opening…' : 'Open the door'}
        </button>
      </form>
    </div>
  );
}

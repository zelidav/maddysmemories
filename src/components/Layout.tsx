import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { role, clearAll } from '../lib/auth';
import FloralAccent from './FloralAccent';

export default function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const r = role();
  const isFamilySection = loc.pathname.startsWith('/family');

  return (
    <>
      <header className="hdr">
        <FloralAccent variant="daffodil" className="hdr-flora hdr-flora-l" />
        <FloralAccent variant="tulip" className="hdr-flora hdr-flora-r" />
        <div className="hdr-inner">
          <NavLink to="/" className="hdr-title">
            <span className="hdr-title-mark" aria-hidden="true">M</span>
            <span className="hdr-title-text">
              <span className="hdr-title-name">Maddy's Memories</span>
              <span className="hdr-title-tag">recipes &amp; stories from grandma's kitchen</span>
            </span>
          </NavLink>
          {r !== 'guest' && (
            <button
              className="btn btn-ghost btn-sign-out"
              onClick={() => { clearAll(); location.href = '/'; }}
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="app-shell">{children}</main>

      {r !== 'guest' && (
        <nav className="bottom-nav" aria-label="primary">
          {r === 'admin' && (
            <>
              <NavLink to="/recipes" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                <FloralAccent variant="tulip-mini" />
                <span className="nav-lbl">Recipes</span>
              </NavLink>
              <NavLink to="/journal" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                <FloralAccent variant="leaf-mini" />
                <span className="nav-lbl">Journal</span>
              </NavLink>
              <NavLink to="/family" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                <FloralAccent variant="daffodil-mini" />
                <span className="nav-lbl">Family</span>
              </NavLink>
            </>
          )}
          {r === 'family' && (
            <NavLink to="/family" className={'nav-item' + (isFamilySection ? ' active' : '')}>
              <FloralAccent variant="daffodil-mini" />
              <span className="nav-lbl">Family Hub</span>
            </NavLink>
          )}
        </nav>
      )}
    </>
  );
}

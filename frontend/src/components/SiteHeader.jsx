import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { getAccessToken } from '../api/client.js';

const CATALOG_ITEMS = [
  { key: 'loops', label: 'Loops', href: '/loops', icon: 'note' },
  { key: 'samples', label: 'Samples', href: '/samples', icon: 'stack' },
  { key: 'drum-kits', label: 'Drum Kits', href: '/drum-kits', icon: 'bars' },
];

function CatalogIcon({ type }) {
  if (type === 'stack') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4 4.5 8 12 12 19.5 8 12 4Z" />
        <path d="M4.5 12 12 16 19.5 12" />
        <path d="M4.5 16 12 20 19.5 16" />
      </svg>
    );
  }

  if (type === 'bars') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 7v10" />
        <path d="M12 4v16" />
        <path d="M18 9v6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="17" r="2.6" />
      <circle cx="18" cy="15" r="2.6" />
      <path d="M11.6 17V6.6L20.6 5v10" />
    </svg>
  );
}

export default function SiteHeader({ active = '', searchContent = null }) {
  const token = getAccessToken();
  const isAuth = Boolean(token);
  const [isCatalogHidden, setIsCatalogHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let ticking = false;

    const syncScrollState = () => {
      const currentScrollY = Math.max(window.scrollY || 0, 0);
      const delta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY <= 20) {
        setIsCatalogHidden(false);
      } else if (Math.abs(delta) >= 8) {
        setIsCatalogHidden(delta > 0);
      }

      lastScrollYRef.current = currentScrollY;
      ticking = false;
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(syncScrollState);
    };

    lastScrollYRef.current = Math.max(window.scrollY || 0, 0);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('catalog-nav-hidden', isCatalogHidden);

    return () => {
      document.body.classList.remove('catalog-nav-hidden');
    };
  }, [isCatalogHidden]);

  return (
    <div className={`site-header-shell ${isCatalogHidden ? 'catalog-nav-hidden' : ''}`}>
      <header className="header">
        <div className="container header-inner">
          <div className="logo">
            <Link to="/">SoundWave</Link>
          </div>

          <div className="search-bar">
            {searchContent || <input type="text" placeholder="Search samples, loops..." />}
          </div>

          <div className="auth-buttons">
            {isAuth ? (
              <div className="auth-user-links">
                <Link to="/upload" className="auth-link auth-link-muted">Upload</Link>
                <Link to="/profile" className="auth-link auth-link-strong">Profile</Link>
              </div>
            ) : (
              <div className="auth-inline-links">
                <Link to="/register" className="auth-link">Sign up</Link>
                <span className="auth-separator" aria-hidden="true">|</span>
                <Link to="/login" className="auth-link">Sign in</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="catalog-nav" aria-label="Catalog">
        <div className="container catalog-nav-inner">
          <div className="catalog-nav-track">
            {CATALOG_ITEMS.map(item => (
              <Link
                key={item.key}
                to={item.href}
                className={`catalog-link ${active === item.key ? 'active' : ''}`}
              >
                <span className="catalog-link-icon">
                  <CatalogIcon type={item.icon} />
                </span>
                <span className="catalog-link-label">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}

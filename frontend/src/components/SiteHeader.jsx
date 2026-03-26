import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { getAccessToken } from '../api/client.js';
import { getMe } from '../api/me.js';

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

export default function SiteHeader({
  active = '',
  searchContent = null,
  showCatalogNav = true,
  showSearch = true,
  showUploadLink = true,
}) {
  const location = useLocation();
  const token = getAccessToken();
  const isAuth = Boolean(token);
  const [isCatalogHidden, setIsCatalogHidden] = useState(false);
  const [me, setMe] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastScrollYRef = useRef(0);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    if (!isAuth) {
      setMe(null);
      setMenuOpen(false);
      return undefined;
    }

    let active = true;

    getMe()
      .then(profile => {
        if (!active) return;
        setMe(profile);
      })
      .catch(() => {
        if (!active) return;
        setMe(null);
      });

    return () => {
      active = false;
    };
  }, [isAuth]);

  useEffect(() => {
    if (!showCatalogNav) {
      setIsCatalogHidden(false);
      return undefined;
    }

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
  }, [showCatalogNav]);

  useEffect(() => {
    if (!showCatalogNav) {
      document.body.classList.remove('catalog-nav-hidden');
      return undefined;
    }

    document.body.classList.toggle('catalog-nav-hidden', isCatalogHidden);

    return () => {
      document.body.classList.remove('catalog-nav-hidden');
    };
  }, [isCatalogHidden, showCatalogNav]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = event => {
      if (!accountMenuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const userName = (me?.username || '').trim() || 'Account';
  const userInitial = userName.charAt(0).toUpperCase() || 'U';
  const accountMenuItems = [
    { href: '/profile', label: 'Profile' },
    { href: '/manage-uploads', label: 'Manage uploads' },
    { href: '/my-downloads', label: 'My downloads' },
  ];
  const headerInnerClassName = [
    'container',
    'header-inner',
    showSearch ? '' : 'without-search',
  ].filter(Boolean).join(' ');

  return (
    <div className={`site-header-shell ${showCatalogNav ? '' : 'without-catalog-nav'} ${isCatalogHidden ? 'catalog-nav-hidden' : ''}`}>
      <header className="header">
        <div className={headerInnerClassName}>
          <div className="logo">
            <Link to="/">SoundWave</Link>
          </div>

          {showSearch ? (
            <div className="search-bar">
              {searchContent || <input type="text" placeholder="Search samples, loops..." />}
            </div>
          ) : null}

          <div className="auth-buttons">
            {isAuth ? (
              <div className="auth-user-links">
                {showUploadLink ? (
                  <Link to="/upload" className="auth-link auth-link-muted">Upload</Link>
                ) : null}
                <div className={`account-menu ${menuOpen ? 'open' : ''}`} ref={accountMenuRef}>
                  <button
                    type="button"
                    className="account-trigger"
                    aria-label="Open account menu"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen(prev => !prev)}
                  >
                    {me?.avatar_url ? (
                      <img src={me.avatar_url} alt={`${userName} avatar`} className="account-trigger-image" />
                    ) : (
                      <span className="account-trigger-fallback">{userInitial}</span>
                    )}
                  </button>

                  <div className="account-dropdown" role="menu" aria-label="Account menu">
                    <div className="account-dropdown-header">
                      <div className="account-dropdown-avatar" aria-hidden="true">
                        {me?.avatar_url ? (
                          <img src={me.avatar_url} alt="" className="account-dropdown-avatar-image" />
                        ) : (
                          <span>{userInitial}</span>
                        )}
                      </div>
                      <div className="account-dropdown-meta">
                        <strong>{userName}</strong>
                        <span>Account</span>
                      </div>
                    </div>

                    <div className="account-dropdown-list">
                      {accountMenuItems.map(item => {
                        const isActive = item.href === '/profile'
                          ? location.pathname === '/profile' || location.pathname.startsWith('/profile/')
                          : location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={`account-dropdown-item ${isActive ? 'active' : ''}`}
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
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

      {showCatalogNav ? (
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
      ) : null}
    </div>
  );
}

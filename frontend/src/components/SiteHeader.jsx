import { Link } from 'react-router-dom';

import { getAccessToken } from '../api/client.js';

export default function SiteHeader({ active = '', searchContent = null }) {
  const token = getAccessToken();
  const isAuth = Boolean(token);

  return (
    <header className="header">
      <div className="logo">
        <Link to="/">SoundWave</Link>
      </div>

      <div className="search-bar">
        {searchContent || <input type="text" placeholder="Search samples, loops..." />}
      </div>

      <nav className="nav-menu">
        <Link to="/samples" className={`nav-link ${active === 'samples' ? 'active' : ''}`}>Samples</Link>
        <Link to="/loops" className={`nav-link ${active === 'loops' ? 'active' : ''}`}>Loops</Link>
        <Link to="/drum-kits" className={`nav-link ${active === 'drum-kits' ? 'active' : ''}`}>Drum Kits</Link>
        {isAuth ? (
          <Link to="/upload" className={`nav-link ${active === 'upload' ? 'active' : ''}`}>Upload</Link>
        ) : null}
      </nav>

      <div className="auth-buttons">
        {isAuth ? (
          <Link to="/profile" className="btn btn-secondary">Profile</Link>
        ) : (
          <div className="auth-inline-links">
            <Link to="/register" className="auth-link">Sign up</Link>
            <span className="auth-separator" aria-hidden="true">|</span>
            <Link to="/login" className="auth-link">Sign in</Link>
          </div>
        )}
      </div>
    </header>
  );
}

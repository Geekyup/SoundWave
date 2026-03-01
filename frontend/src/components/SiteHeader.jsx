import { getAccessToken } from '../api/client.js';

export default function SiteHeader({ active = '', searchContent = null }) {
  const token = getAccessToken();
  const isAuth = Boolean(token);

  return (
    <header className="header">
      <div className="logo">
        <a href="/">SoundWave</a>
      </div>

      <div className="search-bar">
        {searchContent || <input type="text" placeholder="Search samples, loops..." />}
      </div>

      <nav className="nav-menu">
        <a href="/samples" className={`nav-link ${active === 'samples' ? 'active' : ''}`}>Samples</a>
        <a href="/loops" className={`nav-link ${active === 'loops' ? 'active' : ''}`}>Loops</a>
        <a href="/drum-kits" className={`nav-link ${active === 'drum-kits' ? 'active' : ''}`}>Drum Kits</a>
        {isAuth ? (
          <a href="/upload" className={`nav-link ${active === 'upload' ? 'active' : ''}`}>Upload</a>
        ) : null}
      </nav>

      <div className="auth-buttons">
        {isAuth ? (
          <a href="/profile" className="btn btn-secondary">Profile</a>
        ) : (
          <>
            <a href="/login" className="btn btn-secondary">Login</a>
            <a href="/register" className="btn btn-primary">Register</a>
          </>
        )}
      </div>
    </header>
  );
}

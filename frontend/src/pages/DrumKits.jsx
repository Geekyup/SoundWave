import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { listDrumKits } from '../api/drumKits.js';
import { getAccessToken } from '../api/client.js';
import Pagination from '../components/Pagination.jsx';

export default function DrumKits() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [kits, setKits] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const page = searchParams.get('page') || '1';
  const query = searchParams.get('q') || '';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    listDrumKits({
      page,
      ...(query ? { search: query } : {}),
    })
      .then(data => {
        if (!active) return;
        setKits(data.results || []);
        setCount(data.count || 0);
      })
      .catch(() => {
        if (!active) return;
        setKits([]);
        setCount(0);
        setError('Failed to load drum kits.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, query]);

  const hasAuth = Boolean(getAccessToken());

  const handleSearchSubmit = e => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const value = (formData.get('q') || '').toString().trim();
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set('q', value);
    } else {
      next.delete('q');
    }
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="page-wrapper">
      <header className="header">
        <div className="logo">
          <a href="/">SoundWave</a>
        </div>

        <form className="search-bar" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search drum kits..."
          />
        </form>

        <nav className="nav-menu">
          <a href="/samples" className="nav-link">Samples</a>
          <a href="/loops" className="nav-link">Loops</a>
          <a href="/drum-kits" className="nav-link active">Drum Kits</a>
          {hasAuth ? <a href="/upload" className="nav-link">Upload</a> : null}
        </nav>

        <div className="auth-buttons">
          {hasAuth ? (
            <a href="/profile" className="btn btn-secondary">Profile</a>
          ) : (
            <>
              <a href="/login" className="btn btn-secondary">Login</a>
              <a href="/register" className="btn btn-primary">Register</a>
            </>
          )}
        </div>
      </header>

      <div className="content-wrapper">
        <main className="main-content drumkits-main">
          <section className="section">
            <header className="section-header section-header--flex">
              <h2>Drum Kits</h2>
              <span className="drumkits-count">{count} kits</span>
            </header>

            {loading ? (
              <div className="empty-state"><p>Loading drum kits...</p></div>
            ) : null}
            {error ? (
              <div className="empty-state"><p>{error}</p></div>
            ) : null}

            {!loading && !error ? (
              kits.length ? (
                <>
                  <div className="drumkits-grid">
                    {kits.map(kit => (
                      <a href={`/drum-kits/${kit.slug}`} className="drumkit-card" key={kit.id}>
                        <div className="drumkit-cover">
                          {kit.cover_url ? (
                            <img src={kit.cover_url} alt={kit.title} loading="lazy" />
                          ) : (
                            <span className="drumkit-cover-fallback">
                              {kit.title.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="drumkit-card-body">
                          <h3>{kit.title}</h3>
                          <p className="drumkit-meta">
                            {kit.author ? `by ${kit.author}` : 'Unknown author'}
                          </p>
                          <div className="drumkit-card-footer">
                            <span className="drumkit-meta">{kit.files_count} files</span>
                            <span className="drumkit-open">Open kit</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                  <Pagination count={count} />
                </>
              ) : (
                <div className="empty-state">
                  <p>No drum kits uploaded yet.</p>
                </div>
              )
            ) : null}
          </section>
        </main>
      </div>

      <footer className="footer">
        <div className="footer-bottom">
          <p>&copy; 2025 SoundWave. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

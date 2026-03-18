import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { listDrumKits } from '../api/drumKits.js';
import Pagination from '../components/Pagination.jsx';
import SiteHeader from '../components/SiteHeader.jsx';

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
      <SiteHeader
        active="drum-kits"
        searchContent={(
          <form onSubmit={handleSearchSubmit}>
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search drum kits..."
            />
          </form>
        )}
      />

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
                      <Link to={`/drum-kits/${kit.slug}`} className="drumkit-card" key={kit.id}>
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
                            <span className="drumkit-open">{kit.genre_display || kit.genre || 'Other'}</span>
                          </div>
                        </div>
                      </Link>
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

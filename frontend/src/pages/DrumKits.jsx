import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getAccessToken } from '../api/client.js';
import { listDrumKits } from '../api/drumKits.js';
import CatalogPageLayout from '../components/CatalogPageLayout.jsx';
import DrumKitCard from '../components/DrumKitCard.jsx';
import { DrumKitSkeletonGrid } from '../components/LibrarySkeletons.jsx';
import Pagination from '../components/Pagination.jsx';
import { patchSearchParams } from '../utils/searchParams.js';

export default function DrumKits() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState('');
  const [kits, setKits] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isAuthenticated = Boolean(getAccessToken());

  const page = searchParams.get('page') || '1';
  const query = searchParams.get('q') || '';

  useEffect(() => {
    setSearchText(query);
  }, [query]);

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

  const handleSearchSubmit = event => {
    event.preventDefault();
    setSearchParams(
      patchSearchParams(searchParams, {
        q: searchText.trim() || null,
        page: '1',
      }),
      { replace: true },
    );
  };

  return (
    <CatalogPageLayout
      active="drum-kits"
      contentId="catalog"
      mainClassName="drumkits-main"
      searchContent={(
        <form onSubmit={handleSearchSubmit}>
          <input
            type="text"
            name="q"
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Search drum kits..."
          />
        </form>
      )}
    >
      <section className="section">
        <header className="section-header section-header--flex">
          <h2>Drum Kits</h2>
          <span className="drumkits-count">{count} kits</span>
        </header>

        {loading ? (
          <>
            <div className="drumkits-grid">
              <DrumKitSkeletonGrid />
            </div>
            <div className="pagination-slot" aria-hidden="true">
              <div className="pagination-skeleton"></div>
            </div>
          </>
        ) : null}

        {error ? (
          <div className="empty-state"><p>{error}</p></div>
        ) : null}

        {!loading && !error ? (
          kits.length ? (
            <>
              <div className="drumkits-grid">
                {kits.map(kit => (
                  <DrumKitCard
                    key={kit.id}
                    kit={kit}
                    action={isAuthenticated ? (
                      <a
                        href={kit.download_url}
                        className="drumkit-download-btn"
                        title="Download drum kit"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 3v14" />
                          <path d="M7 12l5 5 5-5" />
                          <path d="M5 19h14" />
                        </svg>
                        Download
                      </a>
                    ) : (
                      <Link
                        to="/login"
                        className="drumkit-download-btn auth-required-download"
                        title="Login to download"
                      >
                        Login
                      </Link>
                    )}
                  />
                ))}
              </div>
              <Pagination count={count} isLoading={loading} />
            </>
          ) : (
            <div className="empty-state">
              <p>No drum kits uploaded yet.</p>
            </div>
          )
        ) : null}
      </section>
    </CatalogPageLayout>
  );
}

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getAccessToken } from '../api/client.js';
import { listMyDownloads } from '../api/myDownloads.js';
import CatalogPageLayout from '../components/CatalogPageLayout.jsx';
import DrumKitCard from '../components/DrumKitCard.jsx';
import { DrumKitSkeletonGrid, LoopCardSkeletonList, SampleSquareSkeletonGrid } from '../components/LibrarySkeletons.jsx';
import LoopCard from '../components/LoopCard.jsx';
import { scheduleMediaPlayerInit, stopAllMediaPlayers } from '../media-player/runtime.js';
import Pagination from '../components/Pagination.jsx';
import SampleCard from '../components/SampleCard.jsx';
import { patchSearchParams } from '../utils/searchParams.js';
import { extractKeywordTags, getProfileHref } from '../utils/library.js';

const DOWNLOAD_TABS = [
  { value: 'loop', label: 'Loops' },
  { value: 'sample', label: 'Samples' },
  { value: 'drumkit', label: 'Drum Kits' },
];

export default function MyDownloads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAuthenticated = Boolean(getAccessToken());
  const type = (searchParams.get('type') || 'loop').trim().toLowerCase();
  const activeType = DOWNLOAD_TABS.some(item => item.value === type) ? type : 'loop';
  const page = searchParams.get('page') || '1';

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setCount(0);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    listMyDownloads({
      type: activeType,
      page,
      ...(activeType === 'sample' ? { include_waveform: '1' } : {}),
    })
      .then(data => {
        if (!active) return;
        setItems(data.results || []);
        setCount(data.count || 0);
      })
      .catch(err => {
        if (!active) return;
        setItems([]);
        setCount(0);
        setError(err.message || 'Failed to load downloads.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, activeType, page]);

  useEffect(() => {
    if (activeType === 'drumkit' || !items.length) {
      stopAllMediaPlayers({ destroy: true });
      return;
    }

    scheduleMediaPlayerInit();
  }, [activeType, items.length]);

  const setType = nextType => {
    setSearchParams(
      patchSearchParams(searchParams, {
        type: nextType,
        page: '1',
      }),
      { replace: true },
    );
  };

  const renderLoadingContent = () => {
    if (activeType === 'sample') {
      return <div className="sample-grid samples-grid"><SampleSquareSkeletonGrid /></div>;
    }

    if (activeType === 'drumkit') {
      return <div className="drumkits-grid"><DrumKitSkeletonGrid /></div>;
    }

    return <div className="sample-grid"><LoopCardSkeletonList /></div>;
  };

  if (!isAuthenticated) {
    return (
      <CatalogPageLayout
        active=""
        showCatalogNav={false}
        showSearch={false}
        showUploadLink={false}
        showFooter={false}
        wrapperClassName="downloads-library-page"
        contentClassName="downloads-library-wrapper"
        mainClassName="downloads-library-main"
      >
        <section className="profile-compact-card downloads-library-guard">
          <p className="downloads-library-kicker">Library</p>
          <h1>Log in to view your downloads</h1>
          <p>Your personal download library is available after sign in.</p>
          <Link to="/login" className="btn btn-primary">Login</Link>
        </section>
      </CatalogPageLayout>
    );
  }

  return (
    <CatalogPageLayout
      active=""
      showCatalogNav={false}
      showSearch={false}
      showUploadLink={false}
      showFooter={false}
      wrapperClassName="downloads-library-page"
      contentClassName="downloads-library-wrapper"
      mainClassName="downloads-library-main"
    >
      <section className="downloads-library-header">
        <div className="downloads-library-header-copy">
          <p className="downloads-library-kicker">Library</p>
          <h1>My Downloads</h1>
        </div>
      </section>

      <section className="downloads-library-toolbar">
        <div className="downloads-library-tabs" role="tablist" aria-label="Download types">
          {DOWNLOAD_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              className={`downloads-library-tab ${activeType === tab.value ? 'active' : ''}`}
              onClick={() => setType(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="downloads-library-count">
          {count} items
        </span>
      </section>

      {loading ? (
        <section className="downloads-library-panel">
          {renderLoadingContent()}
          <div className="pagination-slot" aria-hidden="true">
            <div className="pagination-skeleton"></div>
          </div>
        </section>
      ) : null}

      {!loading && error ? (
        <div className="downloads-library-panel empty-state">
          <p>{error}</p>
        </div>
      ) : null}

      {!loading && !error ? (
        <section className="downloads-library-panel">
          {activeType === 'sample' ? (
            items.length ? (
              <div className="sample-grid samples-grid" id="samples-grid">
                {items.map(sample => {
                  const sampleAuthor = sample.author?.trim() || 'Unknown';
                  const sampleAuthorHref = getProfileHref(sample.author);

                  return (
                    <SampleCard
                      key={sample.id}
                      sample={sample}
                      authorName={sampleAuthor}
                      authorHref={sampleAuthorHref}
                      authorLinkTitle={`View ${sampleAuthor} profile`}
                      secondaryAction={(
                        <a
                          href={sample.download_url}
                          className="download-btn-bottom"
                          title="Download sample"
                        >
                          <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </a>
                      )}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <p>No downloaded samples yet.</p>
              </div>
            )
          ) : null}

          {activeType === 'loop' ? (
            items.length ? (
              <div className="sample-grid">
                {items.map(loop => {
                  const loopAuthor = loop.author?.trim() || 'Unknown';
                  const loopAuthorHref = getProfileHref(loop.author);
                  const keywordTags = extractKeywordTags(loop.keywords, 5);

                  return (
                    <LoopCard
                      key={loop.id}
                      loop={loop}
                      authorName={loopAuthor}
                      authorHref={loopAuthorHref}
                      keywordTags={keywordTags}
                      primaryAction={(
                        <a
                          href={loop.download_url}
                          className="download-btn-rect"
                          title="Download loop"
                        >
                          <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
                            <line x1="4" y1="20" x2="20" y2="20" />
                          </svg>
                          Download
                        </a>
                      )}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <p>No downloaded loops yet.</p>
              </div>
            )
          ) : null}

          {activeType === 'drumkit' ? (
            items.length ? (
              <div className="drumkits-grid">
                {items.map(kit => (
                  <DrumKitCard
                    key={kit.id}
                    kit={kit}
                    action={(
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
                    )}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No downloaded drum kits yet.</p>
              </div>
            )
          ) : null}

          {count > 12 ? (
            <Pagination count={count} isLoading={loading} />
          ) : null}
        </section>
      ) : null}
    </CatalogPageLayout>
  );
}
